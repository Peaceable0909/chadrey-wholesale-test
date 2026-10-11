import { describe, expect, it } from "vitest";
import type { AdminSummary } from "./catalogueApi";
import { countOf, deleteSummary, selectionOf, splitSelection, toggleSelection } from "./bulkSelection";

const item = (id: string, category: string, isActive: boolean): AdminSummary => ({ id, name: `Product ${id}`, category, isActive });

describe("toggleSelection", () => {
  it("adds an item and removes it again without changing the original selection", () => {
    const empty = selectionOf([]);
    const one = toggleSelection(empty, item("a", "Bags", false));
    expect(Array.from(one.keys())).toEqual(["a"]);
    expect(empty.size).toBe(0);
    expect(toggleSelection(one, item("a", "Bags", false)).size).toBe(0);
  });
});

describe("splitSelection", () => {
  const selection = selectionOf([item("a", "Bags", false), item("b", "Uncategorised", false), item("c", "", false), item("d", "Shoes", true), item("e", "uncategorised", true)]);

  it("separates hidden from live products", () => {
    const split = splitSelection(selection);
    expect(split.total).toBe(5);
    expect(split.ids).toEqual(["a", "b", "c", "d", "e"]);
    expect(split.hidden.map(entry => entry.id)).toEqual(["a", "b", "c"]);
    expect(split.live.map(entry => entry.id)).toEqual(["d", "e"]);
  });

  it("flags hidden products that still need a category, however it is spelled", () => {
    expect(splitSelection(selection).needsCategory.map(entry => entry.id)).toEqual(["b", "c"]);
  });

  it("does not ask for a category on products that are already live", () => {
    expect(splitSelection(selectionOf([item("e", "Uncategorised", true)])).needsCategory).toEqual([]);
  });
});

describe("wording", () => {
  it("counts products", () => {
    expect(countOf(1)).toBe("1 product");
    expect(countOf(12)).toBe("12 products");
    expect(countOf(1200)).toBe("1,200 products");
  });

  it("reports a clean delete", () => {
    expect(deleteSummary({ deleted: 3, blocked: 0 })).toEqual({ tone: "success", text: "Deleted 3 products" });
  });

  it("explains products that were kept because a quote request uses them", () => {
    expect(deleteSummary({ deleted: 7, blocked: 1 })).toEqual({ tone: "warning", text: "Deleted 7 products. 1 product is part of a quote request, so it was kept. Hide it instead." });
    expect(deleteSummary({ deleted: 0, blocked: 2 }).text).toBe("Nothing was deleted. 2 products are part of a quote request, so they were kept. Hide them instead.");
  });
});
