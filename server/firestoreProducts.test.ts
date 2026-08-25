import { describe, expect, it } from "vitest";
import { mapFirestoreProduct } from "./firestoreProducts";

describe("Firestore product repository", () => {
  it("maps a Firestore product into the existing catalogue shape", () => {
    const product = mapFirestoreProduct("42", {
      slug: "linen-shirt",
      name: "Linen Shirt",
      description: "Wholesale linen shirt",
      category: "Apparel",
      moq: 24,
      colors: ["White"],
      sizes: ["M"],
      packagingOptions: ["Bulk"],
      customizationOptions: ["Labeling"],
      images: ["https://example.com/secondary.jpg", "https://example.com/shirt.jpg"],
      primaryImage: "https://example.com/shirt.jpg",
      isActive: true,
      createdAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
    });

    expect(product.id).toBe(42);
    expect(product.slug).toBe("linen-shirt");
    expect(product.isActive).toBe(1);
    expect(product.images?.[0]).toBe("https://example.com/shirt.jpg");
    expect(product.createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
