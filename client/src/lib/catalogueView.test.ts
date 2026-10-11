import { describe, expect, it } from "vitest";
import { activeFilters, imageFit, variationSummary } from "./catalogueView";

const group = (label: string, count: number) => ({ key: label.toLowerCase(), label, options: Array.from({ length: count }, (_, index) => `Option ${index + 1}`) });

describe("activeFilters", () => {
  it("lists nothing when nothing narrows the list", () => {
    expect(activeFilters({ q: "", category: "All", savedOnly: false })).toEqual([]);
    expect(activeFilters({ q: "   ", category: "", savedOnly: false })).toEqual([]);
  });

  it("lists the category, the search words and saved-only, each by what it is", () => {
    expect(activeFilters({ q: " tote bag ", category: "Bags", savedOnly: true })).toEqual([
      { key: "category", label: "Bags" },
      { key: "q", label: "“tote bag”" },
      { key: "saved", label: "Saved products" },
    ]);
  });

  it("lists a single filter on its own", () => {
    expect(activeFilters({ q: "", category: "Shoes", savedOnly: false })).toEqual([{ key: "category", label: "Shoes" }]);
    expect(activeFilters({ q: "mug", category: "All", savedOnly: false })).toEqual([{ key: "q", label: "“mug”" }]);
  });
});

describe("imageFit", () => {
  it("fills the frame with a photo that is about square, and shows any other shape whole", () => {
    expect(imageFit(1000, 1000)).toBe("cover");
    expect(imageFit(1000, 900)).toBe("cover");
    expect(imageFit(900, 1000)).toBe("cover");
    expect(imageFit(1600, 1200)).toBe("contain");
    expect(imageFit(1200, 1600)).toBe("contain");
    expect(imageFit(3000, 1000)).toBe("contain");
  });

  it("takes the frame's own shape into account", () => {
    expect(imageFit(1600, 1200, 4 / 3)).toBe("cover");
    expect(imageFit(1000, 1000, 4 / 3)).toBe("contain");
  });

  it("shows the whole photo when its size is not known", () => {
    expect(imageFit(0, 0)).toBe("contain");
    expect(imageFit(Number.NaN, 100)).toBe("contain");
    expect(imageFit(100, 100, 0)).toBe("contain");
  });
});

describe("variationSummary", () => {
  it("says nothing when there is nothing to choose between", () => {
    expect(variationSummary([])).toBe("");
    expect(variationSummary([group("Color", 1)])).toBe("");
  });

  it("counts the choices in each group", () => {
    expect(variationSummary([group("Color", 4), group("Size", 3)])).toBe("4 colors · 3 sizes");
  });

  it("makes a sensible plural of any label", () => {
    expect(variationSummary([group("Capacity", 3)])).toBe("3 capacities");
    expect(variationSummary([group("Sizes", 2)])).toBe("2 sizes");
    expect(variationSummary([group("Finish", 2)])).toBe("2 finishes");
    expect(variationSummary([group("Packaging", 2)])).toBe("2 packaging options");
    expect(variationSummary([group("Customization", 5)])).toBe("5 customization options");
    expect(variationSummary([group("Box", 2)])).toBe("2 boxes");
  });

  it("shows two groups and counts the rest", () => {
    expect(variationSummary([group("Color", 2), group("Size", 2), group("Material", 2), group("Style", 2)])).toBe("2 colors · 2 sizes · +2 more");
  });

  it("skips single-option groups without hiding real ones", () => {
    expect(variationSummary([group("Packaging", 1), group("Color", 3)])).toBe("3 colors");
  });
});
