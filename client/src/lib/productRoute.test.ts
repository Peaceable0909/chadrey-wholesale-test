import { describe, expect, it } from "vitest";
import { productHref, productSlugFromLocation, quoteHref } from "./productRoute";

describe("product route helpers", () => {
  it("encodes a catalogue slug into the detail URL", () => {
    expect(productHref("premium-lunch-box")).toBe("/product?id=premium-lunch-box");
    expect(productHref("summer set/blue")).toBe("/product?id=summer%20set%2Fblue");
  });

  it("links to the quote request with the product already chosen", () => {
    expect(quoteHref("premium-lunch-box")).toBe("/quote?product=premium-lunch-box");
    expect(quoteHref("summer set/blue")).toBe("/quote?product=summer%20set%2Fblue");
  });

  it("reads the selected slug without falling back to another product", () => {
    expect(productSlugFromLocation("/product?id=premium-lunch-box")).toBe("premium-lunch-box");
    expect(productSlugFromLocation("/product?id=missing-product")).toBe("missing-product");
    expect(productSlugFromLocation("/product")).toBe("");
  });
});
