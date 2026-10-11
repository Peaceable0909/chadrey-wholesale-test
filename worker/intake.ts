import { describeParsed, formatAmount, formatResellRange, isUncategorised, parseProductMessage, UNCATEGORISED, type ParsedProductMessage } from "../shared/productMessage";
import { slugOrFallback } from "../shared/slug";
import { canonicalCategory, findSameName, guessCategory, type KnownProduct } from "./category";
import { aiProblem, PROVIDER_NAMES } from "./aiError";
import { aiSettings, allowedUserIds, intakeDefaults, type AiSettings } from "./config";
import { checkAi, draftWithAi, type AiDraft } from "./draftAi";
import { cut } from "./draftFilter";
import { HttpError } from "./http";
import { stableUuid } from "./ids";
import { storePhoto } from "./photos";
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
  /** When the bot started on this message (a clock time in milliseconds). The AI is given only what is left of the bot's ~30 seconds. */
  startedAt: number;
  /** Sends a reply. Returns the id of the message that was sent, or null when it could not be sent. */
  say: (text: string) => Promise<number | null>;
  /** Changes a reply sent earlier. Sends a new message instead when that is not possible. */
  edit: (messageId: number | null, text: string) => Promise<void>;
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const DRAFT_ID_LINE = /Draft ID: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
/** How much of the AI's description is shown in the chat. The whole text is on the draft. */
const PREVIEW_CHARACTERS = 500;
/**
 * Telegram lets the bot work for about 30 seconds after it has answered. The AI must be finished by these moments (counted from
 * when the bot started on the message), which leaves time to save its text and change the reply. When the AI names the product
 * itself it goes first and the draft, the photo and the reply still follow, so it gets less.
 */
const AI_DEADLINE_AFTER_SAVE_MS = 26_000;
const AI_DEADLINE_BEFORE_SAVE_MS = 22_000;

/** The id on the LAST "Draft ID:" line of a message. The real line is always last, so text the AI wrote above it can never redirect a photo. */
function lastDraftId(text: string | undefined): string | undefined {
  let found: string | undefined;
  for (const match of (text ?? "").matchAll(DRAFT_ID_LINE)) found = match[1];
  return found?.toLowerCase();
}

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
  "More photos for a draft: send them together as an album, or reply to my confirmation with the photo. Send /ai to test the AI. If a draft's description was not written, reply to its message with the word redo and the AI tries again.",
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
  return text.length <= PREVIEW_CHARACTERS ? text : `${cut(text, PREVIEW_CHARACTERS).replace(/\s+\S*$/, "")}…`;
}

const WRITING = ["✨ Writing the description from your photo… If this message does not change within a minute, reply to it with the word redo."];
const aiDone = (draft: AiDraft) => ["✨ Written by AI from your photo. Please check it before you show it in the store:", draft.short_description, "", preview(draft.description)];
const aiFailed = (error: unknown) => [`ℹ️ I couldn't write the description with AI: ${aiProblem(error)}.`, "The draft is saved as you sent it. To try again, reply to this message with the word redo."];
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
    const draft = await draftWithAi(env, deps.fetch, { ownerName: args.saved.name, notes: args.parsed.notes, categories: categoryNames(args.known), photos: [args.photo] }, { sleep: deps.sleep, deadline: ctx.startedAt + AI_DEADLINE_AFTER_SAVE_MS });
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

  // Without a name there is nothing to save, unless the AI can name it from the photo (only for a photo on its own: the other photos
  // of an album arrive while the AI is still thinking and would find no draft to join). This is checked before anything is read or saved.
  if (!parsed.name && (!ai.enabled || !alone)) {
    await say(`I couldn't find a product name in that caption. Put the name on the first line, then the prices:\n\n${EXAMPLE}`);
    return;
  }

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
    // Only the AI can name a product from the photo alone (see the check above).
    photoBytes = (await ctx.telegram.downloadFile(image.fileId, MAX_PHOTO_BYTES)).bytes;
    try {
      drafted = await draftWithAi(env, deps.fetch, { ownerName: "", notes: parsed.notes, categories: categoryNames(known), photos: [photoBytes] }, { sleep: deps.sleep, deadline: ctx.startedAt + AI_DEADLINE_BEFORE_SAVE_MS });
    } catch (error) {
      console.error("the AI could not name the product", describe(error));
      await say(`I couldn't find a product name in that caption, and the AI could not suggest one: ${aiProblem(error)}.\n\nPut the name on the first line, then the prices:\n\n${EXAMPLE}`);
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

  // Only the delivery that really created the draft asks the AI for its text. When Telegram delivers the same message twice at the
  // same moment, the other one finds the draft already saved and leaves the AI to the first.
  let created = false;
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
      created = (await insertProduct(env.DB, { id: productId, slug, input, createdBy: null })) === "created";
    } catch (error) {
      if (!(error instanceof SlugTakenError)) throw error;
      // Someone else took the web address a moment ago: add a short random ending and try once more.
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      created = (await insertProduct(env.DB, { id: productId, slug, input, createdBy: null })) === "created";
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
  const willDraft = ai.enabled && !drafted && created && !photoFailed && photo !== null;
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
 * Asking again, as a reply to a draft's message ("redo", or /redo): asks the AI once more for a draft whose text could not be
 * written (the service was busy or out of allowance, or AI drafting was switched on later). Only for a hidden draft exactly as the
 * bot saved it, so nothing a person wrote or changed is ever replaced.
 */
async function redoDraft(ctx: Context): Promise<void> {
  const { env, deps, say } = ctx;
  const reply = ctx.message.reply_to_message;
  const draftId = reply?.from?.is_bot ? lastDraftId(reply.text ?? reply.caption) : undefined;
  if (!draftId) {
    await say("Reply to a draft's message with the word redo and I will ask the AI to write its description again.");
    return;
  }
  if (!ctx.ai.enabled) {
    await say("AI drafting is off, so there is nothing to redo. Add your Alibaba Cloud (Qwen) key as the secret QWEN_API_KEY in Cloudflare to switch it on. The setup guide has the steps.");
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
  // Every change made in Admin sets updated_at, so a draft that differs from its first save was edited by a person.
  if (product.updated_at !== product.created_at) {
    await say(`“${product.name}” was edited after I saved it, so I leave its text alone. Change it in Admin > Products.`);
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
    const draft = await draftWithAi(env, deps.fetch, { ownerName: product.name, notes, categories: categoryNames(known), photos: [await photo.arrayBuffer()] }, { sleep: deps.sleep, deadline: ctx.startedAt + AI_DEADLINE_AFTER_SAVE_MS });
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
    await say(`ℹ️ I couldn't write the description with AI: ${aiProblem(error)}.\n\nTo try again, reply to this message with the word redo.\n\nDraft ID: ${product.id}`);
  }
}

/** The /ai command: says whether AI drafting is on, and tests it by showing the AI a small red picture. */
async function aiCheck(ctx: Context): Promise<void> {
  if (!ctx.ai.enabled) {
    await ctx.say("AI drafting is off. To switch it on, add your Alibaba Cloud (Qwen) key as the secret QWEN_API_KEY in Cloudflare (the steps are in the setup guide). Until then I save drafts exactly as you send them.");
    return;
  }
  try {
    const result = await checkAi(ctx.env, ctx.deps.fetch);
    const service = PROVIDER_NAMES[result.provider];
    if (!result.sawPicture) {
      await ctx.say(
        `⚠️ ${service} answered, but not as if it could see the test picture (a red square). It said “${result.answer}”.\n\nModel: ${result.model}\nIf you set AI_MODEL in Cloudflare, check that it names a model that can look at pictures, or remove AI_MODEL to use the standard one.\n\nDrafts are still saved exactly as you send them.`,
      );
      return;
    }
    await ctx.say(`✅ AI drafting works.\nService: ${service}\nModel: ${result.model}\nIt looked at a small test picture and answered “${result.answer}” in ${result.seconds} s.\n\nSend a photo with just a few words and I will write the rest.`);
  } catch (error) {
    console.error("AI check failed", describe(error));
    await ctx.say(`⚠️ AI drafting is switched on, but ${aiProblem(error)}.\n\nDrafts are still saved exactly as you send them.`);
  }
}

async function processMessage(ctx: Context): Promise<void> {
  const { message, say, ai } = ctx;
  const image = pickImage(message);
  const text = (message.text ?? "").trim();
  if (!image) {
    if (/^\/ai(?:@\w+)?$/i.test(text)) return aiCheck(ctx);
    // "/redo" anywhere, or the plain word "redo" as a reply to one of the bot's messages (a "/redo" inside a message turns into a link that cannot reply).
    if (/^\/redo(?:@\w+)?$/i.test(text) || (message.reply_to_message && /^redo[.!]?$/i.test(text))) return redoDraft(ctx);
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
  const draftId = reply?.from?.is_bot ? lastDraftId(reply.text ?? reply.caption) : undefined;
  const caption = (message.caption ?? "").trim();

  if (draftId) return attachToDraft(ctx, image, draftId);
  if (caption) return createDraft(ctx, image, caption);
  if (message.media_group_id) return attachToAlbum(ctx, image);
  // A photo on its own, with no words: the AI can name and describe it. Without the AI there is nothing to go on.
  if (ai.enabled) return createDraft(ctx, image, "");
  await say("Add the product details as the photo's caption: the name first, then the prices. Send /help for an example.");
}

/** Handles one Telegram update. Never throws: problems are logged and reported back in the chat. */
export async function handleUpdate(update: TelegramUpdate, env: Env, deps: IntakeDeps): Promise<void> {
  const startedAt = Date.now();
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
    await processMessage({ message, env, deps, telegram, ai: aiSettings(env), startedAt, say, edit });
  } catch (error) {
    console.error("intake failed", describe(error));
    await say(failureText(error));
  }
}
