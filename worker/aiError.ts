/*
 * What can go wrong when the bot asks an AI service for help, in terms a person can act on. The two services the bot can use
 * (Alibaba Cloud's Qwen, and Puter) report trouble in their own ways; qwen.ts and puter.ts turn that into these kinds.
 */

export type AiProvider = "qwen" | "puter";

export type AiFailure =
  | "auth" // the key or token was not accepted
  | "email" // the account's email address has to be confirmed first
  | "credit" // no free allowance or money left
  | "plan" // needs a paid plan
  | "model" // this account cannot use that model
  | "blocked" // the service's own safety check refused the photo or text
  | "busy" // too many requests at once
  | "timeout"
  | "unreachable"
  | "bad_answer" // the answer came, but could not be used
  | "other";

export class AiError extends Error {
  constructor(
    readonly kind: AiFailure,
    message: string,
    readonly status?: number,
    readonly provider?: AiProvider,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** How a person knows each service. */
export const PROVIDER_NAMES: Record<AiProvider, string> = { qwen: "Alibaba Cloud (Qwen)", puter: "Puter" };

/** The text of an answer. Both services return a string, or a list of parts when the model's own format is passed through. */
export function answerText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map(part => (typeof part === "string" ? part : part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .join("");
}

/** True when a failed request was cut short by its time limit rather than by the other side. */
export function isTimeout(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError";
}

/** Replaces the secret with *** wherever it appears, so a key can never end up in a message, a log line or a chat. */
export const scrubber = (secret: string) => (text: string) => (secret ? text.split(secret).join("***") : text);

/** One sentence a person can act on, for each kind of failure. It has no full stop at the end, so a caller can add its own. */
export function aiProblem(error: unknown): string {
  if (!(error instanceof AiError)) return "something unexpected went wrong";
  const { provider } = error;
  const service = provider ? (provider === "qwen" ? "Alibaba Cloud" : "Puter") : "the AI service";
  switch (error.kind) {
    case "auth":
      if (provider === "qwen") return "Alibaba Cloud did not accept the API key. It may be wrong or deleted, or it was made in a different region. Create a new key in Model Studio (Singapore) and replace QWEN_API_KEY in Cloudflare. If a new key is refused too, add the “API Host” shown when the key is made as the text variable QWEN_API_BASE";
      if (provider === "puter") return "Puter did not accept the token (it may be wrong or revoked). Create a new token in your Puter account and replace PUTER_AUTH_TOKEN in Cloudflare";
      return "the AI service did not accept its key";
    case "email":
      return `${service} wants the email address of that account confirmed before it allows AI. Sign in there, confirm the email, then try again`;
    case "credit":
      if (provider === "qwen") return "Alibaba Cloud says the free allowance for this is used up, or the account has no money left. In its console open the Free Quota page and Billing (a new account has to verify its identity before it can add money)";
      return "your Puter allowance for AI is used up for now. It resets next month, or you can add credit in your Puter account";
    case "plan":
      if (provider === "qwen") return "Alibaba Cloud says Model Studio is not switched on for this account yet. Open Model Studio in the Alibaba Cloud console, agree to its terms to activate it, then try again";
      return "Puter says this needs a paid Puter plan, and waiting will not change that. If you set AI_MODEL in Cloudflare, remove it or choose another model; otherwise upgrade the Puter account";
    case "model":
      return "that AI model cannot be used with this account. Remove the AI_MODEL setting in Cloudflare to use the standard one, or choose another model";
    case "blocked":
      return `${service}'s own safety check refused this photo or text, so try a different photo`;
    case "busy":
      return `${service} is busy right now, so try again in a minute`;
    case "timeout":
      return `${service} took too long to answer`;
    case "unreachable":
      return `${service} could not be reached`;
    case "bad_answer":
      return "the AI's answer could not be used";
    default:
      return error.message.replace(/\s+/g, " ").replace(/[.\s]+$/, "").slice(0, 160) || `${service} returned an error`;
  }
}
