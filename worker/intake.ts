import { describeParsed, formatAmount, formatResellRange, isUncategorised, parseProductMessage, UNCATEGORISED, type ParsedProductMessage } from "../shared/productMessage";
import { slugOrFallback } from "../shared/slug";
import { canonicalCategory, findSameName, guessCategory, type KnownProduct } from "./category";
import { aiSettings, allowedUserIds, intakeDefaults, type AiSettings } from "./config";
import { checkAi, draftWithAi, type AiDraft } from "./draftAi";
import { HttpError } from "./http";
import { stableUuid } from "./ids";
import { storePhoto } from "./photos";
import { puterProblem } from "./puter";
import { ensureSchema } from "./schema";
import { SlugTakenError, addImage, applyDraftText, countImages, freeSlug, getProduct, insertProduct, knownProducts, productBasics, type ProductInput } from "./store";
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
type Incoming = { fileId: string; uniqueId: string; size: number | null };
type Context = {
  message: TelegramMessage;
  env: Env;
  deps: IntakeDeps;
  telegram: Telegram;
  ai: AiSettings;
  /** Sends a reply. Returns the id of the message that was sent, or null when it could not be sent. */
  say: (text: string) => Promise<number | null>;
  /** Changes a reply sent earlier. Sends a new message instead when that is not possible. */
  edit: (messageId: number | null, text: string) => Promise<void>;
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const DRAFT_ID_LINE = /Draft ID: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
/** How much of the AI's description is shown in the chat. The whole text is on the draft. */
const PREVIEW_CHARACTERS = 500;

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

const HELP_WITH_AI = [
  "Send me a photo of the product. Add what you know in the caption, even just the name and the price, for example:",
  "",
  ["Premium lunch box", "24,000 wholesale"].join("\n"),
  "",
  "I save it as a hidden draft and write the rest (description, category, colours) with AI from the photo. You check and approve it in Admin > Products > Hidden before shoppers can see it.",
  "",
  "The price and the minimum order come only from what you type. Extras, each on its own line: MOQ 24, #category, or \"per carton\" after the price.",
  "More photos for a draft: send them together as an album, or reply to my confirmation with the photo. Send /ai to test the AI, or reply /redo to a draft's message to have the AI try again.",
].join("\n");

const describe = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

/** What to tell the person when something failed. Never includes keys or addresses. */
export function failureText(error: unknown): string {
  const retry = "Nothing was lost. Please send it again in a minute.";
  if (error instanceof TelegramError) return `⚠️ ${error.message} ${retry}`;
  if (error instanceof HttpError && error.status < 500) return `⚠️ ${error.message}`;
  if (/exceeded D1's free tier daily/i.test(describe(error))) {
    return "⚠️ The shop's database has used up today's free allowance, so that was not saved. It starts again at midnight UTC. Please send it again then.";
  }
  return `⚠️ Something went wrong while saving that. ${retry}`;
}

function pickImage(message: TelegramMessage): Incoming | null {
  if (message.photo?.length) {
    const area = (size: { width?: number; height?: number; file_size?: number }) => (size.width ?? 0) * (size.height ?? 0) || size.file_size || 0;
    const best = [...message.photo].sort((a, b) => area(b) - area(a))[0];
    return { fileId: best.file_id, uniqueId: best.file_unique_id, size: best.file_size ?? null };
  }
  const document = message.document;
  if (document?.mime_type?.startsWith("image/")) return { fileId: document.file_id, uniqueId: document.file_unique_id, size: document.file_size ?? null };
  return null;
}

const safeFileId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "photo";

/** Stores one photo for a draft and records it. Returns how many photos the draft has now, and the photo itself. */
async function addPhoto(ctx: Context, image: Incoming, target: { productId: string; name: string; primary?: boolean }, already?: ArrayBuffer): Promise<{ count: number; bytes: ArrayBuffer }> {
  const bytes = already ?? (await ctx.telegram.downloadFile(image.fileId, MAX_PHOTO_BYTES)).bytes;
  // The same Telegram photo always gets the same id, so a message delivered twice does not add the photo twice.
  const imageId = await stableUuid(`image:${target.productId}:${safeFileId(image.uniqueId)}`);
  const stored = await storePhoto(ctx.env.PHOTOS, { productId: target.productId, imageId, bytes });
  await addImage(ctx.env.DB, {
    id: imageId,
    productId: target.productId,
    storagePath: stored.key,
    altText: `${target.name} product image`,
    label: null,
    sortOrder: ctx.message.message_id,
    isPrimary: target.primary,
    contentType: stored.contentType,
    sizeBytes: stored.size,
  });
  return { count: await countImages(ctx.env.DB, target.productId), bytes };
}

/** The names of the shop's categories, without "Uncategorised". */
function categoryNames(known: KnownProduct[]): string[] {
  const seen = new Map<string, string>();
  for (const product of known) {
    const name = product.category.trim();
    if (name && name.toLowerCase() !== UNCATEGORISED.toLowerCase() && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return Array.from(seen.values());
}

/** What goes in the draft's description: the AI's text, then the owner's own extra lines exactly as typed. */
function composeDescription(aiText: string, notes: string[]): string {
  return [aiText, notes.join("\n")].filter(part => part.trim()).join("\n\n").slice(0, 20_000);
}

function preview(text: string): string {
  return text.length <= PREVIEW_CHARACTERS ? text : `${text.slice(0, PREVIEW_CHARACTERS).replace(/\s+\S*$/, "")}…`;
}

const WRITING = ["✨ Writing the description from your photo…"];
const aiDone = (draft: AiDraft) => ["✨ Written by AI from your photo. Please check it before you show it in the store:", draft.short_description, "", preview(draft.description)];
const aiFailed = (error: unknown) => [`ℹ️ I couldn't write the description with AI: ${puterProblem(error)}.`, "The draft is saved as you sent it. Reply /redo to this message to try again."];
const aiSkipped = ["ℹ️ This draft was changed while the AI was writing, so I left its text alone."];

type SavedDraft = { name: string; short_description: string; description: string; category: string };

/**
 * Second step for a draft that was saved at once: asks the AI, fills in the text if the draft is still exactly as saved,
 * and changes the first reply to show the result. Never throws, and never touches the price or the minimum order.
 */
async function finishWithAi(
  ctx: Context,
  args: {
    productId: string;
    sentId: number | null;
    photo: ArrayBuffer;
    parsed: ParsedProductMessage;
    saved: SavedDraft;
    typedCategory: string | null;
    known: KnownProduct[];
    compose: (aiLines: string[], view?: { category: string; categoryNote: string; colors: string[] }) => string;
    categoryNote: string;
  },
): Promise<void> {
  const { env, deps } = ctx;
  let text: string;
  try {
    const draft = await draftWithAi(env, deps.fetch, { ownerName: args.saved.name, notes: args.parsed.notes, categories: categoryNames(args.known), photos: [args.photo] }, { sleep: deps.sleep });
    const category = args.typedCategory ?? draft.category ?? args.saved.category;
    const applied = await applyDraftText(env.DB, args.productId, {
      expected: args.saved,
      set: { short_description: draft.short_description, description: composeDescription(draft.description, args.parsed.notes), category, colors: draft.colors.length ? draft.colors : null },
    });
    text = applied
      ? args.compose(aiDone(draft), { category, categoryNote: !args.typedCategory && draft.category ? " (suggested by AI)" : args.categoryNote, colors: draft.colors })
      : args.compose(aiSkipped);
  } catch (error) {
    console.error("AI drafting failed", describe(error));
    text = args.compose(aiFailed(error));
  }
  await ctx.edit(args.sentId, text);
}

async function createDraft(ctx: Context, image: Incoming, caption: string): Promise<void> {
  const { message, env, deps, say, ai } = ctx;
  const parsed = parseProductMessage(caption);
  const alone = !message.media_group_id;

  // Products already in the shop: used to guess the category and to warn about a repeat. A failure here must not stop the save.
  const known: KnownProduct[] = await knownProducts(env.DB).catch(error => {
    console.error("could not list products", describe(error));
    return [];
  });

  // The same message always maps to the same product id, so a message Telegram delivers twice is not saved twice.
  const productId = await stableUuid(`product:${message.chat.id}:${message.media_group_id ?? message.message_id}`);
  const existing = await productBasics(env.DB, productId);

  let name = (parsed.name || existing?.name || "").slice(0, 200);
  let photoBytes: ArrayBuffer | undefined;
  /** Set when the AI had to come up with the name, so its whole draft is saved together with the product. */
  let drafted: AiDraft | null = null;

  if (!name) {
    // Only the AI can name a product from the photo alone. An album is never named this way: its other photos arrive while the
    // AI is still thinking and would find no draft to join.
    if (!ai.enabled || !alone) {
      await say(`I couldn't find a product name in that caption. Put the name on the first line, then the prices:\n\n${EXAMPLE}`);
      return;
    }
    photoBytes = (await ctx.telegram.downloadFile(image.fileId, MAX_PHOTO_BYTES)).bytes;
    try {
      drafted = await draftWithAi(env, deps.fetch, { ownerName: "", notes: parsed.notes, categories: categoryNames(known), photos: [photoBytes] }, { sleep: deps.sleep });
    } catch (error) {
      console.error("the AI could not name the product", describe(error));
      await say(`I couldn't find a product name in that caption, and the AI could not suggest one: ${puterProblem(error)}.\n\nPut the name on the first line, then the prices:\n\n${EXAMPLE}`);
      return;
    }
    name = drafted.name.slice(0, 200);
  }

  const defaults = intakeDefaults(env);
  const currency = parsed.currency ?? defaults.currency;
  const unit = parsed.unit ?? defaults.unit;
  const moq = parsed.moq ?? defaults.moq;

  const typedCategory = canonicalCategory(parsed.category, known);
  const guess = typedCategory ? null : guessCategory(name, known);
  let category = typedCategory ?? guess?.category ?? UNCATEGORISED;
  let categoryNote = typedCategory ? "" : guess ? ` (guessed from “${guess.similarTo}”)` : " (set it in admin)";
  if (drafted?.category && !typedCategory) {
    category = drafted.category;
    categoryNote = " (suggested by AI)";
  }
  const same = findSameName(name, known);

  let slug = existing?.slug ?? (await freeSlug(env.DB, slugOrFallback(name)));
  const saved: SavedDraft = {
    name,
    short_description: drafted?.short_description ?? "",
    description: (drafted ? composeDescription(drafted.description, parsed.notes) : describeParsed(parsed)).slice(0, 20_000),
    category,
  };

  if (!existing) {
    const input: ProductInput = {
      name,
      short_description: saved.short_description,
      description: saved.description,
      category,
      moq,
      colors: drafted?.colors ?? [],
      sizes: [],
      packaging_options: [],
      customization_options: [],
      option_groups: [],
      price_currency: currency,
      price_unit: unit,
      price_tiers: parsed.wholesale === null ? [] : [{ min_qty: moq, price: parsed.wholesale }],
      is_active: false,
    };
    try {
      await insertProduct(env.DB, { id: productId, slug, input, createdBy: null });
    } catch (error) {
      if (!(error instanceof SlugTakenError)) throw error;
      // Someone else took the web address a moment ago: add a short random ending and try once more.
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      await insertProduct(env.DB, { id: productId, slug, input, createdBy: null });
    }
  }

  let photoFailed = false;
  let photo: ArrayBuffer | null = null;
  try {
    photo = (await addPhoto(ctx, image, { productId, name, primary: true }, photoBytes)).bytes;
  } catch (error) {
    photoFailed = true;
    console.error("photo failed", describe(error));
  }

  const compose = (aiLines: string[], view = { category, categoryNote, colors: drafted?.colors ?? [] }): string => {
    const lines: string[] = [photoFailed ? "⚠️ Saved as a hidden draft, but the photo did not upload. Reply to this message with the photo to add it." : "✅ Saved as a hidden draft", name];
    lines.push(parsed.wholesale !== null ? `${formatAmount(parsed.wholesale, currency)} per ${unit} · minimum order ${moq}` : `No price yet · minimum order ${moq}`);
    if (parsed.resellLow !== null) lines.push(`Resell range: ${formatResellRange(parsed.resellLow, parsed.resellHigh ?? parsed.resellLow, currency)} (not saved on the product)`);
    lines.push(`Category: ${view.category}${view.categoryNote}`);
    if (view.colors.length) lines.push(`Colours: ${view.colors.join(", ")} (seen in the photo)`);
    for (const warning of parsed.warnings) lines.push(`⚠️ ${warning}`);
    if (same) lines.push(`ℹ️ You already have “${same.name}” (${same.is_active ? "live" : "hidden"}).`);
    if (aiLines.length) lines.push("", ...aiLines);
    lines.push("", `Review it: ${deps.origin}/admin/products?status=hidden`, `Draft ID: ${productId}`);
    return lines.join("\n");
  };

  // A draft that is new gets its text written by the AI after the first reply, so the owner is never left waiting and an
  // album's other photos can already join the draft. A draft the AI named is complete already.
  const willDraft = ai.enabled && !drafted && !existing && !photoFailed && photo !== null;
  const sentId = await say(compose(willDraft ? WRITING : drafted ? aiDone(drafted) : []));
  if (willDraft && photo) await finishWithAi(ctx, { productId, sentId, photo, parsed, saved, typedCategory, known, compose, categoryNote });
}

async function attachToDraft(ctx: Context, image: Incoming, draftId: string): Promise<void> {
  const product = await productBasics(ctx.env.DB, draftId);
  if (!product) {
    await ctx.say("I couldn't find that draft any more. It may have been deleted.");
    return;
  }
  if (product.is_active) {
    await ctx.say(`“${product.name}” is already live, so I won't change it from chat. Photos can only be added to hidden drafts.`);
    return;
  }
  const { count } = await addPhoto(ctx, image, { productId: product.id, name: product.name });
  await ctx.say(`📷 Added to “${product.name}”. It now has ${count} ${count === 1 ? "photo" : "photos"}.\n\nDraft ID: ${product.id}`);
}

/** Photos of an album arrive one by one. Only the first carries the caption, so the others find that draft by album id. */
async function attachToAlbum(ctx: Context, image: Incoming): Promise<void> {
  const productId = await stableUuid(`product:${ctx.message.chat.id}:${ctx.message.media_group_id}`);
  let product = null;
  for (let attempt = 0; attempt < 4 && !product; attempt += 1) {
    if (attempt > 0) await ctx.deps.sleep(1500);
    product = await productBasics(ctx.env.DB, productId);
  }
  if (!product) {
    await ctx.say("I couldn't find the details for that album photo. Put the name and prices in the caption of the first photo.");
    return;
  }
  if (product.is_active) return;
  await addPhoto(ctx, image, { productId: product.id, name: product.name });
}

/**
 * The /redo command, sent as a reply to a draft's message: asks the AI again for a draft whose text could not be written
 * (Puter was busy or out of allowance, or AI drafting was switched on later). Only a hidden draft with no AI text yet.
 */
async function redoDraft(ctx: Context): Promise<void> {
  const { env, deps, say } = ctx;
  const reply = ctx.message.reply_to_message;
  const draftId = reply?.from?.is_bot ? DRAFT_ID_LINE.exec(reply.text ?? reply.caption ?? "")?.[1]?.toLowerCase() : undefined;
  if (!draftId) {
    await say("Reply to a draft's message with /redo and I will ask the AI to write its description again.");
    return;
  }
  if (!ctx.ai.enabled) {
    await say("AI drafting is off, so there is nothing to redo. Add your Puter token as the secret PUTER_AUTH_TOKEN in Cloudflare to switch it on.");
    return;
  }

  await ensureSchema(env.DB);
  const product = await getProduct(env.DB, { id: draftId }, { liveOnly: false });
  if (!product) {
    await say("I couldn't find that draft any more. It may have been deleted.");
    return;
  }
  if (product.is_active) {
    await say(`“${product.name}” is already live, so I won't change it from chat.`);
    return;
  }
  if (product.short_description.trim()) {
    await say(`“${product.name}” already has AI-written text. Change it in Admin > Products.`);
    return;
  }
  const cover = product.product_images[0];
  const photo = cover ? await env.PHOTOS.get(cover.storage_path) : null;
  if (!photo) {
    await say(`“${product.name}” has no photo for the AI to look at. Reply to its message with a photo first.\n\nDraft ID: ${product.id}`);
    return;
  }

  // What is in the description now is the owner's own lines, since the AI never wrote there.
  const notes = product.description.split("\n").map(line => line.trim()).filter(Boolean);
  try {
    const known: KnownProduct[] = await knownProducts(env.DB).catch(() => []);
    const draft = await draftWithAi(env, deps.fetch, { ownerName: product.name, notes, categories: categoryNames(known), photos: [await photo.arrayBuffer()] }, { sleep: deps.sleep });
    const category = isUncategorised(product.category) ? (draft.category ?? product.category) : product.category;
    const applied = await applyDraftText(env.DB, product.id, {
      expected: { name: product.name, short_description: product.short_description, description: product.description, category: product.category },
      set: { short_description: draft.short_description, description: composeDescription(draft.description, notes), category, colors: product.colors.length || !draft.colors.length ? null : draft.colors },
    });
    if (!applied) {
      await say(`ℹ️ “${product.name}” was changed while the AI was writing, so I left its text alone.\n\nDraft ID: ${product.id}`);
      return;
    }
    const lines = [`✨ Written by AI from your photo for “${product.name}”. Please check it before you show it in the store:`, draft.short_description, "", preview(draft.description)];
    if (category !== product.category) lines.push("", `Category: ${category} (suggested by AI)`);
    if (!product.colors.length && draft.colors.length) lines.push(`Colours: ${draft.colors.join(", ")} (seen in the photo)`);
    lines.push("", `Draft ID: ${product.id}`);
    await say(lines.join("\n"));
  } catch (error) {
    console.error("AI redo failed", describe(error));
    await say(`ℹ️ I couldn't write the description with AI: ${puterProblem(error)}.\n\nReply /redo to this message to try again.\n\nDraft ID: ${product.id}`);
  }
}

/** The /ai command: says whether AI drafting is on and tries it with a tiny question. */
async function aiCheck(ctx: Context): Promise<void> {
  if (!ctx.ai.enabled) {
    await ctx.say("AI drafting is off. To switch it on, add your Puter token as the secret PUTER_AUTH_TOKEN in Cloudflare (the steps are in the setup guide). Until then I save drafts exactly as you send them.");
    return;
  }
  try {
    const result = await checkAi(ctx.env, ctx.deps.fetch);
    await ctx.say(`✅ AI drafting works.\nModel: ${result.model}\nAnswered in ${result.seconds} s.\n\nSend a photo with just a few words and I will write the rest.`);
  } catch (error) {
    console.error("AI check failed", describe(error));
    await ctx.say(`⚠️ AI drafting is switched on, but ${puterProblem(error)}.\n\nDrafts are still saved exactly as you send them.`);
  }
}

async function processMessage(ctx: Context): Promise<void> {
  const { message, say, ai } = ctx;
  const image = pickImage(message);
  const text = (message.text ?? "").trim();
  if (!image) {
    if (/^\/ai(?:@\w+)?$/i.test(text)) return aiCheck(ctx);
    if (/^\/redo(?:@\w+)?$/i.test(text)) return redoDraft(ctx);
    const help = ai.enabled ? HELP_WITH_AI : HELP;
    await say(!text || text.startsWith("/") ? help : `I need a photo to go with that. Send the photo and put the details in its caption.\n\n${help}`);
    return;
  }
  if (image.size && image.size > MAX_PHOTO_BYTES) {
    await say("That photo is larger than 10 MB. Send it as a normal photo, not as a file.");
    return;
  }

  await ensureSchema(ctx.env.DB);
  const reply = message.reply_to_message;
  const draftId = reply?.from?.is_bot ? DRAFT_ID_LINE.exec(reply.text ?? reply.caption ?? "")?.[1] : undefined;
  const caption = (message.caption ?? "").trim();

  if (draftId) return attachToDraft(ctx, image, draftId.toLowerCase());
  if (caption) return createDraft(ctx, image, caption);
  if (message.media_group_id) return attachToAlbum(ctx, image);
  // A photo on its own, with no words: the AI can name and describe it. Without the AI there is nothing to go on.
  if (ai.enabled) return createDraft(ctx, image, "");
  await say("Add the product details as the photo's caption: the name first, then the prices. Send /help for an example.");
}

/** Handles one Telegram update. Never throws: problems are logged and reported back in the chat. */
export async function handleUpdate(update: TelegramUpdate, env: Env, deps: IntakeDeps): Promise<void> {
  const message = update.message;
  if (!message || message.chat?.type !== "private" || !message.from || message.from.is_bot) return;

  const telegram = createTelegram(env.TELEGRAM_BOT_TOKEN ?? "", env.TELEGRAM_API_BASE?.trim() || TELEGRAM_API, deps.fetch);
  const say = async (text: string): Promise<number | null> => {
    try {
      return await telegram.sendMessage(message.chat.id, text, message.message_id);
    } catch (error) {
      console.error("reply failed", describe(error));
      return null;
    }
  };
  const edit = async (messageId: number | null, text: string): Promise<void> => {
    if (messageId !== null) {
      try {
        await telegram.editMessage(message.chat.id, messageId, text);
        return;
      } catch (error) {
        console.error("could not change a reply", describe(error));
      }
    }
    await say(text);
  };

  if (!allowedUserIds(env).has(message.from.id)) {
    await say(`Hi! Only the shop team can add products here. Your Telegram ID is ${message.from.id}. Send that number to the shop owner so they can add you.`);
    return;
  }

  try {
    await processMessage({ message, env, deps, telegram, ai: aiSettings(env), say, edit });
  } catch (error) {
    console.error("intake failed", describe(error));
    await say(failureText(error));
  }
}
