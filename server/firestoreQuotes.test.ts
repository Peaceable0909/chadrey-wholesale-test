import { describe, expect, it } from "vitest";
import { buildFirestoreQuoteDocument } from "./firestoreQuotes";

describe("Firestore quote repository", () => {
  it("builds an owned pending quote with all multi-item request fields", () => {
    const quote = buildFirestoreQuoteDocument({
      ownerUid: "firebase-user-1",
      ref: "WR-2026-00001",
      notes: "Deliver before the next buying cycle",
      items: [
        {
          productId: "linen-shirt",
          quantity: 120,
          color: "White",
          size: "M",
          packaging: "Bulk cartons",
          customization: "Private label",
          note: "Use the approved neck label",
        },
      ],
    });

    expect(quote.ownerUid).toBe("firebase-user-1");
    expect(quote.status).toBe("pending");
    expect(quote.items).toHaveLength(1);
    expect(quote.items[0]?.note).toBe("Use the approved neck label");
  });
});
