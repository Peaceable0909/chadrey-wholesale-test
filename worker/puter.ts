/*
 * The one Puter call the bot needs: ask an AI model a question, with pictures.
 *
 * Puter (puter.com) lets an app use AI without its own API keys. The AI is paid from the allowance of the Puter
 * account whose token is used, so here that is the shop owner's account. This sends the same request Puter's own
 * JavaScript library sends (POST /drivers/call, interface "puter-chat-completion"). The library itself cannot run
 * inside a Cloudflare Worker, so the request is written out here.
 */

export const PUTER_API = "https://api.puter.com";

/** What went wrong, in terms the bot can explain to a person. */
export type PuterFailure = "auth" | "credit" | "plan" | "busy" | "timeout" | "unreachable" | "bad_answer" | "other";

export class PuterError extends Error {
  constructor(
    readonly kind: PuterFailure,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PuterError";
  }
}

export type PuterChatArgs = {
  token: string;
  model: string;
  /** The question. */
  prompt: string;
  /** Pictures as data addresses ("data:image/jpeg;base64,..."), shown to the model after the question. */
  images?: string[];
  maxTokens?: number;
  temperature?: number;
  /** Gives up after this many milliseconds. */
  timeoutMs?: number;
  /** Defaults to Puter's address. Only the tests change it. */
  base?: string;
  fetch: typeof fetch;
};

type Envelope = {
  success?: boolean;
  result?: { message?: { content?: unknown } };
  message?: { content?: unknown } | string;
  code?: string;
  error?: { code?: string; message?: string } | string;
};

/** The text of an answer. Puter returns a string, or a list of parts when the model's own format is passed through. */
function answerText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map(part => (typeof part === "string" ? part : part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .join("");
}

function failureFor(status: number, code: string, message: string): PuterError {
  const text = message.slice(0, 200);
  // Some models are for paying Puter users only (a 403 "permission_denied"). That is not a wrong token.
  if (code === "permission_denied" || /only available to subscribers/i.test(message)) return new PuterError("plan", text || "That AI model needs a paid Puter plan.", status);
  if (status === 401 || status === 403 || code === "token_auth_failed" || code === "auth_failed") return new PuterError("auth", text || "Puter did not accept the token.", status);
  if (status === 402 || code === "insufficient_funds" || code === "subscription_required") return new PuterError("credit", text || "Puter says the AI allowance is used up.", status);
  if (status === 429 || code === "too_many_requests") return new PuterError("busy", text || "Puter is busy.", status);
  return new PuterError("other", text || `Puter answered with status ${status}.`, status);
}

/** Asks the model and returns its answer as text. Throws a PuterError; its message never contains the token. */
export async function puterChat(args: PuterChatArgs): Promise<string> {
  const { token } = args;
  const scrub = (text: string) => (token ? text.split(token).join("***") : text);

  const content: unknown[] = [args.prompt, ...(args.images ?? []).map(url => ({ image_url: { url } }))];
  const body = {
    interface: "puter-chat-completion",
    driver: "ai-chat",
    method: "complete",
    args: {
      ...(args.images?.length ? { vision: true } : {}),
      messages: [{ content }],
      model: args.model,
      max_tokens: args.maxTokens ?? 1200,
      ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      // Ask for the plain "message.content is a string" shape whatever the model.
      normalize: true,
    },
    auth_token: token,
  };

  let response: Response;
  try {
    response = await args.fetch(`${(args.base ?? PUTER_API).replace(/\/+$/, "")}/drivers/call`, {
      method: "POST",
      headers: { "content-type": "text/plain;actually=json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(args.timeoutMs ?? 20_000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new PuterError("timeout", "Puter took too long to answer.");
    throw new PuterError("unreachable", scrub(`Puter could not be reached: ${error instanceof Error ? error.message : String(error)}`));
  }

  let data: Envelope | null;
  try {
    data = (await response.json()) as Envelope | null;
  } catch (error) {
    // A timeout can also cut the answer off while it is being read.
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new PuterError("timeout", "Puter took too long to answer.");
    data = null;
  }

  const error = data && typeof data.error === "object" && data.error ? data.error : null;
  const code = String(error?.code ?? data?.code ?? "");
  const message = String(error?.message || (typeof data?.error === "string" ? data.error : "") || (typeof data?.message === "string" ? data.message : "") || "");
  if (!response.ok || data?.success === false) throw failureFor(response.status, code, scrub(message));

  const text = answerText(data?.result?.message?.content ?? (typeof data?.message === "object" ? data.message?.content : undefined)).trim();
  if (!text) throw new PuterError("bad_answer", "Puter's answer was empty.", response.status);
  return text;
}

/** One sentence a person can act on, for each kind of failure. */
export function puterProblem(error: unknown): string {
  if (!(error instanceof PuterError)) return "something unexpected went wrong";
  switch (error.kind) {
    case "auth":
      return "Puter did not accept the token (it may be wrong or revoked). Create a new token in your Puter account and replace PUTER_AUTH_TOKEN in Cloudflare";
    case "credit":
      return "your Puter allowance for AI is used up for now (it renews every month)";
    case "plan":
      return "that AI model needs a paid Puter plan, so remove the AI_MODEL setting in Cloudflare or choose another model";
    case "busy":
      return "Puter is busy right now, so try again in a minute";
    case "timeout":
      return "Puter took too long to answer";
    case "unreachable":
      return "Puter could not be reached";
    case "bad_answer":
      return "the AI's answer could not be used";
    default:
      return error.message.replace(/\s+/g, " ").slice(0, 160) || "Puter returned an error";
  }
}
