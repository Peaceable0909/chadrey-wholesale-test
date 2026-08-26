import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const storageRules = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");

describe("Firebase security rules", () => {
  it("uses stored document data for owner-scoped reads", () => {
    expect(firestoreRules).toContain("allow read: if isAdmin() || owns(resource);");
    expect(firestoreRules).toContain("allow create: if signedIn() && request.resource.data.ownerUid");
    expect(firestoreRules).not.toContain("allow read, write: if signedIn() && request.resource.data.ownerUid");
  });

  it("does not allow customers to self-assign the administrator role", () => {
    expect(firestoreRules).toContain('request.resource.data.role == "user"');
    expect(firestoreRules).toContain('request.resource.data.role == resource.data.role');
  });

  it("does not grant every signed-in user access to quote or invoice files", () => {
    expect(storageRules).toContain("isAdmin() || ownsQuote(quoteId)");
    expect(storageRules).toContain("isAdmin() || ownsInvoice(invoiceId)");
    expect(storageRules).not.toContain("match /quotes/{quoteId}/{allPaths=**} {\n      allow read, write: if signedIn();");
  });
});
