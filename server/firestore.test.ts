import { describe, expect, it } from "vitest";
import { documentPath, FIRESTORE_COLLECTIONS } from "./firestore";

describe("Firestore domain contract", () => {
  it("keeps the B2B collection names explicit and stable", () => {
    expect(FIRESTORE_COLLECTIONS).toMatchObject({
      users: "users",
      products: "products",
      quoteRequests: "quoteRequests",
      quotations: "quotations",
      invoices: "invoices",
      payments: "payments",
      orders: "orders",
      messages: "messages",
      notifications: "notifications",
      deviceTokens: "deviceTokens",
    });
  });

  it("builds a safe collection/document path", () => {
    expect(documentPath(FIRESTORE_COLLECTIONS.quoteRequests, "quote-123")).toBe(
      "quoteRequests/quote-123"
    );
  });
});
