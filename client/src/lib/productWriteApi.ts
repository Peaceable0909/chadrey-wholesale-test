import { getSupabaseClient } from "@/lib/supabase";
import { tiersToRows } from "@/lib/pricing";
import type { ProductFields } from "@/lib/productDraft";
import { uniqueSlug } from "@/lib/slug";
import { isMissingColumnError } from "@/lib/supabaseCompat";

/* Admin writes. Row-level security only lets administrators do any of this. */

const BUCKET = "product-images";

/** Row for the products table. The pricing columns are left out when the migration has not been run yet. */
export function toProductRow(fields: ProductFields, withPricing: boolean) {
  const row: Record<string, unknown> = {
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
    is_active: fields.isActive,
  };
  if (withPricing) {
    row.price_currency = fields.pricing.currency;
    row.price_unit = fields.pricing.unit;
    row.price_tiers = tiersToRows(fields.pricing.tiers);
  }
  return row;
}

export type SaveResult = { id: string; /** false when prices were typed but the database has no price columns yet */ pricingSaved: boolean };

/** Finds a free web address for a new product ("rattan-bag", then "rattan-bag-2", …). */
export async function findFreeSlug(base: string): Promise<string> {
  const { data, error } = await getSupabaseClient().from("products").select("slug").ilike("slug", `${base}%`).limit(200);
  if (error) throw error;
  return uniqueSlug(base, (data ?? []).map(row => String(row.slug)));
}

export async function createProductRecord(fields: ProductFields, slug: string, createdBy: string | undefined): Promise<SaveResult> {
  const client = getSupabaseClient();
  const insert = (withPricing: boolean) =>
    client.from("products").insert({ slug, ...toProductRow(fields, withPricing), created_by: createdBy }).select("id").single();

  let { data, error } = await insert(true);
  let pricingSaved = true;
  if (error && isMissingColumnError(error)) {
    pricingSaved = fields.pricing.tiers.length === 0;
    ({ data, error } = await insert(false));
  }
  if (error) throw error;
  return { id: data!.id as string, pricingSaved };
}

export async function updateProductRecord(id: string, fields: ProductFields): Promise<SaveResult> {
  const client = getSupabaseClient();
  const update = (withPricing: boolean) => client.from("products").update(toProductRow(fields, withPricing)).eq("id", id);

  let { error } = await update(true);
  let pricingSaved = true;
  if (error && isMissingColumnError(error)) {
    pricingSaved = fields.pricing.tiers.length === 0;
    ({ error } = await update(false));
  }
  if (error) throw error;
  return { id, pricingSaved };
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await getSupabaseClient().from("products").update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

/* Bulk changes: the same rules as above, applied to many products at once. */

const chunk = <T>(items: T[], size: number): T[][] => {
  const parts: T[][] = [];
  for (let index = 0; index < items.length; index += size) parts.push(items.slice(index, index + size));
  return parts;
};

export async function setProductsActive(ids: string[], active: boolean): Promise<void> {
  for (const part of chunk(ids, 50)) {
    const { error } = await getSupabaseClient().from("products").update({ is_active: active }).in("id", part);
    if (error) throw error;
  }
}

export async function setProductsCategory(ids: string[], category: string): Promise<void> {
  for (const part of chunk(ids, 50)) {
    const { error } = await getSupabaseClient().from("products").update({ category }).in("id", part);
    if (error) throw error;
  }
}

export type BulkDeleteResult = { deleted: number; blocked: number };

/**
 * Deletes products and their photos. A product that is part of a quote request cannot be deleted; those are
 * left in place and counted in `blocked` so the rest still go.
 */
export async function deleteProductsBulk(ids: string[]): Promise<BulkDeleteResult> {
  const client = getSupabaseClient();
  let deleted = 0;
  let blocked = 0;

  for (const part of chunk(ids, 20)) {
    const { data: files, error: filesError } = await client.from("product_images").select("product_id,storage_path").in("product_id", part);
    if (filesError) throw filesError;
    const pathsOf = (productIds: string[]) =>
      (files ?? []).filter(file => productIds.includes(String(file.product_id))).map(file => String(file.storage_path)).filter(Boolean);
    const removeFiles = async (paths: string[]) => {
      // Leftover files are harmless; a failure here must not hide that the products are gone.
      if (paths.length) await client.storage.from(BUCKET).remove(paths).catch(() => undefined);
    };

    const all = await client.from("products").delete().in("id", part);
    if (!all.error) {
      deleted += part.length;
      await removeFiles(pathsOf(part));
      continue;
    }
    if (!isStillReferencedError(all.error)) throw all.error;

    // At least one of these is part of a quote request, which fails the whole statement. Go one by one.
    for (const id of part) {
      const one = await client.from("products").delete().eq("id", id);
      if (one.error) {
        if (isStillReferencedError(one.error)) {
          blocked += 1;
          continue;
        }
        throw one.error;
      }
      deleted += 1;
      await removeFiles(pathsOf([id]));
    }
  }
  return { deleted, blocked };
}

/**
 * Deletes the product (its photo records go with it), then the stored files.
 * The row goes first: a product that is part of a quote request cannot be deleted, and the photos
 * must stay in place when that happens.
 */
export async function deleteProductRecord(id: string, storagePaths: string[]): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("products").delete().eq("id", id);
  if (error) throw error;
  if (storagePaths.length) await client.storage.from(BUCKET).remove(storagePaths);
}

/** Postgres foreign-key violation: the row is still referenced elsewhere (e.g. by a quote request). */
export const isStillReferencedError = (error: unknown): boolean => (error as { code?: string } | null)?.code === "23503";

/* Photos */

export type UploadedImage = { path: string; url: string };

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "-");

/** Uploads files one by one (reporting progress). If one fails, the ones already uploaded are removed again. */
export async function uploadProductImages(slug: string, files: File[], startIndex: number, onProgress?: (done: number, total: number) => void): Promise<UploadedImage[]> {
  const client = getSupabaseClient();
  const uploaded: UploadedImage[] = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const path = `products/${slug}/${String(startIndex + index + 1).padStart(2, "0")}-${Date.now().toString(36)}-${safeFileName(file.name)}`;
      const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded.push({ path, url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
      onProgress?.(index + 1, files.length);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await client.storage.from(BUCKET).remove(uploaded.map(item => item.path));
    throw error;
  }
}

export type NewImageRow = { image: UploadedImage; label: string; isPrimary: boolean };

export async function insertImageRows(productId: string, productName: string, rows: NewImageRow[], startSort: number): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("product_images")
    .insert(
      rows.map((row, index) => ({
        product_id: productId,
        storage_path: row.image.path,
        public_url: row.image.url,
        alt_text: row.label.trim() || `${productName} product image ${startSort + index + 1}`,
        label: row.label.trim() || null,
        sort_order: startSort + index,
        is_primary: row.isPrimary,
      })),
    );
  if (error) throw error;
}

export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length) await getSupabaseClient().storage.from(BUCKET).remove(paths);
}

/** Only one photo per product can be the cover, so the old cover is cleared before the new one is set. */
export async function setCoverImage(productId: string, imageId: string): Promise<void> {
  const client = getSupabaseClient();
  const cleared = await client.from("product_images").update({ is_primary: false }).eq("product_id", productId).eq("is_primary", true);
  if (cleared.error) throw cleared.error;
  const set = await client.from("product_images").update({ is_primary: true }).eq("id", imageId);
  if (set.error) throw set.error;
}

export async function deleteImage(image: { id: string; storage_path: string }): Promise<void> {
  const client = getSupabaseClient();
  await client.storage.from(BUCKET).remove([image.storage_path]);
  const { error } = await client.from("product_images").delete().eq("id", image.id);
  if (error) throw error;
}

export async function saveImageLabels(images: Array<{ id: string; label: string }>, productName: string): Promise<void> {
  const client = getSupabaseClient();
  const results = await Promise.all(
    images.map(image =>
      client
        .from("product_images")
        .update({ label: image.label.trim() || null, alt_text: image.label.trim() || `${productName} product image` })
        .eq("id", image.id),
    ),
  );
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
}
