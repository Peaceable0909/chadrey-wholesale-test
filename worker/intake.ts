import { describeParsed, formatAmount, formatResellRange, parseProductMessage, UNCATEGORISED } from "../shared/productMessage";
import { slugOrFallback } from "../shared/slug";
import { canonicalCategory, findSameName, guessCategory, type KnownProduct } from "./category";
import { allowedUserIds, intakeDefaults } from "./config";
import { stableUuid } from "./ids";
import { createSupabase, isMissingColumn, isSlugConflict, SupabaseError, type SupabaseApi } from "./supabaseApi";
import { createTelegram, TELEGRAM_API, TelegramError } from "./telegramApi";
import type { Env, TelegramMessage, TelegramUpdate } from "./types";

export type IntakeDeps = {
  fetch: typeof fetch;
  /** Waits. The tests replace it so they do not really wait. */
  sleep: (ms: number) => Promise<void>;
  /** The website address, for the link in the confirmation message. */
  origin: string;
};

type Telegram = ReturnType<typeof createTelegram>;
type Incoming = { fileId: string; uniqueId: string; mime: string | null; size: number | null };
type Context = { message: TelegramMessage; env: Env; deps: IntakeDeps; telegram: Telegram; say: (text: string) => Promise<void> };

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const DRAFT_ID_LINE = /Draft ID: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

const EXAMPLE = ["100ml Original sugar marshmallow", "48,000 wholesale", "55,000-60,000 Resell"].join("\n");

const HELP = [
  "Send me a photo with the details as its caption, like this:",
  "",
  EXAMPLE,
  "",
  "I save it as a hidden draft. You approve it in Admin > Products > Hidden before shoppers can see it.",
  "",
  'Extras, each on its own line: MOQ 24, #category, or "per carton" after the price.',
  "More photos for a draft: send them together as an album, or reply to my confirmation with the photo.",
].join("\n");

const describe = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

/** What to tell the person when something failed. Never includes keys or addresses. */
export function failureText(error: unknown): string {
  const retry = "Nothing was lost. Please send it again in a minute.";
  if (error instanceof SupabaseError) {
    if (error.status === 401 || error.status === 403) return "⚠️ Supabase refused the key, so nothing was saved. Check SUPABASE_SERVICE_KEY in Cloudflare: it must be the secret or service_role key.";
    if (error.status === 404 && error.where.includes("/storage/")) return "⚠️ The product-images storage bucket was not found in Supabase, so the photo was not saved.";
    if (error.status === 0) return `⚠️ I couldn't reach Supabase. ${retry}`;
    return `⚠️ Supabase returned an error (status ${error.status}). ${retry}`;
  }
  if (error instanceof TelegramError) return `⚠️ ${error.message} ${retry}`;
  return `⚠️ Something went wrong while saving that. ${retry}`;
}

function pickImage(message: TelegramMessage): Incoming | null {
  if (message.photo?.length) {
    const area = (size: { width?: number; height?: number; file_size?: number }) => (size.width ?? 0) * (size.height ?? 0) || size.file_size || 0;
    const best = [...message.photo].sort((a, b) => area(b) - area(a))[0];
    return { fileId: best.file_id, uniqueId: best.file_unique_id, mime: "image/jpeg", size: best.file_size ?? null };
  }
  const document = message.document;
  if (document?.mime_type?.startsWith("image/")) return { fileId: document.file_id, uniqueId: document.file_unique_id, mime: document.mime_type, size: document.file_size ?? null };
  return null;
}

function imageType(telegramPath: string, mime: string | null): { ext: string; contentType: string } {
  const ext = telegramPath.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_TYPES[ext]) return { ext: ext === "jpeg" ? "jpg" : ext, contentType: IMAGE_TYPES[ext] };
  const byMime = Object.entries(IMAGE_TYPES).find(([, type]) => type === mime);
  return byMime ? { ext: byMime[0], contentType: byMime[1] } : { ext: "jpg", contentType: "image/jpeg" };
}

const safeFileId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "photo";

/** Stores one photo for a draft and records it. Returns how many photos the draft has now. */
async function addPhoto(ctx: Context, supabase: SupabaseApi, image: Incoming, target: { productId: string; slug: string; name: string; primary?: boolean }): Promise<number> {
  const { bytes, path } = await ctx.telegram.downloadFile(image.fileId, MAX_PHOTO_BYTES);
  const { ext, contentType } = imageType(path, image.mime);
  const fileId = safeFileId(image.uniqueId);
  const objectPath = `products/${target.slug}/${fileId}.${ext}`;
  const before = target.primary === undefined ? await supabase.countImages(target.productId) : 0;
  await supabase.uploadImage(objectPath, bytes, contentType);
  await supabase.insertImage({
    id: await stableUuid(`image:${target.productId}:${fileId}`),
    product_id: target.productId,
    storage_path: objectPath,
    public_url: supabase.publicImageUrl(objectPath),
    alt_text: `${target.name} product image`,
    sort_order: ctx.message.message_id,
    is_primary: target.primary ?? before === 0,
  });
  return before + 1;
}

async function createDraft(ctx: Context, supabase: SupabaseApi, image: Incoming, caption: string): Promise<void> {
  const { message, env, deps, say } = ctx;
  const parsed = parseProductMessage(caption);
  if (!parsed.name) {
    await say(`I couldn't find a product name in that caption. Put the name on the first line, then the prices:\n\n${EXAMPLE}`);
    return;
  }

  const defaults = intakeDefaults(env);
  const currency = parsed.currency ?? defaults.currency;
  const unit = parsed.unit ?? defaults.unit;
  const moq = parsed.moq ?? defaults.moq;

  // Products already in the shop: used to guess the category and to warn about a repeat. A failure here must not
  // stop the save, except a refused key, which would fail every other step as well.
  const known: KnownProduct[] = await supabase.listProducts().catch(error => {
    if (error instanceof SupabaseError && (error.status === 401 || error.status === 403)) throw error;
    console.error("could not list products", describe(error));
    return [];
  });
  const typedCategory = canonicalCategory(parsed.category, known);
  const guess = typedCategory ? null : guessCategory(parsed.name, known);
  const category = typedCategory ?? guess?.category ?? UNCATEGORISED;
  const same = findSameName(parsed.name, known);

  // The same message always maps to the same product id, so a message Telegram delivers twice is not saved twice.
  const productId = await stableUuid(`product:${message.chat.id}:${message.media_group_id ?? message.message_id}`);
  const existing = await supabase.getProduct(productId);
  let slug = existing?.slug ?? (await supabase.freeSlug(slugOrFallback(parsed.name)));
  let pricingSaved = true;

  if (!existing) {
    const description = describeParsed(parsed);
    const row: Record<string, unknown> = { id: productId, slug, name: parsed.name, description, category, moq, is_active: false };
    const withPrice: Record<string, unknown> =
      parsed.wholesale === null ? row : { ...row, price_currency: currency, price_unit: unit, price_tiers: [{ min_qty: moq, price: parsed.wholesale }] };

    const insert = async (candidate: Record<string, unknown>) => {
      try {
        return await supabase.insertProduct(candidate);
      } catch (error) {
        if (!isSlugConflict(error)) throw error;
        // Someone else took the web address a moment ago: add a short random ending and try once more.
        candidate.slug = `${String(candidate.slug)}-${Math.random().toString(36).slice(2, 6)}`;
        return supabase.insertProduct(candidate);
      }
    };

    try {
      await insert(withPrice);
      slug = String(withPrice.slug);
    } catch (error) {
      if (parsed.wholesale === null || !isMissingColumn(error)) throw error;
      // The price columns do not exist yet (supabase_product_pricing.sql has not been run). Keep the price in the description.
      pricingSaved = false;
      const note = `Wholesale price: ${formatAmount(parsed.wholesale, currency)} per ${unit}`;
      const fallback: Record<string, unknown> = { ...row, description: [note, description].filter(Boolean).join("\n") };
      await insert(fallback);
      slug = String(fallback.slug);
    }
  }

  let photoFailed = false;
  try {
    await addPhoto(ctx, supabase, image, { productId, slug, name: parsed.name, primary: true });
  } catch (error) {
    photoFailed = true;
    console.error("photo failed", describe(error));
  }

  const lines: string[] = [photoFailed ? "⚠️ Saved as a hidden draft, but the photo did not upload. Reply to this message with the photo to add it." : "✅ Saved as a hidden draft", parsed.name];
  lines.push(
    parsed.wholesale !== null
      ? `${formatAmount(parsed.wholesale, currency)} per ${unit} · minimum order ${moq}${pricingSaved ? "" : " (price not saved, see below)"}`
      : `No price yet · minimum order ${moq}`,
  );
  if (parsed.resellLow !== null) lines.push(`Resell range: ${formatResellRange(parsed.resellLow, parsed.resellHigh ?? parsed.resellLow, currency)} (not saved on the product)`);
  lines.push(`Category: ${category}${typedCategory ? "" : guess ? ` (guessed from “${guess.similarTo}”)` : " (set it in admin)"}`);
  for (const warning of parsed.warnings) lines.push(`⚠️ ${warning}`);
  if (same) lines.push(`ℹ️ You already have “${same.name}” (${same.is_active ? "live" : "hidden"}).`);
  if (!pricingSaved) lines.push("⚠️ The price could not be saved because supabase_product_pricing.sql has not been run in Supabase. I put it in the description for now.");
  lines.push("", `Review it: ${deps.origin}/admin/products?status=hidden`, `Draft ID: ${productId}`);
  await say(lines.join("\n"));
}

async function attachToDraft(ctx: Context, supabase: SupabaseApi, image: Incoming, draftId: string): Promise<void> {
  const product = await supabase.getProduct(draftId);
  if (!product) {
    await ctx.say("I couldn't find that draft any more. It may have been deleted.");
    return;
  }
  if (product.is_active) {
    await ctx.say(`“${product.name}” is already live, so I won't change it from chat. Photos can only be added to hidden drafts.`);
    return;
  }
  const count = await addPhoto(ctx, supabase, image, { productId: product.id, slug: product.slug, name: product.name });
  await ctx.say(`📷 Added to “${product.name}”. It now has ${count} ${count === 1 ? "photo" : "photos"}.\n\nDraft ID: ${product.id}`);
}

/** Photos of an album arrive one by one. Only the first carries the caption, so the others find that draft by album id. */
async function attachToAlbum(ctx: Context, supabase: SupabaseApi, image: Incoming): Promise<void> {
  const productId = await stableUuid(`product:${ctx.message.chat.id}:${ctx.message.media_group_id}`);
  let product = null;
  for (let attempt = 0; attempt < 4 && !product; attempt += 1) {
    if (attempt > 0) await ctx.deps.sleep(1500);
    product = await supabase.getProduct(productId);
  }
  if (!product) {
    await ctx.say("I couldn't find the details for that album photo. Put the name and prices in the caption of the first photo.");
    return;
  }
  if (product.is_active) return;
  await addPhoto(ctx, supabase, image, { productId: product.id, slug: product.slug, name: product.name });
}

async function processMessage(ctx: Context): Promise<void> {
  const { message, env, say } = ctx;
  const image = pickImage(message);
  if (!image) {
    const text = (message.text ?? "").trim();
    await say(!text || text.startsWith("/") ? HELP : `I need a photo to go with that. Send the photo and put the details in its caption.\n\n${HELP}`);
    return;
  }
  if (image.size && image.size > MAX_PHOTO_BYTES) {
    await say("That photo is larger than 10 MB. Send it as a normal photo, not as a file.");
    return;
  }

  const supabase = createSupabase(env.SUPABASE_URL ?? "", env.SUPABASE_SERVICE_KEY ?? "", ctx.deps.fetch);
  const reply = message.reply_to_message;
  const draftId = reply?.from?.is_bot ? DRAFT_ID_LINE.exec(reply.text ?? reply.caption ?? "")?.[1] : undefined;
  const caption = (message.caption ?? "").trim();

  if (draftId) return attachToDraft(ctx, supabase, image, draftId.toLowerCase());
  if (caption) return createDraft(ctx, supabase, image, caption);
  if (message.media_group_id) return attachToAlbum(ctx, supabase, image);
  await say("Add the product details as the photo's caption: the name first, then the prices. Send /help for an example.");
}

/** Handles one Telegram update. Never throws: problems are logged and reported back in the chat. */
export async function handleUpdate(update: TelegramUpdate, env: Env, deps: IntakeDeps): Promise<void> {
  const message = update.message;
  if (!message || message.chat?.type !== "private" || !message.from || message.from.is_bot) return;

  const telegram = createTelegram(env.TELEGRAM_BOT_TOKEN ?? "", env.TELEGRAM_API_BASE?.trim() || TELEGRAM_API, deps.fetch);
  const say = async (text: string) => {
    try {
      await telegram.sendMessage(message.chat.id, text, message.message_id);
    } catch (error) {
      console.error("reply failed", describe(error));
    }
  };

  if (!allowedUserIds(env).has(message.from.id)) {
    await say(`Hi! Only the shop team can add products here. Your Telegram ID is ${message.from.id}. Send that number to the shop owner so they can add you.`);
    return;
  }

  try {
    await processMessage({ message, env, deps, telegram, say });
  } catch (error) {
    console.error("intake failed", describe(error));
    await say(failureText(error));
  }
}
