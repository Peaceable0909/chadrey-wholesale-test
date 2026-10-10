import type { Tone } from "@/lib/categories";

/** Customer-friendly labels for the quote / order lifecycle statuses stored in Supabase. */
const LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Awaiting review",
  quoted: "Quotation ready",
  accepted: "Accepted",
  declined: "Declined",
  rejected: "Rejected",
  expired: "Expired",
  invoiced: "Invoice issued",
  overdue: "Overdue",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TONES: Record<string, Tone> = {
  draft: "gray",
  pending: "orange",
  quoted: "blue",
  accepted: "green",
  declined: "red",
  rejected: "red",
  expired: "gray",
  invoiced: "indigo",
  overdue: "red",
  paid: "green",
  processing: "indigo",
  shipped: "teal",
  delivered: "green",
  cancelled: "red",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusTone(status: string): Tone {
  return TONES[status] ?? "gray";
}
