import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { handleTelegramRequest } from "./index";
import { baseEnv, createBackend, EXAMPLE_CAPTION, photoUpdate, type Backend } from "./testkit";

let backend: Backend;

beforeEach(() => {
  backend = createBackend();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

function context() {
  const pending: Promise<unknown>[] = [];
  return { ctx: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) }, settle: () => Promise.all(pending), pending };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://shop.test/api/telegram", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const withSecret = { "x-telegram-bot-api-secret-token": "hook-secret-value" };
const overrides = () => ({ fetch: backend.fetch, sleep: async () => undefined });

describe("POST /api/telegram", () => {
  it("accepts an update that carries the right secret and saves the product in the background", async () => {
    const { ctx, settle } = context();
    const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 1, caption: EXAMPLE_CAPTION }), withSecret), baseEnv(), ctx, overrides());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    await settle();
    expect(backend.state.products.size).toBe(1);
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

    const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 2, caption: EXAMPLE_CAPTION }), withSecret), baseEnv(), ctx, { fetch: slowFetch, sleep: async () => undefined });
    expect(response.status).toBe(200);
    expect(backend.state.products.size).toBe(0);

    release();
    await Promise.all(pending);
    expect(backend.state.products.size).toBe(1);
  });

  it("rejects a missing, wrong or partial secret without doing anything", async () => {
    for (const headers of [{}, { "x-telegram-bot-api-secret-token": "nope" }, { "x-telegram-bot-api-secret-token": "hook-secret" }, { "x-telegram-bot-api-secret-token": "hook-secret-value-and-more" }]) {
      const { ctx, pending } = context();
      const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 3, caption: EXAMPLE_CAPTION }), headers), baseEnv(), ctx, overrides());
      expect(response.status).toBe(401);
      expect(pending).toHaveLength(0);
    }
    expect(backend.state.requests).toHaveLength(0);
  });

  it("refuses everything until the setup is complete, and names what is missing", async () => {
    const { ctx, pending } = context();
    const env = baseEnv({ SUPABASE_SERVICE_KEY: "", TELEGRAM_WEBHOOK_SECRET: undefined });
    const response = await handleTelegramRequest(post({}, withSecret), env, ctx, overrides());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Telegram intake is not set up yet", missing: ["TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_KEY"] });
    expect(pending).toHaveLength(0);
  });

  it("never accepts an empty secret even when none is configured", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post({}, {}), baseEnv({ TELEGRAM_WEBHOOK_SECRET: "" }), ctx, overrides());
    expect(response.status).toBe(503);
  });

  it("rejects a body that is not JSON", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post("not json", withSecret), baseEnv(), ctx, overrides());
    expect(response.status).toBe(400);
  });

  it("rejects an oversized body", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(post({}, { ...withSecret, "content-length": "5000000" }), baseEnv(), ctx, overrides());
    expect(response.status).toBe(413);
  });

  it("links to the configured website address, or to the address Telegram called when there is none", async () => {
    for (const [siteUrl, expected] of [
      ["https://shop.example.com/", "https://shop.example.com"],
      [undefined, "https://shop.test"],
    ] as const) {
      backend = createBackend();
      const { ctx, settle } = context();
      await handleTelegramRequest(post(photoUpdate(backend, { id: 5, caption: EXAMPLE_CAPTION }), withSecret), baseEnv({ SITE_URL: siteUrl }), ctx, overrides());
      await settle();
      expect(backend.state.sent[0].text).toContain(`Review it: ${expected}/admin/products?status=hidden`);
    }
  });

  it("does not let a failure while saving reach Telegram as an error", async () => {
    const { ctx, settle } = context();
    const brokenFetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const response = await handleTelegramRequest(post(photoUpdate(backend, { id: 4, caption: EXAMPLE_CAPTION }), withSecret), baseEnv(), ctx, { fetch: brokenFetch, sleep: async () => undefined });
    expect(response.status).toBe(200);
    await expect(settle()).resolves.toBeDefined();
  });
});

describe("GET /api/telegram", () => {
  it("shows whether the setup is complete without revealing any value", async () => {
    const { ctx } = context();
    const ready = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), baseEnv(), ctx);
    expect(await ready.json()).toEqual({ ready: true, missing: [], allowedUsers: 2 });

    const empty = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), baseEnv({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_ALLOWED_USER_IDS: "" }), ctx);
    const body = (await empty.json()) as { ready: boolean; missing: string[]; allowedUsers: number };
    expect(body).toEqual({ ready: false, missing: ["TELEGRAM_BOT_TOKEN"], allowedUsers: 0 });
  });

  it("is not ready until at least one person is allowed", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), baseEnv({ TELEGRAM_ALLOWED_USER_IDS: "" }), ctx);
    expect(((await response.json()) as { ready: boolean }).ready).toBe(false);
  });

  it("does not contain the bot token, the secret or the Supabase key", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram"), baseEnv(), ctx);
    const text = await response.text();
    for (const secret of ["TEST-BOT-TOKEN", "hook-secret-value", "TEST_SERVICE_KEY"]) expect(text).not.toContain(secret);
  });
});

describe("the Worker entry point", () => {
  it("rejects other methods", async () => {
    const { ctx } = context();
    const response = await handleTelegramRequest(new Request("https://shop.test/api/telegram", { method: "PUT" }), baseEnv(), ctx);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });

  it("answers unknown API addresses with 404 and hands every other address to the website files", async () => {
    const { ctx } = context();
    const env = baseEnv({ ASSETS: { fetch: async request => new Response(`asset for ${new URL(request.url).pathname}`) } });
    const missing = await worker.fetch(new Request("https://shop.test/api/other"), env, ctx);
    expect(missing.status).toBe(404);
    const page = await worker.fetch(new Request("https://shop.test/products"), env, ctx);
    expect(await page.text()).toBe("asset for /products");
  });

  it("routes /api/telegram to the bot", async () => {
    const { ctx } = context();
    const response = await worker.fetch(new Request("https://shop.test/api/telegram"), baseEnv(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: true });
  });
});
