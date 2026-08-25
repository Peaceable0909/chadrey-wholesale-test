import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const createFirestoreProduct = vi.fn();
vi.mock("./firestoreProducts", async () => {
  const actual = await vi.importActual<typeof import("./firestoreProducts")>("./firestoreProducts");
  return { ...actual, createFirestoreProduct };
});

const { appRouter } = await import("./routers");

function context(role: "admin" | "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: role === "admin" ? "admin-uid" : "customer-uid",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "firebase",
      role,
      companyName: null,
      phone: null,
      whatsapp: null,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const images = Array.from({ length: 10 }, (_, index) => `https://cdn.example.com/product-${index}.jpg`);

const input = {
  slug: "premium-hoodie",
  name: "Premium Heavyweight Hoodie",
  description: "A wholesale-ready heavyweight hoodie with a soft brushed interior.",
  category: "Apparel",
  moq: 24,
  colors: ["Black", "Stone"],
  sizes: ["S", "M", "L", "XL"],
  packagingOptions: ["Bulk cartons"],
  customizationOptions: ["Private label", "Embroidery"],
  images,
  primaryImage: images[3]!,
};

describe("catalogue.adminCreate", () => {
  beforeEach(() => createFirestoreProduct.mockClear());

  it("allows an admin to persist a product with ten images", async () => {
    createFirestoreProduct.mockResolvedValueOnce("premium-hoodie");

    const result = await appRouter.createCaller(context("admin")).catalogue.adminCreate(input);

    expect(result).toEqual({ id: "premium-hoodie" });
    expect(createFirestoreProduct).toHaveBeenCalledWith({
      ...input,
      createdByUid: "admin-uid",
    });
  });

  it("rejects non-admin users before persistence", async () => {
    await expect(
      appRouter.createCaller(context("user")).catalogue.adminCreate(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createFirestoreProduct).not.toHaveBeenCalled();
  });

  it("requires the primary image to be part of the uploaded image set", async () => {
    await expect(
      appRouter.createCaller(context("admin")).catalogue.adminCreate({
        ...input,
        primaryImage: "https://cdn.example.com/not-uploaded.jpg",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
