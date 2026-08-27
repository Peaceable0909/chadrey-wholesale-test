import { describe, expect, it } from "vitest";
import { normalizeOptionGroups, optionGroupKey } from "./productOptions";

describe("product option groups", () => {
  it("hides empty product option groups", () => {
    expect(normalizeOptionGroups({ colors: ["Black"], sizes: [], packaging_options: [], customization_options: ["Plain"] })).toEqual([
      { key: "color", label: "Color", options: ["Black"] },
      { key: "customization", label: "Customization", options: ["Plain"] },
    ]);
  });

  it("prefers configured custom groups over legacy option arrays", () => {
    expect(normalizeOptionGroups({ option_groups: [{ key: "capacity", label: "Capacity", options: ["500 ml", "1 L"] }], sizes: ["S", "M"] })).toEqual([
      { key: "capacity", label: "Capacity", options: ["500 ml", "1 L"] },
    ]);
  });

  it("creates stable keys for custom forms", () => {
    expect(optionGroupKey(" Product Finish ")).toBe("product-finish");
  });
});
