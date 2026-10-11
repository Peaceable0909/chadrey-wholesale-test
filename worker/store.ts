import { uniqueSlug } from "../shared/slug";
import type { KnownProduct } from "./category";
import type { D1Database, D1PreparedStatement } from "./types";

/*
 * Everything the shop keeps about products and their photos, in Cloudflare's database (D1).
 * D1 is SQLite, so lists are stored as JSON text and yes/no values as 0/1; this file turns them back into
 * the same shape the website always received from Supabase (snake_case fields, a nested `product_images` list).
 */

/** Photos are served by the Worker at this address. */
export const photoUrl = (storagePath: string): string => `/photos/${storagePath}`;

/** D1 allows 100 values in one statement. Lists of ids are cut into groups of this size. */
const MAX_IN = 80;

export function chunk<T>(items: T[], size = MAX_IN): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

const marks = (items: unknown[]) => items.map(() => "?").join(", ");
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export type PriceTierRow = { min_qty: number; price: number };

/** What an administrator can set on a product. Checked by the caller (see api.ts). */
export type ProductInput = {
  name: string;
  short_description: string;
  description: string;
  category: string;
  moq: number;
  colors: string[];
  sizes: string[];
  packaging_options: string[];
  customization_options: string[];
  option_groups: unknown[];
  price_currency: string;
  price_unit: string;
  price_tiers: PriceTierRow[];
  is_active: boolean;
};

type ProductDbRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: string;
  moq: number;
  colors: string;
  sizes: string;
  packaging_options: string;
  customization_options: string;
  option_groups: string;
  price_currency: string;
  price_unit: string;
  price_tiers: string;
  is_active: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ImageDbRow = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  label: string | null;
  sort_order: number;
  is_primary: number;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type ImageRecord = {
  id: string;
  product_id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  label: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: string;
  moq: number;
  colors: string[];
  sizes: string[];
  packaging_options: string[];
  customization_options: string[];
  option_groups: unknown[];
  price_currency: string;
  price_unit: string;
  price_tiers: unknown[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  product_images: ImageRecord[];
};

function parseList(text: unknown): unknown[] {
  if (typeof text !== "string") return [];
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const parseStrings = (text: unknown): string[] => parseList(text).map(String);

const toImage = (row: ImageDbRow): ImageRecord => ({
  id: row.id,
  product_id: row.product_id,
  storage_path: row.storage_path,
  public_url: photoUrl(row.storage_path),
  alt_text: row.alt_text,
  label: row.label,
  sort_order: Number(row.sort_order),
  is_primary: Number(row.is_primary) === 1,
  created_at: row.created_at,
});

const toProduct = (row: ProductDbRow, images: ImageRecord[]): ProductRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  short_description: row.short_description,
  description: row.description,
  category: row.category,
  moq: Number(row.moq),
  colors: parseStrings(row.colors),
  sizes: parseStrings(row.sizes),
  packaging_options: parseStrings(row.packaging_options),
  customization_options: parseStrings(row.customization_options),
  option_groups: parseList(row.option_groups),
  price_currency: row.price_currency,
  price_unit: row.price_unit,
  price_tiers: parseList(row.price_tiers),
  is_active: Number(row.is_active) === 1,
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
  product_images: images,
});

const IMAGE_ORDER = "ORDER BY i.is_primary DESC, i.sort_order ASC, i.created_at ASC, i.id ASC";

async function imagesFor(db: D1Database, productIds: string[]): Promise<Map<string, ImageRecord[]>> {
  const byProduct = new Map<string, ImageRecord[]>();
  const groups = chunk(productIds);
  if (!groups.length) return byProduct;
  const results = await db.batch<ImageDbRow>(groups.map(group => db.prepare(`SELECT i.* FROM product_images i WHERE i.product_id IN (${marks(group)}) ${IMAGE_ORDER}`).bind(...group)));
  for (const result of results) {
    for (const row of result.results) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(toImage(row));
      byProduct.set(row.product_id, list);
    }
  }
  return byProduct;
}

/* Reading */

export type ListQuery = {
  /** true = only live products, false = only hidden ones, null = both. */
  active: boolean | null;
  /** Words to look for. "shop" searches name, short description and category; "admin" also the web address. */
  search?: string;
  searchFields?: "shop" | "admin";
  category?: string;
  /** Pass at most one of slugs, ids (each is cut to 80). */
  slugs?: string[];
  ids?: string[];
  excludeSlug?: string;
  sort?: "newest" | "moq" | "name";
  limit: number;
  offset: number;
};

function filters(query: Omit<ListQuery, "limit" | "offset" | "sort">): { clause: string; binds: unknown[] } {
  const parts: string[] = [];
  const binds: unknown[] = [];
  if (query.active !== null) {
    parts.push("p.is_active = ?");
    binds.push(query.active ? 1 : 0);
  }
  if (query.category) {
    parts.push("p.category = ?");
    binds.push(query.category);
  }
  if (query.excludeSlug) {
    parts.push("p.slug <> ?");
    binds.push(query.excludeSlug);
  }
  const term = query.search?.trim();
  if (term) {
    const columns = query.searchFields === "admin" ? ["p.name", "p.category", "p.slug"] : ["p.name", "p.short_description", "p.category"];
    // "Contains this text, ignoring upper/lower case". Not LIKE: D1 refuses a LIKE pattern longer than 50 bytes,
    // which a long search (or, in freeSlug, a long product name) easily exceeds. instr() has no such limit and
    // treats % and _ as ordinary characters.
    parts.push(`(${columns.map(column => `instr(lower(${column}), lower(?)) > 0`).join(" OR ")})`);
    for (let index = 0; index < columns.length; index += 1) binds.push(term);
  }
  for (const [column, list] of [["slug", query.slugs], ["id", query.ids]] as const) {
    if (!list) continue;
    const values = list.slice(0, MAX_IN);
    if (!values.length) {
      parts.push("0 = 1");
    } else {
      parts.push(`p.${column} IN (${marks(values)})`);
      binds.push(...values);
    }
  }
  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", binds };
}

const ORDER: Record<NonNullable<ListQuery["sort"]>, string> = {
  newest: "ORDER BY p.created_at DESC, p.id ASC",
  moq: "ORDER BY p.moq ASC, p.created_at DESC, p.id ASC",
  name: "ORDER BY p.name COLLATE NOCASE ASC, p.id ASC",
};

export async function listProducts(db: D1Database, query: ListQuery): Promise<{ rows: ProductRecord[]; total: number }> {
  const { clause, binds } = filters(query);
  const [page, count] = await db.batch<ProductDbRow & { n: number }>([
    db.prepare(`SELECT p.* FROM products p ${clause} ${ORDER[query.sort ?? "newest"]} LIMIT ? OFFSET ?`).bind(...binds, query.limit, query.offset),
    db.prepare(`SELECT COUNT(*) AS n FROM products p ${clause}`).bind(...binds),
  ]);
  const images = await imagesFor(db, page.results.map(row => row.id));
  return {
    rows: page.results.map(row => toProduct(row, images.get(row.id) ?? [])),
    total: Number(count.results[0]?.n ?? 0),
  };
}

/** One product by id or web address. `liveOnly` hides products that are not in the store yet (for shoppers). */
export async function getProduct(db: D1Database, by: { id: string } | { slug: string }, options: { liveOnly: boolean }): Promise<ProductRecord | null> {
  const column = "id" in by ? "id" : "slug";
  const value = "id" in by ? by.id : by.slug;
  const live = options.liveOnly ? " AND p.is_active = 1" : "";
  const [product, images] = await db.batch<ProductDbRow & ImageDbRow>([
    db.prepare(`SELECT p.* FROM products p WHERE p.${column} = ?${live}`).bind(value),
    db.prepare(`SELECT i.* FROM product_images i JOIN products p ON p.id = i.product_id WHERE p.${column} = ?${live} ${IMAGE_ORDER}`).bind(value),
  ]);
  const row = product.results[0];
  return row ? toProduct(row, images.results.map(toImage)) : null;
}

/** Live products by their ids, in no particular order (used by quote screens). */
export async function productsByIds(db: D1Database, ids: string[], options: { liveOnly: boolean }): Promise<ProductRecord[]> {
  const { rows } = await listProducts(db, { active: options.liveOnly ? true : null, ids, limit: MAX_IN, offset: 0 });
  return rows;
}

/** Category chips and home tiles: live products only, most-stocked first. */
export async function categoryCounts(db: D1Database): Promise<Array<{ category: string; count: number }>> {
  const result = await db.prepare("SELECT category, COUNT(*) AS count FROM products WHERE is_active = 1 AND TRIM(category) <> '' GROUP BY category ORDER BY count DESC, category COLLATE NOCASE ASC").all<{ category: string; count: number }>();
  return result.results.map(row => ({ category: row.category, count: Number(row.count) }));
}

export async function hiddenCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 0").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export type AdminSummary = { id: string; name: string; category: string; isActive: boolean };

/** Just enough about every matching product to act on it in bulk ("Select all"). */
export async function summaries(db: D1Database, query: { active: boolean | null; search?: string; limit: number }): Promise<AdminSummary[]> {
  const { clause, binds } = filters({ active: query.active, search: query.search, searchFields: "admin" });
  const result = await db.prepare(`SELECT p.id, p.name, p.category, p.is_active FROM products p ${clause} ORDER BY p.created_at DESC, p.id ASC LIMIT ?`).bind(...binds, query.limit).all<Pick<ProductDbRow, "id" | "name" | "category" | "is_active">>();
  return result.results.map(row => ({ id: row.id, name: row.name, category: row.category, isActive: Number(row.is_active) === 1 }));
}

/** "rattan-bag", or "rattan-bag-2" when that web address is taken. */
export async function freeSlug(db: D1Database, base: string): Promise<string> {
  // Every address that could clash starts with `base` and continues with a letter, digit or hyphen (all of which sort
  // before "~"), so a range test finds them. LIKE would too, but D1 limits a LIKE pattern to 50 bytes and names make long slugs.
  const result = await db.prepare("SELECT slug FROM products WHERE slug >= ? AND slug < ? LIMIT 200").bind(base, `${base}~`).all<{ slug: string }>();
  return uniqueSlug(base, result.results.map(row => row.slug));
}

/** Recent products, used by the Telegram bot to guess a category and to spot a repeat. */
export async function knownProducts(db: D1Database, limit = 500): Promise<KnownProduct[]> {
  const result = await db.prepare("SELECT id, name, category, is_active FROM products ORDER BY created_at DESC LIMIT ?").bind(limit).all<Pick<ProductDbRow, "id" | "name" | "category" | "is_active">>();
  return result.results.map(row => ({ id: row.id, name: row.name, category: row.category, is_active: Number(row.is_active) === 1 }));
}

export async function productBasics(db: D1Database, id: string): Promise<{ id: string; slug: string; name: string; is_active: boolean } | null> {
  const row = await db.prepare("SELECT id, slug, name, is_active FROM products WHERE id = ?").bind(id).first<Pick<ProductDbRow, "id" | "slug" | "name" | "is_active">>();
  return row ? { id: row.id, slug: row.slug, name: row.name, is_active: Number(row.is_active) === 1 } : null;
}

export async function countImages(db: D1Database, productId: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?").bind(productId).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/* Writing */

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class SlugTakenError extends Error {
  constructor() {
    super("Another product already uses that web address.");
    this.name = "SlugTakenError";
  }
}

export class ProductMissingError extends Error {
  constructor() {
    super("That product no longer exists.");
    this.name = "ProductMissingError";
  }
}

const inputBinds = (input: ProductInput): unknown[] => [
  input.name,
  input.short_description,
  input.description,
  input.category,
  input.moq,
  JSON.stringify(input.colors),
  JSON.stringify(input.sizes),
  JSON.stringify(input.packaging_options),
  JSON.stringify(input.customization_options),
  JSON.stringify(input.option_groups),
  input.price_currency,
  input.price_unit,
  JSON.stringify(input.price_tiers),
  input.is_active ? 1 : 0,
];

/** "exists" means a product with this id is already saved (a retry, or a message Telegram sent twice). */
export async function insertProduct(db: D1Database, args: { id: string; slug: string; input: ProductInput; createdBy: string | null; /** Keeps the original date when copying a product from another store. */ createdAt?: string }): Promise<"created" | "exists"> {
  try {
    await db
      .prepare(
        `INSERT INTO products (id, slug, name, short_description, description, category, moq, colors, sizes, packaging_options, customization_options, option_groups, price_currency, price_unit, price_tiers, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, ${NOW}), COALESCE(?, ${NOW}))`,
      )
      .bind(args.id, args.slug, ...inputBinds(args.input), args.createdBy, args.createdAt ?? null, args.createdAt ?? null)
      .run();
    return "created";
  } catch (error) {
    if (!/UNIQUE constraint failed: products\./i.test(errorText(error))) throw error;
    // The database names only one of the clashes. If this id is already saved it is a retry, whichever one it named.
    const saved = await db.prepare("SELECT 1 AS found FROM products WHERE id = ?").bind(args.id).first();
    if (saved) return "exists";
    if (/products\.slug/i.test(errorText(error))) throw new SlugTakenError();
    throw error;
  }
}

/** false when there is no product with this id. */
export async function updateProduct(db: D1Database, id: string, input: ProductInput): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE products SET name = ?, short_description = ?, description = ?, category = ?, moq = ?, colors = ?, sizes = ?, packaging_options = ?,
         customization_options = ?, option_groups = ?, price_currency = ?, price_unit = ?, price_tiers = ?, is_active = ?, updated_at = ${NOW}
       WHERE id = ?`,
    )
    .bind(...inputBinds(input), id)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

const changes = (results: Array<{ meta: { changes?: number } }>) => results.reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0);

export async function setActive(db: D1Database, ids: string[], active: boolean): Promise<number> {
  const groups = chunk(ids);
  if (!groups.length) return 0;
  return changes(await db.batch(groups.map(group => db.prepare(`UPDATE products SET is_active = ?, updated_at = ${NOW} WHERE id IN (${marks(group)})`).bind(active ? 1 : 0, ...group))));
}

export async function setCategory(db: D1Database, ids: string[], category: string): Promise<number> {
  const groups = chunk(ids);
  if (!groups.length) return 0;
  return changes(await db.batch(groups.map(group => db.prepare(`UPDATE products SET category = ?, updated_at = ${NOW} WHERE id IN (${marks(group)})`).bind(category, ...group))));
}

/** Removes products and their photo records. Returns the stored files to delete too (the caller removes those). */
export async function deleteProducts(db: D1Database, ids: string[]): Promise<{ deleted: number; paths: string[] }> {
  const groups = chunk(ids);
  if (!groups.length) return { deleted: 0, paths: [] };
  const statements: D1PreparedStatement[] = [];
  for (const group of groups) {
    statements.push(db.prepare(`SELECT storage_path FROM product_images WHERE product_id IN (${marks(group)})`).bind(...group));
    statements.push(db.prepare(`DELETE FROM product_images WHERE product_id IN (${marks(group)})`).bind(...group));
    statements.push(db.prepare(`DELETE FROM products WHERE id IN (${marks(group)})`).bind(...group));
  }
  const results = await db.batch<{ storage_path: string }>(statements);
  let deleted = 0;
  const paths: string[] = [];
  for (let index = 0; index < results.length; index += 3) {
    paths.push(...results[index].results.map(row => row.storage_path));
    deleted += Number(results[index + 2].meta.changes ?? 0);
  }
  return { deleted, paths };
}

/* Photos */

export type NewImage = {
  id: string;
  productId: string;
  storagePath: string;
  altText: string | null;
  label: string | null;
  /** Defaults to after the last photo. */
  sortOrder?: number;
  /** true makes it the cover; false never does; left out, it becomes the cover only if the product has none yet. */
  isPrimary?: boolean;
  contentType: string | null;
  sizeBytes: number | null;
};

/** `created: false` means a photo with this id was already saved (a retry), and the saved one is returned. */
export async function addImage(db: D1Database, image: NewImage): Promise<{ created: boolean; record: ImageRecord }> {
  const binds: unknown[] = [image.id, image.productId, image.storagePath, image.altText, image.label];
  let sortSql = "?";
  if (image.sortOrder === undefined) {
    sortSql = "COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = ?), 0)";
    binds.push(image.productId);
  } else {
    binds.push(image.sortOrder);
  }
  let primarySql = "?";
  if (image.isPrimary === undefined) {
    primarySql = "CASE WHEN EXISTS (SELECT 1 FROM product_images WHERE product_id = ? AND is_primary = 1) THEN 0 ELSE 1 END";
    binds.push(image.productId);
  } else {
    binds.push(image.isPrimary ? 1 : 0);
  }
  binds.push(image.contentType, image.sizeBytes);

  const insert = db
    .prepare(`INSERT INTO product_images (id, product_id, storage_path, alt_text, label, sort_order, is_primary, content_type, size_bytes) VALUES (?, ?, ?, ?, ?, ${sortSql}, ${primarySql}, ?, ?)`)
    .bind(...binds);
  // The old cover is cleared in the same all-or-nothing group, so a product never has two covers.
  const statements = image.isPrimary === true ? [db.prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND is_primary = 1 AND id <> ?").bind(image.productId, image.id), insert] : [insert];

  // A retry of a photo that was already saved changes nothing.
  const already = await readImage(db, image.id);
  if (already) return { created: false, record: already };

  try {
    await db.batch(statements);
  } catch (error) {
    const message = errorText(error);
    if (/FOREIGN KEY constraint failed/i.test(message)) throw new ProductMissingError();
    if (/UNIQUE constraint failed/i.test(message)) {
      // Two copies of the same photo arrived at the same moment; the other one won.
      const raced = await readImage(db, image.id);
      if (raced) return { created: false, record: raced };
    }
    throw error;
  }
  const saved = await readImage(db, image.id);
  if (!saved) throw new Error("The photo record could not be read back.");
  return { created: true, record: saved };
}

async function readImage(db: D1Database, id: string): Promise<ImageRecord | null> {
  const row = await db.prepare("SELECT * FROM product_images WHERE id = ?").bind(id).first<ImageDbRow>();
  return row ? toImage(row) : null;
}

/** Removes the photo record and returns its stored file path (the caller removes the file). The next photo becomes the cover if this was. */
export async function deleteImage(db: D1Database, productId: string, imageId: string): Promise<{ storagePath: string } | null> {
  const row = await db.prepare("SELECT storage_path, is_primary FROM product_images WHERE id = ? AND product_id = ?").bind(imageId, productId).first<{ storage_path: string; is_primary: number }>();
  if (!row) return null;
  const statements = [db.prepare("DELETE FROM product_images WHERE id = ? AND product_id = ?").bind(imageId, productId)];
  if (Number(row.is_primary) === 1) {
    statements.push(
      db
        .prepare("UPDATE product_images SET is_primary = 1 WHERE id = (SELECT id FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC, id ASC LIMIT 1)")
        .bind(productId),
    );
  }
  await db.batch(statements);
  return { storagePath: row.storage_path };
}

/** false when the photo does not belong to the product. */
export async function setCover(db: D1Database, productId: string, imageId: string): Promise<boolean> {
  const exists = await db.prepare("SELECT 1 AS found FROM product_images WHERE id = ? AND product_id = ?").bind(imageId, productId).first();
  if (!exists) return false;
  await db.batch([
    db.prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND is_primary = 1").bind(productId),
    db.prepare("UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?").bind(imageId, productId),
  ]);
  return true;
}

/** Sets photo captions. A blank caption clears it; the description for screen readers falls back to the product name. */
export async function setLabels(db: D1Database, productId: string, labels: Array<{ id: string; label: string }>): Promise<boolean> {
  const product = await db.prepare("SELECT name FROM products WHERE id = ?").bind(productId).first<{ name: string }>();
  if (!product) return false;
  if (!labels.length) return true;
  await db.batch(
    labels.map(item => {
      const label = item.label.trim();
      return db.prepare("UPDATE product_images SET label = ?, alt_text = ? WHERE id = ? AND product_id = ?").bind(label || null, label || `${product.name} product image`, item.id, productId);
    }),
  );
  return true;
}
