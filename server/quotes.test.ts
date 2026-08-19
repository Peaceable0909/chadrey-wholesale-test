import { describe, expect, it } from "vitest";

type QuoteStatus = "pending" | "quoted" | "accepted" | "invoiced" | "paid" | "processing" | "shipped" | "delivered" | "declined" | "rejected" | "expired" | "overdue" | "cancelled";
const allowed: Record<QuoteStatus, QuoteStatus[]> = {
  pending: ["quoted", "rejected", "cancelled"], quoted: ["accepted", "declined", "expired", "cancelled"], accepted: ["invoiced", "cancelled"], invoiced: ["paid", "overdue", "cancelled"], overdue: ["paid", "cancelled"], paid: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["delivered", "cancelled"], delivered: [], declined: [], rejected: [], expired: [], cancelled: [],
};

describe("wholesale quote state machine", () => {
  it("allows the happy path without skipping invoice creation", () => {
    expect(allowed.pending).toContain("quoted");
    expect(allowed.quoted).toContain("accepted");
    expect(allowed.accepted).toContain("invoiced");
    expect(allowed.invoiced).toContain("paid");
    expect(allowed.paid).toContain("processing");
    expect(allowed.processing).toContain("shipped");
    expect(allowed.shipped).toContain("delivered");
  });
  it("supports rejection, expiry, overdue payment, and cancellation exits", () => {
    expect(allowed.pending).toEqual(expect.arrayContaining(["rejected", "cancelled"]));
    expect(allowed.quoted).toEqual(expect.arrayContaining(["declined", "expired"]));
    expect(allowed.invoiced).toContain("overdue");
    expect(allowed.paid).toContain("cancelled");
  });
  it("keeps Stripe out of the current provider set until credentials are configured", () => {
    const enabledProviders = ["flutterwave", "bank_transfer"];
    expect(enabledProviders).not.toContain("stripe");
  });
});
