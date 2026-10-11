/*
 * The one Puter call the bot needs: ask an AI model a question, with pictures.
 *
 * Puter (puter.com) lets an app use AI without its own API keys. The AI is paid from the allowance of the Puter
 * account whose token is used, so here that is the shop owner's account. This sends the same request Puter's own
 * JavaScript library sends (POST /drivers/call, interface "puter-chat-completion"). The library itself cannot run
 * inside a Cloudflare Worker, so the request is written out here.
 */

import { AiError, answerText, isTimeout, scrubber } from "./aiError";

export const PUTER_API = "https://api.puter.com";

const failed = (kind: AiError["kind"], message: string, status?: number) => new AiError(kind, message, status, "puter");

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

function failureFor(status: number, code: string, message: string): AiError {
  const text = message.slice(0, 200);
  // Some models are for paying Puter users only (a 403 "permission_denied"), and some things need a paid plan (a 402
  // "subscription_required", which waiting does not fix). Neither is a wrong token.
  if (code === "permission_denied" || code === "subscription_required" || /only available to subscribers/i.test(message)) return failed("plan", text || "That needs a paid Puter plan.", status);
  // Puter does not let an account use AI until its email address is confirmed (a 403 "account_is_not_verified").
  if (code === "account_is_not_verified" || code === "email_must_be_confirmed") return failed("email", text || "The Puter account's email address is not confirmed.", status);
  if (status === 401 || status === 403 || code === "token_auth_failed" || code === "auth_failed") return failed("auth", text || "Puter did not accept the token.", status);
  if (status === 402 || code === "insufficient_funds") return failed("credit", text || "Puter says the AI allowance is used up.", status);
  if (status === 429 || code === "too_many_requests") return failed("busy", text || "Puter is busy.", status);
  return failed("other", text || `Puter answered with status ${status}.`, status);
}

/** Asks the model and returns its answer as text. Throws an AiError; its message never contains the token. */
export async function puterChat(args: PuterChatArgs): Promise<string> {
  const { token } = args;
  const scrub = scrubber(token);

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
    if (isTimeout(error)) throw failed("timeout", "Puter took too long to answer.");
    throw failed("unreachable", scrub(`Puter could not be reached: ${error instanceof Error ? error.message : String(error)}`));
  }

  let data: Envelope | null;
  try {
    data = (await response.json()) as Envelope | null;
  } catch (error) {
    // A timeout can also cut the answer off while it is being read.
    if (isTimeout(error)) throw failed("timeout", "Puter took too long to answer.");
    data = null;
  }

  const error = data && typeof data.error === "object" && data.error ? data.error : null;
  const code = String(error?.code ?? data?.code ?? "");
  const message = String(error?.message || (typeof data?.error === "string" ? data.error : "") || (typeof data?.message === "string" ? data.message : "") || "");
  if (!response.ok || data?.success === false) throw failureFor(response.status, code, scrub(message));

  const text = answerText(data?.result?.message?.content ?? (typeof data?.message === "object" ? data.message?.content : undefined)).trim();
  if (!text) throw failed("bad_answer", "Puter's answer was empty.", response.status);
  return text;
}
