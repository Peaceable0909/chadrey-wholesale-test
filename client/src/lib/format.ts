const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  THB: "฿",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
};

export function currencySymbol(code: string): string {
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? `${upper} `;
}

/**
 * Formats an amount with a fixed symbol per currency ("₦12,500", "$12.50", "฿450").
 * Intl's currency style prints "NGN 12,500.00" in most locales, so the symbol is set explicitly.
 */
export function formatMoney(amount: number, currency = "NGN"): string {
  if (!Number.isFinite(amount)) return "—";
  const digits = Number.isInteger(amount) ? 0 : 2;
  const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  return `${currencySymbol(currency)}${formatted}`;
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
}

const UNIT_LABELS: Record<string, [singular: string, plural: string]> = {
  pc: ["pc", "pcs"],
  set: ["set", "sets"],
  pair: ["pair", "pairs"],
  pack: ["pack", "packs"],
  dozen: ["dozen", "dozen"],
  carton: ["carton", "cartons"],
  kg: ["kg", "kg"],
  metre: ["m", "m"],
};

/** "1 pc", "50 pcs", "2 cartons" */
export function formatQty(quantity: number, unit = "pc"): string {
  const [one, many] = UNIT_LABELS[unit] ?? [unit, unit];
  return `${formatNumber(quantity)} ${quantity === 1 ? one : many}`;
}

/** Just the plural word: "pcs", "sets", "kg". */
export function pluralUnit(unit = "pc"): string {
  return (UNIT_LABELS[unit] ?? [unit, unit])[1];
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "10 Oct 2026" */
export function formatDate(value: DateInput, fallback = "—"): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : fallback;
}

/** "10 Oct 2026, 14:05" */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const date = toDate(value);
  return date
    ? `${formatDate(date)}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : fallback;
}

/** "3 hours ago", "yesterday" */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
