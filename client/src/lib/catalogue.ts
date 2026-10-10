import { normalizeOptionGroups, type ProductOptionGroup } from "@/lib/productOptions";
import { pricingFromRow, type Pricing } from "@/lib/pricing";

/* One product model for every screen (home, catalogue, detail, quote, admin).
   Network calls live in catalogueApi.ts; this file is pure so it is easy to test. */

export type ProductImage = {
  id: string;
  url: string;
  /** Where the file lives in the product-images bucket (admin screens use it to delete files). */
  storagePath: string | null;
  label: string | null;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  moq: number;
  /** Short blurb for cards. Falls back to the start of the full description. */
  summary: string;
  /** Raw short description as typed by the admin (may be empty). */
  shortDescription: string;
  description: string;
  images: ProductImage[];
  optionGroups: ProductOptionGroup[];
  /** Legacy comma lists, kept so the admin editor can round-trip them. */
  legacyOptions: { colors: string[]; sizes: string[]; packaging: string[]; customization: string[] };
  pricing: Pricing;
  isActive: boolean;
  createdAt: string | null;
  /** True for the built-in demo products shown when the live catalogue is empty or unreachable. */
  isSample?: boolean;
};

export type CatalogueSort = "newest" | "moq" | "name";
export type CatalogueQuery = { q: string; category: string; sort: CatalogueSort; slugs?: string[] };
export type ProductPage = { items: Product[]; total: number; hasMore: boolean };
export type CategoryCount = { category: string; count: number };

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [];

function plainText(markdown: string): string {
  return markdown.replace(/\*\*/g, "").replace(/^[-*•]\s+/gm, "").replace(/\s+/g, " ").trim();
}

export function summarize(short: unknown, description: unknown): string {
  const trimmed = typeof short === "string" ? short.trim() : "";
  if (trimmed) return trimmed;
  const text = plainText(typeof description === "string" ? description : "");
  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text;
}

/** Turns a `products` row (with nested `product_images`) into the app's product model. */
export function mapProductRow(row: any): Product {
  const images: ProductImage[] = (Array.isArray(row.product_images) ? row.product_images : [])
    .filter((image: any) => image?.public_url)
    .map((image: any) => ({
      id: String(image.id ?? image.public_url),
      url: String(image.public_url),
      storagePath: image.storage_path ?? null,
      label: image.label ?? null,
      alt: image.alt_text ?? null,
      isPrimary: Boolean(image.is_primary),
      sortOrder: Number(image.sort_order ?? 0),
    }))
    .sort((a: ProductImage, b: ProductImage) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name ?? ""),
    category: String(row.category ?? "Other"),
    moq: Math.max(1, Number(row.moq) || 1),
    summary: summarize(row.short_description, row.description),
    shortDescription: typeof row.short_description === "string" ? row.short_description : "",
    description: typeof row.description === "string" ? row.description : "",
    images,
    optionGroups: normalizeOptionGroups(row),
    legacyOptions: {
      colors: strings(row.colors),
      sizes: strings(row.sizes),
      packaging: strings(row.packaging_options),
      customization: strings(row.customization_options),
    },
    pricing: pricingFromRow(row),
    isActive: row.is_active !== false,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export const primaryImage = (product: Pick<Product, "images">): ProductImage | undefined => product.images[0];

/** True when at least one row carries the pricing columns, i.e. the migration has been applied. */
export const rowsSupportPricing = (rows: unknown[]): boolean =>
  rows.some(row => Boolean(row) && typeof row === "object" && "price_tiers" in (row as object));

/** PostgREST treats , ( ) and * as syntax inside .or(); % and _ are ILIKE wildcards. */
export function sanitizeSearch(input: string): string {
  return input.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Tallies categories, most-stocked first. */
export function tallyCategories(rows: Array<{ category: string | null }>): CategoryCount[] {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const category = row.category?.trim();
    if (category) tally.set(category, (tally.get(category) ?? 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
