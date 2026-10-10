import { describe, expect, it } from "vitest";
import { mapProductRow } from "./catalogue";
import { buildItemRows, customFormValue, indicativeTotals, newLine, optionText, OTHER, readPrefill, referenceFileProblem, validateQuote } from "./quote";

const product = mapProductRow({
  id: "p1",
  slug: "tee",
  name: "Cotton tee",
  category: "Apparel",
  moq: 50,
  colors: ["Black", "White"],
  sizes: ["M", "L"],
  packaging_options: [],
  customization_options: [],
  price_currency: "NGN",
  price_unit: "pc",
  price_tiers: [{ min_qty: 50, price: 4500 }, { min_qty: 200, price: 4100 }],
  product_images: [
    { id: "img-b", public_url: "https://x/b.jpg", is_primary: false, sort_order: 1 },
    { id: "img-a", public_url: "https://x/a.jpg", is_primary: true, sort_order: 0 },
  ],
});
const unpriced = mapProductRow({ id: "p2", slug: "mug", name: "Mug", category: "Kitchenware", moq: 12 });

describe("newLine", () => {
  it("starts at the MOQ with the primary image preferred and nothing pre-selected", () => {
    const line = newLine(product);
    expect(line.quantity).toBe(50);
    expect(line.preferredImageIds).toEqual(["img-a"]);
    expect(line.selections).toEqual({});
  });

  it("can be created empty and overridden", () => {
    expect(newLine().product).toBeNull();
    expect(newLine(product, { quantity: 120 }).quantity).toBe(120);
  });
});

describe("readPrefill", () => {
  it("reads quantity and valid option choices from the product page link", () => {
    expect(readPrefill("?product=tee&qty=120&color=White&size=XXL", product)).toEqual({ quantity: 120, selections: { color: "White" } });
  });

  it("never goes below the MOQ and ignores a bad quantity", () => {
    expect(readPrefill("?qty=10", product).quantity).toBe(50);
    expect(readPrefill("?qty=abc", product).quantity).toBe(50);
  });
});

describe("option text", () => {
  const line = newLine(product, { selections: { color: OTHER, size: "L" }, customValues: { color: " Teal ", size: "stale" } });

  it("uses the typed value for 'Other / not listed'", () => {
    expect(optionText(line, "color")).toBe("Teal");
    expect(optionText(line, "size")).toBe("L");
    expect(optionText(line, "packaging")).toBe("");
  });

  it("only records typed values for options still set to Other", () => {
    expect(customFormValue(line)).toBe("color: Teal");
  });
});

describe("buildItemRows", () => {
  it("keeps the same columns the admin screens read", () => {
    const rows = buildItemRows("req-1", [newLine(product, { quantity: 100, selections: { color: "Black" }, requirements: "  logo on chest  " })]);
    expect(rows).toEqual([
      {
        quote_request_id: "req-1",
        product_id: "p1",
        quantity: 100,
        color: "Black",
        size: "",
        packaging: "",
        customization: "",
        option_selections: { color: "Black" },
        custom_form_value: null,
        requirements: "logo on chest",
        preferred_image_ids: ["img-a"],
      },
    ]);
  });
});

describe("validateQuote", () => {
  const ok = [newLine(product)];

  it("accepts a complete request", () => {
    expect(validateQuote(ok, "We need 100 shirts for a school.")).toBeNull();
  });

  it("requires a product on every line", () => {
    expect(validateQuote([], "long enough brief")).toMatch(/Choose a product/);
    expect(validateQuote([newLine()], "long enough brief")).toMatch(/Choose a product/);
  });

  it("enforces the MOQ and a short brief", () => {
    expect(validateQuote([newLine(product, { quantity: 10 })], "long enough brief")).toMatch(/MOQ/);
    expect(validateQuote(ok, "short")).toMatch(/at least a few words/);
  });
});

describe("indicativeTotals", () => {
  it("uses the tier for each line's quantity and skips unpriced products", () => {
    const totals = indicativeTotals([newLine(product, { quantity: 50 }), newLine(product, { quantity: 200 }), newLine(unpriced)]);
    expect(totals).toEqual([{ currency: "NGN", total: 50 * 4500 + 200 * 4100, pricedLines: 2 }]);
  });

  it("returns nothing when no product has a price", () => {
    expect(indicativeTotals([newLine(unpriced)])).toEqual([]);
  });
});

describe("referenceFileProblem", () => {
  it("allows images and documents up to 10 MB", () => {
    expect(referenceFileProblem({ type: "image/png", size: 1024 })).toBeNull();
    expect(referenceFileProblem({ type: "application/pdf", size: 9 * 1024 * 1024 })).toBeNull();
  });

  it("rejects other types and oversized files", () => {
    expect(referenceFileProblem({ type: "application/zip", size: 1024 })).toMatch(/up to 10 MB/);
    expect(referenceFileProblem({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/up to 10 MB/);
  });
});
