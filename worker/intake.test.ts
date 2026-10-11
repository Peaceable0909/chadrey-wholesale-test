import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { stableUuid } from "./ids";
import { handleUpdate } from "./intake";
import { AI_ANSWER, baseEnv, createBackend, deps, EXAMPLE_CAPTION, failingBucket, failingDatabase, OWNER, photoUpdate, puterError, puterOk, PUTER_TOKEN, textUpdate, TOKEN, type Backend } from "./testkit";
import { createTestEnv, type TestEnv } from "./testEnv";
import type { Env, TelegramUpdate } from "./types";

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


describe("smart drafting with AI", () => {
  const withAi = (overrides: Partial<Env> = {}): Partial<Env> => ({ PUTER_AUTH_TOKEN: PUTER_TOKEN, ...overrides });
  const aiAnswer = (overrides: Record<string, unknown> = {}) => JSON.stringify({ ...AI_ANSWER, ...overrides });

  describe("a photo with only a few words", () => {
    it("is saved at once, then the AI writes the description and the first reply is changed", async () => {
      let whileWaiting = "";
      backend.state.puterReply = async () => {
        whileWaiting = lastReply();
        return aiAnswer();
      };
      await run(photoUpdate(backend, { id: 200, caption: "Premium lunch box" }), withAi());

      expect(whileWaiting).toContain("✅ Saved as a hidden draft");
      expect(whileWaiting).toContain("✨ Writing the description from your photo…");
      expect(backend.state.sent).toHaveLength(1);
      expect(backend.state.edits).toHaveLength(1);
      expect(backend.state.edits[0].message_id).toBe(9001);

      const [saved] = await products();
      expect(saved).toMatchObject({ name: "Premium lunch box", is_active: false, short_description: AI_ANSWER.short_description, description: AI_ANSWER.description, price_tiers: [] });
      expect(JSON.parse(saved.colors)).toEqual(["beige", "black", "pink", "blue"]);

      const reply = lastReply();
      expect(reply).toContain("✨ Written by AI from your photo. Please check it before you show it in the store:");
      expect(reply).toContain(AI_ANSWER.short_description);
      expect(reply).toContain("Colours: beige, black, pink, blue (seen in the photo)");
      expect(reply).toContain("Draft ID:");
      expect(reply).not.toContain("Writing the description");
    });

    it("asks the AI with the photo, the name and the extra lines, but never the price or the minimum order", async () => {
      await run(photoUpdate(backend, { id: 201, caption: "Premium lunch box\n24,000 wholesale\n30,000-35,000 Resell\nMOQ 24\nColors: pink, white" }), withAi());

      expect(backend.state.puterCalls).toHaveLength(1);
      const [call] = backend.state.puterCalls;
      expect(call.body.auth_token).toBe(PUTER_TOKEN);
      expect(call.body.args.model).toBe("claude-haiku-5-5");
      const [prompt, photo] = call.body.args.messages[0].content;
      expect(prompt).toContain("Product name: Premium lunch box");
      expect(prompt).toContain("Colors: pink, white");
      expect(prompt).not.toMatch(/24,000|30,000|35,000|MOQ 24|Resell/i);
      expect(photo.image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("keeps the price, minimum order and currency from the caption, and drops order, price and stock claims the AI makes", async () => {
      backend.state.puterReply = async () =>
        aiAnswer({
          description: "A sturdy lunch bag for daily use.\nWholesale price: ₦99,999 per piece.\nMinimum order 500 pieces.\nIn stock, ships in 2 days.\n\nPadded handle for comfortable carrying.",
          price: 99999,
          moq: 500,
          availability: "in stock",
        });
      await run(photoUpdate(backend, { id: 202, caption: "Premium lunch box\n24,000 wholesale\nMOQ 24" }), withAi());

      const [saved] = await products();
      expect(saved).toMatchObject({ moq: 24, price_currency: "NGN", price_unit: "pc", price_tiers: [{ min_qty: 24, price: 24000 }], is_active: false });
      expect(saved.description).toBe("A sturdy lunch bag for daily use.\n\nPadded handle for comfortable carrying.");
      expect(JSON.stringify(saved)).not.toMatch(/99,?999|500 pieces|ships|availability/);
    });

    it("adds the owner's own extra lines under the AI's text, exactly as typed", async () => {
      await run(photoUpdate(backend, { id: 203, caption: "Premium lunch box\nColors: pink, white\nComes in a gift box" }), withAi());
      const [saved] = await products();
      expect(saved.description).toBe(`${AI_ANSWER.description}\n\nColors: pink, white\nComes in a gift box`);
    });

    it("never saves the resell range, with or without the AI", async () => {
      await run(photoUpdate(backend, { id: 204, caption: EXAMPLE_CAPTION }), withAi());
      expect(JSON.stringify(await products())).not.toMatch(/55,?000|60,?000|resale|resell/i);
      expect(JSON.stringify(backend.state.puterCalls)).not.toMatch(/55,?000|60,?000|resell/i);
    });

    it("lets a person add more photos by replying to the changed confirmation, without asking the AI again", async () => {
      await run(photoUpdate(backend, { id: 290, caption: "Premium lunch box" }), withAi());
      const confirmation = lastReply();
      await run(photoUpdate(backend, { id: 291, replyToText: confirmation }), withAi());

      expect(await images()).toHaveLength(2);
      expect(lastReply()).toContain("📷 Added to “Premium lunch box”. It now has 2 photos.");
      expect(backend.state.puterCalls).toHaveLength(1);
    });
  });

  describe("categories", () => {
    beforeEach(async () => {
      await run(photoUpdate(backend, { id: 210, caption: "Leather handbag black\n#Bags\n20,000 wholesale" }));
      await run(photoUpdate(backend, { id: 211, caption: "Cotton t-shirt\n#Apparel\n5,000 wholesale" }));
      backend.state.sent.length = 0;
      backend.state.edits.length = 0;
    });
    const draft = async (name: string) => (await products()).find(product => product.name === name)!;

    it("offers the AI the shop's own categories and uses the one it picks", async () => {
      backend.state.puterReply = async () => aiAnswer({ category: "bags" });
      await run(photoUpdate(backend, { id: 212, caption: "Premium lunch box" }), withAi());

      const prompt = backend.state.puterCalls[0].body.args.messages[0].content[0] as string;
      expect(prompt).toMatch(/Allowed categories: \[(?=.*"Bags")(?=.*"Apparel").*\]/);
      expect((await draft("Premium lunch box")).category).toBe("Bags");
      expect(lastReply()).toContain("Category: Bags (suggested by AI)");
    });

    it("keeps the category typed in the message over the AI's", async () => {
      backend.state.puterReply = async () => aiAnswer({ category: "Bags" });
      await run(photoUpdate(backend, { id: 213, caption: "Premium lunch box\n#apparel" }), withAi());
      expect((await draft("Premium lunch box")).category).toBe("Apparel");
      expect(lastReply()).toContain("Category: Apparel\n");
    });

    it("ignores a category the shop does not have", async () => {
      backend.state.puterReply = async () => aiAnswer({ category: "Lunch Boxes" });
      await run(photoUpdate(backend, { id: 214, caption: "Premium lunch box" }), withAi());
      expect((await draft("Premium lunch box")).category).toBe("Uncategorised");
      expect(lastReply()).toContain("Category: Uncategorised (set it in admin)");
    });

    it("prefers the AI's pick to a guess from similar names", async () => {
      backend.state.puterReply = async () => aiAnswer({ category: "Apparel" });
      await run(photoUpdate(backend, { id: 215, caption: "Leather wallet" }), withAi());
      expect((await draft("Leather wallet")).category).toBe("Apparel");
      expect(lastReply()).toContain("Category: Apparel (suggested by AI)");
    });

    it("keeps the guess from similar names when the AI picks nothing", async () => {
      await run(photoUpdate(backend, { id: 216, caption: "Leather wallet" }), withAi());
      expect((await draft("Leather wallet")).category).toBe("Bags");
      expect(lastReply()).toContain("Category: Bags (guessed from “Leather handbag black”)");
    });
  });

  describe("without a Puter token", () => {
    it("changes nothing: no AI calls, no changed messages, the same reply as before", async () => {
      await run(photoUpdate(backend, { id: 220, caption: "Premium lunch box\n24,000 wholesale" }));
      expect(backend.state.puterCalls).toHaveLength(0);
      expect(backend.state.edits).toHaveLength(0);
      expect(backend.state.sent).toHaveLength(1);
      expect(lastReply()).not.toMatch(/✨|written by AI|writing the description/i);
      const [saved] = await products();
      expect(saved).toMatchObject({ short_description: "", description: "" });
    });

    it("still asks for the details when a photo comes with no words", async () => {
      await run(photoUpdate(backend, { id: 221 }));
      expect(await products()).toHaveLength(0);
      expect(lastReply()).toContain("Add the product details as the photo's caption");
    });
  });

  describe("when the AI does not work", () => {
    it.each([
      ["the token is rejected", () => puterError(401, "token_auth_failed", "bad"), /did not accept the token/],
      ["the allowance is used up", () => puterError(402, "insufficient_funds", "no credit"), /allowance for AI is used up/],
      ["Puter is busy", () => puterError(429, "too_many_requests", "slow down"), /busy/],
      ["Puter has a problem", () => puterError(500, "internal", "Model overloaded"), /Model overloaded/],
      ["the answer is not JSON", () => puterOk("Sorry, I can't help with that."), /could not be used/],
      ["the description is too short", () => puterOk(JSON.stringify({ name: "x", description: "Nice." })), /could not be used/],
      [
        "Puter cannot be reached",
        () => {
          throw new TypeError("fetch failed");
        },
        /could not be reached/,
      ],
      [
        "Puter takes too long",
        () => {
          throw new DOMException("The operation timed out.", "TimeoutError");
        },
        /took too long/,
      ],
    ])("saves the draft as typed and says why, when %s", async (_name, reply, expected) => {
      backend.state.puterReply = reply as never;
      await run(photoUpdate(backend, { id: 230, caption: "Premium lunch box\n24,000 wholesale\nColors: pink" }), withAi());

      const [saved] = await products();
      expect(saved).toMatchObject({ name: "Premium lunch box", is_active: false, short_description: "", description: "Colors: pink", price_tiers: [{ min_qty: 1, price: 24000 }] });
      expect(lastReply()).toMatch(expected);
      expect(lastReply()).toContain("The draft is saved as you sent it.");
      expect(lastReply()).toContain("Draft ID:");
      expect(JSON.stringify([backend.state.sent, errors.mock.calls])).not.toContain(PUTER_TOKEN);
    });

    it("sends a new message when the first one cannot be changed", async () => {
      backend.state.failEdit = true;
      await run(photoUpdate(backend, { id: 231, caption: "Premium lunch box" }), withAi());
      expect(backend.state.sent).toHaveLength(2);
      expect(backend.state.sent[0].text).toContain("Writing the description");
      expect(lastReply()).toContain("✨ Written by AI");
    });

    it("never puts the Puter token in a reply, a log line or the saved product", async () => {
      await run(photoUpdate(backend, { id: 232, caption: "Premium lunch box" }), withAi());
      backend.state.puterReply = () => puterError(500, "x", `failed for ${PUTER_TOKEN}`);
      await run(photoUpdate(backend, { id: 233, caption: "Another lunch box" }), withAi());
      expect(JSON.stringify([backend.state.sent, errors.mock.calls, await products()])).not.toContain(PUTER_TOKEN);
    });
  });

  describe("when the draft changes while the AI is writing", () => {
    it("leaves a draft alone that was shown in the store meanwhile", async () => {
      backend.state.puterReply = async () => {
        await test.env.DB.prepare("UPDATE products SET is_active = 1").run();
        return aiAnswer();
      };
      await run(photoUpdate(backend, { id: 240, caption: "Premium lunch box" }), withAi());
      const [saved] = await products();
      expect(saved).toMatchObject({ is_active: true, short_description: "", description: "" });
      expect(lastReply()).toContain("changed while the AI was writing");
      expect(lastReply()).not.toContain("✨ Written by AI");
    });

    it("leaves text a person typed meanwhile", async () => {
      backend.state.puterReply = async () => {
        await test.env.DB.prepare("UPDATE products SET description = 'Written by hand'").run();
        return aiAnswer();
      };
      await run(photoUpdate(backend, { id: 241, caption: "Premium lunch box" }), withAi());
      expect((await products())[0].description).toBe("Written by hand");
      expect(lastReply()).toContain("changed while the AI was writing");
    });
  });

  describe("a message delivered twice", () => {
    it("asks the AI only once and saves one draft", async () => {
      const update = photoUpdate(backend, { id: 250, caption: "Premium lunch box" });
      await run(update, withAi());
      await run(update, withAi());
      expect(backend.state.puterCalls).toHaveLength(1);
      expect(await products()).toHaveLength(1);
    });
  });

  describe("albums", () => {
    it("asks the AI once, with the first photo, and still adds the others", async () => {
      await run(photoUpdate(backend, { id: 260, caption: "Premium lunch box", group: "album-ai" }), withAi());
      await run(photoUpdate(backend, { id: 261, group: "album-ai" }), withAi());
      await run(photoUpdate(backend, { id: 262, group: "album-ai" }), withAi());
      expect(backend.state.puterCalls).toHaveLength(1);
      expect(backend.state.puterCalls[0].body.args.messages[0].content).toHaveLength(2);
      expect(await images()).toHaveLength(3);
    });

    it("lets a photo of the album join the draft even while the AI is still writing", async () => {
      backend.state.puterReply = async () => {
        await run(photoUpdate(backend, { id: 271, group: "album-ai-2" }), withAi());
        return aiAnswer();
      };
      await run(photoUpdate(backend, { id: 270, caption: "Premium lunch box", group: "album-ai-2" }), withAi());
      expect(await images()).toHaveLength(2);
      expect((await products())[0].description).toBe(AI_ANSWER.description);
    });

    it("does not name an album from its photo alone, because its other photos would arrive too early", async () => {
      await run(photoUpdate(backend, { id: 263, caption: "24,000 wholesale", group: "album-ai-3" }), withAi());
      expect(await products()).toHaveLength(0);
      expect(backend.state.puterCalls).toHaveLength(0);
      expect(lastReply()).toContain("I couldn't find a product name");
    });
  });

  describe("a photo with no name", () => {
    it("is named and described by the AI when it is sent on its own", async () => {
      await run(photoUpdate(backend, { id: 280 }), withAi());

      const [saved] = await products();
      expect(saved).toMatchObject({ name: "Quilted Insulated Lunch Bag", slug: "quilted-insulated-lunch-bag", is_active: false, price_tiers: [], description: AI_ANSWER.description, short_description: AI_ANSWER.short_description });
      expect(JSON.parse(saved.colors)).toEqual(["beige", "black", "pink", "blue"]);
      expect(await images()).toHaveLength(1);
      expect(backend.state.sent).toHaveLength(1);
      expect(backend.state.edits).toHaveLength(0);
      expect(lastReply()).toContain("✨ Written by AI");
      expect(lastReply()).toContain("No price yet");
      expect(backend.state.puterCalls[0].body.args.messages[0].content[0]).toContain("Product name: (not given)");
    });

    it("is named by the AI when the caption has a price but no name, and keeps that price", async () => {
      await run(photoUpdate(backend, { id: 282, caption: "24,000 wholesale\nMOQ 12" }), withAi());
      expect((await products())[0]).toMatchObject({ name: "Quilted Insulated Lunch Bag", moq: 12, price_tiers: [{ min_qty: 12, price: 24000 }] });
    });

    it("saves nothing and asks for the name when the AI cannot suggest one", async () => {
      backend.state.puterReply = () => puterError(402, "insufficient_funds", "no credit");
      await run(photoUpdate(backend, { id: 281 }), withAi());
      expect(await products()).toHaveLength(0);
      expect(await images()).toHaveLength(0);
      expect(lastReply()).toContain("the AI could not suggest one: your Puter allowance for AI is used up");
      expect(lastReply()).toContain("Put the name on the first line");
    });
  });

  describe("the /ai command", () => {
    it("explains how to switch AI on when it is off", async () => {
      await run(textUpdate("/ai"));
      expect(lastReply()).toContain("AI drafting is off");
      expect(lastReply()).toContain("PUTER_AUTH_TOKEN");
      expect(backend.state.puterCalls).toHaveLength(0);
    });

    it("says it works, with the model and how long it took", async () => {
      await run(textUpdate("/ai@ShopBot"), withAi({ AI_MODEL: "claude-sonnet-5-5" }));
      expect(lastReply()).toMatch(/✅ AI drafting works\.\nModel: claude-sonnet-5-5\nAnswered in \d+(\.\d)? s\./);
      expect(backend.state.puterCalls).toHaveLength(1);
      expect(backend.state.puterCalls[0].body.args.messages[0].content).toEqual(["Reply with the single word OK."]);
    });

    it("says what Puter said when the AI does not work", async () => {
      backend.state.puterReply = () => puterError(401, "token_auth_failed", "bad");
      await run(textUpdate("/ai"), withAi());
      expect(lastReply()).toContain("AI drafting is switched on, but Puter did not accept the token");
      expect(lastReply()).toContain("Drafts are still saved exactly as you send them.");
      expect(JSON.stringify([backend.state.sent, errors.mock.calls])).not.toContain(PUTER_TOKEN);
    });

    it("is for the shop team only, and costs nothing for anyone else", async () => {
      await run(textUpdate("/ai", { from: 5555 }), withAi());
      expect(lastReply()).toContain("Only the shop team");
      expect(backend.state.puterCalls).toHaveLength(0);
    });

    it("is mentioned in the help once AI is on, and the help promises no price from the AI", async () => {
      await run(textUpdate("/help"), withAi());
      expect(lastReply()).toContain("write the rest (description, category, colours) with AI");
      expect(lastReply()).toContain("The price and the minimum order come only from what you type");
      expect(lastReply()).toContain("/ai");
    });
  });
});


describe("AI drafting: when Puter is busy, and the /redo command", () => {
  const withAi = (overrides: Partial<Env> = {}): Partial<Env> => ({ PUTER_AUTH_TOKEN: PUTER_TOKEN, ...overrides });
  const aiAnswer = (overrides: Record<string, unknown> = {}) => JSON.stringify({ ...AI_ANSWER, ...overrides });
  /** "/redo" sent as a reply to one of the bot's messages. */
  const redo = (replyText: string): TelegramUpdate => ({
    update_id: 1,
    message: { message_id: 2, from: { id: OWNER, is_bot: false }, chat: { id: OWNER, type: "private" }, text: "/redo", reply_to_message: { message_id: 1, from: { is_bot: true }, text: replyText } },
  });

  it("asks again when Puter says it is busy, and the draft still gets its text", async () => {
    let asked = 0;
    backend.state.puterReply = async () => (++asked === 1 ? puterError(429, "too_many_requests", "slow down") : aiAnswer());
    const sleep = vi.fn(async () => undefined);
    await run(photoUpdate(backend, { id: 300, caption: "Premium lunch box" }), withAi(), { sleep });
    expect(backend.state.puterCalls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect((await products())[0].description).toBe(AI_ANSWER.description);
    expect(lastReply()).toContain("✨ Written by AI");
  });

  it("tells how to try again when the AI fails, and /redo then writes the description", async () => {
    await run(photoUpdate(backend, { id: 301, caption: "Leather handbag black\n#Bags\n20,000 wholesale" }));
    backend.state.puterReply = () => puterError(402, "insufficient_funds", "no credit");
    await run(photoUpdate(backend, { id: 302, caption: "Premium lunch box\nColors: black" }), withAi());
    const failed = lastReply();
    expect(failed).toContain("Reply /redo to this message to try again.");
    expect((await products()).find(product => product.name === "Premium lunch box")).toMatchObject({ short_description: "", description: "Colors: black", category: "Uncategorised" });

    backend.state.puterReply = async () => aiAnswer({ category: "Bags" });
    backend.state.puterCalls.length = 0;
    await run(redo(failed), withAi());

    const saved = (await products()).find(product => product.name === "Premium lunch box")!;
    expect(saved).toMatchObject({ short_description: AI_ANSWER.short_description, description: `${AI_ANSWER.description}\n\nColors: black`, category: "Bags", is_active: false });
    expect(JSON.parse(saved.colors)).toEqual(["beige", "black", "pink", "blue"]);
    const [call] = backend.state.puterCalls;
    expect(call.body.args.messages[0].content[0]).toContain("Colors: black");
    expect(call.body.args.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(lastReply()).toContain("✨ Written by AI from your photo for “Premium lunch box”");
    expect(lastReply()).toContain("Category: Bags (suggested by AI)");
    expect(lastReply()).toContain(`Draft ID: ${saved.id}`);
  });

  it("says how /redo works when it is not sent as a reply to a draft", async () => {
    await run(textUpdate("/redo"), withAi());
    expect(lastReply()).toContain("Reply to a draft's message with /redo");
    expect(backend.state.puterCalls).toHaveLength(0);
  });

  it("explains that AI is off, without asking anything", async () => {
    await run(photoUpdate(backend, { id: 303, caption: "Premium lunch box" }));
    await run(redo(lastReply()));
    expect(lastReply()).toContain("AI drafting is off");
    expect(backend.state.puterCalls).toHaveLength(0);
  });

  it("never touches a product that is already live", async () => {
    backend.state.puterReply = () => puterError(500, "x", "down");
    await run(photoUpdate(backend, { id: 304, caption: "Premium lunch box" }), withAi());
    const failed = lastReply();
    await test.env.DB.prepare("UPDATE products SET is_active = 1").run();
    backend.state.puterCalls.length = 0;
    await run(redo(failed), withAi());
    expect(lastReply()).toContain("is already live");
    expect(backend.state.puterCalls).toHaveLength(0);
    expect((await products())[0].description).toBe("");
  });

  it("leaves a draft alone that already has AI-written text", async () => {
    await run(photoUpdate(backend, { id: 305, caption: "Premium lunch box" }), withAi());
    const done = lastReply();
    backend.state.puterCalls.length = 0;
    await run(redo(done), withAi());
    expect(lastReply()).toContain("already has AI-written text");
    expect(backend.state.puterCalls).toHaveLength(0);
  });

  it("says so when the draft has no photo to look at", async () => {
    await run(photoUpdate(backend, { id: 306, caption: "Premium lunch box" }), withAi({ PHOTOS: failingBucket(test.env.PHOTOS, new Error("storage down")) }));
    const noPhoto = lastReply();
    expect(noPhoto).toContain("the photo did not upload");
    await run(redo(noPhoto), withAi());
    expect(lastReply()).toContain("has no photo for the AI to look at");
    expect(backend.state.puterCalls).toHaveLength(0);
  });

  it("does not overwrite text a person changed while the AI was writing", async () => {
    backend.state.puterReply = () => puterError(500, "x", "down");
    await run(photoUpdate(backend, { id: 307, caption: "Premium lunch box" }), withAi());
    const failed = lastReply();
    backend.state.puterReply = async () => {
      await test.env.DB.prepare("UPDATE products SET description = 'Written by hand'").run();
      return aiAnswer();
    };
    await run(redo(failed), withAi());
    expect((await products())[0].description).toBe("Written by hand");
    expect(lastReply()).toContain("was changed while the AI was writing");
  });

  it("reports a failure and keeps the way to try again", async () => {
    backend.state.puterReply = () => puterError(500, "x", "down");
    await run(photoUpdate(backend, { id: 308, caption: "Premium lunch box" }), withAi());
    await run(redo(lastReply()), withAi());
    expect(lastReply()).toContain("I couldn't write the description with AI");
    expect(lastReply()).toContain("Reply /redo to this message to try again.");
    expect(lastReply()).toContain("Draft ID:");
  });
});
