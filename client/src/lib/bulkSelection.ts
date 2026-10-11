import { isUncategorised } from "@shared/productMessage";
import type { AdminSummary } from "@/lib/catalogueApi";
import type { BulkDeleteResult } from "@/lib/productWriteApi";

/** The products ticked in the admin list, by id. */
export type Selection = Map<string, AdminSummary>;

export function toggleSelection(selection: Selection, item: AdminSummary): Selection {
  const next = new Map(selection);
  if (next.has(item.id)) next.delete(item.id);
  else next.set(item.id, item);
  return next;
}

export function selectionOf(items: AdminSummary[]): Selection {
  return new Map(items.map(item => [item.id, item]));
}

/** What the ticked products allow: which can go live, which can be hidden, which still need a category. */
export function splitSelection(selection: Selection) {
  const items = Array.from(selection.values());
  const hidden = items.filter(item => !item.isActive);
  return {
    total: items.length,
    ids: items.map(item => item.id),
    hidden,
    live: items.filter(item => item.isActive),
    /** Hidden products with no real category. They must be given one before they go live. */
    needsCategory: hidden.filter(item => isUncategorised(item.category)),
  };
}

export const countOf = (count: number, singular = "product", plural = `${singular}s`) => `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;

export function deleteSummary({ deleted, blocked }: BulkDeleteResult): { tone: "success" | "warning"; text: string } {
  if (!blocked) return { tone: "success", text: `Deleted ${countOf(deleted)}` };
  const kept = `${countOf(blocked)} ${blocked === 1 ? "is" : "are"} part of a quote request, so ${blocked === 1 ? "it was" : "they were"} kept. Hide ${blocked === 1 ? "it" : "them"} instead.`;
  return { tone: "warning", text: deleted ? `Deleted ${countOf(deleted)}. ${kept}` : `Nothing was deleted. ${kept}` };
}
