/**
 * Reads the short chat message sent with a product photo, for example:
 *
 *   100ml Original sugar marshmallow
 *   48,000 wholesale
 *   55,000-60,000 Resell
 *
 * Nothing here knows about Telegram or the database, so the Telegram bot and any later admin tool read
 * messages the same way. The reader never throws: whatever it cannot make sense of is left out and
 * reported in `warnings` so a person can double check the draft.
 */

export type ParsedProductMessage = {
  /** The first line that is not a price, minimum order or category. Empty when the message has none. */
  name: string;
  /** Price per unit at the minimum order. */
  wholesale: number | null;
  /** Resell price range, read but never saved on the product. A single price has low and high equal. */
  resellLow: number | null;
  resellHigh: number | null;
  moq: number | null;
  /** ISO code, only when the message names a currency (₦, NGN, ฿ ...). */
  currency: string | null;
  /** One of the site's units, only when the message names one ("per carton"). */
  unit: string | null;
  category: string | null;
  /** Other lines (colours, sizes, remarks). They go into the description. */
  notes: string[];
  /** Plain-language things worth a second look. */
  warnings: string[];
};

type PriceKind = "wholesale" | "resell" | "price";
type FoundPrice = { kind: PriceKind; low: number; high: number; currency: string | null; unit: string | null; raw: string };

const CURRENCY_BY_SYMBOL: Record<string, string> = { "₦": "NGN", ngn: "NGN", naira: "NGN", "฿": "THB", thb: "THB", baht: "THB", บาท: "THB", $: "USD", "us$": "USD", usd: "USD" };
const CURRENCY = String.raw`(?:₦|฿|US\$|\$|NGN|THB|USD|naira|baht|บาท)`;
const CURRENCY_AT_END = new RegExp(String.raw`(${CURRENCY})\s*$`, "i");
const CURRENCY_AT_START = new RegExp(String.raw`^\s*(${CURRENCY})(?![A-Za-z])`, "i");

/** Words for each unit the site knows (see UNITS in the pricing code). */
const UNIT_WORDS: Array<[unit: string, words: string]> = [
  ["carton", "cartons?|ctns?|cases?"],
  ["pack", "packs?|packets?|pkts?|boxe?s?"],
  ["dozen", "dozen|doz|dz"],
  ["set", "sets?"],
  ["pair", "pairs?"],
  ["kg", "kgs?|kilos?|kilograms?"],
  ["metre", "metres?|meters?|mtrs?"],
  ["pc", "pcs?|pieces?|units?|each|bottles?|items?"],
];
const PER_UNIT = new RegExp(String.raw`^\s*(?:\/|per\s+)\s*(?:1\s*)?(?:${UNIT_WORDS.map(([, words]) => `(${words})`).join("|")})\b`, "i");

// The Thai words are what Thai dealers write: ราคาส่ง / ส่ง = wholesale, ราคาปลีก / ปลีก = retail, ราคา = price.
const WHOLESALE_WORDS = String.raw`whole\s*-?\s*sale(?:\s*price)?|w\s*\/\s*s|ws|bulk(?:\s*price)?|trade(?:\s*price)?|ราคาส่ง|ส่ง`;
const RESELL_WORDS = String.raw`re\s*-?\s*sell(?:ing)?(?:\s*price)?|resale(?:\s*price)?|retail(?:\s*price)?|rrp|srp|selling(?:\s*price)?|sell\s*at|market\s*price|ราคาปลีก|ปลีก`;
const GENERIC_WORDS = String.raw`price|prices|rate|only|now|just|at|for|@|ราคา`;
const WHOLESALE_RE = new RegExp(`^(?:${WHOLESALE_WORDS})$`, "i");
const RESELL_RE = new RegExp(`^(?:${RESELL_WORDS})$`, "i");

/** A label written before the number: "Wholesale: ₦48,000". */
const LABEL_BEFORE = new RegExp(String.raw`(?<![A-Za-z0-9])(${WHOLESALE_WORDS}|${RESELL_WORDS}|${GENERIC_WORDS})\s*(?:[:=\-–@(\[]\s*|\bis\b\s*|\bat\b\s*)*(?:${CURRENCY}\s*)?$`, "i");
/** A line that is only a label ("Wholesale:"), waiting for the number on the next line. */
const LABEL_ONLY = new RegExp(String.raw`^(?:${WHOLESALE_WORDS}|${RESELL_WORDS}|${GENERIC_WORDS})\s*[:=\-–]?$`, "i");
/** A label written after the number: "48,000 wholesale" or "48,000 per carton wholesale". */
const LABEL_AFTER = new RegExp(String.raw`^\s*(?:(?:\/|per\s+)\s*\w+\s*)?(?:[-–:=(\[]\s*)?(?:price\s*)?(${WHOLESALE_WORDS}|${RESELL_WORDS})(?![A-Za-z0-9])\)?`, "i");
/** A wholesale or resell label right after an amount, used to tell "N500 wholesale" (naira) from "N95 mask". */
const LABEL_RIGHT_AFTER = new RegExp(String.raw`^\s*(?:(?:\/|per\s+)\s*\w+\s*)?(?:[-–:=(\[]\s*)?(?:price\s*)?(?:${WHOLESALE_WORDS}|${RESELL_WORDS})(?![A-Za-z0-9])`, "i");

/** A number or range: 48,000  48000  48k  55,000-60,000  55-60k. Not part of a word, so N95 and 100ml are skipped. */
const AMOUNT = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s?[kK](?![A-Za-z]))?`;
const AMOUNT_RANGE = new RegExp(String.raw`(?<![\w.,])(${AMOUNT})(?:\s*(?:-|–|—|~|\bto\b)\s*(?:${CURRENCY}\s*)?(${AMOUNT}))?(?!\w)`, "gi");

/** A number followed by one of these is a size or count (100ml, 12 pcs, 5000mAh), not a price. */
const SIZE_AFTER = /^\s*(?:(?:ml|cl|l|ltrs?|litres?|liters?|g|gm|gms|grams?|kgs?|mg|oz|lbs?|cm|mm|m|mtrs?|inch(?:es)?|ft|yards?|yds?|pcs?|pieces?|units?|pairs?|sets?|packs?|pkts?|sheets?|rolls?|x|gb|tb|mb|mah|hz|mp|ply|colou?rs?|sizes?|years?|yrs?|days?|months?)\b|%)/i;

const MOQ_LABELLED = /\b(?:moq|min(?:imum)?\.?(?:\s*(?:order|qty|quantity|purchase))?)\s*[:=\-–]?\s*(\d[\d,]*)(?:\s*(?:pcs?|pieces?|units?|sets?|cartons?|packs?|dozen|pairs?))?\b/i;
const MOQ_TRAILING = /\b(\d[\d,]*)\s*(?:pcs?|pieces?|units?|sets?|cartons?|packs?|dozen|pairs?)\s*(?:min(?:imum)?|moq)\b/i;

const CATEGORY_LINE = /^\s*(?:category|cat)\s*[:=\-–]\s*(.+?)\s*$/i;
// A hashtag starts with a letter: "#perfume" is a category, "#48,000" is a price written with # for the naira sign.
const HASHTAG = /(^|\s)#(\p{L}[\p{L}\p{N}_-]*)/gu;
/** Naira is often typed as # or N: "#48,000", "N48,000". */
const NAIRA_PREFIX = /(^|[\s(:=\-–])(?:#|N)(\d[\d,]*(?:\.\d+)?[kK]?)(?![\w])/g;

const MAX_NAME = 160;
const MAX_PRICE = 1_000_000_000_000;

function normalise(text: string): string {
  return text
    .replace(/[​-‍﻿]/g, "")
    .replace(/ /g, " ")
    .replace(/[๐-๙]/g, digit => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)))
    .replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - 0xff10))
    .replace(/\r\n?/g, "\n");
}

/** "48,000" → 48000, "48k" → 48000, "48.000" → 48000 (thousands dot). */
function toNumber(raw: string): number | null {
  let text = raw.trim().toLowerCase();
  let factor = 1;
  if (text.endsWith("k")) {
    factor = 1000;
    text = text.slice(0, -1).trim();
  }
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const value = Number(text.replace(/,/g, "")) * factor;
  return Number.isFinite(value) && value > 0 && value <= MAX_PRICE ? value : null;
}

function currencyCode(symbol: string): string | null {
  return CURRENCY_BY_SYMBOL[symbol.trim().toLowerCase()] ?? null;
}

function unitFrom(after: string): { unit: string; length: number } | null {
  const match = PER_UNIT.exec(after);
  if (!match) return null;
  const index = match.slice(1).findIndex(Boolean);
  return index === -1 ? null : { unit: UNIT_WORDS[index][0], length: match[0].length };
}

function kindOf(label: string): PriceKind {
  const text = label.trim();
  if (WHOLESALE_RE.test(text)) return "wholesale";
  if (RESELL_RE.test(text)) return "resell";
  return "price";
}

/**
 * "#48,000" and "N48,000" become "₦48,000". Plain "N95" or "#12" stay as they are: the amount must look like
 * money (a comma group, a k, four digits or more) or sit right next to a wholesale/resell label.
 */
function convertNairaPrefix(line: string): string {
  return line.replace(NAIRA_PREFIX, (full, lead: string, amount: string, offset: number) => {
    const digits = amount.replace(/[^\d]/g, "");
    const looksLikeMoney = /,\d{3}/.test(amount) || /k$/i.test(amount) || digits.length >= 4;
    const afterAmount = line.slice(offset + full.length);
    const nextToLabel = LABEL_RIGHT_AFTER.test(afterAmount) || LABEL_BEFORE.test(line.slice(0, offset + lead.length));
    return looksLikeMoney || nextToLabel ? `${lead}₦${amount}` : full;
  });
}

/** Pulls every price out of one line and returns what is left of the line. */
function extractPrices(line: string): { rest: string; prices: FoundPrice[] } {
  const prices: FoundPrice[] = [];
  let rest = "";
  let cursor = 0;

  for (const match of line.matchAll(AMOUNT_RANGE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start < cursor) continue;
    const afterText = line.slice(end);
    if (SIZE_AFTER.test(afterText)) continue;

    const beforeText = line.slice(cursor, start);
    let phraseStart = start;
    let phraseEnd = end;
    let kind: PriceKind | null = null;
    let currency: string | null = null;
    let unit: string | null = null;

    const labelBefore = LABEL_BEFORE.exec(beforeText);
    if (labelBefore) {
      kind = kindOf(labelBefore[1]);
      phraseStart = cursor + labelBefore.index;
      const symbol = labelBefore[0].match(new RegExp(CURRENCY, "i"));
      if (symbol) currency = currencyCode(symbol[0]);
    } else {
      const symbolBefore = CURRENCY_AT_END.exec(beforeText);
      if (symbolBefore) {
        currency = currencyCode(symbolBefore[1]);
        phraseStart = cursor + symbolBefore.index;
      }
    }

    const symbolAfter = CURRENCY_AT_START.exec(afterText);
    if (symbolAfter) {
      currency = currency ?? currencyCode(symbolAfter[1]);
      phraseEnd += symbolAfter[0].length;
    }
    const perUnit = unitFrom(line.slice(phraseEnd));
    if (perUnit) {
      unit = perUnit.unit;
      phraseEnd += perUnit.length;
    }
    if (!kind) {
      const labelAfter = LABEL_AFTER.exec(line.slice(phraseEnd));
      if (labelAfter) {
        kind = kindOf(labelAfter[1]);
        phraseEnd += labelAfter[0].length;
      }
    }

    const grouped = /,\d{3}/.test(match[1]) || /k$/i.test(match[1].trim()) || (match[2] ? /,\d{3}|k$/i.test(match[2].trim()) : false);
    const bareLine = (line.slice(0, phraseStart) + line.slice(phraseEnd)).replace(/[^\p{L}\p{N}]+/gu, "") === "";
    if (!kind && !currency && !grouped && !bareLine) continue;

    let low = toNumber(match[1]);
    let high = match[2] ? toNumber(match[2]) : low;
    if (low === null || high === null) continue;
    // "55-60k": the k belongs to both numbers.
    if (match[2] && /k$/i.test(match[2].trim()) && !/k$/i.test(match[1].trim()) && low * 1000 <= high) low *= 1000;
    if (low > high) [low, high] = [high, low];

    rest += line.slice(cursor, phraseStart) + " ";
    prices.push({ kind: kind ?? "price", low, high, currency, unit, raw: line.slice(phraseStart, phraseEnd).trim() });
    cursor = phraseEnd;
  }

  rest += line.slice(cursor);
  return { rest, prices };
}

/** Removes dangling separators and emoji left behind when a price was cut out of a line. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[\s\p{Extended_Pictographic}️‍\-–—:=|/,;@(\[]+$/u, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/** Banner lines such as "NEW ARRIVAL" or "RESTOCK". They are not the product name. */
const PROMO_LINE = /^(?:new(?:\s*arrivals?)?|restock(?:ed)?|back\s*in\s*stock|in\s*stock|available|now\s*available|hot(?:\s*(?:sale|deal|item|product))?|sale|promo(?:tion)?|best\s*seller|top\s*seller|just\s*landed|flash\s*sale)$/i;

export function parseProductMessage(input: string): ParsedProductMessage {
  const result: ParsedProductMessage = { name: "", wholesale: null, resellLow: null, resellHigh: null, moq: null, currency: null, unit: null, category: null, notes: [], warnings: [] };
  let text = normalise(String(input ?? ""));

  const hashtag = Array.from(text.matchAll(HASHTAG))[0];
  if (hashtag) {
    result.category = hashtag[2].replace(/[_-]+/g, " ").trim();
    text = text.replace(HASHTAG, "$1");
  }

  let lines = text
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  // "Wholesale:" on one line and the number on the next.
  lines = lines.reduce<string[]>((merged, line) => {
    const previous = merged[merged.length - 1];
    if (previous && LABEL_ONLY.test(previous) && /^\p{Sc}?\s*\d[\d,.]*\s*[kK]?$/u.test(line)) merged[merged.length - 1] = `${previous} ${line}`;
    else merged.push(line);
    return merged;
  }, []);

  const textLines: string[] = [];
  const prices: FoundPrice[] = [];

  for (let line of lines) {
    line = convertNairaPrefix(line);
    const categoryLine = CATEGORY_LINE.exec(line);
    if (categoryLine) {
      result.category = result.category ?? categoryLine[1].trim();
      continue;
    }

    const moq = MOQ_LABELLED.exec(line) ?? MOQ_TRAILING.exec(line);
    if (moq) {
      const value = Number(moq[1].replace(/,/g, ""));
      if (Number.isInteger(value) && value >= 1 && value <= 1_000_000) result.moq = result.moq ?? value;
      line = line.replace(moq[0], " ");
    }

    const { rest, prices: found } = extractPrices(line);
    prices.push(...found);
    const cleaned = tidy(rest);
    if (/[\p{L}\p{N}]/u.test(cleaned)) textLines.push(cleaned);
  }

  // A banner line ("NEW ARRIVAL") is dropped when the message has a real product line as well.
  const productLines = textLines.filter(line => !PROMO_LINE.test(line));
  const usable = productLines.length ? productLines : textLines;
  const [first, ...others] = usable;
  result.name = (first ?? "").slice(0, MAX_NAME).trim();
  result.notes = others.map(line => line.slice(0, 300));

  for (const price of prices) {
    result.currency = result.currency ?? price.currency;
    result.unit = result.unit ?? price.unit;
  }

  const wholesale = prices.filter(price => price.kind === "wholesale");
  const resell = prices.filter(price => price.kind === "resell");
  const plain = prices.filter(price => price.kind === "price");

  let chosenWholesale = wholesale[0];
  let chosenResell = resell[0];
  if (!chosenWholesale && plain.length) {
    chosenWholesale = plain[0];
    if (!chosenResell && plain[1]) {
      chosenResell = plain[1];
      result.warnings.push("The prices had no labels, so the first was taken as wholesale and the second as resell.");
    }
  } else if (!chosenResell && plain.length) {
    chosenResell = plain[0];
  }

  if (chosenWholesale) {
    result.wholesale = chosenWholesale.low;
    if (chosenWholesale.high !== chosenWholesale.low) result.warnings.push("The wholesale price was a range, so the lower number was used.");
  }
  if (wholesale.length > 1) result.warnings.push("There was more than one wholesale price. Only the first was used.");
  if (chosenResell) {
    result.resellLow = chosenResell.low;
    result.resellHigh = chosenResell.high;
  }

  if (!prices.length) result.warnings.push("No price was found.");
  else if (!chosenWholesale) result.warnings.push("Only a resell price was found, so no wholesale price was saved.");
  if (result.wholesale !== null && result.resellLow !== null && result.resellLow < result.wholesale) result.warnings.push("The resell price is lower than the wholesale price. Check the numbers.");

  return result;
}

/** The category a product gets when nobody has chosen one yet. */
export const UNCATEGORISED = "Uncategorised";

export const isUncategorised = (category: string | null | undefined): boolean => !category?.trim() || category.trim().toLowerCase() === UNCATEGORISED.toLowerCase();

const CURRENCY_SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", THB: "฿" };

/** "₦48,000", "$12.50", "฿450". Other currencies print their code first ("EUR 10"). */
export function formatAmount(value: number, currency: string): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  const text = value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${text}`;
}

/** "₦55,000 – ₦60,000" or "₦55,000". */
export function formatResellRange(low: number, high: number, currency: string): string {
  return low === high ? formatAmount(low, currency) : `${formatAmount(low, currency)} – ${formatAmount(high, currency)}`;
}

/**
 * Description text for the product page: the extra lines of the message. The resell range is deliberately left out:
 * the shop owner chose not to show it to buyers, so it is only echoed back in the chat reply.
 */
export function describeParsed(parsed: ParsedProductMessage): string {
  return parsed.notes.join("\n");
}
