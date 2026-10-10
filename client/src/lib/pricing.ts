import { formatMoney } from "@/lib/format";

/**
 * Indicative wholesale pricing, modelled like a 1688 price ladder:
 * the unit price drops as the order quantity passes each "break".
 *
 * Prices are indicative only. Imports move with exchange rates and freight, so the final
 * price always comes from the quotation the team issues.
 */

export type PriceTier = { minQty: number; price: number };
export type Pricing = { currency: string; unit: string; tiers: PriceTier[] };
export type TierRange = { from: number; to: number | null; price: number };

export const DEFAULT_CURRENCY = "NGN";
export const DEFAULT_UNIT = "pc";

export const CURRENCIES = [
  { code: "NGN", symbol: "₦", label: "Naira" },
  { code: "USD", symbol: "$", label: "US dollar" },
  { code: "THB", symbol: "฿", label: "Thai baht" },
] as const;

export const UNITS = ["pc", "set", "pair", "pack", "dozen", "carton", "kg", "metre"] as const;

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
};

/** Reads user-typed amounts such as "12,500" or "12 500.50". Returns NaN when it is not a number. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[,\s]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

/** Accepts the stored shape `[{ min_qty, price }]` (or camelCase) and drops anything unusable. */
export function parseTiers(value: unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  const byQty = new Map<number, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const minQty = Math.floor(toNumber(raw.min_qty ?? raw.minQty));
    const price = toNumber(raw.price);
    if (!Number.isFinite(minQty) || minQty < 1 || !Number.isFinite(price) || price <= 0) continue;
    const existing = byQty.get(minQty);
    byQty.set(minQty, existing === undefined ? price : Math.min(existing, price));
  }
  return Array.from(byQty.entries())
    .map(([minQty, price]) => ({ minQty, price }))
    .sort((a, b) => a.minQty - b.minQty);
}

/** Storage shape for the `price_tiers` JSON column. */
export function tiersToRows(tiers: PriceTier[]): Array<{ min_qty: number; price: number }> {
  return tiers.map(tier => ({ min_qty: tier.minQty, price: tier.price }));
}

export function pricingFromRow(row: { price_currency?: unknown; price_unit?: unknown; price_tiers?: unknown }): Pricing {
  const currency = typeof row.price_currency === "string" && row.price_currency.trim() ? row.price_currency.trim().toUpperCase() : DEFAULT_CURRENCY;
  const unit = typeof row.price_unit === "string" && row.price_unit.trim() ? row.price_unit.trim() : DEFAULT_UNIT;
  return { currency, unit, tiers: parseTiers(row.price_tiers) };
}

export const hasPrice = (pricing: Pricing): boolean => pricing.tiers.length > 0;

export function priceBounds(pricing: Pricing): { low: number; high: number } | null {
  if (!pricing.tiers.length) return null;
  const prices = pricing.tiers.map(tier => tier.price);
  return { low: Math.min(...prices), high: Math.max(...prices) };
}

/** Unit price for an order quantity: the highest tier whose break the quantity has reached. */
export function unitPriceFor(pricing: Pricing, quantity: number): number | null {
  if (!pricing.tiers.length) return null;
  let applicable = pricing.tiers[0];
  for (const tier of pricing.tiers) if (quantity >= tier.minQty) applicable = tier;
  return applicable.price;
}

export function lineTotal(pricing: Pricing, quantity: number): number | null {
  const unit = unitPriceFor(pricing, quantity);
  return unit === null ? null : Math.round(unit * quantity * 100) / 100;
}

/** Quantity bands for display: `50–199`, `200–499`, `500+`. */
export function tierRanges(pricing: Pricing): TierRange[] {
  return pricing.tiers.map((tier, index) => ({
    from: tier.minQty,
    to: index < pricing.tiers.length - 1 ? pricing.tiers[index + 1].minQty - 1 : null,
    price: tier.price,
  }));
}

export function formatRange(range: TierRange): string {
  if (range.to === null) return `${range.from.toLocaleString("en-US")}+`;
  if (range.to === range.from) return range.from.toLocaleString("en-US");
  return `${range.from.toLocaleString("en-US")}–${range.to.toLocaleString("en-US")}`;
}

/** "₦11,000 – ₦12,500" or "₦12,500". Returns null when the product has no price yet. */
export function formatPriceRange(pricing: Pricing, separator = " – "): string | null {
  const bounds = priceBounds(pricing);
  if (!bounds) return null;
  const low = formatMoney(bounds.low, pricing.currency);
  if (bounds.low === bounds.high) return low;
  return `${low}${separator}${formatMoney(bounds.high, pricing.currency)}`;
}

/**
 * Checks a ladder the way a buyer would read it. Prices must stay positive, each break must be a
 * new quantity, and buying more must never cost more per unit (it is almost always a typo).
 */
export function validateTiers(tiers: PriceTier[]): string | null {
  const ordered = [...tiers].sort((a, b) => a.minQty - b.minQty);
  for (let index = 0; index < ordered.length; index += 1) {
    const tier = ordered[index];
    if (!Number.isFinite(tier.price) || tier.price <= 0) return "Every price must be greater than zero.";
    if (!Number.isInteger(tier.minQty) || tier.minQty < 1) return "Quantities must be whole numbers of 1 or more.";
    const previous = ordered[index - 1];
    if (!previous) continue;
    if (tier.minQty === previous.minQty) return "Each quantity break needs a different quantity.";
    if (tier.price > previous.price) return "A larger quantity should not cost more per unit. Check the prices.";
  }
  return null;
}

/* Admin editor: the first price always starts at the MOQ, volume breaks sit above it. */

export type PriceDraft = {
  currency: string;
  unit: string;
  base: string;
  breaks: Array<{ minQty: string; price: string }>;
};

export const emptyPriceDraft = (): PriceDraft => ({ currency: DEFAULT_CURRENCY, unit: DEFAULT_UNIT, base: "", breaks: [] });

export function draftFromPricing(pricing: Pricing): PriceDraft {
  const [first, ...rest] = pricing.tiers;
  return {
    currency: pricing.currency,
    unit: pricing.unit,
    base: first ? String(first.price) : "",
    breaks: rest.map(tier => ({ minQty: String(tier.minQty), price: String(tier.price) })),
  };
}

export function pricingFromDraft(draft: PriceDraft, moq: number): { pricing: Pricing; error: string | null } {
  const empty: Pricing = { currency: draft.currency, unit: draft.unit, tiers: [] };
  const rows = draft.breaks.filter(row => row.minQty.trim() || row.price.trim());
  const base = draft.base.trim() ? parseAmount(draft.base) : Number.NaN;

  if (!draft.base.trim()) {
    return rows.length ? { pricing: empty, error: "Enter the price at the minimum order first, or remove the volume prices." } : { pricing: empty, error: null };
  }
  if (!Number.isFinite(base) || base <= 0) return { pricing: empty, error: "Enter a valid price." };

  const tiers: PriceTier[] = [{ minQty: Math.max(1, Math.floor(moq) || 1), price: base }];
  for (const row of rows) {
    const minQty = parseAmount(row.minQty);
    const price = parseAmount(row.price);
    if (!Number.isFinite(minQty) || !Number.isFinite(price)) return { pricing: empty, error: "Complete or remove the volume price rows." };
    if (minQty <= tiers[0].minQty) return { pricing: empty, error: `Volume prices must start above the minimum order (${tiers[0].minQty}).` };
    tiers.push({ minQty: Math.floor(minQty), price });
  }
  const error = validateTiers(tiers);
  return { pricing: { currency: draft.currency, unit: draft.unit, tiers: tiers.sort((a, b) => a.minQty - b.minQty) }, error };
}
