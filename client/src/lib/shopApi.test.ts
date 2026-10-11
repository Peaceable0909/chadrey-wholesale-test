import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = { token: "token-1" as string | null, refreshed: "token-2" as string | null, refreshCalls: 0 };

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }),
      refreshSession: async () => {
        session.refreshCalls += 1;
        return { data: { session: session.refreshed ? { access_token: session.refreshed } : null } };
      },
    },
  }),
}));

const { ApiError, isStillReferencedError, listParam, shopFetch, shopFetchOrNull } = await import("./shopApi");

type Call = { path: string; init: RequestInit & { headers: Record<string, string> } };
let calls: Call[];
let answer: (call: Call) => Response | Promise<Response>;

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

beforeEach(() => {
  calls = [];
  session.token = "token-1";
  session.refreshed = "token-2";
  session.refreshCalls = 0;
  answer = () => reply(200, { ok: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: Call["init"]) => {
      const call = { path, init };
      calls.push(call);
      return answer(call);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("reading", () => {
  it("asks for JSON and does not send a sign-in for what shoppers see", async () => {
    answer = () => reply(200, { items: [], total: 0 });
    expect(await shopFetch("/api/catalogue/products")).toEqual({ items: [], total: 0 });
    expect(calls[0].path).toBe("/api/catalogue/products");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.headers.accept).toBe("application/json");
    expect(calls[0].init.headers.authorization).toBeUndefined();
  });

  it("treats 'not found' as an answer when asked to", async () => {
    answer = () => reply(404, { error: "That product was not found." });
    expect(await shopFetchOrNull("/api/catalogue/products/nope")).toBeNull();
    await expect(shopFetch("/api/catalogue/products/nope")).rejects.toMatchObject({ status: 404, message: "That product was not found." });
  });

  it("still reports real failures when 'not found' is allowed", async () => {
    answer = () => reply(500, { error: "Something went wrong on our side. Please try again in a minute." });
    await expect(shopFetchOrNull("/api/catalogue/products/x")).rejects.toMatchObject({ status: 500 });
  });
});

describe("changing the shop", () => {
  it("sends the signed-in person's session", async () => {
    await shopFetch("/api/admin/products/bulk", { admin: true, method: "POST", json: { action: "show", ids: ["a"] } });
    expect(calls[0].init.headers.authorization).toBe("Bearer token-1");
    expect(calls[0].init.headers["content-type"]).toBe("application/json");
    expect(calls[0].init.body).toBe(JSON.stringify({ action: "show", ids: ["a"] }));
  });

  it("sends a photo as it is, with its own type", async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    await shopFetch("/api/admin/products/p/photos", { admin: true, method: "POST", body: photo, headers: { "content-type": "image/jpeg" } });
    expect(calls[0].init.body).toBe(photo);
    expect(calls[0].init.headers["content-type"]).toBe("image/jpeg");
  });

  it("does not even ask when nobody is signed in", async () => {
    session.token = null;
    await expect(shopFetch("/api/admin/products", { admin: true })).rejects.toMatchObject({ status: 401, code: "sign_in" });
    expect(calls).toHaveLength(0);
  });

  it("gets a fresh session and tries once more when the first one has just run out", async () => {
    answer = call => (call.init.headers.authorization === "Bearer token-2" ? reply(200, { fine: true }) : reply(401, { error: "Please sign in again.", code: "sign_in" }));
    expect(await shopFetch("/api/admin/me", { admin: true })).toEqual({ fine: true });
    expect(calls.map(call => call.init.headers.authorization)).toEqual(["Bearer token-1", "Bearer token-2"]);
    expect(session.refreshCalls).toBe(1);
  });

  it("gives up when the fresh session is refused too, or cannot be had", async () => {
    answer = () => reply(401, { error: "Please sign in again.", code: "sign_in" });
    await expect(shopFetch("/api/admin/me", { admin: true })).rejects.toMatchObject({ status: 401, code: "sign_in" });
    expect(calls).toHaveLength(2);

    calls.length = 0;
    session.refreshed = null;
    await expect(shopFetch("/api/admin/me", { admin: true })).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
  });

  it("never retries a request that is not about signing in", async () => {
    answer = () => reply(403, { error: "Only shop administrators can change the shop.", code: "not_admin" });
    await expect(shopFetch("/api/admin/me", { admin: true })).rejects.toMatchObject({ status: 403, code: "not_admin" });
    expect(calls).toHaveLength(1);
  });
});

describe("when something goes wrong", () => {
  it("passes on the service's own message and code", async () => {
    answer = () => reply(409, { error: "This product is part of a quote request, so it cannot be deleted. Hide it instead.", code: "in_quote" });
    const error = await shopFetch("/api/admin/products/p", { admin: true, method: "DELETE" }).catch(caught => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "in_quote", message: "This product is part of a quote request, so it cannot be deleted. Hide it instead." });
    expect(isStillReferencedError(error)).toBe(true);
    expect(isStillReferencedError(new Error("x"))).toBe(false);
  });

  it("falls back to a plain sentence when the service sent none", async () => {
    answer = () => reply(429, "");
    await expect(shopFetch("/api/catalogue/products")).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/too many requests/i) });
    answer = () => reply(500, { weird: true });
    await expect(shopFetch("/api/catalogue/products")).rejects.toMatchObject({ status: 500, message: expect.stringMatching(/something went wrong/i) });
  });

  it("recognises a web page where data was expected (nothing is answering that address)", async () => {
    answer = () => new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } });
    await expect(shopFetch("/api/catalogue/products")).rejects.toMatchObject({ status: 502, code: "bad_response" });
  });

  it("says so when the shop cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(shopFetch("/api/catalogue/products")).rejects.toMatchObject({ status: 0, code: "offline", message: expect.stringMatching(/couldn't reach the shop/i) });
  });

  it("gives up on a request that never answers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))),
    );
    const pending = shopFetch("/api/catalogue/products").catch(caught => caught);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await pending).toMatchObject({ status: 0, code: "offline" });
  });
});

describe("lists in addresses", () => {
  it("joins values safely", () => {
    expect(listParam(["a", "b c", "d,e"])).toBe("a,b%20c,d%2Ce");
    expect(listParam([])).toBe("");
  });
});
