import { describe, expect, it } from "vitest";
import { normalizeFlutterwaveEvent, verifyFlutterwaveWebhookHash } from "./flutterwave";

describe("Flutterwave webhook boundary", () => {
  it("rejects missing or mismatched webhook hashes", () => {
    expect(verifyFlutterwaveWebhookHash(undefined, "secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash("wrong", "secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash("secret", "secret")).toBe(true);
  });
  it("normalizes successful payment events without trusting them by itself", () => {
    const event = normalizeFlutterwaveEvent({ event: "charge.completed", data: { id: 42, tx_ref: "invoice-7", status: "successful", amount: "15000", currency: "NGN" } });
    expect(event).toMatchObject({ event: "charge.completed", transactionId: "42", txRef: "invoice-7", status: "successful", amount: 15000, currency: "NGN" });
    expect(event.raw).toBeTruthy();
  });
});
