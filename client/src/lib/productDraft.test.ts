import { describe, expect, it } from "vitest";
import { mapProductRow } from "./catalogue";
import { buildOptionGroups, csv, draftFromProduct, emptyDraft, fieldsFromDraft, MIN_PRODUCT_IMAGES } from "./productDraft";

const valid = () => ({ ...emptyDraft(), name: "Rattan bag", category: "Bags", moq: "24" });

describe("csv", () => {
  it("splits, trims and drops empties", () => {
    expect(csv(" Black, Navy ,, Stone ")).toEqual(["Black", "Navy", "Stone"]);
    expect(csv("")).toEqual([]);
  });
});

describe("buildOptionGroups", () => {
  it("only includes groups that have values", () => {
    const groups = buildOptionGroups({ ...emptyDraft(), colors: "Black, White", sizes: "", packaging: "Bulk", customization: "", customLabel: "", customValues: "" });
    expect(groups.map(group => group.key)).toEqual(["color", "packaging"]);
  });

  it("adds a custom group with its own key", () => {
    const groups = buildOptionGroups({ ...emptyDraft(), customLabel: "Capacity", customValues: "500 ml, 1 L" });
    expect(groups).toEqual([{ key: "capacity", label: "Capacity", options: ["500 ml", "1 L"] }]);
  });

  it("does not let a custom label clash with a standard option key", () => {
    const groups = buildOptionGroups({ ...emptyDraft(), colors: "Red", customLabel: "Color", customValues: "Teal" });
    expect(groups.map(group => group.key)).toEqual(["color", "color-custom"]);
  });

  it("ignores a custom group that has a label but no values", () => {
    expect(buildOptionGroups({ ...emptyDraft(), customLabel: "Finish", customValues: "" })).toEqual([]);
  });
});

describe("fieldsFromDraft", () => {
  it("accepts the minimum a dealer listing needs: name, category and MOQ", () => {
    const { fields, error } = fieldsFromDraft(valid());
    expect(error).toBeNull();
    expect(fields).toMatchObject({ name: "Rattan bag", category: "Bags", moq: 24, shortDescription: "", description: "", isActive: true });
    expect(fields?.pricing.tiers).toEqual([]);
  });

  it("requires a name, a category and a sensible MOQ", () => {
    expect(fieldsFromDraft({ ...valid(), name: "  " }).error).toMatch(/name/);
    expect(fieldsFromDraft({ ...valid(), category: "" }).error).toMatch(/category/);
    expect(fieldsFromDraft({ ...valid(), moq: "0" }).error).toMatch(/minimum order/);
    expect(fieldsFromDraft({ ...valid(), moq: "2.5" }).error).toMatch(/whole number/);
  });

  it("builds the price ladder from the MOQ and surfaces price mistakes", () => {
    const ok = fieldsFromDraft({ ...valid(), price: { currency: "NGN", unit: "pc", base: "18,500", breaks: [{ minQty: "100", price: "16800" }] } });
    expect(ok.fields?.pricing.tiers).toEqual([{ minQty: 24, price: 18500 }, { minQty: 100, price: 16800 }]);
    const bad = fieldsFromDraft({ ...valid(), price: { currency: "NGN", unit: "pc", base: "100", breaks: [{ minQty: "100", price: "120" }] } });
    expect(bad.error).toMatch(/should not cost more/);
  });
});

describe("draftFromProduct", () => {
  const product = mapProductRow({
    id: "p1",
    slug: "mug",
    name: "Mug",
    category: "Kitchenware",
    moq: 12,
    short_description: "Short",
    description: "Long",
    colors: ["White"],
    option_groups: [
      { key: "color", label: "Color", options: ["White", "Blue"] },
      { key: "capacity", label: "Capacity", options: ["300 ml", "450 ml"] },
    ],
    price_currency: "USD",
    price_unit: "set",
    price_tiers: [{ min_qty: 12, price: 3.5 }, { min_qty: 60, price: 3 }],
    is_active: false,
  });

  it("turns a saved product back into editable text", () => {
    const draft = draftFromProduct(product);
    expect(draft).toMatchObject({ name: "Mug", category: "Kitchenware", moq: "12", colors: "White, Blue", customLabel: "Capacity", customValues: "300 ml, 450 ml", isActive: false });
    expect(draft.price).toEqual({ currency: "USD", unit: "set", base: "3.5", breaks: [{ minQty: "60", price: "3" }] });
  });

  it("round-trips without changing the product", () => {
    const { fields } = fieldsFromDraft(draftFromProduct(product));
    expect(fields?.optionGroups).toEqual(product.optionGroups);
    expect(fields?.pricing).toEqual(product.pricing);
  });
});

describe("rules", () => {
  it("keeps the two-photo minimum the shop already used", () => {
    expect(MIN_PRODUCT_IMAGES).toBe(2);
  });
});
