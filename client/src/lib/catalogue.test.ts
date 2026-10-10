import { describe, expect, it } from "vitest";
import { mapProductRow, rowsSupportPricing, sanitizeSearch, summarize, tallyCategories } from "./catalogue";
import { categoryMeta, STARTER_CATEGORIES } from "./categories";
import { findSample, querySamples, sampleProducts } from "./sampleProducts";
import { slugify, slugOrFallback, SLUG_PATTERN, uniqueSlug } from "./slug";
import { errorMessage, isMissingColumnError } from "./supabaseCompat";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "rattan-bag",
  name: "Rattan Handbag",
  category: "Bags",
  moq: 24,
  short_description: "  Hand-woven in Chiang Mai.  ",
  description: "**Hand-woven** rattan.\n- Lined interior",
  colors: ["Natural"],
  sizes: [],
  packaging_options: ["Bulk carton"],
  customization_options: [],
  is_active: true,
  created_at: "2026-02-01T10:00:00Z",
  price_currency: "THB",
  price_unit: "pc",
  price_tiers: [{ min_qty: 24, price: 450 }, { min_qty: 100, price: 400 }],
  product_images: [
    { id: "b", public_url: "https://cdn.test/b.jpg", is_primary: false, sort_order: 2, label: null, alt_text: null },
    { id: "a", public_url: "https://cdn.test/a.jpg", is_primary: true, sort_order: 5, label: "Front", alt_text: "Front view" },
    { id: "x", public_url: "", is_primary: false, sort_order: 0 },
  ],
};

describe("mapProductRow", () => {
  const product = mapProductRow(row);

  it("maps core fields and trims the short description", () => {
    expect(product).toMatchObject({ id: row.id, slug: "rattan-bag", name: "Rattan Handbag", category: "Bags", moq: 24, summary: "Hand-woven in Chiang Mai.", isActive: true });
  });

  it("puts the primary image first and drops images without a url", () => {
    expect(product.images.map(image => image.id)).toEqual(["a", "b"]);
    expect(product.images[0]).toMatchObject({ label: "Front", alt: "Front view", isPrimary: true });
  });

  it("reads pricing from the new columns", () => {
    expect(product.pricing).toEqual({ currency: "THB", unit: "pc", tiers: [{ minQty: 24, price: 450 }, { minQty: 100, price: 400 }] });
  });

  it("builds option groups only for the lists that have values", () => {
    expect(product.optionGroups.map(group => group.key)).toEqual(["color", "packaging"]);
  });

  it("still works for rows from before the pricing migration", () => {
    const legacy = mapProductRow({ ...row, price_currency: undefined, price_unit: undefined, price_tiers: undefined, product_images: undefined });
    expect(legacy.pricing).toEqual({ currency: "NGN", unit: "pc", tiers: [] });
    expect(legacy.images).toEqual([]);
  });

  it("clamps a missing or invalid MOQ to 1", () => {
    expect(mapProductRow({ ...row, moq: 0 }).moq).toBe(1);
    expect(mapProductRow({ ...row, moq: null }).moq).toBe(1);
  });
});

describe("summarize", () => {
  it("prefers the short description", () => {
    expect(summarize("Short", "Long text")).toBe("Short");
  });

  it("falls back to plain text from the description and truncates", () => {
    expect(summarize("", "**Bold** start\n- item")).toBe("Bold start item");
    expect(summarize(null, "x".repeat(300))).toHaveLength(138);
  });
});

describe("search and category helpers", () => {
  it("removes characters that would break a PostgREST filter", () => {
    expect(sanitizeSearch("tee, (polo) 100%_")).toBe("tee polo 100");
  });

  it("tallies categories most-stocked first and ignores blanks", () => {
    expect(tallyCategories([{ category: "Bags" }, { category: "Apparel" }, { category: "Bags" }, { category: null }, { category: " " }])).toEqual([
      { category: "Bags", count: 2 },
      { category: "Apparel", count: 1 },
    ]);
  });

  it("detects whether the pricing migration has been applied", () => {
    expect(rowsSupportPricing([{ id: 1 }])).toBe(false);
    expect(rowsSupportPricing([{ id: 1, price_tiers: [] }])).toBe(true);
    expect(rowsSupportPricing([])).toBe(false);
  });
});

describe("categoryMeta", () => {
  it("recognises the common wholesale categories", () => {
    expect(categoryMeta("Apparel & Textiles").tone).toBe("blue");
    expect(categoryMeta("Bags").tone).toBe("orange");
    expect(categoryMeta("Beauty & skincare").tone).toBe("pink");
    expect(categoryMeta("Home & lifestyle").tone).toBe("teal");
  });

  it("gives unknown categories a stable colour", () => {
    expect(categoryMeta("Zebra herding")).toEqual(categoryMeta("Zebra herding"));
  });

  it("covers every starter category", () => {
    for (const name of STARTER_CATEGORIES) expect(categoryMeta(name).icon).toBeTruthy();
  });
});

describe("slugs", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Cotton Tee & Polo (2026)")).toBe("cotton-tee-and-polo-2026");
    expect(slugify("Crème brûlée candle")).toBe("creme-brulee-candle");
    expect(SLUG_PATTERN.test(slugify("  --Hello   World--  "))).toBe(true);
  });

  it("falls back to a generated slug for Thai-only names", () => {
    const slug = slugOrFallback("กระเป๋าหวาย", "product", () => 0.123456789);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
    expect(slug.startsWith("product-")).toBe(true);
  });

  it("avoids clashes with existing slugs", () => {
    expect(uniqueSlug("rattan-bag", ["rattan-bag", "rattan-bag-2"])).toBe("rattan-bag-3");
    expect(uniqueSlug("new-item", ["rattan-bag"])).toBe("new-item");
  });
});

describe("supabase compatibility helpers", () => {
  it("recognises missing-column errors from Postgres and PostgREST", () => {
    expect(isMissingColumnError({ code: "42703", message: 'column products.price_tiers does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'price_tiers' column of 'products' in the schema cache" })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'price_tiers' column" }, "price_tiers")).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'other' column" }, "price_tiers")).toBe(false);
  });

  it("does not treat other failures as missing columns", () => {
    expect(isMissingColumnError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });

  it("extracts readable messages", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage({ message: "from postgrest" })).toBe("from postgrest");
    expect(errorMessage(42, "fallback")).toBe("fallback");
  });
});

describe("sample products", () => {
  it("are all flagged and priced", () => {
    expect(sampleProducts.length).toBeGreaterThan(0);
    for (const product of sampleProducts) {
      expect(product.isSample).toBe(true);
      expect(product.pricing.tiers.length).toBeGreaterThan(0);
      expect(product.optionGroups.length).toBeGreaterThan(0);
    }
  });

  it("can be looked up and filtered like the live catalogue", () => {
    expect(findSample("classic-polo")?.name).toBe("Classic Pique Polo Shirt");
    expect(querySamples({ q: "", category: "Bags", sort: "newest" }).every(product => product.category === "Bags")).toBe(true);
    expect(querySamples({ q: "hoodie", category: "All", sort: "newest" }).map(product => product.slug)).toEqual(["fleece-hoodie"]);
    const byMoq = querySamples({ q: "", category: "All", sort: "moq" }).map(product => product.moq);
    expect(byMoq).toEqual([...byMoq].sort((a, b) => a - b));
  });
});
