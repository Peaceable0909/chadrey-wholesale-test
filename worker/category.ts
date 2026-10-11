import { isUncategorised } from "../shared/productMessage";

export type KnownProduct = { id: string; name: string; category: string; is_active: boolean };

const STOP_WORDS = new Set(["the", "and", "with", "for", "from", "new", "original", "pcs", "pack", "set", "size", "color", "colour", "price", "wholesale", "resell", "retail"]);

/** Lower-case words of three letters or more, without sizes, numbers and filler words. */
export function nameTokens(name: string): string[] {
  const words = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 3 && !/^\d/.test(word) && !STOP_WORDS.has(word));
  return Array.from(new Set(words));
}

const sameKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A product with the same name (ignoring case and punctuation). A live one is preferred. */
export function findSameName(name: string, known: KnownProduct[]): KnownProduct | null {
  const key = sameKey(name);
  if (!key) return null;
  const matches = known.filter(product => sameKey(product.name) === key);
  return matches.find(product => product.is_active) ?? matches[0] ?? null;
}

/** The exact spelling of an existing category when the typed one matches it ignoring case. */
export function canonicalCategory(typed: string | null, known: KnownProduct[]): string | null {
  const wanted = typed?.trim();
  if (!wanted) return null;
  const match = known.find(product => product.category.trim().toLowerCase() === wanted.toLowerCase());
  return match ? match.category : wanted.slice(0, 60);
}

/**
 * Guesses the category from products you already have: the one whose name shares the most unusual words.
 * A word found in nearly every product counts for little; a word found in only a few counts for a lot.
 * Returns null when nothing is similar enough, so the product stays "Uncategorised" for a person to decide.
 */
export function guessCategory(name: string, known: KnownProduct[]): { category: string; similarTo: string } | null {
  const wanted = nameTokens(name);
  const pool = known
    .filter(product => !isUncategorised(product.category))
    .map(product => ({ product, tokens: new Set(nameTokens(product.name)) }));
  if (!wanted.length || !pool.length) return null;

  const frequency = new Map<string, number>();
  for (const entry of pool) for (const token of entry.tokens) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const weight = (token: string) => Math.log(1 + pool.length / (frequency.get(token) ?? pool.length));

  let best: { score: number; product: KnownProduct } | null = null;
  for (const entry of pool) {
    const score = wanted.filter(token => entry.tokens.has(token)).reduce((sum, token) => sum + weight(token), 0);
    if (score >= 1 && (!best || score > best.score)) best = { score, product: entry.product };
  }
  return best ? { category: best.product.category, similarTo: best.product.name } : null;
}
