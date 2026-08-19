import crypto from "node:crypto";

export type FlutterwaveEvent = { event: string; transactionId?: string; txRef?: string; status?: string; amount?: number; currency?: string; raw: unknown };

export function verifyFlutterwaveWebhookHash(providedHash: string | undefined, configuredHash = process.env.FLUTTERWAVE_WEBHOOK_HASH): boolean {
  if (!providedHash || !configuredHash) return false;
  const provided = Buffer.from(providedHash);
  const configured = Buffer.from(configuredHash);
  return provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
}

export function normalizeFlutterwaveEvent(payload: any): FlutterwaveEvent {
  const data = payload?.data ?? {};
  return { event: payload?.event ?? "unknown", transactionId: data.id ? String(data.id) : undefined, txRef: data.tx_ref ? String(data.tx_ref) : undefined, status: data.status ? String(data.status) : undefined, amount: typeof data.amount === "number" ? data.amount : Number(data.amount || 0), currency: data.currency ? String(data.currency) : undefined, raw: payload };
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Flutterwave verification failed with ${response.status}`);
  const body = await response.json() as any;
  if (body?.status !== "success" || body?.data?.status !== "successful") throw new Error("Flutterwave transaction was not successful");
  return body.data as { id: number; tx_ref?: string; amount: number; currency: string; payment_type?: string; status: string };
}
