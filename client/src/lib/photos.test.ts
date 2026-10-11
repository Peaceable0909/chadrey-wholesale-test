import { describe, expect, it } from "vitest";
import { PHOTO_WIDTHS, isShopPhoto, photoAttributes, photoSrc } from "./photos";

const KEY = "/photos/products/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg";

describe("shop photos", () => {
  it("recognises the shop's own photos by their address", () => {
    expect(isShopPhoto(KEY)).toBe(true);
    expect(isShopPhoto("https://images.example.com/a.jpg")).toBe(false);
    expect(isShopPhoto("/og-product.svg")).toBe(false);
  });

  it("asks for a smaller copy of a shop photo and leaves other photos alone", () => {
    expect(photoSrc(KEY, 320)).toBe(`${KEY}?w=320`);
    expect(photoSrc(`${KEY}?w=999`, 160)).toBe(`${KEY}?w=160`);
    expect(photoSrc("https://images.example.com/a.jpg", 320)).toBe("https://images.example.com/a.jpg");
  });

  it("only ever asks for sizes the shop makes", () => {
    for (const variant of ["thumb", "card", "main"] as const) {
      const { srcSet } = photoAttributes(KEY, variant);
      const asked = Array.from(srcSet!.matchAll(/\?w=(\d+) /g), match => Number(match[1]));
      expect(asked.length).toBeGreaterThan(1);
      for (const width of asked) expect(PHOTO_WIDTHS).toContain(width);
    }
  });

  it("lets the browser pick by the size the photo is shown at", () => {
    expect(photoAttributes(KEY, "thumb")).toEqual({ src: `${KEY}?w=160`, srcSet: `${KEY}?w=160 160w, ${KEY}?w=320 320w`, sizes: "72px" });
    expect(photoAttributes(KEY, "card").sizes).toBe("(min-width: 1024px) 280px, 50vw");
    expect(photoAttributes(KEY, "main").src).toBe(`${KEY}?w=960`);
  });

  it("gives other photos as they are, with no size choices", () => {
    expect(photoAttributes("https://images.example.com/a.jpg", "card")).toEqual({ src: "https://images.example.com/a.jpg" });
  });
});
