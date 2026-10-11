import { describe, expect, it } from "vitest";
import { photoIdFor } from "./stableId";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const file = (...bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
const PRODUCT = "00000000-0000-4000-8000-000000000001";

describe("photoIdFor", () => {
  it("gives a valid id", async () => {
    expect(await photoIdFor(PRODUCT, file(1, 2, 3))).toMatch(UUID);
  });

  it("gives the same id for the same photo on the same product", async () => {
    expect(await photoIdFor(PRODUCT, file(1, 2, 3))).toBe(await photoIdFor(PRODUCT, file(1, 2, 3)));
    expect(await photoIdFor(PRODUCT.toUpperCase(), file(1, 2, 3))).toBe(await photoIdFor(PRODUCT, file(1, 2, 3)));
  });

  it("gives another id for another photo or another product", async () => {
    const base = await photoIdFor(PRODUCT, file(1, 2, 3));
    expect(await photoIdFor(PRODUCT, file(1, 2, 4))).not.toBe(base);
    expect(await photoIdFor("00000000-0000-4000-8000-000000000002", file(1, 2, 3))).not.toBe(base);
  });
});
