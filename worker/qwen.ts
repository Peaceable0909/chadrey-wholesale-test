/*
 * The one Qwen call the bot needs: ask an AI model a question, with pictures.
 *
 * Qwen is Alibaba's family of AI models. Alibaba Cloud's "Model Studio" serves them through the same request format the
 * OpenAI chat API uses (POST .../compatible-mode/v1/chat/completions with "Authorization: Bearer <API key>"), so a plain
 * fetch() is all a Cloudflare Worker needs. Keys belong to one region; the default address below is the international
 * (Singapore) one. The AI is paid from the free allowance or the balance of the Alibaba Cloud account that made the key.
 */

import { AiError, answerText, isTimeout, scrubber } from "./aiError";

/** Alibaba's international (Singapore) address for the OpenAI-style API. Alibaba says this older address stays fully functional. */
export const QWEN_API = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

const failed = (kind: AiError["kind"], message: string, status?: number) => new AiError(kind, message, status, "qwen");

export type QwenChatArgs = {
  apiKey: string;
  model: string;
  /** The question. */
  prompt: string;
  /** Pictures as data addresses ("data:image/jpeg;base64,..."), shown to the model after the question. */
  images?: string[];
  maxTokens?: number;
  /** Gives up after this many milliseconds (all attempts together). */
  timeoutMs?: number;
  /** Defaults to Alibaba's international address. */
  base?: string;
  fetch: typeof fetch;
};

type Envelope = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { code?: unknown; type?: unknown; message?: unknown } | string;
  code?: unknown;
  type?: unknown;
  message?: unknown;
};

/**
 * The newer Qwen3 models (Qwen3.5, 3.6, 3.7, 3.8 ...) "think" at length before they answer unless told not to. That is slower, costs
 * more, and this bot does not need it. Models that only think (their name says so) cannot be told, and older models lack the setting.
 */
export const wantsNoThinking = (model: string) => /^qwen3/i.test(model) && !/thinking/i.test(model);

/** Alibaba's errors come as {"error": {"code", "message", "type"}} or flat as {"code", "message"}; read both. */
function readError(data: Envelope | null): { code: string; message: string } {
  const nested = data && typeof data.error === "object" && data.error ? data.error : null;
  return {
    code: String(nested?.code || data?.code || nested?.type || data?.type || ""),
    message: String(nested?.message || (typeof data?.error === "string" ? data.error : "") || data?.message || ""),
  };
}

function failureFor(status: number, code: string, message: string): AiError {
  const kind = code.toLowerCase();
  const text = message.replace(/\s+/g, " ").slice(0, 200);
  // Alibaba's own content check refused the photo or the words.
  if (kind === "data_inspection_failed" || kind === "datainspectionfailed") return failed("blocked", text || "Alibaba's content check refused this.", status);
  if (status === 401 || kind === "invalid_api_key" || kind === "invalidapikey" || kind === "incorrect_api_key") return failed("auth", text || "Alibaba Cloud did not accept the API key.", status);
  // Model Studio has not been switched on for the account yet.
  if (kind === "accessdenied.unpurchased") return failed("plan", text || "Model Studio is not activated for this account.", status);
  // No money, or the free allowance for this model is used up while "Free Quota Only" is on.
  if (kind === "arrearage" || kind === "isv.out_of_service" || kind === "allocationquota.freetieronly") return failed("credit", text || "Alibaba Cloud says there is no allowance or balance left.", status);
  // The same code is used for "free allocated quota exceeded" (money) and for a per-minute cap (wait a little), so the words decide.
  if (kind === "insufficient_quota" || kind === "throttling.allocationquota") return /free/i.test(text) ? failed("credit", text, status) : failed("busy", text || "Alibaba Cloud is busy.", status);
  if (kind === "model_not_found" || kind === "modelnotfound" || kind === "model.accessdenied" || kind === "endpoint.accessdenied") return failed("model", text || "Alibaba Cloud says this account cannot use that model.", status);
  // A "not found" can also mean a wrong or retired address, which has nothing to do with the model.
  if (status === 404) {
    return /model/i.test(`${kind} ${text}`)
      ? failed("model", text, status)
      : failed("other", "Alibaba Cloud answered “not found” for that address. If you set QWEN_API_BASE in Cloudflare, remove it so the built-in address is used", status);
  }
  if (kind.startsWith("invalidimage") || kind === "invalidfile.size") return failed("other", "Alibaba Cloud could not read the photo (its format or size is not accepted).", status);
  if (status === 429 || kind.startsWith("throttling") || kind.startsWith("limit_") || kind === "limitrequests") return failed("busy", text || "Alibaba Cloud is busy.", status);
  // Alibaba's own trouble ("InternalError", "ModelUnavailable": "try again later") passes by itself.
  if (status >= 500) return failed("busy", text || "Alibaba Cloud had a problem.", status);
  return failed("other", text || `Alibaba Cloud answered with status ${status}.`, status);
}

/** Asks the model and returns its answer as text. Throws an AiError; its message never contains the API key. */
export async function qwenChat(args: QwenChatArgs): Promise<string> {
  const { apiKey } = args;
  const scrub = scrubber(apiKey);
  const endsAt = Date.now() + (args.timeoutMs ?? 20_000);

  async function send(thinkingOff: boolean): Promise<{ response: Response; data: Envelope | null }> {
    const body = {
      model: args.model,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: args.prompt }, ...(args.images ?? []).map(url => ({ type: "image_url", image_url: { url } }))],
        },
      ],
      max_tokens: args.maxTokens ?? 1200,
      ...(thinkingOff ? { enable_thinking: false } : {}),
    };

    let response: Response;
    try {
      response = await args.fetch(`${(args.base ?? QWEN_API).replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.max(1000, endsAt - Date.now())),
      });
    } catch (error) {
      if (isTimeout(error)) throw failed("timeout", "Alibaba Cloud took too long to answer.");
      throw failed("unreachable", scrub(`Alibaba Cloud could not be reached: ${error instanceof Error ? error.message : String(error)}`));
    }

    let data: Envelope | null;
    try {
      data = (await response.json()) as Envelope | null;
    } catch (error) {
      // A timeout can also cut the answer off while it is being read.
      if (isTimeout(error)) throw failed("timeout", "Alibaba Cloud took too long to answer.");
      data = null;
    }
    return { response, data };
  }

  let { response, data } = await send(wantsNoThinking(args.model));
  // A Qwen3 model that has no thinking setting says so with a 400: ask again without it, once, if there is time.
  if (response.status === 400 && wantsNoThinking(args.model) && /enable_thinking/i.test(readError(data).message) && endsAt - Date.now() > 3000) {
    ({ response, data } = await send(false));
  }

  // An error is an error whatever the status says: a 200 with an "error" in it is not an answer.
  if (!response.ok || (data && data.error)) {
    const { code, message } = readError(data);
    throw failureFor(response.status, code, scrub(message));
  }

  const text = answerText(data?.choices?.[0]?.message?.content).trim();
  if (!text) throw failed("bad_answer", "Alibaba Cloud's answer was empty.", response.status);
  return text;
}
