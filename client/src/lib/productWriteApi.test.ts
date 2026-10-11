import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductFields } from "@/lib/productDraft";

type Call = { path: string; options: { method?: string; json?: any; body?: unknown; headers?: Record<string, string>; admin?: boolean; timeoutMs?: number } };
let calls: Call[];
let answer: (call: Call) => unknown;

vi.mock("@/lib/shopApi", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/shopApi")>();
  return {
    ...original,
    shopFetch: async (path: string, options: Call["options"] = {}) => {
      const call = { path, options };
      calls.push(call);
      return answer(call);
    },
  };
});

const { ApiError } = await import("@/lib/shopApi");
const api = await import("./productWriteApi");

const fields: ProductFields = {
  name: "Rattan Bag",
  category: "Bags",
  moq: 24,
  shortDescription: "Handmade",
  description: "**Rattan**",
  colors: ["Natural"],
  sizes: ["M"],
  packaging: ["Box"],
  customization: ["Logo"],
  optionGroups: [{ key: "color", label: "Color", options: ["Natural"] }],
  pricing: { currency: "THB", unit: "carton", tiers: [{ minQty: 24, price: 1200 }, { minQty: 100, price: 1100 }] },
  isActive: true,
};

beforeEach(() => {
  calls = [];
  answer = () => ({});
});

const ids = (count: number) => Array.from({ length: count }, (_, index) => `p${index}`);

describe("saving a product", () => {
  it("sends every field in the shape the shop stores them, prices included", () => {
    expect(api.toProductBody(fields)).toEqual({
      name: "Rattan Bag",
      short_description: "Handmade",
      description: "**Rattan**",
      category: "Bags",
      moq: 24,
      colors: ["Natural"],
      sizes: ["M"],
      packaging_options: ["Box"],
      customization_options: ["Logo"],
      option_groups: [{ key: "color", label: "Color", options: ["Natural"] }],
      price_currency: "THB",
      price_unit: "carton",
      price_tiers: [
        { min_qty: 24, price: 1200 },
        { min_qty: 100, price: 1100 },
      ],
      is_active: true,
    });
  });

  it("creates a product and returns its id and web address", async () => {
    answer = () => ({ id: "new-id", slug: "rattan-bag" });
    expect(await api.createProductRecord(fields)).toEqual({ id: "new-id", slug: "rattan-bag", existed: false });
    expect(calls[0]).toMatchObject({ path: "/api/admin/products", options: { method: "POST", admin: true } });
    expect(calls[0].options.json).not.toHaveProperty("id");
    expect(calls[0].options.json).not.toHaveProperty("slug");
  });

  it("keeps the id, web address and date when copying a product from another store", async () => {
    answer = () => ({ id: "old-id", slug: "premium-lunch-box" });
    await api.createProductRecord(fields, { id: "old-id", slug: "premium-lunch-box", createdAt: "2026-08-27T21:51:31.742Z" });
    expect(calls[0].options.json).toMatchObject({ id: "old-id", slug: "premium-lunch-box", created_at: "2026-08-27T21:51:31.742Z" });
  });

  it("says when the product was already there", async () => {
    answer = () => ({ id: "old-id", slug: "premium-lunch-box", existed: true });
    expect(await api.createProductRecord(fields, { id: "old-id" })).toEqual({ id: "old-id", slug: "premium-lunch-box", existed: true });
  });

  it("updates a product", async () => {
    await api.updateProductRecord("a b", fields);
    expect(calls[0]).toMatchObject({ path: "/api/admin/products/a%20b", options: { method: "PUT", admin: true } });
    expect(calls[0].options.json.price_tiers).toHaveLength(2);
  });
});

describe("bulk changes", () => {
  it("shows or hides every id, 200 at a time", async () => {
    await api.setProductsActive(ids(450), true);
    expect(calls.map(call => call.options.json.ids.length)).toEqual([200, 200, 50]);
    expect(calls.every(call => call.path === "/api/admin/products/bulk" && call.options.json.action === "show" && call.options.admin)).toBe(true);
    calls.length = 0;
    await api.setProductsActive(["a"], false);
    expect(calls[0].options.json).toEqual({ action: "hide", ids: ["a"] });
  });

  it("changes one product's visibility the same way", async () => {
    await api.setProductActive("a", true);
    expect(calls[0].options.json).toEqual({ action: "show", ids: ["a"] });
  });

  it("sets one category for every id", async () => {
    await api.setProductsCategory(["a", "b"], "Fashion accessories");
    expect(calls).toHaveLength(1);
    expect(calls[0].options.json).toEqual({ action: "category", ids: ["a", "b"], category: "Fashion accessories" });
  });

  it("does nothing for an empty list", async () => {
    await api.setProductsActive([], true);
    await api.setProductsCategory([], "X");
    expect(await api.deleteProductsBulk([])).toEqual({ deleted: 0, blocked: 0 });
    expect(calls).toHaveLength(0);
  });

  it("deletes a long list 100 at a time and adds up what was deleted and what a quote request kept", async () => {
    const results = [{ deleted: 100, blocked: 0 }, { deleted: 90, blocked: 10 }, { deleted: 3, blocked: 2 }];
    answer = () => results[calls.length - 1];
    expect(await api.deleteProductsBulk(ids(205))).toEqual({ deleted: 193, blocked: 12 });
    expect(calls.map(call => call.options.json.ids.length)).toEqual([100, 100, 5]);
    expect(calls.every(call => call.options.json.action === "delete")).toBe(true);
  });

  it("stops and passes on the problem when a change fails", async () => {
    answer = () => {
      throw new ApiError(403, "Only shop administrators can change the shop.", "not_admin");
    };
    await expect(api.setProductsActive(ids(300), true)).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(1);
  });

  it("deletes one product", async () => {
    await api.deleteProductRecord("a/b");
    expect(calls[0]).toMatchObject({ path: "/api/admin/products/a%2Fb", options: { method: "DELETE", admin: true } });
  });

  it("recognises 'part of a quote request' so the screen can explain it", () => {
    expect(api.isStillReferencedError(new ApiError(409, "x", "in_quote"))).toBe(true);
    expect(api.isStillReferencedError(new ApiError(409, "x", "slug_taken"))).toBe(false);
    expect(api.isStillReferencedError(new Error("in_quote"))).toBe(false);
  });
});

describe("photos", () => {
  const photo = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

  it("uploads a photo with its type, and returns where it can be seen", async () => {
    answer = () => ({ id: "img-1", public_url: "/photos/products/p/img-1.jpg", storage_path: "products/p/img-1.jpg", is_primary: true });
    expect(await api.uploadProductPhoto("p", photo)).toEqual({ id: "img-1", url: "/photos/products/p/img-1.jpg", storagePath: "products/p/img-1.jpg", isPrimary: true });
    expect(calls[0].path).toBe("/api/admin/products/p/photos");
    expect(calls[0].options).toMatchObject({ method: "POST", admin: true, body: photo, headers: { "content-type": "image/jpeg" }, timeoutMs: 90_000 });
  });

  it("can name the photo, caption it, order it and make it the cover", async () => {
    answer = () => ({ id: "x", public_url: "/photos/x.jpg", storage_path: "x", is_primary: false });
    await api.uploadProductPhoto("p", photo, { label: " Side view ", primary: false, sort: 3, imageId: "img-9" });
    const query = new URL(calls[0].path, "https://shop.test").searchParams;
    expect(Object.fromEntries(query)).toEqual({ label: "Side view", primary: "0", sort: "3", imageId: "img-9" });
    calls.length = 0;
    await api.uploadProductPhoto("p", photo, { primary: true });
    expect(calls[0].path).toBe("/api/admin/products/p/photos?primary=1");
  });

  it("leaves the cover to the shop when nothing is said", async () => {
    answer = () => ({ id: "x", public_url: "/photos/x.jpg", storage_path: "x", is_primary: true });
    await api.uploadProductPhoto("p", photo);
    expect(calls[0].path).toBe("/api/admin/products/p/photos");
  });

  it("changes the cover, removes a photo and saves captions", async () => {
    await api.setCoverImage("p", "i");
    await api.deleteImage("p", "i");
    await api.saveImageLabels("p", [{ id: "i", label: "Back" }]);
    expect(calls.map(call => [call.options.method, call.path])).toEqual([
      ["PUT", "/api/admin/products/p/photos/i/cover"],
      ["DELETE", "/api/admin/products/p/photos/i"],
      ["PUT", "/api/admin/products/p/photos/labels"],
    ]);
    expect(calls[2].options.json).toEqual([{ id: "i", label: "Back" }]);
  });
});
