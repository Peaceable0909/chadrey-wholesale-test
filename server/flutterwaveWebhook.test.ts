import { beforeAll, describe, expect, it, vi } from "vitest";
import { processFlutterwaveWebhook } from "./flutterwaveWebhook";

describe("Flutterwave webhook handler", () => { beforeAll(() => { process.env.FLUTTERWAVE_WEBHOOK_HASH = "secret"; });
  const body = { event: "charge.completed", data: { id: "tx-1", tx_ref: "invoice-7", status: "successful", amount: "15000", currency: "NGN" } };
  it("persists the verified payment, creates an order, and notifies the owner", async () => {
    const recordPayment = vi.fn().mockResolvedValue(4); const createPaidOrder = vi.fn().mockResolvedValue(9); const notifyOwner = vi.fn().mockResolvedValue(undefined);
    const result = await processFlutterwaveWebhook({ hash: "secret", body }, { getPaymentByTransaction: vi.fn().mockResolvedValue(undefined), getInvoiceById: vi.fn().mockResolvedValue({ id: 7, total: "15000", currency: "NGN" }), verifyTransaction: vi.fn().mockResolvedValue({ id: "tx-1", tx_ref: "invoice-7", amount: 15000, currency: "NGN", payment_type: "card" }), recordPayment, createPaidOrder, notifyOwner });
    expect(result).toEqual({ status: 200, body: { ok: true, orderId: 9 } }); expect(recordPayment).toHaveBeenCalledOnce(); expect(createPaidOrder).toHaveBeenCalledWith(7); expect(notifyOwner).toHaveBeenCalledOnce();
  });
  it("returns duplicate without persisting or notifying", async () => {
    const recordPayment = vi.fn(); const createPaidOrder = vi.fn(); const notifyOwner = vi.fn();
    const result = await processFlutterwaveWebhook({ hash: "secret", body }, { getPaymentByTransaction: vi.fn().mockResolvedValue({ id: 4 }), getInvoiceById: vi.fn(), verifyTransaction: vi.fn(), recordPayment, createPaidOrder, notifyOwner });
    expect(result).toEqual({ status: 200, body: { ok: true, duplicate: true } }); expect(recordPayment).not.toHaveBeenCalled(); expect(createPaidOrder).not.toHaveBeenCalled(); expect(notifyOwner).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures before touching payment dependencies", async () => {
    const getPaymentByTransaction = vi.fn(); const result = await processFlutterwaveWebhook({ hash: "wrong", body }, { getPaymentByTransaction, getInvoiceById: vi.fn(), verifyTransaction: vi.fn(), recordPayment: vi.fn(), createPaidOrder: vi.fn(), notifyOwner: vi.fn() });
    expect(result.status).toBe(401); expect(getPaymentByTransaction).not.toHaveBeenCalled();
  });
});
