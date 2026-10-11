import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { forgetAdmins } from "./adminAuth";
import { handleApi, parseProductInput } from "./api";
import { addImage, insertProduct, type ProductInput } from "./store";
import { ADMIN_ID, USER_ID, fakeSupabase, makeToken, type PretendSupabase } from "./testAuth";
import { JPEG_BYTES, PNG_BYTES, createTestEnv, type TestEnv } from "./testEnv";

let test: TestEnv;
let supabase: PretendSupabase;

beforeAll(async () => {
  test = await createTestEnv();
}, 60_000);
afterAll(() => test?.dispose());
beforeEach(async () => {
  await test.reset();
  forgetAdmins();
  supabase = fakeSupabase();
});

const ctx = { waitUntil: () => undefined };
const adminToken = makeToken(ADMIN_ID);
const userToken = makeToken(USER_ID);

async function call(path: string, options: { method?: string; token?: string | null; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token !== null && options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await handleApi(
    new Request(`https://shop.test${path}`, { method: options.method ?? "GET", headers, body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined) }),
    test.env,
    ctx,
    { admin: supabase.deps },
  );
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

const admin = (path: string, options: Parameters<typeof call>[1] = {}) => call(`/api/admin${path}`, { token: adminToken, ...options });

const product = (overrides: Partial<ProductInput> = {}): ProductInput => ({
  name: "Rattan Bag",
  short_description: "",
  description: "",
  category: "Bags",
  moq: 24,
  colors: [],
  sizes: [],
  packaging_options: [],
  customization_options: [],
  option_groups: [],
  price_currency: "NGN",
  price_unit: "pc",
  price_tiers: [],
  is_active: true,
  ...overrides,
});

let counter = 0;
async function seed(overrides: Partial<ProductInput> & { slug?: string } = {}) {
  counter += 1;
  const { slug, ...rest } = overrides;
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  await insertProduct(test.env.DB, { id, slug: slug ?? `seed-${counter}`, input: product(rest), createdBy: ADMIN_ID });
  return id;
}

const upload = (productId: string, query = "", bytes: Uint8Array = JPEG_BYTES, token: string | null = adminToken) =>
  call(`/api/admin/products/${productId}/photos${query}`, { method: "POST", token, raw: bytes, headers: { "content-type": "image/jpeg" } });

describe("who may change the shop", () => {
  it("refuses a request with no sign-in", async () => {
    const { status, data } = await call("/api/admin/products", { method: "POST", token: null, body: product() });
    expect(status).toBe(401);
    expect(data.code).toBe("sign_in");
    expect(supabase.state.calls).toHaveLength(0);
  });

  it("refuses text that is not a sign-in token without asking Supabase", async () => {
    expect((await call("/api/admin/me", { token: "not-a-token" })).status).toBe(401);
    expect((await call("/api/admin/me", { token: "a.b.c" })).status).toBe(401);
    expect(supabase.state.calls).toHaveLength(0);
  });

  it("refuses a token whose subject is not a user id", async () => {
    const odd = makeToken("'; drop table products; --");
    expect((await call("/api/admin/me", { token: odd })).status).toBe(401);
    expect(supabase.state.calls).toHaveLength(0);
  });

  it("refuses an expired session without asking Supabase", async () => {
    const { status } = await call("/api/admin/me", { token: makeToken(ADMIN_ID, -60) });
    expect(status).toBe(401);
    expect(supabase.state.calls).toHaveLength(0);
  });

  it("refuses an ordinary customer", async () => {
    const { status, data } = await call("/api/admin/me", { token: userToken });
    expect(status).toBe(403);
    expect(data.code).toBe("not_admin");
  });

  it("refuses someone with no profile", async () => {
    supabase.state.roles.delete(ADMIN_ID);
    expect((await admin("/me")).status).toBe(403);
  });

  it("lets an administrator in, asking Supabase with the website's public key and the person's own session", async () => {
    const { status, data } = await admin("/me");
    expect(status).toBe(200);
    expect(data.userId).toBe(ADMIN_ID);
    const [call1] = supabase.state.calls;
    expect(call1.url).toBe(`https://proj.supabase.co/rest/v1/profiles?select=id,role&id=eq.${ADMIN_ID}&limit=1`);
    expect(call1.headers.apikey).toBe("sb_publishable_TEST_KEY");
    expect(call1.headers.authorization).toBe(`Bearer ${adminToken}`);
  });

  it("trusts Supabase's answer when it says the session is not valid", async () => {
    supabase.state.rejectAllTokens = true;
    expect((await admin("/me")).status).toBe(401);
  });

  it("remembers a good answer for a minute so a long task does not ask Supabase for every step", async () => {
    await admin("/me");
    await admin("/me");
    await admin("/products/hidden-count");
    expect(supabase.state.calls).toHaveLength(1);
  });

  it("does not remember a refusal", async () => {
    supabase.state.rejectAllTokens = true;
    await admin("/me");
    supabase.state.rejectAllTokens = false;
    expect((await admin("/me")).status).toBe(200);
  });

  it("says what to do when Supabase is paused or unreachable", async () => {
    supabase.state.breakWith = "unreachable";
    const { status, data } = await admin("/me");
    expect(status).toBe(503);
    expect(data.code).toBe("auth_unreachable");
    expect(data.error).toMatch(/paused/i);
  });

  it("reports a Supabase outage as temporary", async () => {
    supabase.state.breakWith = 502;
    expect((await admin("/me")).status).toBe(503);
  });

  it("says so when the sign-in check is not set up", async () => {
    const saved = test.env.SUPABASE_PUBLISHABLE_KEY;
    test.env.SUPABASE_PUBLISHABLE_KEY = "";
    try {
      const { status, data } = await admin("/me");
      expect(status).toBe(503);
      expect(data.code).toBe("auth_not_configured");
    } finally {
      test.env.SUPABASE_PUBLISHABLE_KEY = saved;
    }
  });

  it("protects every change, not just one", async () => {
    const id = await seed();
    const attempts: Array<[string, string]> = [
      ["POST", "/api/admin/products"],
      ["PUT", `/api/admin/products/${id}`],
      ["DELETE", `/api/admin/products/${id}`],
      ["POST", "/api/admin/products/bulk"],
      ["POST", `/api/admin/products/${id}/photos`],
      ["PUT", `/api/admin/products/${id}/photos/labels`],
      ["DELETE", `/api/admin/products/${id}/photos/${id}`],
      ["PUT", `/api/admin/products/${id}/photos/${id}/cover`],
      ["GET", "/api/admin/products"],
      ["GET", `/api/admin/products/${id}`],
    ];
    for (const [method, path] of attempts) expect((await call(path, { method, token: userToken })).status, `${method} ${path}`).toBe(403);
    expect((await call("/api/catalogue/products")).data.total).toBe(1);
  });
});

describe("what shoppers see", () => {
  it("lists live products only, newest first, without saying who added them", async () => {
    await seed({ name: "Old", slug: "old" });
    await new Promise(resolve => setTimeout(resolve, 5));
    const newest = await seed({ name: "New", slug: "new" });
    await seed({ name: "Draft", slug: "draft", is_active: false });
    await addImage(test.env.DB, { id: "00000000-0000-4000-8000-0000000000aa", productId: newest, storagePath: `products/${newest}/00000000-0000-4000-8000-0000000000aa.jpg`, altText: "x", label: null, contentType: "image/jpeg", sizeBytes: 1 });
    const { status, data } = await call("/api/catalogue/products");
    expect(status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.items.map((item: any) => item.name)).toEqual(["New", "Old"]);
    expect(data.items[0].product_images[0].public_url).toBe(`/photos/products/${newest}/00000000-0000-4000-8000-0000000000aa.jpg`);
    expect(JSON.stringify(data)).not.toContain(ADMIN_ID);
    expect(data.items[0].is_active).toBe(true);
  });

  it("filters, sorts and pages", async () => {
    for (let n = 1; n <= 5; n += 1) await seed({ name: `Item ${n}`, slug: `item-${n}`, moq: n, category: n % 2 ? "Odd" : "Even" });
    const odd = await call("/api/catalogue/products?category=Odd&sort=moq&size=2&page=1");
    expect(odd.data.items.map((item: any) => item.name)).toEqual(["Item 5"]);
    expect(odd.data.total).toBe(3);
    expect((await call("/api/catalogue/products?q=item+3")).data.items.map((item: any) => item.name)).toEqual(["Item 3"]);
    expect((await call("/api/catalogue/products?category=All&size=60")).data.total).toBe(5);
    expect((await call("/api/catalogue/products?slugs=item-1,item-4")).data.total).toBe(2);
    expect((await call("/api/catalogue/products?slugs=")).data.total).toBe(0);
  });

  it("limits how many it returns at once", async () => {
    await seed();
    expect((await call("/api/catalogue/products?size=9999")).status).toBe(200);
    expect((await call("/api/catalogue/products?size=abc")).status).toBe(400);
  });

  it("shows one live product, and 404 for a draft or a missing one", async () => {
    await seed({ name: "Shown", slug: "shown" });
    await seed({ name: "Hidden", slug: "hidden", is_active: false });
    expect((await call("/api/catalogue/products/shown")).data.name).toBe("Shown");
    expect((await call("/api/catalogue/products/hidden")).status).toBe(404);
    expect((await call("/api/catalogue/products/nothing")).status).toBe(404);
  });

  it("suggests related products from the same category", async () => {
    await seed({ name: "Me", slug: "me", category: "Bags" });
    await seed({ name: "Sibling", slug: "sibling", category: "Bags" });
    await seed({ name: "Other", slug: "other", category: "Toys" });
    const { data } = await call("/api/catalogue/related?slug=me&category=Bags");
    expect(data.items.map((item: any) => item.name)).toEqual(["Sibling"]);
    expect((await call("/api/catalogue/related?slug=me")).data.items).toEqual([]);
  });

  it("counts categories", async () => {
    await seed({ category: "Bags" });
    await seed({ category: "Bags" });
    await seed({ category: "Toys" });
    await seed({ category: "Secret", is_active: false });
    expect((await call("/api/catalogue/categories")).data.items).toEqual([
      { category: "Bags", count: 2 },
      { category: "Toys", count: 1 },
    ]);
  });

  it("gives names for quote screens, leaving out hidden products", async () => {
    const live = await seed({ name: "Live", slug: "live" });
    const hidden = await seed({ name: "Hid", slug: "hid", is_active: false });
    const { data } = await call(`/api/catalogue/names?ids=${live},${hidden}`);
    expect(data.items).toEqual([{ id: live, name: "Live", slug: "live" }]);
    expect((await call("/api/catalogue/names?ids=not-an-id")).status).toBe(400);
  });

  it("only allows reading", async () => {
    expect((await call("/api/catalogue/products", { method: "POST", body: product() })).status).toBe(405);
    expect((await call("/api/catalogue/nothing")).status).toBe(404);
  });
});

describe("checking what an administrator typed", () => {
  const bad = (overrides: Record<string, unknown>) => () => parseProductInput({ ...product(), ...overrides });

  it("accepts a normal product and tidies it", () => {
    const parsed = parseProductInput({ name: "  Bag  ", category: " Bags ", price_currency: "thb", price_tiers: [{ min_qty: 200, price: 90 }, { min_qty: 50, price: 100 }, { min_qty: 50, price: 95 }], colors: [" Red ", ""] });
    expect(parsed).toMatchObject({ name: "Bag", category: "Bags", moq: 1, price_currency: "THB", price_unit: "pc", is_active: true, colors: ["Red"] });
    expect(parsed.price_tiers).toEqual([{ min_qty: 50, price: 95 }, { min_qty: 200, price: 90 }]);
  });

  it("explains what is wrong", () => {
    expect(bad({ name: "  " })).toThrow(/name/i);
    expect(bad({ category: "" })).toThrow(/category/i);
    expect(bad({ moq: 0 })).toThrow(/minimum order/i);
    expect(bad({ moq: 1.5 })).toThrow(/minimum order/i);
    expect(bad({ price_currency: "N1" })).toThrow(/currency/i);
    expect(bad({ price_unit: "  " })).toThrow(/unit/i);
    expect(bad({ price_tiers: [{ min_qty: 0, price: 5 }] })).toThrow(/price step/i);
    expect(bad({ price_tiers: [{ min_qty: 1, price: -1 }] })).toThrow(/price step/i);
    expect(bad({ price_tiers: "free" })).toThrow(/price list/i);
    expect(bad({ name: "x".repeat(201) })).toThrow(/too long/i);
    expect(bad({ colors: "red" })).toThrow(/colours/i);
    expect(bad({ is_active: "yes" })).toThrow(/visible/i);
    expect(bad({ option_groups: [1] })).toThrow();
    expect(() => parseProductInput("nope")).toThrow(/JSON object/i);
  });
});

describe("adding and editing products", () => {
  it("creates a product and picks a free web address", async () => {
    await seed({ slug: "rattan-bag" });
    const { status, data } = await admin("/products", { method: "POST", body: product() });
    expect(status).toBe(201);
    expect(data.slug).toBe("rattan-bag-2");
    const saved = await admin(`/products/${data.id}`);
    expect(saved.data).toMatchObject({ name: "Rattan Bag", created_by: ADMIN_ID, price_currency: "NGN" });
  });

  it("saves prices, which the old database could not", async () => {
    const { data } = await admin("/products", { method: "POST", body: product({ price_currency: "THB", price_unit: "carton", price_tiers: [{ min_qty: 24, price: 1200 }] }) });
    expect((await admin(`/products/${data.id}`)).data).toMatchObject({ price_currency: "THB", price_unit: "carton", price_tiers: [{ min_qty: 24, price: 1200 }] });
  });

  it("keeps a chosen id and web address, and treats a repeat as already done", async () => {
    const id = "761cbd43-660f-4827-af5f-90ff2c6492d7";
    const first = await admin("/products", { method: "POST", body: { ...product({ name: "Premium Lunch Box" }), id, slug: "premium-lunch-box" } });
    expect(first).toMatchObject({ status: 201, data: { id, slug: "premium-lunch-box" } });
    const again = await admin("/products", { method: "POST", body: { ...product({ name: "Premium Lunch Box" }), id, slug: "premium-lunch-box" } });
    expect(again).toMatchObject({ status: 200, data: { id, slug: "premium-lunch-box", existed: true } });
    expect((await call("/api/catalogue/products")).data.total).toBe(1);
  });

  it("keeps the original date when a product is copied from another store", async () => {
    const id = "761cbd43-660f-4827-af5f-90ff2c6492d7";
    await admin("/products", { method: "POST", body: { ...product(), id, slug: "old-one", created_at: "2026-08-27 21:51:31.742586+00" } });
    expect((await admin(`/products/${id}`)).data).toMatchObject({ created_at: "2026-08-27T21:51:31.742Z", updated_at: "2026-08-27T21:51:31.742Z" });
    const future = await admin("/products", { method: "POST", body: { ...product(), created_at: "2999-01-01T00:00:00Z" } });
    expect(future.status).toBe(400);
    expect((await admin("/products", { method: "POST", body: { ...product(), created_at: "yesterday-ish" } })).status).toBe(400);
  });

  it("refuses a chosen web address that is taken, or not valid", async () => {
    await seed({ slug: "taken" });
    const taken = await admin("/products", { method: "POST", body: { ...product(), slug: "taken" } });
    expect(taken).toMatchObject({ status: 409, data: { code: "slug_taken" } });
    expect((await admin("/products", { method: "POST", body: { ...product(), slug: "Not Valid!" } })).status).toBe(400);
    expect((await admin("/products", { method: "POST", body: { ...product(), id: "nope" } })).status).toBe(404);
  });

  it("refuses an invalid product with a reason and saves nothing", async () => {
    const { status, data } = await admin("/products", { method: "POST", body: product({ moq: 0 }) });
    expect(status).toBe(400);
    expect(data.error).toMatch(/minimum order/i);
    expect((await admin("/products")).data.total).toBe(0);
  });

  it("refuses a request that is not JSON", async () => {
    expect((await admin("/products", { method: "POST", raw: "{oops", headers: { "content-type": "application/json" } })).status).toBe(400);
  });

  it("edits a product", async () => {
    const id = await seed({ name: "Old", slug: "old" });
    expect((await admin(`/products/${id}`, { method: "PUT", body: product({ name: "New", is_active: false, price_tiers: [{ min_qty: 1, price: 9 }] }) })).data).toEqual({ id });
    expect((await admin(`/products/${id}`)).data).toMatchObject({ name: "New", slug: "old", is_active: false, price_tiers: [{ min_qty: 1, price: 9 }] });
    expect((await admin("/products/00000000-0000-4000-8000-999999999999", { method: "PUT", body: product() })).status).toBe(404);
  });

  it("lists everything for admins, with filters and a hidden count", async () => {
    await seed({ name: "Live", slug: "live" });
    await seed({ name: "Draft A", slug: "draft-a", is_active: false });
    await seed({ name: "Draft B", slug: "draft-b", is_active: false });
    expect((await admin("/products")).data.total).toBe(3);
    expect((await admin("/products?status=hidden")).data.items.map((item: any) => item.name).sort()).toEqual(["Draft A", "Draft B"]);
    expect((await admin("/products?status=live")).data.total).toBe(1);
    expect((await admin("/products?q=draft-a")).data.total).toBe(1);
    expect((await admin("/products/hidden-count")).data).toEqual({ count: 2 });
    const summaries = (await admin("/products/summaries?status=hidden")).data.items;
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({ isActive: false });
  });

  it("fetches several products by id, hidden ones too", async () => {
    const a = await seed({ name: "A", slug: "a" });
    const b = await seed({ name: "B", slug: "b", is_active: false });
    expect((await admin(`/products/by-ids?ids=${a},${b}`)).data.items.map((item: any) => item.name).sort()).toEqual(["A", "B"]);
  });
});

describe("photos", () => {
  it("stores a photo in the photo storage and records it, the first one becoming the cover", async () => {
    const id = await seed();
    const first = await upload(id);
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({ product_id: id, is_primary: true, sort_order: 0, alt_text: "Rattan Bag product image" });
    expect(first.data.storage_path).toMatch(new RegExp(`^products/${id}/[0-9a-f-]{36}\\.jpg$`));
    expect(first.data.public_url).toBe(`/photos/${first.data.storage_path}`);

    const stored = await test.env.PHOTOS.get(first.data.storage_path);
    expect(stored?.httpMetadata?.contentType).toBe("image/jpeg");
    expect(stored?.httpMetadata?.cacheControl).toContain("immutable");
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(JPEG_BYTES);

    const second = await upload(id, "?label=Side%20view");
    expect(second.data).toMatchObject({ is_primary: false, sort_order: 1, label: "Side view", alt_text: "Side view" });
  });

  it("can set the cover, the order and the id when uploading", async () => {
    const id = await seed();
    const imageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await upload(id);
    const cover = await upload(id, `?imageId=${imageId}&primary=1&sort=7`, PNG_BYTES);
    expect(cover.data).toMatchObject({ id: imageId, is_primary: true, sort_order: 7 });
    expect(cover.data.storage_path).toBe(`products/${id}/${imageId}.png`);
    const product = (await admin(`/products/${id}`)).data;
    expect(product.product_images.filter((image: any) => image.is_primary).map((image: any) => image.id)).toEqual([imageId]);
  });

  it("accepts the same photo twice (a retry) without a second copy", async () => {
    const id = await seed();
    const imageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect((await upload(id, `?imageId=${imageId}`)).status).toBe(201);
    expect((await upload(id, `?imageId=${imageId}`)).status).toBe(200);
    expect((await admin(`/products/${id}`)).data.product_images).toHaveLength(1);
  });

  it("refuses files that are not photos, empty files and oversized ones", async () => {
    const id = await seed();
    const notPhoto = await upload(id, "", new TextEncoder().encode("<html><script>alert(1)</script></html>"));
    expect(notPhoto).toMatchObject({ status: 415, data: { code: "not_a_photo" } });
    expect((await upload(id, "", new Uint8Array())).status).toBe(400);
    const huge = await call(`/api/admin/products/${id}/photos`, { method: "POST", token: adminToken, raw: JPEG_BYTES, headers: { "content-length": String(13 * 1024 * 1024) } });
    expect(huge.status).toBe(413);
    expect((await admin(`/products/${id}`)).data.product_images).toHaveLength(0);
  });

  it("leaves no stored file behind when the photo cannot be recorded", async () => {
    const id = await seed();
    const list = async () => (await (test.env.PHOTOS as any).list()).objects.length;
    await upload(id, "?primary=maybe&sort=oops");
    expect(await list()).toBe(0);
  });

  it("refuses a photo for a missing product and stops at 30 photos", async () => {
    expect((await upload("00000000-0000-4000-8000-999999999999")).status).toBe(404);
    const id = await seed();
    for (let n = 0; n < 30; n += 1) {
      const imageId = `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`;
      await addImage(test.env.DB, { id: imageId, productId: id, storagePath: `products/${id}/${imageId}.jpg`, altText: null, label: null, contentType: "image/jpeg", sizeBytes: 1 });
    }
    expect(await upload(id)).toMatchObject({ status: 409, data: { code: "too_many_photos" } });
  });

  it("removes a photo and its file, and promotes the next cover", async () => {
    const id = await seed();
    const one = (await upload(id)).data;
    const two = (await upload(id)).data;
    expect((await admin(`/products/${id}/photos/${one.id}`, { method: "DELETE" })).data).toEqual({ deleted: true });
    expect(await test.env.PHOTOS.get(one.storage_path)).toBeNull();
    expect(await test.env.PHOTOS.get(two.storage_path)).not.toBeNull();
    expect((await admin(`/products/${id}`)).data.product_images.map((image: any) => [image.id, image.is_primary])).toEqual([[two.id, true]]);
    expect((await admin(`/products/${id}/photos/${one.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("changes the cover and the captions", async () => {
    const id = await seed();
    const one = (await upload(id)).data;
    const two = (await upload(id)).data;
    expect((await admin(`/products/${id}/photos/${two.id}/cover`, { method: "PUT" })).status).toBe(200);
    expect((await admin(`/products/${id}/photos/labels`, { method: "PUT", body: [{ id: one.id, label: "Back" }] })).status).toBe(200);
    const product = (await admin(`/products/${id}`)).data;
    expect(product.product_images.map((image: any) => [image.id, image.is_primary, image.label])).toEqual([
      [two.id, true, null],
      [one.id, false, "Back"],
    ]);
    expect((await admin(`/products/${id}/photos/00000000-0000-4000-8000-999999999999/cover`, { method: "PUT" })).status).toBe(404);
    expect((await admin(`/products/${id}/photos/labels`, { method: "PUT", body: { nope: true } })).status).toBe(400);
  });
});

describe("removing products", () => {
  it("deletes a product, its photo records and its files", async () => {
    const id = await seed();
    const photo = (await upload(id)).data;
    expect((await admin(`/products/${id}`, { method: "DELETE" })).data).toEqual({ deleted: 1 });
    expect((await admin(`/products/${id}`)).status).toBe(404);
    expect(await test.env.PHOTOS.get(photo.storage_path)).toBeNull();
    expect((await admin(`/products/${id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("will not delete a product that is part of a quote request", async () => {
    const id = await seed();
    const photo = (await upload(id)).data;
    supabase.state.quoteProductIds.add(id);
    expect(await admin(`/products/${id}`, { method: "DELETE" })).toMatchObject({ status: 409, data: { code: "in_quote" } });
    expect((await admin(`/products/${id}`)).status).toBe(200);
    expect(await test.env.PHOTOS.get(photo.storage_path)).not.toBeNull();
    // The quote check is asked with the administrator's own session, not a master key.
    const quoteCall = supabase.state.calls.find(entry => entry.url.includes("quote_request_items"));
    expect(quoteCall?.headers.authorization).toBe(`Bearer ${adminToken}`);
  });

  it("deletes nothing when it cannot tell whether a product is in a quote", async () => {
    const id = await seed();
    supabase.state.failQuotes = true;
    expect(await admin(`/products/${id}`, { method: "DELETE" })).toMatchObject({ status: 502, data: { code: "quote_check_failed" } });
    expect((await admin(`/products/${id}`)).status).toBe(200);
  });
});

describe("changing many products at once", () => {
  it("shows, hides and re-categorises", async () => {
    const ids = [await seed({ is_active: false }), await seed({ is_active: false }), await seed({ is_active: false })];
    expect((await admin("/products/bulk", { method: "POST", body: { action: "show", ids } })).data).toEqual({ updated: 3 });
    expect((await call("/api/catalogue/products")).data.total).toBe(3);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "hide", ids: ids.slice(0, 2) } })).data).toEqual({ updated: 2 });
    expect((await admin("/products/hidden-count")).data.count).toBe(2);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "category", ids, category: "  Snacks " } })).data).toEqual({ updated: 3 });
    expect((await call("/api/catalogue/categories")).data.items).toEqual([{ category: "Snacks", count: 1 }]);
  });

  it("deletes the ones it can and reports the ones kept because of quotes", async () => {
    const free = await seed();
    const inQuote = await seed();
    const photo = (await upload(free)).data;
    supabase.state.quoteProductIds.add(inQuote);
    const { data } = await admin("/products/bulk", { method: "POST", body: { action: "delete", ids: [free, inQuote] } });
    expect(data).toEqual({ deleted: 1, blocked: 1 });
    expect((await admin(`/products/${inQuote}`)).status).toBe(200);
    expect((await admin(`/products/${free}`)).status).toBe(404);
    expect(await test.env.PHOTOS.get(photo.storage_path)).toBeNull();
  });

  it("refuses bad requests", async () => {
    const id = await seed();
    expect((await admin("/products/bulk", { method: "POST", body: { action: "explode", ids: [id] } })).status).toBe(400);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "show", ids: [] } })).status).toBe(400);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "show", ids: ["nope"] } })).status).toBe(400);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "category", ids: [id], category: "" } })).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "show", ids: many } })).status).toBe(400);
    expect((await admin("/products/bulk", { method: "GET" })).status).toBe(405);
  });

  it("copes with a few hundred at once", async () => {
    const ids: string[] = [];
    const statements = [];
    for (let n = 0; n < 250; n += 1) {
      const id = `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
      ids.push(id);
      statements.push(test.env.DB.prepare("INSERT INTO products (id, slug, name, category, is_active) VALUES (?, ?, ?, 'Other', 0)").bind(id, `many-${n}`, `Many ${n}`));
    }
    await test.env.DB.batch(statements);
    expect((await admin("/products/bulk", { method: "POST", body: { action: "show", ids } })).data).toEqual({ updated: 250 });
    expect((await admin("/products/bulk", { method: "POST", body: { action: "delete", ids } })).data).toEqual({ deleted: 250, blocked: 0 });
  });
});

describe("sharing answers between visitors", () => {
  function fakeCache() {
    const store = new Map<string, Response>();
    return {
      store,
      puts: [] as Array<{ url: string; cacheControl: string | null }>,
      async match(request: Request) {
        return store.get(request.url)?.clone();
      },
      async put(request: Request, response: Response) {
        store.set(request.url, response.clone());
        this.puts.push({ url: request.url, cacheControl: response.headers.get("cache-control") });
      },
    };
  }

  /** Counts how often the database is asked, so "served from memory" can be proven. */
  function countingDb() {
    const counter = { queries: 0 };
    const db = {
      prepare: (sql: string) => {
        counter.queries += 1;
        return test.env.DB.prepare(sql);
      },
      batch: (statements: any[]) => test.env.DB.batch(statements),
    } as typeof test.env.DB;
    return { db, counter };
  }

  async function visit(path: string, cache: ReturnType<typeof fakeCache> | null, db = test.env.DB, headers: Record<string, string> = {}) {
    const pending: Promise<unknown>[] = [];
    const response = await handleApi(new Request(`https://shop.test${path}`, { headers }), { ...test.env, DB: db }, { waitUntil: promise => void pending.push(promise) }, { admin: supabase.deps, cache });
    await Promise.all(pending);
    return { status: response.status, body: await response.text(), cacheControl: response.headers.get("cache-control") };
  }

  it("answers the same shopper request from memory instead of asking the database again", async () => {
    await seed({ name: "Shared", slug: "shared" });
    const cache = fakeCache();
    const { db, counter } = countingDb();
    const first = await visit("/api/catalogue/products?page=0", cache, db);
    const afterFirst = counter.queries;
    expect(afterFirst).toBeGreaterThan(0);
    const second = await visit("/api/catalogue/products?page=0", cache, db);
    expect(counter.queries).toBe(afterFirst);
    expect(second).toEqual(first);
    expect(JSON.parse(second.body).items[0].name).toBe("Shared");
  });

  it("remembers it for 30 seconds on Cloudflare's side but tells browsers to always ask", async () => {
    await seed();
    const cache = fakeCache();
    const first = await visit("/api/catalogue/categories", cache);
    expect(first.cacheControl).toBe("no-store");
    expect(cache.puts).toEqual([{ url: "https://shop.test/api/catalogue/categories", cacheControl: "public, max-age=30" }]);
    expect((await visit("/api/catalogue/categories", cache)).cacheControl).toBe("no-store");
  });

  it("keeps different questions apart", async () => {
    await seed({ name: "Alpha", slug: "alpha", category: "Bags" });
    await seed({ name: "Beta", slug: "beta", category: "Toys" });
    const cache = fakeCache();
    const bags = JSON.parse((await visit("/api/catalogue/products?category=Bags", cache)).body);
    const toys = JSON.parse((await visit("/api/catalogue/products?category=Toys", cache)).body);
    expect(bags.items.map((item: any) => item.name)).toEqual(["Alpha"]);
    expect(toys.items.map((item: any) => item.name)).toEqual(["Beta"]);
  });

  it("gives every visitor the same answer whatever headers they send", async () => {
    await seed({ name: "Same", slug: "same" });
    const cache = fakeCache();
    const { db, counter } = countingDb();
    await visit("/api/catalogue/products", cache, db);
    const afterFirst = counter.queries;
    const withSignIn = await visit("/api/catalogue/products", cache, db, { authorization: `Bearer ${adminToken}`, cookie: "a=b", "accept-language": "th" });
    expect(counter.queries).toBe(afterFirst);
    expect(JSON.parse(withSignIn.body).total).toBe(1);
  });

  it("treats the same question written differently as one", async () => {
    await seed({ name: "Tote Bag", slug: "tote" });
    const cache = fakeCache();
    const { db, counter } = countingDb();
    await visit("/api/catalogue/products?q=Tote", cache, db);
    const afterFirst = counter.queries;
    for (const path of [
      "/api/catalogue/products?q=tote",
      "/api/catalogue/products?q=TOTE&x=1&utm_source=ad",
      "/api/catalogue/products?size=24&page=0&q=tote&sort=newest&category=All",
      "/api/catalogue/products?q=%20tote%20",
    ]) {
      expect(JSON.parse((await visit(path, cache, db)).body).total, path).toBe(1);
    }
    expect(counter.queries).toBe(afterFirst);
    expect(cache.puts).toHaveLength(1);
  });

  it("does not let a huge page number or random extras make every request look new", async () => {
    const cache = fakeCache();
    for (const query of ["?page=100000", "?page=999999", "?page=200&junk=1", "?junk=2&page=500"]) await visit(`/api/catalogue/products${query}`, cache);
    expect(cache.puts).toHaveLength(1);
  });

  it("says in a header whether the answer came from memory", async () => {
    const cache = fakeCache();
    const note = async (memory: ReturnType<typeof fakeCache> | null) => {
      const pending: Promise<unknown>[] = [];
      const response = await handleApi(new Request("https://shop.test/api/catalogue/categories"), test.env, { waitUntil: promise => void pending.push(promise) }, { admin: supabase.deps, cache: memory });
      await Promise.all(pending);
      return response.headers.get("x-shop-cache");
    };
    expect(await note(cache)).toBe("miss");
    expect(await note(cache)).toBe("hit");
    expect(await note(null)).toBe("off");
  });

  it("never remembers a failure", async () => {
    const cache = fakeCache();
    expect((await visit("/api/catalogue/products/not-yet", cache)).status).toBe(404);
    expect(cache.puts).toHaveLength(0);
    await seed({ name: "Now here", slug: "not-yet" });
    expect((await visit("/api/catalogue/products/not-yet", cache)).status).toBe(200);
  });

  it("never remembers anything an administrator sees, or any change", async () => {
    const cache = fakeCache();
    await admin("/products");
    const response = await handleApi(new Request("https://shop.test/api/admin/products", { headers: { authorization: `Bearer ${adminToken}` } }), test.env, ctx, { admin: supabase.deps, cache });
    expect(response.status).toBe(200);
    expect(cache.puts).toHaveLength(0);
    const post = await handleApi(new Request("https://shop.test/api/catalogue/products", { method: "POST" }), test.env, ctx, { admin: supabase.deps, cache });
    expect(post.status).toBe(405);
    expect(cache.puts).toHaveLength(0);
  });

  it("still works when there is no memory to use", async () => {
    await seed({ name: "Plain", slug: "plain" });
    expect(JSON.parse((await visit("/api/catalogue/products", null)).body).total).toBe(1);
  });
});

describe("unknown or wrongly used addresses", () => {
  it("answers 404 and 405 politely", async () => {
    const id = await seed();
    expect((await admin("/nothing")).status).toBe(404);
    expect((await admin("/products/not-a-uuid")).status).toBe(404);
    expect((await admin(`/products/${id}`, { method: "PATCH" })).status).toBe(405);
    expect((await admin(`/products/${id}/photos`, { method: "GET" })).status).toBe(405);
    expect((await admin(`/products/${id}/elsewhere`)).status).toBe(404);
    expect((await call("/api/other/x")).status).toBe(404);
    expect((await call("/api/catalogue/%E0%A4%A")).status).toBe(404);
  });

  it("never lets a reply be stored by a shared cache", async () => {
    expect((await call("/api/catalogue/products")).headers.get("cache-control")).toBe("no-store");
    expect((await admin("/me")).headers.get("cache-control")).toBe("no-store");
  });
});
