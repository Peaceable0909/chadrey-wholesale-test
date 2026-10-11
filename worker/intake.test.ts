import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleUpdate } from "./intake";
import { baseEnv, createBackend, deps, EXAMPLE_CAPTION, OWNER, photoUpdate, SERVICE_KEY, textUpdate, TOKEN, type Backend } from "./testkit";

let backend: Backend;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  backend = createBackend();
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const run = (update: Parameters<typeof handleUpdate>[0], env = baseEnv(), extra?: Parameters<typeof deps>[1]) => handleUpdate(update, env, deps(backend, extra));
const lastReply = () => backend.state.sent[backend.state.sent.length - 1]?.text ?? "";
const products = () => Array.from(backend.state.products.values());

describe("a photo with the details as its caption", () => {
  it("is saved as a hidden draft with the price at the minimum order", async () => {
    await run(photoUpdate(backend, { id: 10, caption: EXAMPLE_CAPTION }));

    expect(products()).toHaveLength(1);
    const product = products()[0];
    expect(product).toMatchObject({
      name: "100ml Original sugar marshmallow",
      slug: "100ml-original-sugar-marshmallow",
      category: "Uncategorised",
      moq: 1,
      is_active: false,
      price_currency: "NGN",
      price_unit: "pc",
      price_tiers: [{ min_qty: 1, price: 48000 }],
      description: "",
    });
  });

  it("does not save the resell range on the product", async () => {
    await run(photoUpdate(backend, { id: 9, caption: EXAMPLE_CAPTION }));
    expect(JSON.stringify(products()[0])).not.toMatch(/55,?000|60,?000|resale|resell/i);
  });

  it("stores the biggest version of the photo and marks it as the main photo", async () => {
    await run(photoUpdate(backend, { id: 10, caption: EXAMPLE_CAPTION }));

    const paths = Array.from(backend.state.storage.keys());
    expect(paths).toEqual(["products/100ml-original-sugar-marshmallow/uniq10.jpg"]);
    expect(backend.state.storage.get(paths[0])).toMatchObject({ contentType: "image/jpeg", upsert: "false", size: 4096 });
    expect(backend.state.images).toHaveLength(1);
    expect(backend.state.images[0]).toMatchObject({
      product_id: products()[0].id,
      storage_path: paths[0],
      public_url: "https://proj.supabase.co/storage/v1/object/public/product-images/products/100ml-original-sugar-marshmallow/uniq10.jpg",
      is_primary: true,
      sort_order: 10,
    });
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
    expect(text).toContain(`Draft ID: ${products()[0].id}`);
  });

  it("uses the minimum order, unit, currency and category written in the message", async () => {
    await run(photoUpdate(backend, { id: 11, caption: "Soap bar\n#Beauty\nMOQ 24\n600 per dozen wholesale\n$1.5 retail" }));
    expect(products()[0]).toMatchObject({ category: "Beauty", moq: 24, price_unit: "dozen", price_currency: "USD", price_tiers: [{ min_qty: 24, price: 600 }] });
  });

  it("is saved without a price when the message has none, and says so", async () => {
    await run(photoUpdate(backend, { id: 12, caption: "Rattan basket" }));
    const product = products()[0];
    expect(product.is_active).toBe(false);
    expect("price_tiers" in product).toBe(false);
    expect(lastReply()).toContain("No price yet");
    expect(lastReply()).toContain("No price was found.");
  });

  it("never saves the same message twice", async () => {
    const update = photoUpdate(backend, { id: 13, caption: EXAMPLE_CAPTION });
    await run(update);
    await run(update);
    expect(products()).toHaveLength(1);
    expect(backend.state.images).toHaveLength(1);
    expect(backend.state.storage.size).toBe(1);
  });

  it("gives a repeat name a new web address and mentions the existing product", async () => {
    await run(photoUpdate(backend, { id: 14, caption: EXAMPLE_CAPTION }));
    await run(photoUpdate(backend, { id: 15, caption: EXAMPLE_CAPTION }));
    expect(products().map(product => product.slug)).toEqual(["100ml-original-sugar-marshmallow", "100ml-original-sugar-marshmallow-2"]);
    expect(lastReply()).toContain("ℹ️ You already have “100ml Original sugar marshmallow” (hidden).");
  });

  it("tries again with a new web address when another save took it first", async () => {
    backend.state.failNext = {
      match: (method, path) => method === "POST" && path === "/rest/v1/products",
      status: 409,
      body: { code: "23505", details: "Key (slug)=(taken) already exists.", hint: null, message: 'duplicate key value violates unique constraint "products_slug_key"' },
    };
    await run(photoUpdate(backend, { id: 16, caption: EXAMPLE_CAPTION }));
    expect(products()).toHaveLength(1);
    expect(String(products()[0].slug)).toMatch(/^100ml-original-sugar-marshmallow-[a-z0-9]{1,4}$/);
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
    expect(Array.from(backend.state.storage.keys())).toEqual(["products/100ml-original-sugar-marshmallow/docuniq.png"]);
    expect(backend.state.storage.get("products/100ml-original-sugar-marshmallow/docuniq.png")?.contentType).toBe("image/png");
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
    const draft = products().find(product => product.name === "100ml Original sugar marshmallow");
    expect(draft?.category).toBe("Beauty");
    expect(lastReply()).toContain("Category: Beauty (guessed from “Sugar marshmallow body mist 250ml”)");
  });

  it("keeps a category typed in the message, spelled like the existing one", async () => {
    await run(photoUpdate(backend, { id: 23, caption: "Silk scarf\n#bags\n5,000 wholesale" }));
    const draft = products().find(product => product.name === "Silk scarf");
    expect(draft?.category).toBe("Bags");
    expect(lastReply()).toContain("Category: Bags\n");
  });

  it("leaves a product with nothing in common as Uncategorised", async () => {
    await run(photoUpdate(backend, { id: 24, caption: "Garden hose reel\n9,000 wholesale" }));
    expect(products().find(product => product.name === "Garden hose reel")?.category).toBe("Uncategorised");
  });
});

describe("albums and extra photos", () => {
  it("adds the other photos of an album to the draft made from the first one", async () => {
    await run(photoUpdate(backend, { id: 30, caption: EXAMPLE_CAPTION, group: "album-1" }));
    await run(photoUpdate(backend, { id: 31, group: "album-1" }));
    await run(photoUpdate(backend, { id: 32, group: "album-1" }));

    expect(products()).toHaveLength(1);
    expect(backend.state.images.map(image => [image.sort_order, image.is_primary])).toEqual([
      [30, true],
      [31, false],
      [32, false],
    ]);
    // Only the first photo gets a confirmation.
    expect(backend.state.sent).toHaveLength(1);
  });

  it("waits for the first photo if an album member arrives before it", async () => {
    const sleep = vi.fn(async () => {
      if (!products().length) await run(photoUpdate(backend, { id: 40, caption: EXAMPLE_CAPTION, group: "album-2" }));
    });
    await run(photoUpdate(backend, { id: 41, group: "album-2" }), baseEnv(), { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(products()).toHaveLength(1);
    expect(backend.state.images).toHaveLength(2);
  });

  it("gives up with a clear message when an album never gets a caption", async () => {
    const sleep = vi.fn(async () => undefined);
    await run(photoUpdate(backend, { id: 42, group: "album-3" }), baseEnv(), { sleep });
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(products()).toHaveLength(0);
    expect(lastReply()).toContain("Put the name and prices in the caption of the first photo.");
  });

  it("adds a photo sent as a reply to the confirmation", async () => {
    await run(photoUpdate(backend, { id: 50, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    await run(photoUpdate(backend, { id: 51, replyToText: confirmation }));

    expect(backend.state.images).toHaveLength(2);
    expect(backend.state.images[1]).toMatchObject({ is_primary: false, sort_order: 51 });
    expect(lastReply()).toContain("📷 Added to “100ml Original sugar marshmallow”. It now has 2 photos.");
  });

  it("will not touch a product that is already live", async () => {
    await run(photoUpdate(backend, { id: 52, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    products()[0].is_active = true;
    await run(photoUpdate(backend, { id: 53, replyToText: confirmation }));
    expect(backend.state.images).toHaveLength(1);
    expect(lastReply()).toContain("already live");
  });

  it("says so when the draft was deleted", async () => {
    await run(photoUpdate(backend, { id: 54, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    backend.state.products.clear();
    await run(photoUpdate(backend, { id: 55, replyToText: confirmation }));
    expect(lastReply()).toContain("couldn't find that draft");
  });

  it("ignores a Draft ID line in a reply to someone else's message", async () => {
    await run(photoUpdate(backend, { id: 56, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    await run(photoUpdate(backend, { id: 57, replyToText: confirmation, replyFromBot: false, caption: "Silk scarf\n5,000 wholesale" }));
    expect(products()).toHaveLength(2);
    expect(backend.state.images).toHaveLength(2);
  });
});

describe("who and what the bot answers", () => {
  it("tells a stranger their Telegram id and saves nothing", async () => {
    await run(photoUpdate(backend, { id: 60, caption: EXAMPLE_CAPTION, from: 777 }));
    expect(products()).toHaveLength(0);
    expect(backend.state.storage.size).toBe(0);
    expect(backend.state.requests.every(request => !request.url.includes("supabase.co"))).toBe(true);
    expect(lastReply()).toContain("Your Telegram ID is 777");
  });

  it("answers every allowed person, not only the first", async () => {
    await run(photoUpdate(backend, { id: 61, caption: EXAMPLE_CAPTION, from: 1002 }));
    expect(products()).toHaveLength(1);
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
    expect(products()).toHaveLength(0);
    expect(lastReply()).toContain("Add the product details as the photo's caption");
  });

  it("asks for a name when the caption only has prices", async () => {
    await run(photoUpdate(backend, { id: 64, caption: "48,000 wholesale" }));
    expect(products()).toHaveLength(0);
    expect(lastReply()).toContain("couldn't find a product name");
  });

  it("refuses a photo over 10 MB", async () => {
    const sizes = [{ file_id: "huge", file_unique_id: "huge", width: 4000, height: 4000, file_size: 11 * 1024 * 1024 }];
    await run(photoUpdate(backend, { id: 65, caption: EXAMPLE_CAPTION, sizes }));
    expect(products()).toHaveLength(0);
    expect(lastReply()).toContain("larger than 10 MB");
  });
});

describe("when the database is not ready", () => {
  it("keeps the price in the description when the price columns do not exist yet", async () => {
    backend = createBackend({ pricingColumns: false });
    await run(photoUpdate(backend, { id: 70, caption: EXAMPLE_CAPTION }));

    expect(products()).toHaveLength(1);
    const product = products()[0];
    expect("price_tiers" in product).toBe(false);
    expect(product.description).toBe("Wholesale price: ₦48,000 per pc");
    expect(lastReply()).toContain("(price not saved, see below)");
    expect(lastReply()).toContain("supabase_product_pricing.sql");
    expect(backend.state.images).toHaveLength(1);
  });

  it("still saves a price-less product without needing the price columns", async () => {
    backend = createBackend({ pricingColumns: false });
    await run(photoUpdate(backend, { id: 71, caption: "Rattan basket" }));
    expect(products()).toHaveLength(1);
    expect(lastReply()).not.toContain("supabase_product_pricing.sql");
  });
});

describe("when something goes wrong", () => {
  it("explains a refused Supabase key without showing the key", async () => {
    await run(photoUpdate(backend, { id: 80, caption: EXAMPLE_CAPTION }), baseEnv({ SUPABASE_SERVICE_KEY: "sb_secret_WRONG_KEY_VALUE" }));
    expect(lastReply()).toContain("Supabase refused the key");
    expect(lastReply()).toContain("SUPABASE_SERVICE_KEY");
    expect(lastReply()).not.toContain("WRONG_KEY_VALUE");
    expect(JSON.stringify(errors.mock.calls)).not.toContain("WRONG_KEY_VALUE");
  });

  it("explains a missing storage bucket", async () => {
    backend.state.bucketMissing = true;
    await run(photoUpdate(backend, { id: 81, caption: EXAMPLE_CAPTION }));
    // The draft exists, but the photo could not be stored.
    expect(products()).toHaveLength(1);
    expect(lastReply()).toContain("the photo did not upload");
    expect(lastReply()).toContain("Reply to this message with the photo");
    expect(lastReply()).toContain(`Draft ID: ${products()[0].id}`);
  });

  it("keeps the draft when the photo cannot be downloaded from Telegram", async () => {
    backend.state.failDownload = true;
    await run(photoUpdate(backend, { id: 82, caption: EXAMPLE_CAPTION }));
    expect(products()).toHaveLength(1);
    expect(backend.state.images).toHaveLength(0);
    expect(lastReply()).toContain("the photo did not upload");
  });

  it("lets a reply with the photo finish a draft whose photo failed", async () => {
    backend.state.failDownload = true;
    await run(photoUpdate(backend, { id: 83, caption: EXAMPLE_CAPTION }));
    const confirmation = lastReply();
    backend.state.failDownload = false;
    await run(photoUpdate(backend, { id: 84, replyToText: confirmation }));
    expect(backend.state.images).toHaveLength(1);
    expect(backend.state.images[0].is_primary).toBe(true);
  });

  it("reports an unexpected database error without details", async () => {
    backend.state.failNext = { match: (method, path) => method === "POST" && path === "/rest/v1/products", status: 500, body: { message: "boom internal detail" } };
    await run(photoUpdate(backend, { id: 85, caption: EXAMPLE_CAPTION }));
    expect(products()).toHaveLength(0);
    expect(lastReply()).toContain("Supabase returned an error (status 500)");
    expect(lastReply()).not.toContain("boom");
  });

  it("never puts the bot token or the Supabase key in a reply or a log line", async () => {
    backend.state.failDownload = true;
    await run(photoUpdate(backend, { id: 86, caption: EXAMPLE_CAPTION }));
    await run(photoUpdate(backend, { id: 87, caption: EXAMPLE_CAPTION }), baseEnv({ SUPABASE_SERVICE_KEY: "sb_secret_other" }));
    const everything = JSON.stringify([backend.state.sent, errors.mock.calls]);
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain(SERVICE_KEY);
    expect(everything).not.toContain("sb_secret_other");
  });
});

describe("how the database is called", () => {
  it("sends the new-style secret key in apikey only", async () => {
    await run(photoUpdate(backend, { id: 90, caption: EXAMPLE_CAPTION }));
    const supabaseCalls = backend.state.requests.filter(request => request.url.includes("supabase.co"));
    expect(supabaseCalls.length).toBeGreaterThan(3);
    expect(supabaseCalls.every(request => request.headers.apikey === SERVICE_KEY && request.headers.authorization === undefined)).toBe(true);
  });

  it("also sends an older JWT-style key as a bearer token", async () => {
    const jwtLike = "eyJhbGciOiJIUzI1NiJ9.payload.signature";
    const jwtBackend = createBackend();
    const original = jwtBackend.fetch;
    const seen: Array<Record<string, string>> = [];
    const wrapped = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value]));
      if (String(input).includes("supabase.co")) seen.push(headers);
      // Pretend the older key is the valid one.
      const patched = { ...init, headers: { ...(init?.headers as Record<string, string>), apikey: SERVICE_KEY } };
      return original(input, String(input).includes("supabase.co") ? patched : init);
    }) as typeof fetch;
    await handleUpdate(photoUpdate(jwtBackend, { id: 91, caption: EXAMPLE_CAPTION }), baseEnv({ SUPABASE_SERVICE_KEY: jwtLike }), { fetch: wrapped, sleep: async () => undefined, origin: "https://shop.test" });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(headers => headers.apikey === jwtLike && headers.authorization === `Bearer ${jwtLike}`)).toBe(true);
  });

  it("gives photos a long cache time because each file name is unique", async () => {
    await run(photoUpdate(backend, { id: 92, caption: EXAMPLE_CAPTION }));
    expect(Array.from(backend.state.storage.values())[0].cacheControl).toBe("max-age=31536000");
  });
});
