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

/** A small, fast Claude model: plenty for a short description, and it costs a fraction of a cent per product. */
export const DEFAULT_AI_MODEL = "claude-haiku-5-5";

export type AiSettings = { enabled: boolean; model: string };

/** AI drafting is on when the Puter token is set. The model can be changed with AI_MODEL, for example "claude-sonnet-5-5". */
export function aiSettings(env: Env): AiSettings {
  const model = env.AI_MODEL?.trim() ?? "";
  return { enabled: Boolean(env.PUTER_AUTH_TOKEN?.trim()), model: /^[A-Za-z0-9._:/-]{3,80}$/.test(model) ? model : DEFAULT_AI_MODEL };
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
