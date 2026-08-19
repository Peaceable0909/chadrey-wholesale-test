import { describe, expect, it } from "vitest";
import { normalizeFlutterwaveEvent, paymentMatchesInvoice, verifyFlutterwaveWebhookHash, webhookDecision } from "./flutterwave";

describe("Flutterwave webhook boundary", () => {
  it("rejects missing or mismatched webhook hashes", () => {
    expect(verifyFlutterwaveWebhookHash(undefined, "secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash("wrong", "secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash("secret", "secret")).toBe(true);
  });
  it("matches only the expected invoice reference, currency, and amount", () => {
    expect(paymentMatchesInvoice({ txRef: "invoice-7", expectedTxRef: "invoice-7", amount: 15000, expectedAmount: 15000, currency: "NGN", expectedCurrency: "NGN" })).toBe(true);
    expect(paymentMatchesInvoice({ txRef: "invoice-7", expectedTxRef: "invoice-7", amount: 14999, expectedAmount: 15000, currency: "NGN", expectedCurrency: "NGN" })).toBe(false);
    expect(paymentMatchesInvoice({ txRef: "invoice-8", expectedTxRef: "invoice-7", amount: 15000, expectedAmount: 15000, currency: "NGN", expectedCurrency: "NGN" })).toBe(false);
  });
  it("makes safe webhook decisions for accepted, duplicate, and rejected events", () => {
    expect(webhookDecision({ signatureValid: true, duplicate: false, providerStatus: "successful", invoiceMatches: true })).toBe("accept");
    expect(webhookDecision({ signatureValid: true, duplicate: true, providerStatus: "successful", invoiceMatches: true })).toBe("duplicate");
    expect(webhookDecision({ signatureValid: false, duplicate: false, providerStatus: "successful", invoiceMatches: true })).toBe("reject_signature");
    expect(webhookDecision({ signatureValid: true, duplicate: false, providerStatus: "failed", invoiceMatches: true })).toBe("reject_status");
    expect(webhookDecision({ signatureValid: true, duplicate: false, providerStatus: "successful", invoiceMatches: false })).toBe("reject_invoice");
  });
  it("normalizes successful payment events without trusting them by itself", () => {
    const event = normalizeFlutterwaveEvent({ event: "charge.completed", data: { id: 42, tx_ref: "invoice-7", status: "successful", amount: "15000", currency: "NGN" } });
    expect(event).toMatchObject({ event: "charge.completed", transactionId: "42", txRef: "invoice-7", status: "successful", amount: 15000, currency: "NGN" });
    expect(event.raw).toBeTruthy();
  });
});
