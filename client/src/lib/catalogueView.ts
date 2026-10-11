import type { ProductOptionGroup } from "@/lib/productOptions";

/* Small, pure helpers for how the catalogue is shown. Kept apart from the screens so they are easy to test. */

export type ActiveFilter = { key: "q" | "category" | "saved"; label: string };

/** The filters currently narrowing the list, in the order they are shown as removable chips. */
export function activeFilters(state: { q: string; category: string; savedOnly: boolean }): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  const category = state.category.trim();
  const q = state.q.trim();
  if (category && category !== "All") filters.push({ key: "category", label: category });
  if (q) filters.push({ key: "q", label: `“${q}”` });
  if (state.savedOnly) filters.push({ key: "saved", label: "Saved products" });
  return filters;
}

export type ImageFit = "cover" | "contain";

/**
 * How a photo should sit in a card's picture frame. A photo about as wide as it is tall fills the frame; any other shape is
 * shown whole, so a tall bottle or a wide bag is never cut off and nothing is stretched.
 * `frameRatio` is the frame's width divided by its height.
 */
export function imageFit(width: number, height: number, frameRatio = 1): ImageFit {
  if (!(width > 0) || !(height > 0) || !(frameRatio > 0)) return "contain";
  const relative = width / height / frameRatio;
  return relative >= 0.85 && relative <= 1.18 ? "cover" : "contain";
}

/** The word for several of something a buyer can choose between: "Color" → "colors", "Capacity" → "capacities". */
function choices(label: string): string {
  const word = label.trim().toLowerCase();
  if (/(ing|ation)$/.test(word)) return `${word} options`;
  if (/s$/.test(word)) return word;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(x|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/**
 * "4 colors · 3 sizes": what a buyer can choose between, taken from the product's own option groups.
 * A group with a single option is not a choice and is left out. Returns an empty text when there is nothing to choose.
 */
export function variationSummary(groups: ProductOptionGroup[], max = 2): string {
  const real = groups.filter(group => group.options.length >= 2);
  const shown = real.slice(0, max).map(group => `${group.options.length} ${choices(group.label)}`);
  const more = real.length - shown.length;
  return [...shown, ...(more > 0 ? [`+${more} more`] : [])].join(" · ");
}
