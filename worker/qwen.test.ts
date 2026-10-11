import { describe, expect, it } from "vitest";
import { AiError, aiProblem } from "./aiError";
import { qwenChat, wantsNoThinking } from "./qwen";
import { qwenError, qwenOk, QWEN_KEY } from "./testkit";

const base = { apiKey: QWEN_KEY, model: "qwen3-vl-plus", prompt: "Say hi" };
const answers = (response: Response | (() => Response | Promise<Response>)) => (async () => (typeof response === "function" ? response() : response)) as unknown as typeof fetch;
const failure = async (promise: Promise<unknown>) => (await promise.then(() => null, error => error)) as AiError;

describe("the request Alibaba receives", () => {
  it("is the OpenAI-style chat request Alibaba documents, with the pictures after the question", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return qwenOk("OK");
    }) as unknown as typeof fetch;

    const answer = await qwenChat({ ...base, images: ["data:image/jpeg;base64,AAAA", "data:image/png;base64,BBBB"], maxTokens: 500, fetch: fetchImpl });

    expect(answer).toBe("OK");
    expect(seen!.url).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");
    expect(seen!.init.method).toBe("POST");
    const headers = new Headers(seen!.init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe(`Bearer ${QWEN_KEY}`);
    expect(JSON.parse(String(seen!.init.body))).toEqual({
      model: "qwen3-vl-plus",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Say hi" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
            { type: "image_url", image_url: { url: "data:image/png;base64,BBBB" } },
          ],
        },
      ],
      max_tokens: 500,
      enable_thinking: false,
    });
  });

  it("sends only a question when there are no pictures", async () => {
    let body: any = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return qwenOk("OK");
    }) as unknown as typeof fetch;
    await qwenChat({ ...base, fetch: fetchImpl });
    expect(body.messages[0].content).toEqual([{ type: "text", text: "Say hi" }]);
    expect(body.max_tokens).toBe(1200);
    expect(body).not.toHaveProperty("temperature");
  });

  it("goes to another address when told to, with or without a closing slash", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (address: string) => {
      urls.push(address);
      return qwenOk("OK");
    }) as unknown as typeof fetch;
    await qwenChat({ ...base, base: "https://abc123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/", fetch: fetchImpl });
    await qwenChat({ ...base, base: "http://127.0.0.1:9999/compatible-mode/v1", fetch: fetchImpl });
    expect(urls).toEqual(["https://abc123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions", "http://127.0.0.1:9999/compatible-mode/v1/chat/completions"]);
  });

  describe("thinking", () => {
    // The newer Qwen3 models think out loud unless told not to. That is slow and dearer, and the bot has no use for it.
    it.each([
      ["qwen3-vl-plus", true],
      ["qwen3-vl-flash", true],
      ["qwen3.8-flash", true],
      ["qwen3.7-flash", true],
      ["Qwen3.5-Plus", true],
      ["qwen-vl-plus", false],
      ["qwen-plus", false],
      ["qwq-32b", false],
      ["qwen3-vl-235b-a22b-thinking", false],
    ])("is switched off for %s: %s", async (model, off) => {
      expect(wantsNoThinking(model)).toBe(off);
      let body: any = null;
      const fetchImpl = (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return qwenOk("OK");
      }) as unknown as typeof fetch;
      await qwenChat({ ...base, model, fetch: fetchImpl });
      if (off) expect(body.enable_thinking).toBe(false);
      else expect(body).not.toHaveProperty("enable_thinking");
    });
  });
});

describe("the answer", () => {
  it("is read from the first choice, trimmed", async () => {
    expect(await qwenChat({ ...base, fetch: answers(qwenOk("  Hello  ")) })).toBe("Hello");
  });

  it("is read from a list of parts too", async () => {
    const parts = new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: [{ type: "text", text: "Hel" }, { type: "text", text: "lo" }] } }] }));
    expect(await qwenChat({ ...base, fetch: answers(parts) })).toBe("Hello");
  });

  it("ignores the model's thinking, which Alibaba keeps in a separate field", async () => {
    const thought = new Response(JSON.stringify({ choices: [{ message: { role: "assistant", reasoning_content: "Let me think…", content: "Answer" } }] }));
    expect(await qwenChat({ ...base, fetch: answers(thought) })).toBe("Answer");
  });

  it("is an error when it is empty or not JSON", async () => {
    expect((await failure(qwenChat({ ...base, fetch: answers(qwenOk("   ")) }))).kind).toBe("bad_answer");
    expect((await failure(qwenChat({ ...base, fetch: answers(new Response(JSON.stringify({ choices: [] }))) }))).kind).toBe("bad_answer");
    expect((await failure(qwenChat({ ...base, fetch: answers(new Response("<html>hi</html>", { status: 200 })) }))).kind).toBe("bad_answer");
  });
});

describe("when Alibaba says no", () => {
  // The status and code strings are the ones in Alibaba's own error-code table.
  it.each([
    ["the key is wrong", 401, "invalid_api_key", "auth"],
    ["the key is wrong (the other spelling)", 401, "InvalidApiKey", "auth"],
    ["the account is overdue", 400, "Arrearage", "credit"],
    ["the free allowance is used up", 403, "AllocationQuota.FreeTierOnly", "credit"],
    ["the quota is used up", 429, "insufficient_quota", "credit"],
    ["the quota is used up (the other spelling)", 429, "Throttling.AllocationQuota", "credit"],
    ["there are too many requests", 429, "limit_requests", "busy"],
    ["there are too many requests at once", 429, "limit_burst_rate", "busy"],
    ["the rate limit is hit", 429, "Throttling.RateQuota", "busy"],
    ["the service is overloaded", 429, "Throttling.ServiceOverloaded", "busy"],
    ["the content check refuses the picture", 400, "data_inspection_failed", "blocked"],
    ["the content check refuses the picture (the other spelling)", 400, "DataInspectionFailed", "blocked"],
    ["the model does not exist", 404, "model_not_found", "model"],
    ["the account may not use the model", 403, "Model.AccessDenied", "model"],
    ["the model was never bought", 403, "AccessDenied.Unpurchased", "model"],
    ["something else goes wrong", 500, "internal_error", "other"],
    ["the answer is a surprise", 403, "SomethingNew", "other"],
  ])("%s", async (_name, status, code, kind) => {
    const error = await failure(qwenChat({ ...base, fetch: answers(qwenError(status, code, "Alibaba says no")) }));
    expect(error).toBeInstanceOf(AiError);
    expect(error.provider).toBe("qwen");
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
  });

  it("explains a picture it cannot read without Alibaba's jargon", async () => {
    const error = await failure(qwenChat({ ...base, fetch: answers(qwenError(400, "InvalidImageFormat", "The input image is in invalid format.")) }));
    expect(error.kind).toBe("other");
    expect(aiProblem(error)).toBe("Alibaba Cloud could not read the photo (its format or size is not accepted)");
  });

  it("reads the flat error shape too: code and message without the wrapper", async () => {
    const flat = new Response(JSON.stringify({ code: "Arrearage", message: "Access denied, please make sure your account is in good standing.", request_id: "abc" }), { status: 400 });
    const error = await failure(qwenChat({ ...base, fetch: answers(flat) }));
    expect(error.kind).toBe("credit");
    expect(error.message).toBe("Access denied, please make sure your account is in good standing.");
  });

  it("calls any 401 a wrong key, even without a code", async () => {
    expect((await failure(qwenChat({ ...base, fetch: answers(new Response("Unauthorized", { status: 401 })) }))).kind).toBe("auth");
  });

  it("copes with an error page that is not JSON", async () => {
    const error = await failure(qwenChat({ ...base, fetch: answers(new Response("Bad gateway", { status: 502 })) }));
    expect(error.kind).toBe("other");
    expect(error.status).toBe(502);
  });

  it("never repeats the key, even if Alibaba or the network does", async () => {
    const leaky = await failure(qwenChat({ ...base, fetch: answers(qwenError(500, "x", `failed for ${QWEN_KEY}`)) }));
    expect(leaky.message).not.toContain(QWEN_KEY);

    const broken = (async () => {
      throw new Error(`connect failed with ${QWEN_KEY}`);
    }) as unknown as typeof fetch;
    const unreachable = await failure(qwenChat({ ...base, fetch: broken }));
    expect(unreachable.kind).toBe("unreachable");
    expect(unreachable.message).not.toContain(QWEN_KEY);
  });
});

describe("when Alibaba is slow", () => {
  it("gives up after the time it was given", async () => {
    const hangs = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    expect((await failure(qwenChat({ ...base, timeoutMs: 20, fetch: hangs }))).kind).toBe("timeout");
  });

  it("treats a cut-off answer as a timeout too", async () => {
    const cut = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    })) as unknown as typeof fetch;
    expect((await failure(qwenChat({ ...base, fetch: cut }))).kind).toBe("timeout");
  });
});

describe("what a person is told", () => {
  const qwenFailure = (kind: AiError["kind"], message = "x") => new AiError(kind, message, undefined, "qwen");

  it("names Alibaba Cloud and says what to do", () => {
    expect(aiProblem(qwenFailure("auth"))).toMatch(/Alibaba Cloud did not accept the API key.*different region.*QWEN_API_KEY/);
    expect(aiProblem(qwenFailure("credit"))).toMatch(/Alibaba Cloud says there is no free allowance or money left.*Free Quota.*Billing.*verify its identity/);
    expect(aiProblem(qwenFailure("model"))).toMatch(/cannot be used with this account.*AI_MODEL/);
    expect(aiProblem(qwenFailure("blocked"))).toMatch(/Alibaba Cloud's own safety check refused this photo or text/);
    expect(aiProblem(qwenFailure("busy"))).toMatch(/Alibaba Cloud is busy right now/);
    expect(aiProblem(qwenFailure("timeout"))).toMatch(/Alibaba Cloud took too long/);
    expect(aiProblem(qwenFailure("unreachable"))).toMatch(/Alibaba Cloud could not be reached/);
  });

  it("never ends with a full stop, so the caller's own full stop does not double up", () => {
    for (const kind of ["auth", "credit", "model", "blocked", "busy", "timeout", "unreachable", "bad_answer"] as const) expect(aiProblem(qwenFailure(kind))).not.toMatch(/[.\s]$/);
  });
});
