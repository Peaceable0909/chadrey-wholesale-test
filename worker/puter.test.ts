import { describe, expect, it } from "vitest";
import { PuterError, puterChat, puterProblem } from "./puter";
import { puterError, puterOk, PUTER_TOKEN } from "./testkit";

const base = { token: PUTER_TOKEN, model: "claude-haiku-5-5", prompt: "Say hi" };
const answers = (response: Response | (() => Response | Promise<Response>)) => (async () => (typeof response === "function" ? response() : response)) as unknown as typeof fetch;
const failure = async (promise: Promise<unknown>) => (await promise.then(() => null, error => error)) as PuterError;

describe("the request Puter receives", () => {
  it("is the same one Puter's own library sends", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return puterOk("OK");
    }) as unknown as typeof fetch;

    const answer = await puterChat({ ...base, images: ["data:image/jpeg;base64,AAAA", "data:image/png;base64,BBBB"], maxTokens: 500, fetch: fetchImpl });

    expect(answer).toBe("OK");
    expect(seen!.url).toBe("https://api.puter.com/drivers/call");
    expect(seen!.init.method).toBe("POST");
    const headers = new Headers(seen!.init.headers);
    expect(headers.get("content-type")).toBe("text/plain;actually=json");
    expect(headers.get("authorization")).toBe(`Bearer ${PUTER_TOKEN}`);
    expect(JSON.parse(String(seen!.init.body))).toEqual({
      interface: "puter-chat-completion",
      driver: "ai-chat",
      method: "complete",
      args: {
        vision: true,
        messages: [{ content: ["Say hi", { image_url: { url: "data:image/jpeg;base64,AAAA" } }, { image_url: { url: "data:image/png;base64,BBBB" } }] }],
        model: "claude-haiku-5-5",
        max_tokens: 500,
        normalize: true,
      },
      auth_token: PUTER_TOKEN,
    });
  });

  it("asks only a question when there are no pictures, and sets no sampling options unless told to", async () => {
    let body: any = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return puterOk("OK");
    }) as unknown as typeof fetch;
    await puterChat({ ...base, fetch: fetchImpl });
    expect(body.args).toEqual({ messages: [{ content: ["Say hi"] }], model: "claude-haiku-5-5", max_tokens: 1200, normalize: true });
    expect(body.args).not.toHaveProperty("vision");
    expect(body.args).not.toHaveProperty("temperature");
  });

  it("goes to another address when told to (the browser tests use a pretend Puter)", async () => {
    let url = "";
    const fetchImpl = (async (address: string) => {
      url = address;
      return puterOk("OK");
    }) as unknown as typeof fetch;
    await puterChat({ ...base, base: "http://127.0.0.1:9999/", fetch: fetchImpl });
    expect(url).toBe("http://127.0.0.1:9999/drivers/call");
  });
});

describe("the answer", () => {
  it("is read from a plain text reply", async () => {
    expect(await puterChat({ ...base, fetch: answers(puterOk("  Hello  ")) })).toBe("Hello");
  });

  it("is read from a list of parts, as some models send it", async () => {
    const parts = new Response(JSON.stringify({ success: true, result: { message: { content: [{ type: "text", text: "Hel" }, { type: "thinking", thinking: "…" }, { type: "text", text: "lo" }] } } }));
    expect(await puterChat({ ...base, fetch: answers(parts) })).toBe("Hello");
  });

  it("is an error when it is empty or not JSON", async () => {
    expect((await failure(puterChat({ ...base, fetch: answers(puterOk("   ")) }))).kind).toBe("bad_answer");
    expect((await failure(puterChat({ ...base, fetch: answers(new Response("<html>hi</html>", { status: 200 })) }))).kind).toBe("bad_answer");
  });
});

describe("when Puter says no", () => {
  it.each([
    ["the token is wrong", 401, "token_auth_failed", "auth"],
    ["the token is not allowed to do this", 403, "forbidden", "auth"],
    ["the allowance is used up", 402, "insufficient_funds", "credit"],
    ["the account needs a paid plan", 402, "subscription_required", "credit"],
    ["there are too many requests", 429, "too_many_requests", "busy"],
    ["something else goes wrong", 500, "internal_error", "other"],
  ])("%s", async (_name, status, code, kind) => {
    const error = await failure(puterChat({ ...base, fetch: answers(puterError(status, code, "Puter says no")) }));
    expect(error).toBeInstanceOf(PuterError);
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
  });

  it("explains that a model for paying users is not a wrong token", async () => {
    const error = await failure(puterChat({ ...base, fetch: answers(puterError(403, "permission_denied", "The model x is only available to subscribers. Please subscribe to access this model.")) }));
    expect(error.kind).toBe("plan");
    expect(puterProblem(error)).toMatch(/paid Puter plan.*AI_MODEL/);
  });

  it("reads both ways Puter has of describing an error: the server's, and the library's nested one", async () => {
    const nested = new Response(JSON.stringify({ success: false, error: { code: "insufficient_funds", message: "No credit" } }), { status: 402 });
    expect((await failure(puterChat({ ...base, fetch: answers(nested) }))).kind).toBe("credit");
    const flat = new Response(JSON.stringify({ error: "No credit", message: "No credit", code: "insufficient_funds" }), { status: 402 });
    const error = await failure(puterChat({ ...base, fetch: answers(flat) }));
    expect(error.kind).toBe("credit");
    expect(error.message).toBe("No credit");
  });

  it("also reads a refusal that arrives with a success status", async () => {
    const response = new Response(JSON.stringify({ success: false, code: "token_auth_failed", message: "Authentication failed" }), { status: 200 });
    expect((await failure(puterChat({ ...base, fetch: answers(response) }))).kind).toBe("auth");
  });

  it("copes with an error page that is not JSON", async () => {
    const error = await failure(puterChat({ ...base, fetch: answers(new Response("Bad gateway", { status: 502 })) }));
    expect(error.kind).toBe("other");
    expect(error.status).toBe(502);
  });

  it("never repeats the token, even if Puter or the network does", async () => {
    const leaky = await failure(puterChat({ ...base, fetch: answers(puterError(500, "x", `failed for ${PUTER_TOKEN}`)) }));
    expect(leaky.message).not.toContain(PUTER_TOKEN);

    const broken = (async () => {
      throw new Error(`connect failed with ${PUTER_TOKEN}`);
    }) as unknown as typeof fetch;
    const unreachable = await failure(puterChat({ ...base, fetch: broken }));
    expect(unreachable.kind).toBe("unreachable");
    expect(unreachable.message).not.toContain(PUTER_TOKEN);
  });
});

describe("when Puter is slow", () => {
  it("gives up after the time it was given", async () => {
    const hangs = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    const error = await failure(puterChat({ ...base, timeoutMs: 20, fetch: hangs }));
    expect(error.kind).toBe("timeout");
  });

  it("treats a cut-off answer as a timeout too", async () => {
    const cut = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    })) as unknown as typeof fetch;
    expect((await failure(puterChat({ ...base, fetch: cut }))).kind).toBe("timeout");
  });
});

describe("what a person is told", () => {
  it("is one plain sentence for each kind of failure", () => {
    expect(puterProblem(new PuterError("auth", "x"))).toMatch(/did not accept the token.*PUTER_AUTH_TOKEN/);
    expect(puterProblem(new PuterError("credit", "x"))).toMatch(/allowance.*used up/);
    expect(puterProblem(new PuterError("plan", "x"))).toMatch(/paid Puter plan/);
    expect(puterProblem(new PuterError("busy", "x"))).toMatch(/busy/);
    expect(puterProblem(new PuterError("timeout", "x"))).toMatch(/too long/);
    expect(puterProblem(new PuterError("unreachable", "x"))).toMatch(/could not be reached/);
    expect(puterProblem(new PuterError("bad_answer", "x"))).toMatch(/could not be used/);
    expect(puterProblem(new PuterError("other", "Model exploded\nbadly"))).toBe("Model exploded badly");
    expect(puterProblem(new Error("boom"))).toBe("something unexpected went wrong");
  });
});
