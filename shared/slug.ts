export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Cotton Tee & Polo" → "cotton-tee-and-polo". Accents are folded; Thai or other scripts are dropped. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** A name written only in a non-Latin script slugifies to nothing, so fall back to a short random id. */
export function slugOrFallback(name: string, prefix = "product", random: () => number = Math.random): string {
  return slugify(name) || `${prefix}-${random().toString(36).slice(2, 8)}`;
}

/** Appends -2, -3 … until the slug is not in `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let attempt = 2; attempt < 1000; attempt += 1) {
    const candidate = `${base}-${attempt}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
