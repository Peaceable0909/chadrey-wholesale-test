import { GIF_BYTES, JPEG_BYTES, PNG_BYTES, WEBP_BYTES } from "./testEnv";
import type { D1Database, D1PreparedStatement, Env, R2Bucket, TelegramMessage, TelegramUpdate } from "./types";

/**
 * A pretend Telegram, and a pretend Puter (the AI), for the bot's tests. Saving products and photos uses the real (local)
 * database and file storage from testEnv.ts, so only Telegram and Puter are pretended here.
 */

export const TOKEN = "123456:TEST-BOT-TOKEN";
export const PUTER_TOKEN = "puter-test-token-0123456789";
export const OWNER = 1001;

/** One request the pretend Puter received. */
export type PuterCall = { body: any; headers: Record<string, string> };

/** What a well-behaved model answers for the lunch-box photo used in the tests. */
export const AI_ANSWER = {
  name: "Quilted Insulated Lunch Bag",
  short_description: "A quilted two-layer lunch bag with a shoulder strap.",
  description: "A quilted lunch bag with two zip compartments and a padded top handle.\n\nIt is shown in beige, black, pink and blue.\n\n- Two zip compartments\n- Removable shoulder strap",
  category: null as string | null,
  colors: ["beige", "black", "pink", "blue"],
};

/** Puter's success envelope around the model's reply text. */
export const puterOk = (text: string) => new Response(JSON.stringify({ success: true, result: { message: { role: "assistant", content: text } } }), { status: 200, headers: { "content-type": "application/json" } });
/** An error the way Puter's server sends it (see its errorHandler): the message twice, and a short code. */
export const puterError = (status: number, code: string, message: string) => new Response(JSON.stringify({ error: message, message, code }), { status, headers: { "content-type": "application/json" } });

type Row = Record<string, unknown>;

export function createBackend() {
  const state = {
    /** Messages the bot sent. A message the bot later changed shows its newest text. */
    sent: [] as Array<{ chat_id: number; text: string; reply_to: number | null }>,
    /** Every change the bot made to a message it had sent. */
    edits: [] as Array<{ chat_id: number; message_id: number; text: string }>,
    /** Set to make every message change fail. */
    failEdit: false,
    puterCalls: [] as PuterCall[],
    /** What the pretend Puter answers: the model's reply text, or a whole response. Replace it to test failures. */
    puterReply: (async () => JSON.stringify(AI_ANSWER)) as (call: PuterCall) => Response | string | Promise<Response | string>,
    telegramFiles: new Map<string, { path: string; bytes: Uint8Array }>(),
    requests: [] as Array<{ method: string; url: string }>,
    /** Set to make every Telegram file download fail. */
    failDownload: false,
  };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  /** A file of the given size that starts like a real picture of the kind its name says. */
  function addTelegramFile(fileId: string, size = 2048, path = `photos/${fileId}.jpg`, bytes?: Uint8Array) {
    const magic = path.endsWith(".png") ? PNG_BYTES : path.endsWith(".webp") ? WEBP_BYTES : path.endsWith(".gif") ? GIF_BYTES : JPEG_BYTES;
    const content = bytes ?? new Uint8Array(Math.max(size, magic.length)).fill(7);
    if (!bytes) content.set(magic);
    state.telegramFiles.set(fileId, { path, bytes: content });
  }

  async function telegram(url: URL, init?: RequestInit): Promise<Response> {
    const file = /^\/file\/bot([^/]+)\/(.+)$/.exec(url.pathname);
    if (file) {
      if (file[1] !== TOKEN) return json(401, { ok: false });
      if (state.failDownload) return new Response("no", { status: 500 });
      const found = Array.from(state.telegramFiles.values()).find(entry => entry.path === file[2]);
      return found ? new Response(new Uint8Array(found.bytes)) : new Response("missing", { status: 404 });
    }
    const call = /^\/bot([^/]+)\/(\w+)$/.exec(url.pathname);
    if (!call) return json(404, { ok: false });
    if (call[1] !== TOKEN) return json(401, { ok: false, description: "Unauthorized" });
    const body = JSON.parse(String(init?.body ?? "{}")) as Row;
    if (call[2] === "sendMessage") {
      const reply = body.reply_parameters as { message_id?: number } | undefined;
      state.sent.push({ chat_id: Number(body.chat_id), text: String(body.text), reply_to: reply?.message_id ?? null });
      return json(200, { ok: true, result: { message_id: 9000 + state.sent.length } });
    }
    if (call[2] === "editMessageText") {
      if (state.failEdit) return json(400, { ok: false, description: "Bad Request: message can't be edited" });
      const entry = state.sent[Number(body.message_id) - 9001];
      if (!entry) return json(400, { ok: false, description: "Bad Request: message to edit not found" });
      entry.text = String(body.text);
      state.edits.push({ chat_id: Number(body.chat_id), message_id: Number(body.message_id), text: String(body.text) });
      return json(200, { ok: true, result: { message_id: body.message_id } });
    }
    if (call[2] === "getFile") {
      const found = state.telegramFiles.get(String(body.file_id));
      return found ? json(200, { ok: true, result: { file_id: body.file_id, file_path: found.path, file_size: found.bytes.length } }) : json(400, { ok: false, description: "Bad Request: wrong file_id" });
    }
    return json(404, { ok: false, description: "unknown method" });
  }

  async function puter(url: URL, init?: RequestInit): Promise<Response> {
    if (url.pathname !== "/drivers/call") return json(404, { success: false });
    const call: PuterCall = { body: JSON.parse(String(init?.body ?? "{}")), headers: Object.fromEntries(new Headers(init?.headers).entries()) };
    state.puterCalls.push(call);
    if (call.body.auth_token !== PUTER_TOKEN) return puterError(401, "token_auth_failed", "Authentication failed");
    const answer = await state.puterReply(call);
    return typeof answer === "string" ? puterOk(answer) : answer;
  }

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    state.requests.push({ method: (init?.method ?? "GET").toUpperCase(), url: url.href });
    if (url.origin === "https://api.telegram.org") return telegram(url, init);
    if (url.origin === "https://api.puter.com") return puter(url, init);
    return new Response("unexpected host", { status: 502 });
  };

  return { state, fetch: fetchImpl as typeof fetch, addTelegramFile };
}

export type Backend = ReturnType<typeof createBackend>;

/** Settings for the bot. The database and photo storage are stand-ins unless the test passes the real ones. */
export function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset") },
    DB: {} as D1Database,
    PHOTOS: {} as R2Bucket,
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_WEBHOOK_SECRET: "hook-secret-value",
    TELEGRAM_ALLOWED_USER_IDS: `${OWNER}, 1002`,
    DEFAULT_CURRENCY: "NGN",
    DEFAULT_UNIT: "pc",
    DEFAULT_MOQ: "1",
    ...overrides,
  };
}

export function deps(backend: Backend, extra: { sleep?: (ms: number) => Promise<void> } = {}) {
  return { fetch: backend.fetch, sleep: extra.sleep ?? (async () => undefined), origin: "https://shop.test" };
}

export const EXAMPLE_CAPTION = "100ml Original sugar marshmallow\n\n48,000 wholesale\n\n55,000-60,000 Resell";

/**
 * Wraps the database so that one kind of statement fails, to see how the bot copes.
 * `fails` decides by the SQL text; `error` is what the database "says".
 */
export function failingDatabase(db: D1Database, fails: (sql: string) => boolean, error: Error, options: { times?: number } = {}): D1Database & { failures: number } {
  let remaining = options.times ?? Infinity;
  const wrapped = {
    failures: 0,
    prepare(sql: string): D1PreparedStatement {
      const real = db.prepare(sql);
      if (!fails(sql) || remaining <= 0) return real;
      const broken: D1PreparedStatement = {
        bind: () => broken,
        first: async () => {
          remaining -= 1;
          wrapped.failures += 1;
          throw error;
        },
        all: async () => {
          remaining -= 1;
          wrapped.failures += 1;
          throw error;
        },
        run: async () => {
          remaining -= 1;
          wrapped.failures += 1;
          throw error;
        },
      };
      return broken;
    },
    batch: (statements: D1PreparedStatement[]) => db.batch(statements),
  };
  return wrapped as unknown as D1Database & { failures: number };
}

/** Wraps the photo storage so that saving a file fails. */
export function failingBucket(bucket: R2Bucket, error: Error): R2Bucket {
  return { get: key => bucket.get(key), head: key => bucket.head(key), delete: keys => bucket.delete(keys), put: async () => Promise.reject(error) };
}

type PhotoOptions = {
  id: number;
  caption?: string;
  from?: number;
  chat?: number;
  chatType?: string;
  group?: string;
  uniqueId?: string;
  replyToText?: string;
  replyFromBot?: boolean;
  sizes?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size: number }>;
};

/** A photo message as Telegram delivers it: several sizes of the same picture. */
export function photoUpdate(backend: Backend, options: PhotoOptions): TelegramUpdate {
  const unique = options.uniqueId ?? `uniq${options.id}`;
  const sizes = options.sizes ?? [
    { file_id: `small-${options.id}`, file_unique_id: `${unique}s`, width: 90, height: 90, file_size: 1500 },
    { file_id: `big-${options.id}`, file_unique_id: unique, width: 1280, height: 1280, file_size: 180_000 },
  ];
  for (const size of sizes) if (!backend.state.telegramFiles.has(size.file_id)) backend.addTelegramFile(size.file_id, Math.min(size.file_size, 4096));
  const message: TelegramMessage = {
    message_id: options.id,
    from: { id: options.from ?? OWNER, is_bot: false, first_name: "Owner" },
    chat: { id: options.chat ?? options.from ?? OWNER, type: options.chatType ?? "private" },
    photo: sizes,
    ...(options.caption !== undefined ? { caption: options.caption } : {}),
    ...(options.group ? { media_group_id: options.group } : {}),
    ...(options.replyToText ? { reply_to_message: { message_id: 1, from: { is_bot: options.replyFromBot ?? true }, text: options.replyToText } } : {}),
  };
  return { update_id: options.id * 10, message };
}

export function textUpdate(text: string, options: { id?: number; from?: number; chatType?: string; isBot?: boolean } = {}): TelegramUpdate {
  const from = options.from ?? OWNER;
  return { update_id: 1, message: { message_id: options.id ?? 1, from: { id: from, is_bot: options.isBot ?? false }, chat: { id: from, type: options.chatType ?? "private" }, text } };
}
