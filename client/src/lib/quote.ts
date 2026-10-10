import type { Product } from "@/lib/catalogue";
import { lineTotal } from "@/lib/pricing";

/** Marker stored when a buyer picks "Other / not listed" for an option. */
export const OTHER = "__other__";

export type QuoteLine = {
  id: string;
  product: Product | null;
  quantity: number;
  /** option group key → chosen value (or OTHER). Empty string = not specified. */
  selections: Record<string, string>;
  /** option group key → free text, used when the selection is OTHER. */
  customValues: Record<string, string>;
  preferredImageIds: string[];
  requirements: string;
};

export type ContactDetails = { name: string; company: string; email: string; phone: string; whatsapp: string; address: string };

let sequence = 0;
const nextId = () => `${Date.now().toString(36)}-${(sequence++).toString(36)}`;

export function newLine(product: Product | null = null, overrides: Partial<QuoteLine> = {}): QuoteLine {
  const primary = product?.images.find(image => image.isPrimary) ?? product?.images[0];
  return {
    id: nextId(),
    product,
    quantity: product?.moq ?? 1,
    selections: {},
    customValues: {},
    preferredImageIds: primary ? [primary.id] : [],
    requirements: "",
    ...overrides,
  };
}

/** Reads `?qty=` and one `?<option key>=` per option group from a product page's "Request a quote" link. */
export function readPrefill(search: string, product: Product): Pick<QuoteLine, "quantity" | "selections"> {
  const params = new URLSearchParams(search);
  const selections: Record<string, string> = {};
  for (const group of product.optionGroups) {
    const value = params.get(group.key);
    if (value && group.options.includes(value)) selections[group.key] = value;
  }
  return { quantity: Math.max(product.moq, Number(params.get("qty")) || product.moq), selections };
}

/** What gets stored in the legacy colour / size / packaging / customization columns. */
export function optionText(line: Pick<QuoteLine, "selections" | "customValues">, key: string): string {
  const value = line.selections[key];
  if (!value) return "";
  return value === OTHER ? (line.customValues[key] ?? "").trim() : value;
}

/** "capacity: 600 ml; style: striped" for every option the buyer typed in themselves. */
export function customFormValue(line: Pick<QuoteLine, "selections" | "customValues">): string {
  return Object.entries(line.customValues)
    .filter(([key, value]) => line.selections[key] === OTHER && value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join("; ");
}

export function buildItemRows(requestId: string, lines: QuoteLine[]) {
  return lines.map(line => ({
    quote_request_id: requestId,
    product_id: line.product!.id,
    quantity: line.quantity,
    color: optionText(line, "color"),
    size: optionText(line, "size"),
    packaging: optionText(line, "packaging"),
    customization: optionText(line, "customization"),
    option_selections: line.selections,
    custom_form_value: customFormValue(line) || null,
    requirements: line.requirements.trim() || null,
    preferred_image_ids: line.preferredImageIds,
  }));
}

export const MIN_BRIEF_LENGTH = 10;

export function validateQuote(lines: QuoteLine[], brief: string): string | null {
  if (!lines.length || lines.some(line => !line.product)) return "Choose a product for every request line.";
  if (lines.some(line => line.quantity < (line.product?.moq ?? 1))) return "Every quantity must meet the selected product's MOQ.";
  if (brief.trim().length < MIN_BRIEF_LENGTH) return "Tell us what you need in at least a few words so we can prepare an accurate quote.";
  return null;
}

export type IndicativeTotal = { currency: string; total: number; pricedLines: number };

/** Sums the indicative line totals per currency, skipping products that have no price yet. */
export function indicativeTotals(lines: QuoteLine[]): IndicativeTotal[] {
  const byCurrency = new Map<string, IndicativeTotal>();
  for (const line of lines) {
    if (!line.product) continue;
    const total = lineTotal(line.product.pricing, line.quantity);
    if (total === null) continue;
    const current = byCurrency.get(line.product.pricing.currency) ?? { currency: line.product.pricing.currency, total: 0, pricedLines: 0 };
    current.total = Math.round((current.total + total) * 100) / 100;
    current.pricedLines += 1;
    byCurrency.set(line.product.pricing.currency, current);
  }
  return Array.from(byCurrency.values());
}

/** Allowed reference uploads: images, PDF, Word and plain text up to 10 MB. */
export function referenceFileProblem(file: Pick<File, "type" | "size">): string | null {
  const allowed = file.type.startsWith("image/") || ["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);
  return !allowed || file.size > 10 * 1024 * 1024 ? "Choose an image, PDF, DOC, DOCX, or TXT file up to 10 MB." : null;
}
