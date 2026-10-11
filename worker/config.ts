import type { Env } from "./types";

const REQUIRED = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_KEY", "SUPABASE_URL"] as const;
const UNITS = ["pc", "set", "pair", "pack", "dozen", "carton", "kg", "metre"];

/** Names (never values) of the settings that are still empty. */
export function missingConfig(env: Env): string[] {
  return REQUIRED.filter(name => !env[name]?.trim());
}

/** "123456789, 987654321" → the set of ids. Anything that is not a number is ignored. */
export function allowedUserIds(env: Env): Set<number> {
  const ids = (env.TELEGRAM_ALLOWED_USER_IDS ?? "")
    .split(/[\s,;]+/)
    .map(part => Number(part))
    .filter(value => Number.isSafeInteger(value) && value > 0);
  return new Set(ids);
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
