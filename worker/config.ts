import type { AiProvider } from "./aiError";
import type { Env } from "./types";

const REQUIRED = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"] as const;
const UNITS = ["pc", "set", "pair", "pack", "dozen", "carton", "kg", "metre"];

/** Names (never values) of the settings that are still empty. DB and PHOTOS are the shop's database and photo storage. */
export function missingConfig(env: Env): string[] {
  const missing: string[] = REQUIRED.filter(name => !env[name]?.trim());
  if (!env.DB) missing.push("DB");
  if (!env.PHOTOS) missing.push("PHOTOS");
  return missing;
}

/** "123456789, 987654321" → the set of ids. Anything that is not a number is ignored. */
export function allowedUserIds(env: Env): Set<number> {
  const ids = (env.TELEGRAM_ALLOWED_USER_IDS ?? "")
    .split(/[\s,;]+/)
    .map(part => Number(part))
    .filter(value => Number.isSafeInteger(value) && value > 0);
  return new Set(ids);
}

/** The model each AI service uses unless AI_MODEL says otherwise. Both are small and quick: a draft costs a fraction of a cent. */
export const DEFAULT_AI_MODELS: Record<AiProvider, string> = { qwen: "qwen3-vl-plus", puter: "claude-haiku-5-5" };

export type AiSettings = {
  enabled: boolean;
  /** Which service answers: Alibaba's Qwen when its key is set, otherwise Puter when its token is set. */
  provider: AiProvider | null;
  model: string;
};

/** AI drafting is on when a Qwen key or a Puter token is set. The model can be changed with AI_MODEL. */
export function aiSettings(env: Env): AiSettings {
  const provider: AiProvider | null = env.QWEN_API_KEY?.trim() ? "qwen" : env.PUTER_AUTH_TOKEN?.trim() ? "puter" : null;
  const wanted = env.AI_MODEL?.trim() ?? "";
  return { enabled: provider !== null, provider, model: /^[A-Za-z0-9._:/-]{3,80}$/.test(wanted) ? wanted : DEFAULT_AI_MODELS[provider ?? "qwen"] };
}

/**
 * Where Qwen requests go. Normally nowhere special: Alibaba's international address is built in. QWEN_API_BASE can hold the
 * "API Host" Alibaba shows when a key is made. Only Alibaba's own https addresses are accepted, so a typo cannot send the key
 * somewhere else. QWEN_API_ORIGIN is for the tests, which use a pretend Alibaba.
 */
export function qwenBase(env: Env): string | undefined {
  const test = env.QWEN_API_ORIGIN?.trim();
  if (test) return test;
  const wanted = env.QWEN_API_BASE?.trim();
  if (!wanted) return undefined;
  try {
    // The "API Host" Alibaba shows may come without the https://.
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(wanted) ? wanted : `https://${wanted}`);
    if (url.protocol !== "https:" || !/(^|\.)(aliyuncs|alibabacloud)\.com$/i.test(url.hostname)) return undefined;
    const path = url.pathname.replace(/\/+$/, "");
    const at = path.indexOf("/compatible-mode");
    return `${url.origin}${at >= 0 ? path.slice(0, at) : path}/compatible-mode/v1`;
  } catch {
    return undefined;
  }
}

export type IntakeDefaults = { currency: string; unit: string; moq: number };

export function intakeDefaults(env: Env): IntakeDefaults {
  const currency = env.DEFAULT_CURRENCY?.trim().toUpperCase() ?? "";
  const unit = env.DEFAULT_UNIT?.trim() ?? "";
  const moq = Number.parseInt(env.DEFAULT_MOQ ?? "", 10);
  return {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "NGN",
    unit: UNITS.includes(unit) ? unit : "pc",
    moq: Number.isInteger(moq) && moq >= 1 ? moq : 1,
  };
}

/** Compares two strings without stopping at the first difference, so response time reveals nothing about the secret. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(a)), crypto.subtle.digest("SHA-256", encoder.encode(b))]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < x.length; index += 1) difference |= x[index] ^ y[index];
  return difference === 0;
}
