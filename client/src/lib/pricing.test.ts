import { describe, expect, it } from "vitest";
import {
  draftFromPricing,
  emptyPriceDraft,
  formatPriceRange,
  formatRange,
  lineTotal,
  parseAmount,
  parseTiers,
  priceBounds,
  pricingFromDraft,
  pricingFromRow,
  tierRanges,
  tiersToRows,
  unitPriceFor,
  validateTiers,
  type Pricing,
} from "./pricing";
import { formatMoney } from "./format";

const ladder: Pricing = {
  currency: "NGN",
  unit: "pc",
  tiers: [
    { minQty: 50, price: 12500 },
    { minQty: 200, price: 11800 },
    { minQty: 500, price: 11000 },
  ],
};

describe("parseTiers", () => {
  it("reads the stored shape, sorts by quantity and ignores unusable rows", () => {
    expect(
      parseTiers([
        { min_qty: 200, price: 11800 },
        { min_qty: 50, price: "12500" },
        { min_qty: 0, price: 10 },
        { min_qty: 10, price: -5 },
        { min_qty: "abc", price: 10 },
        null,
        "nope",
      ]),
    ).toEqual([
      { minQty: 50, price: 12500 },
      { minQty: 200, price: 11800 },
    ]);
  });

  it("accepts camelCase input and keeps the lowest price when a quantity repeats", () => {
    expect(parseTiers([{ minQty: 10, price: 9 }, { minQty: 10, price: 7 }])).toEqual([{ minQty: 10, price: 7 }]);
  });

  it("returns an empty ladder for anything that is not an array", () => {
    expect(parseTiers(null)).toEqual([]);
    expect(parseTiers({})).toEqual([]);
    expect(parseTiers("[]")).toEqual([]);
  });

  it("round-trips through the storage shape", () => {
    expect(parseTiers(tiersToRows(ladder.tiers))).toEqual(ladder.tiers);
  });
});

describe("pricingFromRow", () => {
  it("falls back to the default currency and unit for products that have no pricing yet", () => {
    expect(pricingFromRow({})).toEqual({ currency: "NGN", unit: "pc", tiers: [] });
  });

  it("normalises the currency code and keeps the unit", () => {
    expect(pricingFromRow({ price_currency: "thb", price_unit: " set ", price_tiers: [{ min_qty: 5, price: 100 }] })).toEqual({
      currency: "THB",
      unit: "set",
      tiers: [{ minQty: 5, price: 100 }],
    });
  });
});

describe("price lookups", () => {
  it("finds the lowest and highest unit price", () => {
    expect(priceBounds(ladder)).toEqual({ low: 11000, high: 12500 });
    expect(priceBounds({ ...ladder, tiers: [] })).toBeNull();
  });

  it("applies the tier the quantity has reached", () => {
    expect(unitPriceFor(ladder, 50)).toBe(12500);
    expect(unitPriceFor(ladder, 199)).toBe(12500);
    expect(unitPriceFor(ladder, 200)).toBe(11800);
    expect(unitPriceFor(ladder, 10_000)).toBe(11000);
  });

  it("uses the first tier below the first break instead of returning nothing", () => {
    expect(unitPriceFor(ladder, 10)).toBe(12500);
  });

  it("returns null when there is no price", () => {
    expect(unitPriceFor({ ...ladder, tiers: [] }, 100)).toBeNull();
    expect(lineTotal({ ...ladder, tiers: [] }, 100)).toBeNull();
  });

  it("totals a line without floating point drift", () => {
    expect(lineTotal({ currency: "USD", unit: "pc", tiers: [{ minQty: 1, price: 0.1 }] }, 3)).toBe(0.3);
    expect(lineTotal(ladder, 200)).toBe(2_360_000);
  });
});

describe("display helpers", () => {
  it("builds quantity bands", () => {
    const ranges = tierRanges(ladder);
    expect(ranges).toEqual([
      { from: 50, to: 199, price: 12500 },
      { from: 200, to: 499, price: 11800 },
      { from: 500, to: null, price: 11000 },
    ]);
    expect(ranges.map(formatRange)).toEqual(["50–199", "200–499", "500+"]);
  });

  it("formats a price range or a single price", () => {
    expect(formatPriceRange(ladder)).toBe("₦11,000 – ₦12,500");
    expect(formatPriceRange({ ...ladder, tiers: [{ minQty: 1, price: 450 }] })).toBe("₦450");
    expect(formatPriceRange({ ...ladder, tiers: [] })).toBeNull();
  });

  it("formats each currency with its own symbol", () => {
    expect(formatMoney(12500, "NGN")).toBe("₦12,500");
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
    expect(formatMoney(450, "THB")).toBe("฿450");
    expect(formatMoney(10, "KES")).toBe("KES 10");
    expect(formatMoney(Number.NaN)).toBe("—");
  });
});

describe("parseAmount", () => {
  it("accepts thousands separators and spaces", () => {
    expect(parseAmount("12,500")).toBe(12500);
    expect(parseAmount("1 250 000.50")).toBe(1_250_000.5);
  });

  it("returns NaN for blanks and text", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("abc")).toBeNaN();
  });
});

describe("validateTiers", () => {
  it("accepts a normal descending ladder", () => {
    expect(validateTiers(ladder.tiers)).toBeNull();
  });

  it("rejects a bigger order that costs more per unit", () => {
    expect(validateTiers([{ minQty: 10, price: 100 }, { minQty: 50, price: 120 }])).toMatch(/should not cost more/);
  });

  it("rejects repeated quantities and non-positive prices", () => {
    expect(validateTiers([{ minQty: 10, price: 100 }, { minQty: 10, price: 90 }])).toMatch(/different quantity/);
    expect(validateTiers([{ minQty: 10, price: 0 }])).toMatch(/greater than zero/);
  });
});

describe("price editor drafts", () => {
  it("treats an empty price as 'price on request'", () => {
    expect(pricingFromDraft(emptyPriceDraft(), 50)).toEqual({ pricing: { currency: "NGN", unit: "pc", tiers: [] }, error: null });
  });

  it("anchors the first price at the MOQ and sorts the volume prices", () => {
    const result = pricingFromDraft(
      { currency: "NGN", unit: "pc", base: "12,500", breaks: [{ minQty: "500", price: "11000" }, { minQty: "200", price: "11800" }] },
      50,
    );
    expect(result.error).toBeNull();
    expect(result.pricing.tiers).toEqual(ladder.tiers);
  });

  it("blocks volume prices without a base price", () => {
    const result = pricingFromDraft({ currency: "NGN", unit: "pc", base: "", breaks: [{ minQty: "200", price: "100" }] }, 50);
    expect(result.error).toMatch(/price at the minimum order first/);
  });

  it("blocks volume prices at or below the MOQ", () => {
    const result = pricingFromDraft({ currency: "NGN", unit: "pc", base: "100", breaks: [{ minQty: "50", price: "90" }] }, 50);
    expect(result.error).toMatch(/above the minimum order \(50\)/);
  });

  it("blocks half-filled rows and non-numeric prices", () => {
    expect(pricingFromDraft({ currency: "NGN", unit: "pc", base: "100", breaks: [{ minQty: "200", price: "" }] }, 50).error).toMatch(/Complete or remove/);
    expect(pricingFromDraft({ currency: "NGN", unit: "pc", base: "abc", breaks: [] }, 50).error).toMatch(/valid price/);
  });

  it("ignores completely blank volume rows", () => {
    const result = pricingFromDraft({ currency: "NGN", unit: "pc", base: "100", breaks: [{ minQty: "", price: "" }] }, 50);
    expect(result.error).toBeNull();
    expect(result.pricing.tiers).toEqual([{ minQty: 50, price: 100 }]);
  });

  it("round-trips a saved ladder back into the editor", () => {
    const draft = draftFromPricing(ladder);
    expect(draft.base).toBe("12500");
    expect(draft.breaks).toEqual([{ minQty: "200", price: "11800" }, { minQty: "500", price: "11000" }]);
    expect(pricingFromDraft(draft, 50).pricing).toEqual(ladder);
  });
});
