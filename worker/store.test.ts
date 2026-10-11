import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, ensureSchema } from "./schema";
import {
  ProductMissingError,
  SlugTakenError,
  addImage,
  categoryCounts,
  countImages,
  deleteImage,
  deleteProducts,
  freeSlug,
  getProduct,
  hiddenCount,
  insertProduct,
  knownProducts,
  listProducts,
  productBasics,
  productsByIds,
  setActive,
  setCategory,
  setCover,
  setLabels,
  summaries,
  updateProduct,
  type ProductInput,
} from "./store";
import { createTestEnv, strictLikeLimit, type TestEnv } from "./testEnv";
import type { D1Database } from "./types";

let test: TestEnv;
let db: D1Database;

beforeAll(async () => {
  test = await createTestEnv();
  db = test.env.DB;
}, 60_000);
afterAll(() => test?.dispose());
beforeEach(() => test.reset());

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const input = (overrides: Partial<ProductInput> = {}): ProductInput => ({
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
async function add(overrides: Partial<ProductInput> & { id?: string; slug?: string } = {}) {
  counter += 1;
  const { id, slug, ...rest } = overrides;
  const productId = id ?? uuid(counter);
  await insertProduct(db, { id: productId, slug: slug ?? `product-${counter}`, input: input(rest), createdBy: null });
  return productId;
}

const photo = (productId: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: uuid(1000 + n),
  productId,
  storagePath: `products/${productId}/${uuid(1000 + n)}.jpg`,
  altText: null,
  label: null,
  contentType: "image/jpeg",
  sizeBytes: 100,
  ...extra,
});

describe("schema", () => {
  it("records the migrations it applied", async () => {
    const rows = await db.prepare("SELECT id, name FROM schema_migrations ORDER BY id").all<{ id: number; name: string }>();
    expect(rows.results.map(row => row.id)).toEqual(MIGRATIONS.map(migration => migration.id));
  });

  it("can run again on a database that already has everything (a second Worker starting up)", async () => {
    await add({ name: "Keep me" });
    // A different object for the same database, so the "already checked" memory does not apply.
    const second: D1Database = { prepare: sql => db.prepare(sql), batch: statements => db.batch(statements) };
    await expect(ensureSchema(second)).resolves.toBeUndefined();
    expect((await listProducts(db, { active: null, limit: 10, offset: 0 })).rows.map(row => row.name)).toEqual(["Keep me"]);
  });

  it("builds everything from nothing on a brand-new database", async () => {
    const names = async () =>
      ((await test.freshDb.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).results as Array<{ name: string }>).map(row => row.name);
    expect(await names()).toEqual([]);
    await ensureSchema(test.freshDb);
    expect(await names()).toEqual(["product_images", "product_images_by_product", "product_images_one_cover", "products", "products_category", "products_live_newest", "schema_migrations"]);
    const applied = await test.freshDb.prepare("SELECT id FROM schema_migrations").all<{ id: number }>();
    expect(applied.results.map(row => row.id)).toEqual(MIGRATIONS.map(migration => migration.id));
    // The first catalogue request on an empty database is simply an empty shop.
    expect((await listProducts(test.freshDb, { active: true, limit: 10, offset: 0 })).total).toBe(0);
  });

  it("keeps migrations numbered in order without gaps", () => {
    expect(MIGRATIONS.map(migration => migration.id)).toEqual(MIGRATIONS.map((_, index) => index + 1));
  });
});

describe("products", () => {
  it("saves a product and reads it back in the shape the website expects", async () => {
    const id = await add({
      name: "Premium Lunch Box",
      slug: "premium-lunch-box",
      short_description: "Keeps meals fresh",
      description: "**Premium**\n\nLine two",
      moq: 48,
      colors: ["Red", "Blue"],
      option_groups: [{ key: "color", label: "Color", options: ["Red", "Blue"] }],
      price_currency: "THB",
      price_unit: "carton",
      price_tiers: [{ min_qty: 48, price: 1200.5 }],
      is_active: false,
    });
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product).toMatchObject({
      id,
      slug: "premium-lunch-box",
      name: "Premium Lunch Box",
      short_description: "Keeps meals fresh",
      moq: 48,
      colors: ["Red", "Blue"],
      sizes: [],
      option_groups: [{ key: "color", label: "Color", options: ["Red", "Blue"] }],
      price_currency: "THB",
      price_unit: "carton",
      price_tiers: [{ min_qty: 48, price: 1200.5 }],
      is_active: false,
      created_by: null,
      product_images: [],
    });
    expect(product?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("keeps hidden products away from shoppers but not from admins", async () => {
    const id = await add({ is_active: false, slug: "secret" });
    expect(await getProduct(db, { slug: "secret" }, { liveOnly: true })).toBeNull();
    expect(await getProduct(db, { id }, { liveOnly: true })).toBeNull();
    expect((await getProduct(db, { slug: "secret" }, { liveOnly: false }))?.id).toBe(id);
  });

  it("refuses a second product with the same web address", async () => {
    await add({ slug: "same" });
    await expect(add({ slug: "same" })).rejects.toBeInstanceOf(SlugTakenError);
  });

  it("treats saving the same id twice as already done", async () => {
    const id = await add({ name: "First" });
    const again = await insertProduct(db, { id, slug: "another-address", input: input({ name: "Second" }), createdBy: null });
    expect(again).toBe("exists");
    expect((await getProduct(db, { id }, { liveOnly: false }))?.name).toBe("First");
  });

  it("rejects values the database must never hold", async () => {
    await expect(add({ moq: 0 })).rejects.toThrow();
  });

  it("updates a product and reports when it does not exist", async () => {
    const id = await add({ name: "Old", slug: "old" });
    const before = await getProduct(db, { id }, { liveOnly: false });
    expect(await updateProduct(db, id, input({ name: "New", category: "Toys", price_tiers: [{ min_qty: 1, price: 5 }] }))).toBe(true);
    const after = await getProduct(db, { id }, { liveOnly: false });
    expect(after).toMatchObject({ name: "New", category: "Toys", slug: "old", price_tiers: [{ min_qty: 1, price: 5 }] });
    expect(after!.updated_at >= before!.updated_at).toBe(true);
    expect(await updateProduct(db, uuid(999999), input())).toBe(false);
  });

  it("finds a free web address", async () => {
    await add({ slug: "rattan-bag" });
    await add({ slug: "rattan-bag-2" });
    expect(await freeSlug(db, "rattan-bag")).toBe("rattan-bag-3");
    expect(await freeSlug(db, "fresh-one")).toBe("fresh-one");
  });

  it("finds a free web address for a very long name (D1 limits LIKE patterns to 50 bytes)", async () => {
    const long = `womens-cotton-short-sleeve-round-neck-t-shirt-plain-basic-summer-top`;
    expect(long.length).toBeGreaterThan(50);
    await add({ name: "Long", slug: long });
    await add({ name: "Long 2", slug: `${long}-2` });
    await add({ name: "Different", slug: `${long}x`.slice(0, 80) });
    expect(await freeSlug(db, long)).toBe(`${long}-3`);
    const eighty = "a".repeat(80);
    expect(await freeSlug(db, eighty)).toBe(eighty);
  });

  it("only counts web addresses that start with the same text", async () => {
    await add({ slug: "bag" });
    await add({ slug: "bagpipe" });
    await add({ slug: "bag-2" });
    await add({ slug: "a-bag" });
    expect(await freeSlug(db, "bag")).toBe("bag-3");
  });

  it("looks up the basics for the bot", async () => {
    const id = await add({ name: "Basics", slug: "basics", is_active: false });
    expect(await productBasics(db, id)).toEqual({ id, slug: "basics", name: "Basics", is_active: false });
    expect(await productBasics(db, uuid(424242))).toBeNull();
  });
});

describe("the test database", () => {
  it("refuses a LIKE pattern over 50 bytes, as Cloudflare's does", () => {
    const strict = strictLikeLimit(db);
    expect(() => strict.prepare("SELECT 1 WHERE 'x' LIKE ?").bind(`%${"a".repeat(60)}%`)).toThrow(/too complex/);
    expect(() => strict.prepare("SELECT 1 WHERE 'x' LIKE ?").bind("%short%")).not.toThrow();
    // Long text in a statement without LIKE is fine
    expect(() => strict.prepare("SELECT ?").bind("a".repeat(500))).not.toThrow();
  });
});

describe("lists", () => {
  it("lists only live products for shoppers, newest first, with a total", async () => {
    await add({ name: "A", slug: "a" });
    await new Promise(resolve => setTimeout(resolve, 5));
    await add({ name: "B", slug: "b" });
    await add({ name: "Hidden", slug: "hidden", is_active: false });
    const { rows, total } = await listProducts(db, { active: true, limit: 24, offset: 0 });
    expect(rows.map(row => row.name)).toEqual(["B", "A"]);
    expect(total).toBe(2);
  });

  it("pages and reports the full total", async () => {
    for (let n = 1; n <= 5; n += 1) await add({ name: `P${n}`, slug: `p${n}`, moq: n });
    const page2 = await listProducts(db, { active: true, limit: 2, offset: 2, sort: "moq" });
    expect(page2.rows.map(row => row.name)).toEqual(["P3", "P4"]);
    expect(page2.total).toBe(5);
    const beyond = await listProducts(db, { active: true, limit: 2, offset: 10 });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(5);
  });

  it("sorts by name ignoring case, and by smallest minimum order", async () => {
    await add({ name: "banana", slug: "banana", moq: 5 });
    await add({ name: "Apple", slug: "apple", moq: 50 });
    await add({ name: "cherry", slug: "cherry", moq: 1 });
    const names = async (sort: "name" | "moq") => (await listProducts(db, { active: true, limit: 10, offset: 0, sort })).rows.map(row => row.name);
    expect(await names("name")).toEqual(["Apple", "banana", "cherry"]);
    expect(await names("moq")).toEqual(["cherry", "banana", "Apple"]);
  });

  it("filters by category", async () => {
    await add({ name: "Bag", slug: "bag", category: "Bags" });
    await add({ name: "Toy", slug: "toy", category: "Toys" });
    const { rows } = await listProducts(db, { active: true, category: "Toys", limit: 10, offset: 0 });
    expect(rows.map(row => row.name)).toEqual(["Toy"]);
  });

  it("searches name, short description and category, ignoring case", async () => {
    await add({ name: "Sugar Marshmallow", slug: "m", category: "Snacks" });
    await add({ name: "Plain", slug: "p", short_description: "soft and SWEET", category: "Other" });
    await add({ name: "Zebra", slug: "z", category: "Sweets" });
    await add({ name: "Nothing", slug: "n", category: "Toys" });
    const found = async (search: string) => (await listProducts(db, { active: true, search, limit: 10, offset: 0, sort: "name" })).rows.map(row => row.name);
    expect(await found("marshmallow")).toEqual(["Sugar Marshmallow"]);
    expect(await found("sweet")).toEqual(["Plain", "Zebra"]);
    expect(await found("SNACK")).toEqual(["Sugar Marshmallow"]);
  });

  it("searches with a long phrase (D1 limits LIKE patterns to 50 bytes)", async () => {
    const name = "Stainless Steel Vacuum Insulated Water Bottle 500ml with Bamboo Lid";
    await add({ name, slug: "bottle" });
    await add({ name: "Short", slug: "short" });
    const found = async (search: string) => (await listProducts(db, { active: true, search, limit: 10, offset: 0 })).rows.map(row => row.name);
    expect(await found(name)).toEqual([name]);
    expect(await found(name.toUpperCase())).toEqual([name]);
    expect(await found("ผ้าฝ้ายคุณภาพดีสำหรับเสื้อยืดแขนสั้นคอกลมสีพื้นฐาน")).toEqual([]);
    expect(await found(`${name} that does not exist`)).toEqual([]);
  });

  it("treats % and _ in a search as plain characters", async () => {
    await add({ name: "100% Cotton", slug: "cotton" });
    await add({ name: "Other thing", slug: "other" });
    await add({ name: "snake_case", slug: "snake" });
    const found = async (search: string) => (await listProducts(db, { active: true, search, limit: 10, offset: 0 })).rows.map(row => row.name);
    expect(await found("%")).toEqual(["100% Cotton"]);
    expect(await found("_")).toEqual(["snake_case"]);
  });

  it("admin search also looks at the web address", async () => {
    await add({ name: "Unrelated name", slug: "special-address" });
    const shop = await listProducts(db, { active: null, search: "special-address", limit: 10, offset: 0 });
    const admin = await listProducts(db, { active: null, search: "special-address", searchFields: "admin", limit: 10, offset: 0 });
    expect(shop.rows).toHaveLength(0);
    expect(admin.rows).toHaveLength(1);
  });

  it("finds products by a list of web addresses, and an empty list finds none", async () => {
    await add({ name: "One", slug: "one" });
    await add({ name: "Two", slug: "two" });
    await add({ name: "Three", slug: "three" });
    const some = await listProducts(db, { active: true, slugs: ["one", "three", "missing"], limit: 10, offset: 0, sort: "name" });
    expect(some.rows.map(row => row.name)).toEqual(["One", "Three"]);
    expect((await listProducts(db, { active: true, slugs: [], limit: 10, offset: 0 })).rows).toEqual([]);
  });

  it("leaves one product out of its related list", async () => {
    await add({ name: "Me", slug: "me", category: "Bags" });
    await add({ name: "Sibling", slug: "sibling", category: "Bags" });
    await add({ name: "Stranger", slug: "stranger", category: "Toys" });
    const { rows } = await listProducts(db, { active: true, category: "Bags", excludeSlug: "me", limit: 8, offset: 0 });
    expect(rows.map(row => row.name)).toEqual(["Sibling"]);
  });

  it("fetches products by id for the quote screens", async () => {
    const live = await add({ name: "Live", slug: "live" });
    const hidden = await add({ name: "Hidden", slug: "hid", is_active: false });
    expect((await productsByIds(db, [live, hidden], { liveOnly: true })).map(row => row.name)).toEqual(["Live"]);
    expect((await productsByIds(db, [live, hidden], { liveOnly: false })).map(row => row.name).sort()).toEqual(["Hidden", "Live"]);
    expect(await productsByIds(db, [], { liveOnly: false })).toEqual([]);
  });

  it("counts categories of live products, most stocked first, skipping blanks", async () => {
    await add({ slug: "a", category: "Toys" });
    await add({ slug: "b", category: "Bags" });
    await add({ slug: "c", category: "Bags" });
    await add({ slug: "d", category: "Hidden only", is_active: false });
    await add({ slug: "e", category: "  " });
    expect(await categoryCounts(db)).toEqual([
      { category: "Bags", count: 2 },
      { category: "Toys", count: 1 },
    ]);
  });

  it("counts hidden products and summarises them for bulk actions", async () => {
    await add({ name: "Live one", slug: "l", category: "Bags" });
    await add({ name: "Draft one", slug: "d1", category: "Toys", is_active: false });
    await add({ name: "Draft two", slug: "d2", category: "Toys", is_active: false });
    expect(await hiddenCount(db)).toBe(2);
    const hidden = await summaries(db, { active: false, limit: 1000 });
    expect(hidden.map(row => row.name).sort()).toEqual(["Draft one", "Draft two"]);
    expect(hidden.every(row => row.isActive === false)).toBe(true);
    expect((await summaries(db, { active: null, search: "draft", limit: 1000 })).length).toBe(2);
    expect((await summaries(db, { active: null, limit: 1 })).length).toBe(1);
  });

  it("lists recent products for the bot's category guess", async () => {
    await add({ name: "Known", slug: "k", category: "Snacks", is_active: false });
    expect(await knownProducts(db)).toEqual([{ id: expect.any(String), name: "Known", category: "Snacks", is_active: false }]);
  });
});

describe("bulk changes", () => {
  async function many(count: number, overrides: Partial<ProductInput> = {}) {
    const ids: string[] = [];
    const statements = [];
    for (let n = 0; n < count; n += 1) {
      counter += 1;
      const id = uuid(counter);
      ids.push(id);
      statements.push(
        db
          .prepare("INSERT INTO products (id, slug, name, category, is_active) VALUES (?, ?, ?, ?, ?)")
          .bind(id, `bulk-${counter}`, `Bulk ${counter}`, overrides.category ?? "Other", overrides.is_active === false ? 0 : 1),
      );
    }
    await db.batch(statements);
    return ids;
  }

  it("shows and hides more products than fit in one statement", async () => {
    const ids = await many(170, { is_active: false });
    expect(await setActive(db, ids, true)).toBe(170);
    expect((await listProducts(db, { active: true, limit: 1, offset: 0 })).total).toBe(170);
    expect(await setActive(db, ids.slice(0, 90), false)).toBe(90);
    expect(await hiddenCount(db)).toBe(90);
  });

  it("sets a category on many products", async () => {
    const ids = await many(100);
    expect(await setCategory(db, ids, "Snacks")).toBe(100);
    expect((await categoryCounts(db))[0]).toEqual({ category: "Snacks", count: 100 });
  });

  it("does nothing for an empty list", async () => {
    expect(await setActive(db, [], true)).toBe(0);
    expect(await setCategory(db, [], "X")).toBe(0);
    expect(await deleteProducts(db, [])).toEqual({ deleted: 0, paths: [] });
  });

  it("deletes products with their photo records and returns the files to remove", async () => {
    const a = await add({ slug: "da" });
    const b = await add({ slug: "db" });
    const keep = await add({ slug: "keep" });
    await addImage(db, photo(a, 1));
    await addImage(db, photo(a, 2));
    await addImage(db, photo(b, 3));
    await addImage(db, photo(keep, 4));
    const { deleted, paths } = await deleteProducts(db, [a, b]);
    expect(deleted).toBe(2);
    expect(paths.sort()).toEqual([`products/${a}/${uuid(1001)}.jpg`, `products/${a}/${uuid(1002)}.jpg`, `products/${b}/${uuid(1003)}.jpg`].sort());
    expect(await countImages(db, a)).toBe(0);
    expect(await countImages(db, keep)).toBe(1);
    expect(await getProduct(db, { id: a }, { liveOnly: false })).toBeNull();
  });

  it("deletes a long list across several statements", async () => {
    const ids = await many(200);
    const { deleted } = await deleteProducts(db, ids);
    expect(deleted).toBe(200);
    expect((await listProducts(db, { active: null, limit: 1, offset: 0 })).total).toBe(0);
  });
});

describe("photos", () => {
  it("makes the first photo the cover and puts later ones after it", async () => {
    const id = await add();
    const first = await addImage(db, photo(id, 1));
    const second = await addImage(db, photo(id, 2));
    expect(first).toMatchObject({ created: true, record: { is_primary: true, sort_order: 0, public_url: `/photos/products/${id}/${uuid(1001)}.jpg` } });
    expect(second.record).toMatchObject({ is_primary: false, sort_order: 1 });
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images.map(image => image.id)).toEqual([uuid(1001), uuid(1002)]);
  });

  it("lists the cover first, then the rest by their order", async () => {
    const id = await add();
    await addImage(db, photo(id, 1, { sortOrder: 0, isPrimary: false }));
    await addImage(db, photo(id, 2, { sortOrder: 1, isPrimary: true }));
    await addImage(db, photo(id, 3, { sortOrder: 2, isPrimary: false }));
    const product = await getProduct(db, { slug: (await productBasics(db, id))!.slug }, { liveOnly: false });
    expect(product?.product_images.map(image => image.id)).toEqual([uuid(1002), uuid(1001), uuid(1003)]);
  });

  it("replaces the cover when a new cover is added", async () => {
    const id = await add();
    await addImage(db, photo(id, 1));
    await addImage(db, photo(id, 2, { isPrimary: true }));
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images.filter(image => image.is_primary).map(image => image.id)).toEqual([uuid(1002)]);
  });

  it("does not make a second cover when a photo is added without saying so", async () => {
    const id = await add();
    await addImage(db, photo(id, 1));
    await addImage(db, photo(id, 2));
    await addImage(db, photo(id, 3));
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images.filter(image => image.is_primary)).toHaveLength(1);
  });

  it("accepts the same photo twice (a retry) without changing anything", async () => {
    const id = await add();
    await addImage(db, photo(id, 1, { isPrimary: true }));
    const again = await addImage(db, photo(id, 1, { isPrimary: true }));
    expect(again.created).toBe(false);
    expect(await countImages(db, id)).toBe(1);
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images[0].is_primary).toBe(true);
  });

  it("refuses a photo for a product that does not exist", async () => {
    await expect(addImage(db, photo(uuid(777777), 1))).rejects.toBeInstanceOf(ProductMissingError);
  });

  it("promotes the next photo when the cover is removed", async () => {
    const id = await add();
    await addImage(db, photo(id, 1));
    await addImage(db, photo(id, 2));
    await addImage(db, photo(id, 3));
    expect(await deleteImage(db, id, uuid(1001))).toEqual({ storagePath: `products/${id}/${uuid(1001)}.jpg` });
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images.map(image => [image.id, image.is_primary])).toEqual([
      [uuid(1002), true],
      [uuid(1003), false],
    ]);
  });

  it("removing another photo leaves the cover alone", async () => {
    const id = await add();
    await addImage(db, photo(id, 1));
    await addImage(db, photo(id, 2));
    await deleteImage(db, id, uuid(1002));
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images.map(image => [image.id, image.is_primary])).toEqual([[uuid(1001), true]]);
  });

  it("will not remove a photo through the wrong product", async () => {
    const a = await add({ slug: "a1" });
    const b = await add({ slug: "b1" });
    await addImage(db, photo(a, 1));
    expect(await deleteImage(db, b, uuid(1001))).toBeNull();
    expect(await countImages(db, a)).toBe(1);
  });

  it("changes the cover", async () => {
    const id = await add();
    await addImage(db, photo(id, 1));
    await addImage(db, photo(id, 2));
    expect(await setCover(db, id, uuid(1002))).toBe(true);
    const product = await getProduct(db, { id }, { liveOnly: false });
    expect(product?.product_images.map(image => [image.id, image.is_primary])).toEqual([
      [uuid(1002), true],
      [uuid(1001), false],
    ]);
  });

  it("refuses to make another product's photo the cover and keeps the old cover", async () => {
    const a = await add({ slug: "a2" });
    const b = await add({ slug: "b2" });
    await addImage(db, photo(a, 1));
    await addImage(db, photo(b, 2));
    expect(await setCover(db, a, uuid(1002))).toBe(false);
    const product = await getProduct(db, { id: a }, { liveOnly: false });
    expect(product?.product_images[0]).toMatchObject({ id: uuid(1001), is_primary: true });
  });

  it("sets captions and falls back to the product name for the description", async () => {
    const id = await add({ name: "Lunch Box" });
    await addImage(db, photo(id, 1));
    await addImage(db, photo(id, 2, { label: "Front", altText: "Front" }));
    expect(await setLabels(db, id, [{ id: uuid(1001), label: "  Side view " }, { id: uuid(1002), label: "  " }])).toBe(true);
    const product = await getProduct(db, { id }, { liveOnly: false });
    const byId = Object.fromEntries(product!.product_images.map(image => [image.id, image]));
    expect(byId[uuid(1001)]).toMatchObject({ label: "Side view", alt_text: "Side view" });
    expect(byId[uuid(1002)]).toMatchObject({ label: null, alt_text: "Lunch Box product image" });
    expect(await setLabels(db, uuid(555555), [])).toBe(false);
  });
});
