import { mapProductRow, type Product } from "@/lib/catalogue";
import { fetchAdminSummaries } from "@/lib/catalogueApi";
import type { ProductFields } from "@/lib/productDraft";
import { createProductRecord, setProductActive, uploadProductPhoto } from "@/lib/productWriteApi";
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

/** Old products that are not in the new store yet. Returns an empty list when the old store cannot be read. */
export async function findUncopied(): Promise<LegacyProduct[]> {
  const { data, error } = await getSupabaseClient()
    .from("products")
    .select("*,product_images(id,storage_path,public_url,is_primary,sort_order,alt_text,label)")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error || !Array.isArray(data) || !data.length) return [];

  const already = new Set((await fetchAdminSummaries({ q: "", status: "all" }, 2000)).map(item => item.id.toLowerCase()));
  return (data as Array<Record<string, unknown>>)
    .filter(row => typeof row.id === "string" && !already.has(String(row.id).toLowerCase()))
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

/**
 * Copies one product. It is created hidden, gets its photos, and only then goes live (if it was live), so shoppers never
 * see it half-finished. If something fails part-way it simply stays hidden; running it again carries on where it stopped.
 */
export async function copyLegacyProduct(legacy: LegacyProduct, onProgress: (progress: CopyProgress) => void = () => undefined): Promise<{ photos: number }> {
  const fields = fieldsFromLegacy(legacy.row);
  const total = legacy.photos.length;
  const report = (step: string, done: number) => onProgress({ name: legacy.name, step, done, total });

  report("Creating the product", 0);
  const created = await createProductRecord({ ...fields, isActive: false }, { id: legacy.id, slug: String(legacy.row.slug ?? ""), createdAt: isoDate(legacy.row.created_at) });

  const coverId = (legacy.photos.find(photo => photo.is_primary) ?? legacy.photos[0])?.id;
  for (let index = 0; index < legacy.photos.length; index += 1) {
    const photo = legacy.photos[index];
    report(`Copying photo ${index + 1} of ${total}`, index);
    await uploadProductPhoto(created.id, await download(photo.public_url), { imageId: photo.id, label: photo.label ?? undefined, primary: photo.id === coverId, sort: Number(photo.sort_order) });
  }

  report("Finishing", total);
  if (fields.isActive) await setProductActive(created.id, true);
  return { photos: total };
}
