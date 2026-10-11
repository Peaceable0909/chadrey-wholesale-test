import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { stableUuid } from "./ids";
import { handleUpdate } from "./intake";
import { baseEnv, createBackend, deps, EXAMPLE_CAPTION, failingBucket, failingDatabase, OWNER, photoUpdate, textUpdate, TOKEN, type Backend } from "./testkit";
import { createTestEnv, type TestEnv } from "./testEnv";
import type { Env } from "./types";

let test: TestEnv;
let backend: Backend;
let errors: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  test = await createTestEnv();
}, 60_000);
afterAll(() => test?.dispose());
beforeEach(async () => {
  await test.reset();
  backend = createBackend();
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const env = (overrides: Partial<Env> = {}) => baseEnv({ DB: test.env.DB, PHOTOS: test.env.PHOTOS, ...overrides });
const run = (update: Parameters<typeof handleUpdate>[0], overrides: Partial<Env> = {}, extra?: Parameters<typeof deps>[1]) => handleUpdate(update, env(overrides), deps(backend, extra));
const lastReply = () => backend.state.sent[backend.state.sent.length - 1]?.text ?? "";

/** Saved products in the order they were saved, with the stored lists and yes/no values turned back into real ones. */
async function products() {
  const rows = (await test.env.DB.prepare("SELECT * FROM products ORDER BY rowid").all()).results as Array<Record<string, any>>;
  return rows.map(row => ({ ...row, is_active: row.is_active === 1, price_tiers: JSON.parse(row.price_tiers) }));
}
async function images() {
  const rows = (await test.env.DB.prepare("SELECT * FROM product_images ORDER BY sort_order, rowid").all()).results as Array<Record<string, any>>;
  return rows.map(row => ({ ...row, is_primary: row.is_primary === 1 }));
}
async function storedFiles() {
  const listing = await (test.env.PHOTOS as any).list();
  const files = [] as Array<{ key: string; size: number; httpMetadata?: { contentType?: string; cacheControl?: string } }>;
  for (const object of listing.objects as Array<{ key: string }>) files.push((await test.env.PHOTOS.head(object.key))!);
  return files;
}

describe("a photo with the details as its caption", () => {
  it("is saved as a hidden draft with the price at the minimum order", async () => {
    await run(photoUpdate(backend, { id: 10, caption: EXAMPLE_CAPTION }));

    const saved = await products();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: "100ml Original sugar marshmallow",
      slug: "100ml-original-sugar-marshmallow",
      category: "Uncategorised",
      moq: 1,
      is_active: false,
      price_currency: "NGN",
      price_unit: "pc",
      price_tiers: [{ min_qty: 1, price: 48000 }],
      description: "",
      created_by: null,
    });
  });

  it("does not save the resell range on the product", async () => {
    await run(photoUpdate(backend, { id: 9, caption: EXAMPLE_CAPTION }));
    expect(JSON.stringify((await products())[0])).not.toMatch(/55,?000|60,?000|resale|resell/i);
  });

  it("stores the biggest version of the photo and marks it as the main photo", async () => {
    await run(photoUpdate(backend, { id: 10, caption: EXAMPLE_CAPTION }));

    const [product] = await products();
    const imageId = await stableUuid(`image:${product.id}:uniq10`);
    const key = `products/${product.id}/${imageId}.jpg`;
    const files = await storedFiles();
    expect(files.map(file => file.key)).toEqual([key]);
    expect(files[0]).toMatchObject({ size: 4096, httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" } });
    expect(await images()).toMatchObject([
      { id: imageId, product_id: product.id, storage_path: key, is_primary: true, sort_order: 10, alt_text: "100ml Original sugar marshmallow product image", content_type: "image/jpeg", size_bytes: 4096 },
    ]);
    // The small thumbnail was never downloaded.
    expect(backend.state.requests.some(request => request.url.includes("small-10"))).toBe(false);
  });

  it("confirms in the chat with the price, a review link and the draft id", async () => {
    await run(photoUpdate(backend, { id: 10, caption: EXAMPLE_CAPTION }));

    expect(backend.state.sent).toHaveLength(1);
    expect(backend.state.sent[0]).toMatchObject({ chat_id: OWNER, reply_to: 10 });
    const text = lastReply();
    expect(text).toContain("✅ Saved as a hidden draft");
    expect(text).toContain("100ml Original sugar marshmallow");
    expect(text).toContain("₦48,000 per pc · minimum order 1");
    expect(text).toContain("Resell range: ₦55,000 – ₦60,000 (not saved on the product)");
    expect(text).toContain("Category: Uncategorised (set it in admin)");
    expect(text).toContain("Review it: https://shop.test/admin/products?status=hidden");
    expect(text).toContain(`Draft ID: ${(await products())[0].id}`);
    expect(text).not.toMatch(/supabase/i);
  });

  it("uses the minimum order, unit, currency and category written in the message", async () => {
    await run(photoUpdate(backend, { id: 11, caption: "Soap bar\n#Beauty\nMOQ 24\n600 per dozen wholesale\n$1.5 retail" }));
    expect((await products())[0]).toMatchObject({ category: "Beauty", moq: 24, price_unit: "dozen", price_currency: "USD", price_tiers: [{ min_qty: 24, price: 600 }] });
  });

  it("is saved without a price when the message has none, and says so", async () => {
    await run(photoUpdate(backend, { id: 12, caption: "Rattan basket" }));
    const [product] = await products();
    expect(product.is_active).toBe(false);
    expect(product.price_tiers).toEqual([]);
    expect(lastReply()).toContain("No price yet");
    expect(lastReply()).toContain("No price was found.");
  });

  it("never saves the same message twice", async () => {
    const update = photoUpdate(backend, { id: 13, caption: EXAMPLE_CAPTION });
    await run(update);
    await run(update);
    expect(await products()).toHaveLength(1);
    expect(await images()).toHaveLength(1);
    expect(await storedFiles()).toHaveLength(1);
  });

  it("gives a repeat name a new web address and mentions the existing product", async () => {
    await run(photoUpdate(backend, { id: 14, caption: EXAMPLE_CAPTION }));
    await run(photoUpdate(backend, { id: 15, caption: EXAMPLE_CAPTION }));
    expect((await products()).map(product => product.slug)).toEqual(["100ml-original-sugar-marshmallow", "100ml-original-sugar-marshmallow-2"]);
    expect(lastReply()).toContain("ℹ️ You already have “100ml Original sugar marshmallow” (hidden).");
  });

  it("tries again with a new web address when another save took it first", async () => {
    const racing = failingDatabase(test.env.DB, sql => sql.startsWith("INSERT INTO products"), new Error("D1_ERROR: UNIQUE constraint failed: products.slug: SQLITE_CONSTRAINT_UNIQUE"), { times: 1 });
    await run(photoUpdate(backend, { id: 16, caption: EXAMPLE_CAPTION }), { DB: racing });
    expect(racing.failures).toBe(1);
    const saved = await products();
    expect(saved).toHaveLength(1);
    expect(String(saved[0].slug)).toMatch(/^100ml-original-sugar-marshmallow-[a-z0-9]{1,4}$/);
    expect(lastReply()).toContain("✅ Saved as a hidden draft");
  });

  it("reads a photo sent as an image file", async () => {
    backend.addTelegramFile("doc-1", 3000, "documents/file_9.png");
    const update = textUpdate("");
    update.message = {
      message_id: 17,
      from: { id: OWNER },
      chat: { id: OWNER, type: "private" },
      caption: EXAMPLE_CAPTION,
      document: { file_id: "doc-1", file_unique_id: "docuniq", mime_type: "image/png", file_size: 3000 },
    };
    await run(update);
    const [product] = await products();
    const imageId = await stableUuid(`image:${product.id}:docuniq`);
    const files = await storedFiles();
    expect(files.map(file => file.key)).toEqual([`products/${product.id}/${imageId}.png`]);
    expect(files[0].httpMetadata?.contentType).toBe("image/png");
  });

  it("keeps long text within what the shop accepts", async () => {
    await run(photoUpdate(backend, { id: 18, caption: `${"A very long name ".repeat(30)}\n48,000 wholesale` }));
    const [product] = await products();
    expect(product.name.length).toBeLessThanOrEqual(200);
    expect(product.slug.length).toBeLessThanOrEqual(90);
  });
});

describe("categories", () => {
  beforeEach(async () => {
    await run(photoUpdate(backend, { id: 20, caption: "Sugar marshmallow body mist 250ml\n#Beauty\n30,000 wholesale" }));
    await run(photoUpdate(backend, { id: 21, caption: "Leather handbag black\n#Bags\n20,000 wholesale" }));
    backend.state.sent.length = 0;
  });

  it("guesses the category from a similar product and says where the guess came from", async () => {
    await run(photoUpdate(backend, { id: 22, caption: EXAMPLE_CAPTION }));
    const draft = (await products()).find(product => product.name === "100ml Original sugar marshmallow");
    expect(draft?.category).toBe("Beauty");
    expect(lastReply()).toContain("Category: Beauty (guessed from “Sugar marshmallow body mist 250ml”)");
  });

  it("keeps a category typed in the message, spelled like the existing one", async () => {
    await run(photoUpdate(backend, { id: 23, caption: "Silk scarf\n#bags\n5,000 wholesale" }));
    const draft = (await products()).find(product => product.name === "Silk scarf");
    expect(draft?.category).toBe("Bags");
    expect(lastReply()).toContain("Category: Bags\n");
  });

  it("leaves a product with nothing in common as Uncategorised", async () => {
    await run(photoUpdate(backend, { id: 24, caption: "Garden hose reel\n9,000 wholesale" }));
    expect((await products()).find(product => product.name === "Garden hose reel")?.category).toBe("Uncategorised");
  });
});

describe("albums and extra photos", () => {
  it("adds the other photos of an album to the draft made from the first one", async () => {
    await run(photoUpdate(backend, { id: 30, caption: EXAMPLE_CAPTION, group: "album-1" }));
    await run(photoUpdate(backend, { id: 31, group: "album-1" }));
    await run(photoUpdate(backend, { id: 32, group: "album-1" }));

    expect(await products()).toHaveLength(1);
    expect((await images()).map(image => [image.sort_order, image.is_primary])).toEqual([
      [30, true],
      [31, false],
      [32, false],
    ]);
    // Only the first photo gets a confirmation.
    expect(backend.state.sent).toHaveLength(1);
  });

  it("waits for the first photo if an album member arrives before it", async () => {
    const sleep = vi.fn(async () => {
      if (!(await products()).length) await run(photoUpdate(backend, { id: 40, caption: EXAMPLE_CAPTION, group: "album-2" }));
    });
    await run(photoUpdate(backend, { id: 41, group: "album-2" }), {}, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(await products()).toHaveLength(1);
    expect(await images()).toHaveLength(2);
  });

  it("gives up with a clear message when an album never gets a caption", async () => {
    const sleep = vi.fn(async () => undefined);
    await run(photoUpdate(backend, { id: 42, group: "album-3" }), {}, { sleep });
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(await products()).toHaveLength(0);
    expect(lastReply()).toContain("Put the name and prices in the caption of the first photo.");
  });

  it("adds a photo sent as a reply to the confirmation", async () => {
    await run(photoUpdate(backend, { id: 50, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    await run(photoUpdate(backend, { id: 51, replyToText: confirmation }));

    const saved = await images();
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ is_primary: false, sort_order: 51 });
    expect(lastReply()).toContain("📷 Added to “100ml Original sugar marshmallow”. It now has 2 photos.");
  });

  it("never gives a draft two main photos, however the photos arrive", async () => {
    await run(photoUpdate(backend, { id: 58, caption: EXAMPLE_CAPTION, group: "album-4" }));
    await Promise.all([run(photoUpdate(backend, { id: 59, group: "album-4" })), run(photoUpdate(backend, { id: 60, group: "album-4" })), run(photoUpdate(backend, { id: 61, group: "album-4" }))]);
    const saved = await images();
    expect(saved).toHaveLength(4);
    expect(saved.filter(image => image.is_primary)).toHaveLength(1);
  });

  it("will not touch a product that is already live", async () => {
    await run(photoUpdate(backend, { id: 52, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    await test.env.DB.prepare("UPDATE products SET is_active = 1").run();
    await run(photoUpdate(backend, { id: 53, replyToText: confirmation }));
    expect(await images()).toHaveLength(1);
    expect(lastReply()).toContain("already live");
  });

  it("says so when the draft was deleted", async () => {
    await run(photoUpdate(backend, { id: 54, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    await test.env.DB.batch([test.env.DB.prepare("DELETE FROM product_images"), test.env.DB.prepare("DELETE FROM products")]);
    await run(photoUpdate(backend, { id: 55, replyToText: confirmation }));
    expect(lastReply()).toContain("couldn't find that draft");
  });

  it("ignores a Draft ID line in a reply to someone else's message", async () => {
    await run(photoUpdate(backend, { id: 56, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    await run(photoUpdate(backend, { id: 57, replyToText: confirmation, replyFromBot: false, caption: "Silk scarf\n5,000 wholesale" }));
    expect(await products()).toHaveLength(2);
    expect(await images()).toHaveLength(2);
  });
});

describe("who and what the bot answers", () => {
  it("tells a stranger their Telegram id and saves nothing", async () => {
    await run(photoUpdate(backend, { id: 60, caption: EXAMPLE_CAPTION, from: 777 }));
    expect(await products()).toHaveLength(0);
    expect(await storedFiles()).toHaveLength(0);
    // The only thing sent was the reply: the stranger's photo was never even downloaded.
    expect(backend.state.requests.map(request => new URL(request.url).pathname.split("/").pop())).toEqual(["sendMessage"]);
    expect(lastReply()).toContain("Your Telegram ID is 777");
  });

  it("answers every allowed person, not only the first", async () => {
    await run(photoUpdate(backend, { id: 61, caption: EXAMPLE_CAPTION, from: 1002 }));
    expect(await products()).toHaveLength(1);
  });

  it("ignores group chats, bots and updates without a message", async () => {
    await run(photoUpdate(backend, { id: 62, caption: EXAMPLE_CAPTION, chatType: "group", chat: -500 }));
    await run(textUpdate("hi", { isBot: true }));
    await run({ update_id: 5 });
    expect(backend.state.sent).toHaveLength(0);
    expect(backend.state.requests).toHaveLength(0);
  });

  it("shows the help text for /start, /help and plain text", async () => {
    for (const text of ["/start", "/help", "hello"]) {
      backend.state.sent.length = 0;
      await run(textUpdate(text));
      expect(lastReply()).toContain("100ml Original sugar marshmallow");
      expect(lastReply()).toContain("hidden draft");
    }
    expect(lastReply()).toContain("I need a photo to go with that");
  });

  it("asks for the caption when a photo comes with none", async () => {
    await run(photoUpdate(backend, { id: 63 }));
    expect(await products()).toHaveLength(0);
    expect(lastReply()).toContain("Add the product details as the photo's caption");
  });

  it("asks for a name when the caption only has prices", async () => {
    await run(photoUpdate(backend, { id: 64, caption: "48,000 wholesale" }));
    expect(await products()).toHaveLength(0);
    expect(lastReply()).toContain("couldn't find a product name");
  });

  it("refuses a photo over 10 MB", async () => {
    const sizes = [{ file_id: "huge", file_unique_id: "huge", width: 4000, height: 4000, file_size: 11 * 1024 * 1024 }];
    await run(photoUpdate(backend, { id: 65, caption: EXAMPLE_CAPTION, sizes }));
    expect(await products()).toHaveLength(0);
    expect(lastReply()).toContain("larger than 10 MB");
  });
});

describe("when something goes wrong", () => {
  it("keeps the draft when the photo cannot be stored", async () => {
    await run(photoUpdate(backend, { id: 81, caption: EXAMPLE_CAPTION }), { PHOTOS: failingBucket(test.env.PHOTOS, new Error("R2 is down")) });
    const [product] = await products();
    expect(product).toBeDefined();
    expect(await images()).toHaveLength(0);
    expect(lastReply()).toContain("the photo did not upload");
    expect(lastReply()).toContain("Reply to this message with the photo");
    expect(lastReply()).toContain(`Draft ID: ${product.id}`);
  });

  it("keeps the draft when the photo cannot be downloaded from Telegram", async () => {
    backend.state.failDownload = true;
    await run(photoUpdate(backend, { id: 82, caption: EXAMPLE_CAPTION }));
    expect(await products()).toHaveLength(1);
    expect(await images()).toHaveLength(0);
    expect(lastReply()).toContain("the photo did not upload");
  });

  it("keeps the draft, and stores nothing, when the file is not really a picture", async () => {
    backend.addTelegramFile("fake", 100, "documents/fake.png", new TextEncoder().encode("<html>not a picture</html>"));
    const update = textUpdate("");
    update.message = { message_id: 19, from: { id: OWNER }, chat: { id: OWNER, type: "private" }, caption: EXAMPLE_CAPTION, document: { file_id: "fake", file_unique_id: "fakeuniq", mime_type: "image/png", file_size: 100 } };
    await run(update);
    expect(await products()).toHaveLength(1);
    expect(await storedFiles()).toHaveLength(0);
    expect(lastReply()).toContain("the photo did not upload");
  });

  it("lets a reply with the photo finish a draft whose photo failed", async () => {
    backend.state.failDownload = true;
    await run(photoUpdate(backend, { id: 83, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    backend.state.failDownload = false;
    await run(photoUpdate(backend, { id: 84, replyToText: confirmation }));
    const saved = await images();
    expect(saved).toHaveLength(1);
    expect(saved[0].is_primary).toBe(true);
  });

  it("tells the person when the shop's database has used up its free allowance", async () => {
    const full = failingDatabase(test.env.DB, sql => sql.startsWith("INSERT INTO products"), new Error("D1_ERROR: Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue."));
    await run(photoUpdate(backend, { id: 85, caption: EXAMPLE_CAPTION }), { DB: full });
    expect(await products()).toHaveLength(0);
    expect(lastReply()).toContain("midnight UTC");
    expect(lastReply()).toContain("send it again");
  });

  it("reports an unexpected database error without details", async () => {
    const broken = failingDatabase(test.env.DB, sql => sql.startsWith("INSERT INTO products"), new Error("boom internal detail"));
    await run(photoUpdate(backend, { id: 86, caption: EXAMPLE_CAPTION }), { DB: broken });
    expect(await products()).toHaveLength(0);
    expect(lastReply()).toContain("Something went wrong while saving that");
    expect(lastReply()).not.toContain("boom");
    expect(JSON.stringify(errors.mock.calls)).toContain("boom");
  });

  it("never puts the bot token in a reply or a log line", async () => {
    backend.state.failDownload = true;
    await run(photoUpdate(backend, { id: 87, caption: EXAMPLE_CAPTION }));
    const everything = JSON.stringify([backend.state.sent, errors.mock.calls]);
    expect(everything).not.toContain(TOKEN);
  });
});

describe("what the bot needs", () => {
  it("works without any Supabase key or address", async () => {
    await run(photoUpdate(backend, { id: 90, caption: EXAMPLE_CAPTION }), { SUPABASE_URL: undefined, SUPABASE_PUBLISHABLE_KEY: undefined });
    expect(await products()).toHaveLength(1);
    expect(backend.state.requests.every(request => request.url.startsWith("https://api.telegram.org/"))).toBe(true);
  });

  it("sets up a brand-new database by itself on first use", async () => {
    const fresh = createBackend();
    await handleUpdate(photoUpdate(fresh, { id: 91, caption: EXAMPLE_CAPTION }), env({ DB: test.freshDb }), deps(fresh));
    const saved = await test.freshDb.prepare("SELECT name, is_active FROM products").all();
    expect(saved.results).toEqual([{ name: "100ml Original sugar marshmallow", is_active: 0 }]);
    await test.freshDb.batch([test.freshDb.prepare("DELETE FROM product_images"), test.freshDb.prepare("DELETE FROM products")]);
  });
});
