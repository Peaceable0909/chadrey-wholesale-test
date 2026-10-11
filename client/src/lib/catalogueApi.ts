import { listParam, shopFetch, shopFetchOrNull } from "@/lib/shopApi";
import { mapProductRow, type CatalogueQuery, type CategoryCount, type Product, type ProductPage } from "@/lib/catalogue";

/*
 * Where the website reads products from: the shop's own data service (Cloudflare), not Supabase.
 * Rows arrive in the same shape Supabase used to send, so mapProductRow works unchanged.
 */

export const PAGE_SIZE = 24;

type Rows = { items: unknown[]; total: number };

function pageOf(data: Rows, page: number, size: number): ProductPage {
  const items = data.items.map(mapProductRow);
  const total = Number.isFinite(data.total) ? data.total : page * size + items.length;
  return { items, total, hasMore: page * size + items.length < total };
}

export async function fetchProductsPage(query: CatalogueQuery, page: number): Promise<ProductPage> {
  const size = query.pageSize ?? PAGE_SIZE;
  const params = new URLSearchParams({ page: String(page), size: String(size), sort: query.sort });
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.category && query.category !== "All") params.set("category", query.category);
  if (query.slugs) params.set("slugs", query.slugs.join(","));
  return pageOf(await shopFetch<Rows>(`/api/catalogue/products?${params}`), page, size);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const row = await shopFetchOrNull<unknown>(`/api/catalogue/products/${encodeURIComponent(slug)}`);
  return row ? mapProductRow(row) : null;
}

/** Admin lookup by id, including hidden products. */
export async function fetchProductById(id: string): Promise<Product | null> {
  const row = await shopFetchOrNull<unknown>(`/api/admin/products/${encodeURIComponent(id)}`, { admin: true });
  return row ? mapProductRow(row) : null;
}

export async function fetchRelatedProducts(product: Pick<Product, "slug" | "category">, limit = 8): Promise<Product[]> {
  const params = new URLSearchParams({ slug: product.slug, category: product.category, limit: String(limit) });
  const data = await shopFetch<{ items: unknown[] }>(`/api/catalogue/related?${params}`);
  return data.items.map(mapProductRow);
}

/** Category chips and home tiles come from the real catalogue, most-stocked first. */
export async function fetchCategoryCounts(): Promise<CategoryCount[]> {
  return (await shopFetch<{ items: CategoryCount[] }>("/api/catalogue/categories")).items;
}

const chunked = <T>(items: T[], size: number): T[][] => {
  const parts: T[][] = [];
  for (let index = 0; index < items.length; index += size) parts.push(items.slice(index, index + size));
  return parts;
};

/** Names of live products by id, for quote screens. Hidden or removed products are simply missing from the answer. */
export async function fetchProductNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const part of chunked(Array.from(new Set(ids)), 60)) {
    const data = await shopFetch<{ items: Array<{ id: string; name: string }> }>(`/api/catalogue/names?ids=${listParam(part)}`);
    for (const item of data.items) names.set(item.id, item.name);
  }
  return names;
}

/* Admin: every product, live or hidden. */

export type AdminStatusFilter = "all" | "live" | "hidden";
export type AdminQuery = { q: string; status: AdminStatusFilter };
export const ADMIN_PAGE_SIZE = 30;

export async function fetchAdminProductsPage(query: AdminQuery, page: number): Promise<ProductPage> {
  const params = new URLSearchParams({ page: String(page), size: String(ADMIN_PAGE_SIZE), status: query.status });
  if (query.q.trim()) params.set("q", query.q.trim());
  return pageOf(await shopFetch<Rows>(`/api/admin/products?${params}`, { admin: true }), page, ADMIN_PAGE_SIZE);
}

/** Products by id for the admin's quote screens, hidden ones included. */
export async function fetchAdminProductsByIds(ids: string[]): Promise<Product[]> {
  const products: Product[] = [];
  for (const part of chunked(Array.from(new Set(ids)), 60)) {
    const data = await shopFetch<{ items: unknown[] }>(`/api/admin/products/by-ids?ids=${listParam(part)}`, { admin: true });
    products.push(...data.items.map(mapProductRow));
  }
  return products;
}

/** Products hidden from the store. Products made from Telegram messages start here, waiting to be approved. */
export async function fetchHiddenCount(): Promise<number> {
  return (await shopFetch<{ count: number }>("/api/admin/products/hidden-count", { admin: true })).count;
}

/** Just enough about a product to act on it in bulk. */
export type AdminSummary = { id: string; name: string; category: string; isActive: boolean };

/** Every product matching the admin filters, in one request, for "Select all". */
export async function fetchAdminSummaries(query: AdminQuery, limit = 1000): Promise<AdminSummary[]> {
  const params = new URLSearchParams({ status: query.status, limit: String(limit) });
  if (query.q.trim()) params.set("q", query.q.trim());
  return (await shopFetch<{ items: AdminSummary[] }>(`/api/admin/products/summaries?${params}`, { admin: true })).items;
}
