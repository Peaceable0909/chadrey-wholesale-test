import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { path: string; options?: { admin?: boolean } };
let calls: Call[];
let answer: (call: Call) => unknown;

vi.mock("@/lib/shopApi", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/shopApi")>();
  return {
    ...original,
    shopFetch: async (path: string, options?: Call["options"]) => {
      const call = { path, options };
      calls.push(call);
      return answer(call);
    },
    shopFetchOrNull: async (path: string, options?: Call["options"]) => {
      const call = { path, options };
      calls.push(call);
      return answer(call);
    },
  };
});

const api = await import("./catalogueApi");

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  slug: `item-${n}`,
  name: `Item ${n}`,
  category: "Bags",
  moq: 24,
  short_description: "",
  description: "Soft **bag**",
  colors: ["Red"],
  sizes: [],
  packaging_options: [],
  customization_options: [],
  option_groups: [],
  price_currency: "THB",
  price_unit: "carton",
  price_tiers: [{ min_qty: 24, price: 1200 }],
  is_active: true,
  created_at: "2026-10-11T09:00:00.000Z",
  product_images: [
    { id: "img-b", storage_path: "products/p/b.jpg", public_url: "/photos/products/p/b.jpg", is_primary: false, sort_order: 1, alt_text: null, label: "Side" },
    { id: "img-a", storage_path: "products/p/a.jpg", public_url: "/photos/products/p/a.jpg", is_primary: true, sort_order: 0, alt_text: "Front", label: null },
  ],
  ...extra,
});

beforeEach(() => {
  calls = [];
  answer = () => ({ items: [], total: 0 });
});

const params = (call: Call) => Object.fromEntries(new URL(call.path, "https://shop.test").searchParams);

describe("what shoppers see", () => {
  it("asks for a page of products and turns each row into a product, cover photo first, prices included", async () => {
    answer = () => ({ items: [row(1), row(2)], total: 30 });
    const page = await api.fetchProductsPage({ q: "", category: "All", sort: "newest" }, 0);
    expect(calls[0].path.startsWith("/api/catalogue/products?")).toBe(true);
    expect(params(calls[0])).toEqual({ page: "0", size: "24", sort: "newest" });
    expect(calls[0].options?.admin).toBeUndefined();
    expect(page.total).toBe(30);
    expect(page.hasMore).toBe(true);
    expect(page.items[0]).toMatchObject({ slug: "item-1", name: "Item 1", moq: 24, pricing: { currency: "THB", unit: "carton", tiers: [{ minQty: 24, price: 1200 }] } });
    expect(page.items[0].images.map(image => [image.url, image.isPrimary])).toEqual([
      ["/photos/products/p/a.jpg", true],
      ["/photos/products/p/b.jpg", false],
    ]);
  });

  it("includes only the filters that are set", async () => {
    await api.fetchProductsPage({ q: "  tea cup ", category: "Kitchen", sort: "name", slugs: ["a", "b"], pageSize: 8 }, 2);
    expect(params(calls[0])).toEqual({ page: "2", size: "8", sort: "name", q: "tea cup", category: "Kitchen", slugs: "a,b" });
    calls.length = 0;
    await api.fetchProductsPage({ q: "", category: "", sort: "moq", slugs: [] }, 0);
    expect(params(calls[0])).toEqual({ page: "0", size: "24", sort: "moq", slugs: "" });
  });

  it("knows when there is nothing more to load", async () => {
    answer = () => ({ items: [row(1), row(2)], total: 26 });
    expect((await api.fetchProductsPage({ q: "", category: "All", sort: "newest" }, 1)).hasMore).toBe(false);
    answer = () => ({ items: [row(1)], total: 1 });
    expect((await api.fetchProductsPage({ q: "", category: "All", sort: "newest" }, 0)).hasMore).toBe(false);
  });

  it("finds one product by web address, or none", async () => {
    answer = () => row(3);
    expect((await api.fetchProductBySlug("item 3/odd"))?.name).toBe("Item 3");
    expect(calls[0].path).toBe("/api/catalogue/products/item%203%2Fodd");
    answer = () => null;
    expect(await api.fetchProductBySlug("missing")).toBeNull();
  });

  it("suggests related products", async () => {
    answer = () => ({ items: [row(4)] });
    const related = await api.fetchRelatedProducts({ slug: "item-1", category: "Home & Garden" }, 4);
    expect(params(calls[0])).toEqual({ slug: "item-1", category: "Home & Garden", limit: "4" });
    expect(related.map(product => product.slug)).toEqual(["item-4"]);
  });

  it("counts categories", async () => {
    answer = () => ({ items: [{ category: "Bags", count: 2 }] });
    expect(await api.fetchCategoryCounts()).toEqual([{ category: "Bags", count: 2 }]);
  });

  it("looks up names for quote screens, asking for each product once, 60 at a time", async () => {
    const wanted = Array.from({ length: 130 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
    answer = call => ({ items: params(call).ids.split(",").map(id => ({ id, name: `Name ${id.slice(-3)}` })) });
    const names = await api.fetchProductNames([...wanted, ...wanted.slice(0, 10)]);
    expect(calls).toHaveLength(3);
    expect(calls.map(call => params(call).ids.split(",").length)).toEqual([60, 60, 10]);
    expect(names.size).toBe(130);
    expect(names.get(wanted[7])).toBe("Name 007");
  });
});

describe("what administrators see", () => {
  it("lists every product with the visibility and search filters, signed in", async () => {
    answer = () => ({ items: [row(1, { is_active: false })], total: 1 });
    const page = await api.fetchAdminProductsPage({ q: "bag", status: "hidden" }, 1);
    expect(params(calls[0])).toEqual({ page: "1", size: "30", status: "hidden", q: "bag" });
    expect(calls[0].options?.admin).toBe(true);
    expect(page.items[0].isActive).toBe(false);
  });

  it("opens one product by id, hidden ones too", async () => {
    answer = () => row(5, { is_active: false });
    expect((await api.fetchProductById("abc"))?.isActive).toBe(false);
    expect(calls[0]).toMatchObject({ path: "/api/admin/products/abc", options: { admin: true } });
    answer = () => null;
    expect(await api.fetchProductById("abc")).toBeNull();
  });

  it("counts hidden products", async () => {
    answer = () => ({ count: 7 });
    expect(await api.fetchHiddenCount()).toBe(7);
    expect(calls[0]).toMatchObject({ path: "/api/admin/products/hidden-count", options: { admin: true } });
  });

  it("lists what 'Select all' needs", async () => {
    answer = () => ({ items: [{ id: "a", name: "A", category: "X", isActive: false }] });
    expect(await api.fetchAdminSummaries({ q: "a", status: "hidden" }, 500)).toEqual([{ id: "a", name: "A", category: "X", isActive: false }]);
    expect(params(calls[0])).toEqual({ status: "hidden", limit: "500", q: "a" });
  });

  it("fetches products by id for the quote screens, hidden ones too, 60 at a time", async () => {
    const wanted = Array.from({ length: 70 }, (_, index) => `id-${index}`);
    answer = call => ({ items: params(call).ids.split(",").map((id, position) => row(position + 1, { id })) });
    const products = await api.fetchAdminProductsByIds([...wanted, "id-0"]);
    expect(calls.map(call => params(call).ids.split(",").length)).toEqual([60, 10]);
    expect(calls.every(call => call.options?.admin === true)).toBe(true);
    expect(products).toHaveLength(70);
  });
});
