import type { Env, TelegramMessage, TelegramUpdate } from "./types";

/**
 * A pretend Telegram and a pretend Supabase behind one fetch function, for the tests.
 * It follows the real services closely enough to catch mistakes: wrong keys are refused,
 * duplicate ids and web addresses give Postgres' 23505 error, and missing price columns give PostgREST's PGRST204.
 */

export const TOKEN = "123456:TEST-BOT-TOKEN";
export const SERVICE_KEY = "sb_secret_TEST_SERVICE_KEY";
export const SUPABASE_URL = "https://proj.supabase.co";
export const OWNER = 1001;

export type Row = Record<string, unknown>;

type Options = {
  /** false pretends supabase_product_pricing.sql has not been run. */
  pricingColumns?: boolean;
};

export function createBackend(options: Options = {}) {
  const state = {
    products: new Map<string, Row>(),
    images: [] as Row[],
    storage: new Map<string, { size: number; contentType: string | null; upsert: string | null; cacheControl: string | null }>(),
    sent: [] as Array<{ chat_id: number; text: string; reply_to: number | null }>,
    telegramFiles: new Map<string, { path: string; bytes: Uint8Array }>(),
    requests: [] as Array<{ method: string; url: string; headers: Record<string, string> }>,
    pricingColumns: options.pricingColumns ?? true,
    /** Set to make the next matching Supabase request fail. */
    failNext: null as null | { match: (method: string, path: string) => boolean; status: number; body: Row },
    /** Called before each Telegram file download. Lets a test make the download fail. */
    failDownload: false,
    bucketMissing: false,
  };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  function addTelegramFile(fileId: string, size = 2048, path = `photos/${fileId}.jpg`) {
    state.telegramFiles.set(fileId, { path, bytes: new Uint8Array(size).fill(7) });
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
    if (call[2] === "getFile") {
      const found = state.telegramFiles.get(String(body.file_id));
      return found ? json(200, { ok: true, result: { file_id: body.file_id, file_path: found.path, file_size: found.bytes.length } }) : json(400, { ok: false, description: "Bad Request: wrong file_id" });
    }
    return json(404, { ok: false, description: "unknown method" });
  }

  async function supabase(url: URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value]));
    if (headers.apikey !== SERVICE_KEY) return json(401, { message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." });
    const injected = state.failNext;
    if (injected && injected.match(method, url.pathname)) {
      state.failNext = null;
      return json(injected.status, injected.body);
    }

    if (url.pathname.startsWith("/storage/v1/object/product-images/")) {
      if (state.bucketMissing) return json(404, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
      const path = decodeURIComponent(url.pathname.replace("/storage/v1/object/product-images/", ""));
      if (state.storage.has(path)) return json(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      const bytes = init?.body as ArrayBuffer;
      state.storage.set(path, { size: bytes.byteLength, contentType: headers["content-type"] ?? null, upsert: headers["x-upsert"] ?? null, cacheControl: headers["cache-control"] ?? null });
      return json(200, { Key: `product-images/${path}` });
    }

    if (url.pathname === "/rest/v1/products" && method === "GET") {
      const select = url.searchParams.get("select") ?? "";
      const all = Array.from(state.products.values());
      if (select.startsWith("id,name,category")) return json(200, [...all].reverse().map(row => ({ id: row.id, name: row.name, category: row.category, is_active: row.is_active })));
      if (select === "slug") {
        const prefix = (url.searchParams.get("slug") ?? "").replace(/^ilike\./, "").replace(/%$/, "").toLowerCase();
        return json(200, all.filter(row => String(row.slug).toLowerCase().startsWith(prefix)).map(row => ({ slug: row.slug })));
      }
      if (select.startsWith("id,slug,name")) {
        const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
        const row = state.products.get(id);
        return json(200, row ? [{ id: row.id, slug: row.slug, name: row.name, is_active: row.is_active }] : []);
      }
      return json(400, { message: "unsupported select" });
    }

    if (url.pathname === "/rest/v1/products" && method === "POST") {
      const row = JSON.parse(String(init?.body)) as Row;
      if (!state.pricingColumns && ("price_currency" in row || "price_unit" in row || "price_tiers" in row)) {
        return json(400, { code: "PGRST204", details: null, hint: null, message: "Could not find the 'price_currency' column of 'products' in the schema cache" });
      }
      const id = String(row.id);
      if (state.products.has(id)) return json(409, { code: "23505", details: `Key (id)=(${id}) already exists.`, hint: null, message: 'duplicate key value violates unique constraint "products_pkey"' });
      if (Array.from(state.products.values()).some(existing => existing.slug === row.slug)) {
        return json(409, { code: "23505", details: `Key (slug)=(${String(row.slug)}) already exists.`, hint: null, message: 'duplicate key value violates unique constraint "products_slug_key"' });
      }
      state.products.set(id, { ...row, created_at: new Date().toISOString() });
      return new Response(null, { status: 201 });
    }

    if (url.pathname === "/rest/v1/product_images" && method === "GET") {
      const productId = (url.searchParams.get("product_id") ?? "").replace(/^eq\./, "");
      return json(200, state.images.filter(row => row.product_id === productId).map(row => ({ id: row.id })));
    }

    if (url.pathname === "/rest/v1/product_images" && method === "POST") {
      const row = JSON.parse(String(init?.body)) as Row;
      if (state.images.some(existing => existing.id === row.id)) return json(409, { code: "23505", details: "", hint: null, message: 'duplicate key value violates unique constraint "product_images_pkey"' });
      if (row.is_primary === true && state.images.some(existing => existing.product_id === row.product_id && existing.is_primary === true)) {
        return json(409, { code: "23505", details: "", hint: null, message: 'duplicate key value violates unique constraint "product_images_one_primary_idx"' });
      }
      state.images.push(row);
      return new Response(null, { status: 201 });
    }

    return json(404, { message: `no pretend route for ${method} ${url.pathname}` });
  }

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value]));
    state.requests.push({ method: (init?.method ?? "GET").toUpperCase(), url: url.href, headers });
    if (url.origin === "https://api.telegram.org") return telegram(url, init);
    if (url.origin === SUPABASE_URL) return supabase(url, init);
    return new Response("unexpected host", { status: 502 });
  };

  return { state, fetch: fetchImpl as typeof fetch, addTelegramFile };
}

export type Backend = ReturnType<typeof createBackend>;

export function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset") },
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_WEBHOOK_SECRET: "hook-secret-value",
    TELEGRAM_ALLOWED_USER_IDS: `${OWNER}, 1002`,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY: SERVICE_KEY,
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
