import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error?: unknown };
let oldStore: Result;
let newStore: Array<{ id: string }>;
const created: any[] = [];
const uploads: any[] = [];
const activated: string[] = [];
const events: string[] = [];
const rangeCalls: Array<[number, number]> = [];
const askedIds: string[][] = [];
/** Lets a test change what creating a product does. */
let onCreate: ((options: any) => Promise<{ id: string; slug: string; existed: boolean }>) | null;
let failDelete = false;

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    from: () => {
      const query: any = {
        select: () => query,
        order: () => query,
        range: (from: number, to: number) => {
          rangeCalls.push([from, to]);
          const oldRows = Array.isArray(oldStore.data) ? oldStore.data : [];
          return Promise.resolve({ data: oldStore.error ? null : oldRows.slice(from, to + 1), error: oldStore.error ?? null });
        },
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/catalogueApi", () => ({
  fetchAdminProductsByIds: async (ids: string[]) => {
    askedIds.push(ids);
    return newStore.filter(item => ids.includes(item.id.toLowerCase()));
  },
}));
vi.mock("@/lib/productWriteApi", () => ({
  createProductRecord: vi.fn(async (fields: unknown, options: any) => {
    created.push({ fields, options });
    events.push("create");
    if (onCreate) return onCreate(options);
    return { id: options.id, slug: options.slug, existed: false };
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
  deleteProductRecord: vi.fn(async () => {
    events.push("delete");
    if (failDelete) throw new Error("offline");
  }),
}));

const { CopyFailed, copyAllLegacy, copyLegacyProduct, describeCopyProblems, fieldsFromLegacy, findUncopied } = await import("./legacyCopy");
const { ApiError } = await import("./shopApi");

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
  rangeCalls.length = 0;
  askedIds.length = 0;
  onCreate = null;
  failDelete = false;
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

  const many = (count: number) => Array.from({ length: count }, (_, index) => lunchBox({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, slug: `p-${index}`, product_images: [] }));

  it("reads the whole old store, not just the first thousand products", async () => {
    oldStore = { data: many(1203) };
    expect(await findUncopied()).toHaveLength(1203);
    expect(rangeCalls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("asks the new store only about the old products, 60 at a time, however many products it holds", async () => {
    oldStore = { data: many(130) };
    newStore = [{ id: "00000000-0000-4000-8000-000000000007" }];
    const found = await findUncopied();
    expect(found).toHaveLength(129);
    expect(found.map(item => item.id)).not.toContain("00000000-0000-4000-8000-000000000007");
    expect(askedIds.map(ids => ids.length)).toEqual([60, 60, 10]);
  });

  it("uses what it has read when a later page cannot be read", async () => {
    const calls = { n: 0 };
    oldStore = { data: many(600) };
    const original = rangeCalls.push.bind(rangeCalls);
    rangeCalls.push = (...values: Array<[number, number]>) => {
      calls.n += 1;
      if (calls.n === 2) oldStore = { error: { message: "timeout" } };
      return original(...values);
    };
    expect((await findUncopied()).length).toBe(500);
    rangeCalls.push = original;
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

  it("removes the unfinished copy again, and says why, when a photo cannot be downloaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).endsWith("/2.jpeg") ? new Response("gone", { status: 404 }) : new Response(new Uint8Array([0xff, 0xd8, 0xff, 1]), { headers: { "content-type": "image/jpeg" } }))));
    const failure = await copy().catch(error => error);
    expect(failure).toBeInstanceOf(CopyFailed);
    expect(failure.message).toMatch(/photo in the old store could not be read/);
    expect(failure).toMatchObject({ productName: "Premium Lunch Box", leftBehind: false });
    expect(events).toEqual(["create", "upload", "delete"]);
    expect(activated).toEqual([]);
  });

  it("says when the unfinished copy could not be removed either", async () => {
    failDelete = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const failure = await copy().catch(error => error);
    expect(failure).toMatchObject({ leftBehind: true });
    expect(events).toEqual(["create", "delete"]);
  });

  it("leaves a product the new store already has exactly as it is", async () => {
    onCreate = async options => ({ id: options.id, slug: "premium-lunch-box", existed: true });
    const { result } = await copy();
    expect(result).toEqual({ photos: 0 });
    expect(events).toEqual(["create"]);
    expect(activated).toEqual([]);
  });

  it("asks for the next free web address when a different product already uses the old one", async () => {
    let attempts = 0;
    onCreate = async options => {
      attempts += 1;
      if (attempts === 1) throw new ApiError(409, "A product with this web address already exists.", "slug_taken");
      return { id: options.id, slug: "premium-lunch-box-2", existed: false };
    };
    await copy();
    expect(created.map(entry => entry.options.slug)).toEqual(["premium-lunch-box", undefined]);
    expect(created[1].options.id).toBe("761cbd43-660f-4827-af5f-90ff2c6492d7");
    expect(events).toEqual(["create", "create", "upload", "upload", "upload", "activate"]);
  });

  it("does not retry other creation problems", async () => {
    onCreate = async () => {
      throw new ApiError(400, "The price is not valid.", "bad_request");
    };
    await expect(copy()).rejects.toThrow(/price is not valid/);
    expect(events).toEqual(["create"]);
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

  it("can be run again after a failure: the unfinished copy was removed, so it starts that product afresh", async () => {
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

describe("copying every product", () => {
  const two = () => [lunchBox({ id: "00000000-0000-4000-8000-00000000000a", name: "First", slug: "first", product_images: [image(1)] }), lunchBox({ id: "00000000-0000-4000-8000-00000000000b", name: "Second", slug: "second", product_images: [image(2)] })];

  it("carries on with the other products when one fails", async () => {
    oldStore = { data: two() };
    onCreate = async options => {
      if (options.slug === "first") throw new ApiError(400, "That price step is not valid.", "bad_request");
      return { id: options.id, slug: options.slug, existed: false };
    };
    const summary = await copyAllLegacy(await findUncopied());
    expect(summary.copied).toBe(1);
    expect(summary.failed).toEqual([{ name: "First", reason: "That price step is not valid.", leftBehind: false }]);
    expect(summary.stopped).toBe(false);
    expect(activated).toEqual(["00000000-0000-4000-8000-00000000000b"]);
  });

  it("gives up early when every product would fail the same way", async () => {
    oldStore = { data: two() };
    onCreate = async () => {
      throw new ApiError(401, "Please sign in again.", "sign_in");
    };
    const summary = await copyAllLegacy(await findUncopied());
    expect(summary).toMatchObject({ copied: 0, stopped: true });
    expect(summary.failed).toHaveLength(1);
    expect(created).toHaveLength(1);
  });

  it("reports which product it is on", async () => {
    oldStore = { data: two() };
    const positions: string[] = [];
    await copyAllLegacy(await findUncopied(), { onPosition: (index, count) => positions.push(`${index + 1}/${count}`) });
    expect(positions).toEqual(["1/2", "2/2"]);
  });
});

describe("telling the administrator what went wrong", () => {
  it("says nothing when everything copied", () => {
    expect(describeCopyProblems({ copied: 2, failed: [], stopped: false })).toBe("");
  });

  it("names one product and says nothing was left half-done", () => {
    const text = describeCopyProblems({ copied: 0, failed: [{ name: "Lunch Box", reason: "A photo in the old store could not be read.", leftBehind: false }], stopped: false });
    expect(text).toContain("“Lunch Box” did not copy: A photo in the old store could not be read.");
    expect(text).toContain("Nothing was left half-done");
  });

  it("counts several and tells where an unfinished copy is", () => {
    const text = describeCopyProblems({
      copied: 1,
      failed: [
        { name: "A", reason: "Offline", leftBehind: true },
        { name: "B", reason: "Offline", leftBehind: false },
        { name: "C", reason: "Offline", leftBehind: false },
        { name: "D", reason: "Offline", leftBehind: false },
      ],
      stopped: false,
    });
    expect(text).toContain("4 products did not copy (“A”, “B”, “C” and more)");
    expect(text).toContain("An unfinished hidden copy of “A” is still in Admin → Products → Hidden");
  });
});
