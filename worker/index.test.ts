import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { handleTelegramRequest } from "./index";
import { storePhoto } from "./photos";
import { baseEnv, createBackend, EXAMPLE_CAPTION, photoUpdate, type Backend } from "./testkit";
import { JPEG_BYTES, createTestEnv, type TestEnv } from "./testEnv";
import type { Env } from "./types";

let test: TestEnv;
let backend: Backend;

beforeAll(async () => {
  test = await createTestEnv();
}, 60_000);
afterAll(() => test?.dispose());
beforeEach(async () => {
  await test.reset();
  backend = createBackend();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

function context() {
  const pending: Promise<unknown>[] = [];
  return { ctx: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) }, settle: () => Promise.all(pending), pending };
}

const env = (overrides: Partial<Env> = {}) => baseEnv({ DB: test.env.DB, PHOTOS: test.env.PHOTOS, ...overrides });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://shop.test/api/telegram", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const withSecret = { "x-telegram-bot-api-secret-token": "hook-secret-value" };
const overrides = () => ({ fetch: backend.fetch, sleep: async () => undefined });
const productCount = async () => Number((await test.env.DB.prepare("SELECT COUNT(*) AS n FROM products").first<{ n: number }>())?.n);

describe("POST /api/telegram", () => {
  it("accepts an update that carries the right secret and saves the product in the background", async () => {
    const { ctx, settle } = context();
    const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 1, caption: EXAMPLE_CAPTION }), withSecret), env(), ctx, overrides());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    await settle();
    expect(await productCount()).toBe(1);
    expect(backend.state.sent).toHaveLength(1);
  });

  it("answers Telegram before the product is saved", async () => {
    const { ctx, pending } = context();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => (release = resolve));
    const slowFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      await gate;
      return backend.fetch(input, init);
    }) as typeof fetch;

    const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 2, caption: EXAMPLE_CAPTION }), withSecret), env(), ctx, { fetch: slowFetch, sleep: async () => undefined });
    expect(response.status).toBe(200);
    expect(await productCount()).toBe(0);

    release();
    await Promise.all(pending);
    expect(await productCount()).toBe(1);
  });

  it("rejects a missing, wrong or partial secret without doing anything", async () => {
    for (const headers of [{}, { "x-telegram-bot-api-secret-token": "nope" }, { "x-telegram-bot-api-secret-token": "hook-secret" }, { "x-telegram-bot-api-secret-token": "hook-secret-value-and-more" }]) {
      const { ctx, pending } = context();
      const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 3, caption: EXAMPLE_CAPTION }), headers), env(), ctx, overrides());
      expect(response.status).toBe(401);
      expect(pending).toHaveLength(0);
    }
    expect(backend.state.requests).toHaveLength(0);
    expect(await productCount()).toBe(0);
  });

  it("refuses everything until the setup is complete, and names what is missing", async () => {
    const { ctx, pending } = context();
    const response = await handleTelegramRequest(post({}, withSecret), env({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_WEBHOOK_SECRET: undefined }), ctx, overrides());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Telegram intake is not set up yet", missing: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"] });
    expect(pending).toHaveLength(0);
  });

  it("also names the shop's database or photo storage when they are not connected (for example on a stripped-down preview)", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post({}, withSecret), env({ DB: undefined as never, PHOTOS: undefined as never }), ctx, overrides());
    expect(response.status).toBe(503);
    expect(((await response.json()) as { missing: string[] }).missing).toEqual(["DB", "PHOTOS"]);
  });

  it("never accepts an empty secret even when none is configured", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post({}, {}), env({ TELEGRAM_WEBHOOK_SECRET: "" }), ctx, overrides());
    expect(response.status).toBe(503);
  });

  it("rejects a body that is not JSON", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post("not json", withSecret), env(), ctx, overrides());
    expect(response.status).toBe(400);
  });

  it("rejects an oversized body", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post({}, { ...withSecret, "content-length": "5000000" }), env(), ctx, overrides());
    expect(response.status).toBe(413);
  });

  it("links to the configured website address, or to the address Telegram called when there is none", async () => {
    for (const [siteUrl, expected] of [
      ["https://shop.example.com/", "https://shop.example.com"],
      [undefined, "https://shop.test"],
    ] as const) {
      backend = createBackend();
      await test.reset();
      const { ctx, settle } = context();
      await handleTelegramRequest(post(photoUpdate(backend, { id: 5, caption: EXAMPLE_CAPTION }), withSecret), env({ SITE_URL: siteUrl }), ctx, overrides());
      await settle();
      expect(backend.state.sent[0].text).toContain(`Review it: ${expected}/admin/products?status=hidden`);
    }
  });

  it("does not let a failure while saving reach Telegram as an error", async () => {
    const { ctx, settle } = context();
    const brokenFetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 4, caption: EXAMPLE_CAPTION }), withSecret), env(), ctx, { fetch: brokenFetch, sleep: async () => undefined });
    expect(response.status).toBe(200);
    await expect(settle()).resolves.toBeDefined();
  });
});

describe("GET /api/telegram", () => {
  it("shows whether the setup is complete without revealing any value", async () => {
    const { ctx } = context();
    const ready = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), env(), ctx);
    expect(await ready.json()).toEqual({ ready: true, missing: [], allowedUsers: 2, ai: false, aiService: null });

    const empty = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), env({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_ALLOWED_USER_IDS: "" }), ctx);
    const body = (await empty.json()) as { ready: boolean; missing: string[]; allowedUsers: number };
    expect(body).toEqual({ ready: false, missing: ["TELEGRAM_BOT_TOKEN"], allowedUsers: 0, ai: false, aiService: null });
  });

  it("says whether AI drafting is switched on, and which service answers, without revealing any key", async () => {
    const { ctx } = context();
    const status = async (extra: Partial<Env>) => {
      const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), env(extra), ctx);
      return response.text();
    };
    const qwen = await status({ QWEN_API_KEY: "qwen-secret-key-value" });
    expect(JSON.parse(qwen)).toMatchObject({ ready: true, ai: true, aiService: "qwen" });
    expect(qwen).not.toContain("qwen-secret-key-value");

    const puter = await status({ PUTER_AUTH_TOKEN: "puter-secret-token-value" });
    expect(JSON.parse(puter)).toMatchObject({ ready: true, ai: true, aiService: "puter" });
    expect(puter).not.toContain("puter-secret-token-value");

    // With both set, Alibaba's Qwen answers.
    expect(JSON.parse(await status({ QWEN_API_KEY: "q-key-1234567", PUTER_AUTH_TOKEN: "p-token-1234567" }))).toMatchObject({ aiService: "qwen" });
  });

  it("is not ready until at least one person is allowed", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), env({ TELEGRAM_ALLOWED_USER_IDS: "" }), ctx);
    expect(((await response.json()) as { ready: boolean }).ready).toBe(false);
  });

  it("does not contain the bot token or the secret", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), env(), ctx);
    const text = await response.text();
    for (const secret of ["TEST-BOT-TOKEN", "hook-secret-value"]) expect(text).not.toContain(secret);
  });
});

describe("the Worker entry point", () => {
  it("rejects other methods on the bot address", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram", { method: "PUT" }), env(), ctx);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });

  it("answers unknown API addresses with 404 and hands every other address to the website files", async () => {
    const { ctx } = context();
    const assets = env({ ASSETS: { fetch: async request => new Response(`asset for ${new URL(request.url).pathname}`) } });
    const missing = await worker.fetch(new Request("https://shop.test/api/other"), assets, ctx);
    expect(missing.status).toBe(404);
    const page = await worker.fetch(new Request("https://shop.test/products"), assets, ctx);
    expect(await page.text()).toBe("asset for /products");
  });

  it("routes /api/telegram to the bot", async () => {
    const { ctx } = context();
    const response = await worker.fetch(new Request("https://shop.test/api/telegram"), env(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: true });
  });

  it("routes the shop's addresses to the shop", async () => {
    const { ctx } = context();
    const catalogue = await worker.fetch(new Request("https://shop.test/api/catalogue/products"), env(), ctx);
    expect(catalogue.status).toBe(200);
    expect(await catalogue.json()).toEqual({ items: [], total: 0 });

    const admin = await worker.fetch(new Request("https://shop.test/api/admin/products"), env(), ctx);
    expect(admin.status).toBe(401);

    const stored = await storePhoto(test.env.PHOTOS, { productId: "11111111-1111-4111-8111-111111111111", imageId: "22222222-2222-4222-8222-222222222222", bytes: JPEG_BYTES.buffer.slice(0) as ArrayBuffer });
    const photo = await worker.fetch(new Request(`https://shop.test/photos/${stored.key}`), env(), ctx);
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/jpeg");
  });

  it("turns a crash anywhere into a polite reply with no details", async () => {
    const { ctx } = context();
    const broken = env({
      DB: {
        prepare: () => {
          throw new Error("secret internal detail");
        },
        batch: async () => {
          throw new Error("secret internal detail");
        },
      } as never,
    });
    const response = await worker.fetch(new Request("https://shop.test/api/catalogue/products"), broken, ctx);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret internal detail");
  });
});

describe("the Cloudflare settings", () => {
  const read = (file: string) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, file), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  const config = read("../wrangler.jsonc");
  const testConfig = read("wrangler.test.jsonc");

  it("connects the shop's database, photo storage and photo resizer", () => {
    expect(config.d1_databases).toMatchObject([{ binding: "DB", database_name: "chadrey-store" }]);
    expect(config.r2_buckets).toMatchObject([{ binding: "PHOTOS", bucket_name: "chadrey-store-photos" }]);
    expect(config.images).toEqual({ binding: "IMAGES" });
    expect(config.assets.binding).toBe("ASSETS");
  });

  it("wakes the Worker only for the addresses that need it, so website files stay free and fast", () => {
    expect(config.assets.run_worker_first.sort()).toEqual(["/api/admin/*", "/api/catalogue/*", "/api/telegram", "/photos/*"]);
    expect(config.assets.run_worker_first).not.toContain("/api/*");
  });

  it("gives branch previews their own database and photo storage, never the real shop's", () => {
    const preview = config.previews;
    expect(preview.d1_databases).toMatchObject([{ binding: "DB" }]);
    expect(preview.r2_buckets).toMatchObject([{ binding: "PHOTOS" }]);
    expect(preview.images).toEqual({ binding: "IMAGES" });
    expect(preview.d1_databases[0].database_id).not.toBe(config.d1_databases[0].database_id);
    expect(preview.d1_databases[0].database_name).not.toBe(config.d1_databases[0].database_name);
    expect(preview.r2_buckets[0].bucket_name).not.toBe(config.r2_buckets[0].bucket_name);
    // The bot has no keys on a preview, on purpose.
    expect(JSON.stringify(preview)).not.toMatch(/TELEGRAM/i);
  });

  it("gives previews the public settings they need to check who is signed in", () => {
    expect(config.vars.SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(config.vars.SUPABASE_PUBLISHABLE_KEY).toMatch(/^sb_publishable_/);
    expect(config.previews.vars).toMatchObject({ SUPABASE_URL: config.vars.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: config.vars.SUPABASE_PUBLISHABLE_KEY });
  });

  it("holds no secret", () => {
    expect(JSON.stringify(config)).not.toMatch(/sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}|bot\d{6,}:/);
  });

  it("uses the same binding names in the tests as on Cloudflare", () => {
    const names = (settings: any) => ({ d1: settings.d1_databases.map((entry: any) => entry.binding).filter((name: string) => name !== "FRESH_DB"), r2: settings.r2_buckets.map((entry: any) => entry.binding) });
    expect(names(testConfig)).toEqual(names(config));
  });
});
