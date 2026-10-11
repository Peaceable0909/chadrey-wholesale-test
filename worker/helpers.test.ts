import { describe, expect, it } from "vitest";
import { canonicalCategory, findSameName, guessCategory, nameTokens, type KnownProduct } from "./category";
import { aiSettings, allowedUserIds, intakeDefaults, missingConfig, qwenBase, safeEqual } from "./config";
import { stableUuid } from "./ids";
import { baseEnv } from "./testkit";

const product = (name: string, category: string, is_active = true, id = name): KnownProduct => ({ id, name, category, is_active });

describe("stableUuid", () => {
  it("gives the same id for the same text and different ids for different text", async () => {
    expect(await stableUuid("product:1:10")).toBe(await stableUuid("product:1:10"));
    expect(await stableUuid("product:1:10")).not.toBe(await stableUuid("product:1:11"));
  });

  it("looks like a UUID the database accepts", async () => {
    expect(await stableUuid("anything")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("configuration", () => {
  it("lists the names of missing settings, never their values", () => {
    expect(missingConfig(baseEnv())).toEqual([]);
    expect(missingConfig(baseEnv({ TELEGRAM_BOT_TOKEN: "  ", TELEGRAM_WEBHOOK_SECRET: undefined }))).toEqual(["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"]);
    expect(missingConfig(baseEnv({ DB: undefined as never }))).toEqual(["DB"]);
  });

  it("reads allowed Telegram ids from a comma list and ignores anything else", () => {
    expect(Array.from(allowedUserIds(baseEnv({ TELEGRAM_ALLOWED_USER_IDS: "1001, 1002;abc,-5,0, 12.5 ,1001" })))).toEqual([1001, 1002]);
    expect(allowedUserIds(baseEnv({ TELEGRAM_ALLOWED_USER_IDS: undefined })).size).toBe(0);
  });

  it("falls back to sensible defaults when the settings are blank or wrong", () => {
    expect(intakeDefaults(baseEnv({ DEFAULT_CURRENCY: undefined, DEFAULT_UNIT: undefined, DEFAULT_MOQ: undefined }))).toEqual({ currency: "NGN", unit: "pc", moq: 1 });
    expect(intakeDefaults(baseEnv({ DEFAULT_CURRENCY: "naira", DEFAULT_UNIT: "bucket", DEFAULT_MOQ: "0" }))).toEqual({ currency: "NGN", unit: "pc", moq: 1 });
    expect(intakeDefaults(baseEnv({ DEFAULT_CURRENCY: "thb", DEFAULT_UNIT: "carton", DEFAULT_MOQ: "12" }))).toEqual({ currency: "THB", unit: "carton", moq: 12 });
  });

  it("switches AI drafting on with an Alibaba key or a Puter token, and prefers Alibaba", () => {
    expect(aiSettings(baseEnv())).toEqual({ enabled: false, provider: null, model: "qwen3-vl-plus" });
    expect(aiSettings(baseEnv({ QWEN_API_KEY: "  " , PUTER_AUTH_TOKEN: " " }))).toMatchObject({ enabled: false, provider: null });
    expect(aiSettings(baseEnv({ QWEN_API_KEY: "key-1234567" }))).toEqual({ enabled: true, provider: "qwen", model: "qwen3-vl-plus" });
    expect(aiSettings(baseEnv({ PUTER_AUTH_TOKEN: "token-1234567" }))).toEqual({ enabled: true, provider: "puter", model: "claude-haiku-5-5" });
    expect(aiSettings(baseEnv({ QWEN_API_KEY: "key-1234567", PUTER_AUTH_TOKEN: "token-1234567" })).provider).toBe("qwen");
  });

  it("takes the model from AI_MODEL only when it looks like a model name", () => {
    const key = { QWEN_API_KEY: "key-1234567" };
    expect(aiSettings(baseEnv({ ...key, AI_MODEL: " qwen3.8-flash " })).model).toBe("qwen3.8-flash");
    expect(aiSettings(baseEnv({ ...key, AI_MODEL: "qwen/qwen3.8-flash" })).model).toBe("qwen/qwen3.8-flash");
    for (const wrong of ["", "x", "not a model!", "a".repeat(81), "model;drop"]) expect(aiSettings(baseEnv({ ...key, AI_MODEL: wrong })).model).toBe("qwen3-vl-plus");
  });

  it("sends Qwen requests to Alibaba's own https address only", () => {
    expect(qwenBase(baseEnv())).toBeUndefined();
    expect(qwenBase(baseEnv({ QWEN_API_BASE: "https://dashscope-intl.aliyuncs.com" }))).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
    expect(qwenBase(baseEnv({ QWEN_API_BASE: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/" }))).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
    expect(qwenBase(baseEnv({ QWEN_API_BASE: "https://abc123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions" }))).toBe("https://abc123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1");
    expect(qwenBase(baseEnv({ QWEN_API_BASE: " https://dashscope-us.aliyuncs.com " }))).toBe("https://dashscope-us.aliyuncs.com/compatible-mode/v1");
    for (const wrong of ["http://dashscope-intl.aliyuncs.com", "https://evil.example.com", "https://aliyuncs.com.evil.example", "https://evilaliyuncs.com", "not a url", "ftp://x.aliyuncs.com"]) {
      expect(qwenBase(baseEnv({ QWEN_API_BASE: wrong }))).toBeUndefined();
    }
  });

  it("lets the tests point Qwen at a pretend Alibaba", () => {
    expect(qwenBase(baseEnv({ QWEN_API_ORIGIN: "http://127.0.0.1:9999/compatible-mode/v1", QWEN_API_BASE: "https://evil.example.com" }))).toBe("http://127.0.0.1:9999/compatible-mode/v1");
  });

  it("compares secrets exactly", async () => {
    expect(await safeEqual("abc", "abc")).toBe(true);
    expect(await safeEqual("abc", "abd")).toBe(false);
    expect(await safeEqual("abc", "abcd")).toBe(false);
    expect(await safeEqual("", "abc")).toBe(false);
  });
});

describe("product names", () => {
  it("breaks a name into its meaningful words", () => {
    expect(nameTokens("100ml Original Sugar Marshmallow (New)")).toEqual(["sugar", "marshmallow"]);
    expect(nameTokens("Crème brûlée candle")).toEqual(["creme", "brulee", "candle"]);
  });

  it("finds a product with the same name ignoring case and punctuation, preferring a live one", () => {
    const known = [product("Silk scarf!", "Fashion", false, "a"), product("silk  SCARF", "Fashion", true, "b")];
    expect(findSameName("Silk Scarf", known)?.id).toBe("b");
    expect(findSameName("Silk scarves", known)).toBeNull();
    expect(findSameName("   ", known)).toBeNull();
  });

  it("uses the spelling of an existing category", () => {
    const known = [product("Bag", "Bags & Wallets")];
    expect(canonicalCategory("bags & wallets", known)).toBe("Bags & Wallets");
    expect(canonicalCategory("Toys", known)).toBe("Toys");
    expect(canonicalCategory("  ", known)).toBeNull();
    expect(canonicalCategory(null, known)).toBeNull();
  });
});

describe("guessCategory", () => {
  const known = [
    product("Sugar marshmallow body mist", "Beauty"),
    product("Vanilla body lotion", "Beauty"),
    product("Leather handbag black", "Bags"),
    product("Canvas tote bag", "Bags"),
    product("Phone case clear", "Phone accessories"),
    product("Unsorted thing", "Uncategorised"),
  ];

  it("picks the category of the most similar product", () => {
    expect(guessCategory("100ml Original sugar marshmallow", known)).toEqual({ category: "Beauty", similarTo: "Sugar marshmallow body mist" });
    expect(guessCategory("Brown leather wallet", known)?.category).toBe("Bags");
  });

  it("gives up when nothing is similar", () => {
    expect(guessCategory("Garden hose reel", known)).toBeNull();
    expect(guessCategory("", known)).toBeNull();
    expect(guessCategory("Sugar marshmallow", [])).toBeNull();
  });

  it("does not learn from products nobody has sorted yet", () => {
    expect(guessCategory("Unsorted thing", known)).toBeNull();
  });

  it("does not guess from a word nearly every product shares", () => {
    const crowded = Array.from({ length: 10 }, (_, index) => product(`Premium item ${index}`, index < 5 ? "A" : "B"));
    expect(guessCategory("Premium gadget", crowded)).toBeNull();
  });
});
