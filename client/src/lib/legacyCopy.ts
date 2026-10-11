import { mapProductRow, type Product } from "@/lib/catalogue";
import { fetchAdminProductsByIds } from "@/lib/catalogueApi";
import type { ProductFields } from "@/lib/productDraft";
import { createProductRecord, deleteProductRecord, setProductActive, uploadProductPhoto, type CreatedProduct } from "@/lib/productWriteApi";
import { ApiError } from "@/lib/shopApi";
import { getSupabaseClient } from "@/lib/supabase";

/*
 * Copies products (and their photos) from the old store in Supabase into the shop's new home in Cloudflare.
 * The administrator's own browser does the carrying: it reads the old product with the administrator's Supabase
 * session, downloads each public photo, and hands everything to the new store through the normal "add product"
 * addresses. Nothing here needs a secret key, and running it twice never makes a second copy.
 */

type LegacyImage = { id: string; storage_path: string; public_url: string; is_primary: boolean; sort_order: number; alt_text: string | null; label: string | null };

export type LegacyProduct = {
  id: string;
  name: string;
  /** The row exactly as Supabase sent it. */
  row: Record<string, unknown>;
  photos: LegacyImage[];
};

const OLD_PAGE = 500;
const ASK_AT_A_TIME = 60;

/** Every old product, read a page at a time so a big old store is never cut short. */
async function readOldProducts(): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += OLD_PAGE) {
    const { data, error } = await getSupabaseClient()
      .from("products")
      .select("*,product_images(id,storage_path,public_url,is_primary,sort_order,alt_text,label)")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + OLD_PAGE - 1);
    if (error || !Array.isArray(data)) return from === 0 ? [] : rows;
    rows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < OLD_PAGE) return rows;
  }
}

/** Old products that are not in the new store yet. Returns an empty list when the old store cannot be read. */
export async function findUncopied(): Promise<LegacyProduct[]> {
  const rows = (await readOldProducts()).filter(row => typeof row.id === "string");
  if (!rows.length) return [];

  // Ask the new store only about these products, so it does not matter how many products it already holds.
  const already = new Set<string>();
  const ids = rows.map(row => String(row.id).toLowerCase());
  for (let index = 0; index < ids.length; index += ASK_AT_A_TIME) {
    for (const product of await fetchAdminProductsByIds(ids.slice(index, index + ASK_AT_A_TIME))) already.add(product.id.toLowerCase());
  }
  return rows
    .filter(row => !already.has(String(row.id).toLowerCase()))
    .map(row => ({
      id: String(row.id),
      name: String(row.name ?? "Product"),
      row,
      photos: (Array.isArray(row.product_images) ? (row.product_images as LegacyImage[]) : [])
        .filter(image => image?.public_url)
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    }));
}

/** The old row as the fields the new store takes, without applying today's form rules to yesterday's data. */
export function fieldsFromLegacy(row: Record<string, unknown>): ProductFields {
  const product: Product = mapProductRow(row);
  return {
    name: product.name,
    category: product.category,
    moq: product.moq,
    shortDescription: product.shortDescription,
    description: product.description,
    colors: product.legacyOptions.colors,
    sizes: product.legacyOptions.sizes,
    packaging: product.legacyOptions.packaging,
    customization: product.legacyOptions.customization,
    optionGroups: product.optionGroups,
    pricing: product.pricing,
    isActive: product.isActive,
  };
}

export type CopyProgress = { name: string; step: string; done: number; total: number };

/** "2026-08-27 21:51:31.742586+00" → an ISO date, or nothing if it cannot be read. */
function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value.replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function download(url: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("A photo could not be downloaded from the old store.");
  }
  const blob = response.ok ? await response.blob() : null;
  if (!blob || !blob.size || !(blob.type || response.headers.get("content-type") || "").startsWith("image/")) throw new Error("A photo in the old store could not be read.");
  return blob;
}

/** A product that could not be copied. `leftBehind` is true when an unfinished hidden copy could not be removed again. */
export class CopyFailed extends Error {
  constructor(
    message: string,
    readonly productName: string,
    readonly leftBehind: boolean,
  ) {
    super(message);
    this.name = "CopyFailed";
  }
}

const reasonOf = (error: unknown): string => (error instanceof Error && error.message ? error.message : "It did not copy.");

/**
 * Copies one product. It is created hidden, gets its photos, and only then goes live (if it was live), so shoppers never
 * see it half-finished. If something fails part-way the unfinished copy is removed again, so pressing the button again
 * starts that product from the beginning instead of finding a half-made one it takes for finished.
 * A product the new store already has is left exactly as it is (it may have been hidden on purpose).
 */
export async function copyLegacyProduct(legacy: LegacyProduct, onProgress: (progress: CopyProgress) => void = () => undefined): Promise<{ photos: number }> {
  const fields = fieldsFromLegacy(legacy.row);
  const total = legacy.photos.length;
  const report = (step: string, done: number) => onProgress({ name: legacy.name, step, done, total });
  const createdAt = isoDate(legacy.row.created_at);

  report("Creating the product", 0);
  let created: CreatedProduct;
  try {
    created = await createProductRecord({ ...fields, isActive: false }, { id: legacy.id, slug: String(legacy.row.slug ?? ""), createdAt });
  } catch (error) {
    // A different product in the new store (for example one added from Telegram) may already use the old web address:
    // let the new store pick the next free one rather than giving up on this product.
    if (!(error instanceof ApiError && error.code === "slug_taken")) throw error;
    created = await createProductRecord({ ...fields, isActive: false }, { id: legacy.id, createdAt });
  }
  if (created.existed) return { photos: 0 };

  try {
    const coverId = (legacy.photos.find(photo => photo.is_primary) ?? legacy.photos[0])?.id;
    for (let index = 0; index < legacy.photos.length; index += 1) {
      const photo = legacy.photos[index];
      report(`Copying photo ${index + 1} of ${total}`, index);
      await uploadProductPhoto(created.id, await download(photo.public_url), { imageId: photo.id, label: photo.label ?? undefined, primary: photo.id === coverId, sort: Number(photo.sort_order) });
    }

    report("Finishing", total);
    if (fields.isActive) await setProductActive(created.id, true);
    return { photos: total };
  } catch (error) {
    let leftBehind = false;
    try {
      await deleteProductRecord(created.id);
    } catch {
      leftBehind = true;
    }
    throw new CopyFailed(reasonOf(error), legacy.name, leftBehind);
  }
}

export type CopySummary = {
  copied: number;
  failed: Array<{ name: string; reason: string; leftBehind: boolean }>;
  /** True when it gave up early because every other product would fail the same way (signed out, shop unreachable). */
  stopped: boolean;
};

/** Copies every product it can. One that fails does not stop the others. */
export async function copyAllLegacy(items: LegacyProduct[], hooks: { onProgress?: (progress: CopyProgress) => void; onPosition?: (index: number, count: number) => void } = {}): Promise<CopySummary> {
  const summary: CopySummary = { copied: 0, failed: [], stopped: false };
  for (let index = 0; index < items.length; index += 1) {
    hooks.onPosition?.(index, items.length);
    try {
      await copyLegacyProduct(items[index], hooks.onProgress);
      summary.copied += 1;
    } catch (caught) {
      summary.failed.push({ name: items[index].name, reason: reasonOf(caught), leftBehind: caught instanceof CopyFailed && caught.leftBehind });
      const cause = caught instanceof ApiError ? caught : null;
      if (cause && (cause.status === 0 || cause.status === 401 || cause.status === 403)) {
        summary.stopped = true;
        break;
      }
    }
  }
  return summary;
}

/** What to tell the administrator when some products did not copy. Empty when everything did. */
export function describeCopyProblems(summary: CopySummary): string {
  if (!summary.failed.length) return "";
  const [first] = summary.failed;
  const left = summary.failed.filter(item => item.leftBehind).map(item => item.name);
  const head =
    summary.failed.length === 1
      ? `“${first.name}” did not copy: ${first.reason}`
      : `${summary.failed.length} products did not copy (${summary.failed.map(item => `“${item.name}”`).slice(0, 3).join(", ")}${summary.failed.length > 3 ? " and more" : ""}). The first problem was: ${first.reason}`;
  const tail = left.length
    ? ` An unfinished hidden copy of ${left.map(name => `“${name}”`).join(", ")} is still in Admin → Products → Hidden: delete it there, then press the button again.`
    : " Nothing was left half-done: press the button again to try the rest again.";
  return `${head}${/[.!?]$/.test(head) ? "" : "."}${tail}`;
}
