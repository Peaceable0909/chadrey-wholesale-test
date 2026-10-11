import { tiersToRows } from "@/lib/pricing";
import type { ProductFields } from "@/lib/productDraft";
import { isStillReferencedError, shopFetch } from "@/lib/shopApi";

/*
 * Administrator changes to products and photos. They go to the shop's own data service (Cloudflare), which checks
 * again that the signed-in person is an administrator, so these helpers carry the person's session with every call.
 */

export { isStillReferencedError };

/** The product details as the data service expects them. */
export function toProductBody(fields: ProductFields) {
  return {
    name: fields.name,
    short_description: fields.shortDescription,
    description: fields.description,
    category: fields.category,
    moq: fields.moq,
    colors: fields.colors,
    sizes: fields.sizes,
    packaging_options: fields.packaging,
    customization_options: fields.customization,
    option_groups: fields.optionGroups,
    price_currency: fields.pricing.currency,
    price_unit: fields.pricing.unit,
    price_tiers: tiersToRows(fields.pricing.tiers),
    is_active: fields.isActive,
  };
}

export type CreatedProduct = { id: string; slug: string };

/**
 * Creates a product. Without a web address one is made from the name ("rattan-bag", then "rattan-bag-2", …).
 * Giving the id, web address and date keeps a product exactly as it was when copying it from another store.
 */
export async function createProductRecord(fields: ProductFields, options: { id?: string; slug?: string; createdAt?: string } = {}): Promise<CreatedProduct> {
  const created = await shopFetch<CreatedProduct>("/api/admin/products", {
    admin: true,
    method: "POST",
    json: {
      ...toProductBody(fields),
      ...(options.id ? { id: options.id } : {}),
      ...(options.slug ? { slug: options.slug } : {}),
      ...(options.createdAt ? { created_at: options.createdAt } : {}),
    },
  });
  return { id: created.id, slug: created.slug };
}

export async function updateProductRecord(id: string, fields: ProductFields): Promise<void> {
  await shopFetch(`/api/admin/products/${encodeURIComponent(id)}`, { admin: true, method: "PUT", json: toProductBody(fields) });
}

/* Bulk changes: the same rules, applied to many products at once. */

const chunk = <T>(items: T[], size: number): T[][] => {
  const parts: T[][] = [];
  for (let index = 0; index < items.length; index += size) parts.push(items.slice(index, index + size));
  return parts;
};

export const setProductActive = (id: string, active: boolean): Promise<void> => setProductsActive([id], active);

export async function setProductsActive(ids: string[], active: boolean): Promise<void> {
  for (const part of chunk(ids, 200)) await shopFetch("/api/admin/products/bulk", { admin: true, method: "POST", json: { action: active ? "show" : "hide", ids: part } });
}

export async function setProductsCategory(ids: string[], category: string): Promise<void> {
  for (const part of chunk(ids, 200)) await shopFetch("/api/admin/products/bulk", { admin: true, method: "POST", json: { action: "category", ids: part, category } });
}

export type BulkDeleteResult = { deleted: number; blocked: number };

/**
 * Deletes products and their photos. A product that is part of a quote request cannot be deleted; those are
 * left in place and counted in `blocked` so the rest still go.
 */
export async function deleteProductsBulk(ids: string[]): Promise<BulkDeleteResult> {
  let deleted = 0;
  let blocked = 0;
  for (const part of chunk(ids, 100)) {
    const result = await shopFetch<BulkDeleteResult>("/api/admin/products/bulk", { admin: true, method: "POST", json: { action: "delete", ids: part } });
    deleted += result.deleted;
    blocked += result.blocked;
  }
  return { deleted, blocked };
}

/** Deletes one product, its photo records and its stored photos. */
export async function deleteProductRecord(id: string): Promise<void> {
  await shopFetch(`/api/admin/products/${encodeURIComponent(id)}`, { admin: true, method: "DELETE" });
}

/* Photos */

export type UploadedPhoto = { id: string; url: string; storagePath: string; isPrimary: boolean };

type PhotoRow = { id: string; public_url: string; storage_path: string; is_primary: boolean };

/**
 * Uploads one photo to a product. The first photo of a product becomes its cover unless `primary` says otherwise;
 * `primary: true` makes this the cover and `primary: false` never does. Sending the same `imageId` again changes nothing.
 */
export async function uploadProductPhoto(productId: string, file: Blob, options: { label?: string; primary?: boolean; sort?: number; imageId?: string } = {}): Promise<UploadedPhoto> {
  const params = new URLSearchParams();
  if (options.label?.trim()) params.set("label", options.label.trim());
  if (options.primary !== undefined) params.set("primary", options.primary ? "1" : "0");
  if (options.sort !== undefined) params.set("sort", String(options.sort));
  if (options.imageId) params.set("imageId", options.imageId);
  const query = params.toString();
  const row = await shopFetch<PhotoRow>(`/api/admin/products/${encodeURIComponent(productId)}/photos${query ? `?${query}` : ""}`, {
    admin: true,
    method: "POST",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
    timeoutMs: 90_000,
  });
  return { id: row.id, url: row.public_url, storagePath: row.storage_path, isPrimary: row.is_primary };
}

export async function setCoverImage(productId: string, imageId: string): Promise<void> {
  await shopFetch(`/api/admin/products/${encodeURIComponent(productId)}/photos/${encodeURIComponent(imageId)}/cover`, { admin: true, method: "PUT" });
}

/** Removes a photo and its stored file. If it was the cover, the next photo becomes the cover. */
export async function deleteImage(productId: string, imageId: string): Promise<void> {
  await shopFetch(`/api/admin/products/${encodeURIComponent(productId)}/photos/${encodeURIComponent(imageId)}`, { admin: true, method: "DELETE" });
}

export async function saveImageLabels(productId: string, images: Array<{ id: string; label: string }>): Promise<void> {
  await shopFetch(`/api/admin/products/${encodeURIComponent(productId)}/photos/labels`, { admin: true, method: "PUT", json: images.map(image => ({ id: image.id, label: image.label })) });
}
