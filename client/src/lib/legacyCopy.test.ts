import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error?: unknown };
let oldStore: Result;
let newStore: Array<{ id: string }>;
const created: any[] = [];
const uploads: any[] = [];
const activated: string[] = [];
const events: string[] = [];

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    from: () => {
      const query: any = { select: () => query, order: () => query, limit: () => Promise.resolve({ data: null, error: null, ...oldStore }) };
      return query;
    },
  }),
}));
vi.mock("@/lib/catalogueApi", () => ({ fetchAdminSummaries: async () => newStore }));
vi.mock("@/lib/productWriteApi", () => ({
  createProductRecord: vi.fn(async (fields: unknown, options: any) => {
    created.push({ fields, options });
    events.push("create");
    return { id: options.id, slug: options.slug };
  }),
  uploadProductPhoto: vi.fn(async (productId: string, blob: Blob, options: unknown) => {
    uploads.push({ productId, blob, options });
    events.push("upload");
    return { id: "x", url: "/photos/x.jpg", storagePath: "x", isPrimary: false };
  }),
  setProductActive: vi.fn(async (id: string, active: boolean) => {
    if (active) activated.push(id);
    events.push("activate");
  }),
}));

const { copyLegacyProduct, fieldsFromLegacy, findUncopied } = await import("./legacyCopy");

const BASE = "https://pysfxmosoijbghfzfhge.supabase.co/storage/v1/object/public/product-images/products/premium-lunch-box";
const image = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  storage_path: `products/premium-lunch-box/${n}.jpeg`,
  public_url: `${BASE}/${n}.jpeg`,
  is_primary: false,
  sort_order: n - 1,
  alt_text: "Premium Lunch Box product image",
  label: null,
  ...extra,
});

/** The product that is in the shop today, as Supabase sends it. */
const lunchBox = (extra: Record<string, unknown> = {}) => ({
  id: "761cbd43-660f-4827-af5f-90ff2c6492d7",
  slug: "premium-lunch-box",
  name: "Premium Lunch Box",
  category: "Apparel",
  moq: 24,
  is_active: true,
  colors: ["all"],
  sizes: ["all"],
  packaging_options: ["any"],
  customization_options: ["default"],
  option_groups: [
    { key: "color", label: "Color", options: ["all"] },
    { key: "size", label: "Size", options: ["all"] },
  ],
  short_description: "Keep meals fresh.",
  description: "**Premium Lunch Box**\n\nKeep meals fresh.",
  created_at: "2026-08-27 21:51:31.742586+00",
  product_images: [image(3), image(1), image(2, { is_primary: true, label: "Open" })],
  ...extra,
});

beforeEach(() => {
  oldStore = { data: [lunchBox()] };
  newStore = [];
  created.length = 0;
  uploads.length = 0;
  activated.length = 0;
  events.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("finding what still has to be copied", () => {
  it("lists the old products that are not in the new store, with their photos in order", async () => {
    const [found] = await findUncopied();
    expect(found).toMatchObject({ id: "761cbd43-660f-4827-af5f-90ff2c6492d7", name: "Premium Lunch Box" });
    expect(found.photos.map(photo => photo.sort_order)).toEqual([0, 1, 2]);
  });

  it("leaves out products that are already there, whatever the letter case of the id", async () => {
    newStore = [{ id: "761CBD43-660F-4827-AF5F-90FF2C6492D7" }];
    expect(await findUncopied()).toEqual([]);
  });

  it("finds nothing when the old store is empty or cannot be read", async () => {
    oldStore = { data: [] };
    expect(await findUncopied()).toEqual([]);
    oldStore = { error: { message: "permission denied" } };
    expect(await findUncopied()).toEqual([]);
  });

  it("skips photos with no address", async () => {
    oldStore = { data: [lunchBox({ product_images: [image(1), { id: "broken", public_url: "" }] })] };
    expect((await findUncopied())[0].photos).toHaveLength(1);
  });
});

describe("turning an old product into a new one", () => {
  it("keeps the text, options and minimum order, and gives prices their defaults", () => {
    const fields = fieldsFromLegacy(lunchBox());
    expect(fields).toMatchObject({
      name: "Premium Lunch Box",
      category: "Apparel",
      moq: 24,
      shortDescription: "Keep meals fresh.",
      colors: ["all"],
      sizes: ["all"],
      isActive: true,
      pricing: { currency: "NGN", unit: "pc", tiers: [] },
    });
    expect(fields.optionGroups).toEqual([
      { key: "color", label: "Color", options: ["all"] },
      { key: "size", label: "Size", options: ["all"] },
    ]);
  });

  it("keeps prices when the old row has them", () => {
    const fields = fieldsFromLegacy(lunchBox({ price_currency: "thb", price_unit: "carton", price_tiers: [{ min_qty: 24, price: 900 }] }));
    expect(fields.pricing).toEqual({ currency: "THB", unit: "carton", tiers: [{ minQty: 24, price: 900 }] });
  });
});

describe("copying a product", () => {
  async function copy() {
    const [legacy] = await findUncopied();
    const progress: string[] = [];
    const result = await copyLegacyProduct(legacy, step => progress.push(`${step.step} ${step.done}/${step.total}`));
    return { result, progress };
  }

  it("creates it hidden with its own id, web address and date, copies each photo, then makes it live", async () => {
    const { result, progress } = await copy();
    expect(events).toEqual(["create", "upload", "upload", "upload", "activate"]);
    expect(result).toEqual({ photos: 3 });
    expect(created[0].fields.isActive).toBe(false);
    expect(created[0].options).toEqual({ id: "761cbd43-660f-4827-af5f-90ff2c6492d7", slug: "premium-lunch-box", createdAt: "2026-08-27T21:51:31.742Z" });
    expect(activated).toEqual(["761cbd43-660f-4827-af5f-90ff2c6492d7"]);
    expect(progress[0]).toBe("Creating the product 0/3");
    expect(progress).toContain("Copying photo 2 of 3 1/3");
    expect(progress[progress.length - 1]).toBe("Finishing 3/3");
  });

  it("downloads each photo from the old store and hands it over under the same photo id, keeping the cover and the order", async () => {
    await copy();
    expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([`${BASE}/1.jpeg`, `${BASE}/2.jpeg`, `${BASE}/3.jpeg`]);
    expect(uploads.map(upload => upload.options)).toEqual([
      { imageId: "00000000-0000-4000-8000-000000000001", label: undefined, primary: false, sort: 0 },
      { imageId: "00000000-0000-4000-8000-000000000002", label: "Open", primary: true, sort: 1 },
      { imageId: "00000000-0000-4000-8000-000000000003", label: undefined, primary: false, sort: 2 },
    ]);
    expect(uploads.every(upload => upload.productId === "761cbd43-660f-4827-af5f-90ff2c6492d7" && upload.blob.size === 6)).toBe(true);
  });

  it("makes the first photo the cover when the old product had none", async () => {
    oldStore = { data: [lunchBox({ product_images: [image(1), image(2)] })] };
    await copy();
    expect(uploads.map(upload => upload.options.primary)).toEqual([true, false]);
  });

  it("leaves a product hidden if it was hidden", async () => {
    oldStore = { data: [lunchBox({ is_active: false })] };
    await copy();
    expect(activated).toEqual([]);
    expect(events).not.toContain("activate");
  });

  it("keeps the product hidden, and says so, when a photo cannot be downloaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).endsWith("/2.jpeg") ? new Response("gone", { status: 404 }) : new Response(new Uint8Array([0xff, 0xd8, 0xff, 1]), { headers: { "content-type": "image/jpeg" } }))));
    await expect(copy()).rejects.toThrow(/photo in the old store could not be read/);
    expect(events).toEqual(["create", "upload"]);
    expect(activated).toEqual([]);
  });

  it("refuses something that is not a picture", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>", { headers: { "content-type": "text/html" } })));
    await expect(copy()).rejects.toThrow(/could not be read/);
    expect(uploads).toHaveLength(0);
  });

  it("reports a photo that cannot be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(copy()).rejects.toThrow(/could not be downloaded/);
  });

  it("can be run again after a failure: it creates and uploads the same things again, which the shop accepts as already done", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("offline")));
    await expect(copy()).rejects.toThrow();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 1]), { headers: { "content-type": "image/jpeg" } })));
    events.length = 0;
    await copy();
    expect(events).toEqual(["create", "upload", "upload", "upload", "activate"]);
    expect(created.map(entry => entry.options.id)).toEqual(["761cbd43-660f-4827-af5f-90ff2c6492d7", "761cbd43-660f-4827-af5f-90ff2c6492d7"]);
  });
});
