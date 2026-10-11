import { getSupabaseClient } from "@/lib/supabase";
import {
  mapProductRow,
  sanitizeSearch,
  tallyCategories,
  type CatalogueQuery,
  type CategoryCount,
  type Product,
  type ProductPage,
} from "@/lib/catalogue";

/** `*` keeps the query working both before and after the pricing migration adds its columns. */
export const PRODUCT_SELECT = "*,product_images(id,storage_path,public_url,is_primary,sort_order,alt_text,label)";
export const PAGE_SIZE = 24;

export async function fetchProductsPage(query: CatalogueQuery, page: number): Promise<ProductPage> {
  const size = query.pageSize ?? PAGE_SIZE;
  const from = page * size;
  let request = getSupabaseClient().from("products").select(PRODUCT_SELECT, { count: "exact" }).eq("is_active", true);

  if (query.category && query.category !== "All") request = request.eq("category", query.category);
  const term = sanitizeSearch(query.q);
  if (term) request = request.or(`name.ilike.%${term}%,short_description.ilike.%${term}%,category.ilike.%${term}%`);
  if (query.slugs) request = request.in("slug", query.slugs.length ? query.slugs : ["__none__"]);

  if (query.sort === "moq") request = request.order("moq", { ascending: true }).order("created_at", { ascending: false });
  else if (query.sort === "name") request = request.order("name", { ascending: true });
  else request = request.order("created_at", { ascending: false });

  const { data, error, count } = await request.range(from, from + size - 1);
  if (error) throw error;
  const items = (data ?? []).map(mapProductRow);
  const total = count ?? from + items.length;
  return { items, total, hasMore: from + items.length < total };
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await getSupabaseClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProductRow(data) : null;
}

/** Admin lookup by id, including hidden products (row-level security allows administrators to read them). */
export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await getSupabaseClient().from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapProductRow(data) : null;
}

export async function fetchRelatedProducts(product: Pick<Product, "slug" | "category">, limit = 8): Promise<Product[]> {
  const { data, error } = await getSupabaseClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("category", product.category)
    .neq("slug", product.slug)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapProductRow);
}

/** Category chips and home tiles come from the real catalogue, most-stocked first. */
export async function fetchCategoryCounts(): Promise<CategoryCount[]> {
  const { data, error } = await getSupabaseClient().from("products").select("category").eq("is_active", true);
  if (error) throw error;
  return tallyCategories((data ?? []) as Array<{ category: string | null }>);
}

/* Admin: every product, live or hidden. RLS restricts hidden rows to administrators. */

export type AdminStatusFilter = "all" | "live" | "hidden";
export type AdminQuery = { q: string; status: AdminStatusFilter };
export const ADMIN_PAGE_SIZE = 30;

/** The visibility and search filters of the admin list, shared by the list and "select all". */
function adminFilter(query: AdminQuery): { active: boolean | null; search: string | null } {
  const term = sanitizeSearch(query.q);
  return {
    active: query.status === "live" ? true : query.status === "hidden" ? false : null,
    search: term ? `name.ilike.%${term}%,category.ilike.%${term}%,slug.ilike.%${term}%` : null,
  };
}

export async function fetchAdminProductsPage(query: AdminQuery, page: number): Promise<ProductPage> {
  const from = page * ADMIN_PAGE_SIZE;
  const filter = adminFilter(query);
  let request = getSupabaseClient().from("products").select(PRODUCT_SELECT, { count: "exact" });
  if (filter.active !== null) request = request.eq("is_active", filter.active);
  if (filter.search) request = request.or(filter.search);
  const { data, error, count } = await request.order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw error;
  const items = (data ?? []).map(mapProductRow);
  const total = count ?? from + items.length;
  return { items, total, hasMore: from + items.length < total };
}

/** Products hidden from the store. Products made from Telegram messages start here, waiting to be approved. */
export async function fetchHiddenCount(): Promise<number> {
  const { count, error } = await getSupabaseClient().from("products").select("id", { count: "exact", head: true }).eq("is_active", false);
  if (error) throw error;
  return count ?? 0;
}

/** Just enough about a product to act on it in bulk. */
export type AdminSummary = { id: string; name: string; category: string; isActive: boolean };

/** Every product matching the admin filters, in one request, for "Select all". */
export async function fetchAdminSummaries(query: AdminQuery, limit = 1000): Promise<AdminSummary[]> {
  const filter = adminFilter(query);
  let request = getSupabaseClient().from("products").select("id,name,category,is_active");
  if (filter.active !== null) request = request.eq("is_active", filter.active);
  if (filter.search) request = request.or(filter.search);
  const { data, error } = await request.order("created_at", { ascending: false }).range(0, limit - 1);
  if (error) throw error;
  return (data ?? []).map(row => ({ id: String(row.id), name: String(row.name ?? ""), category: String(row.category ?? ""), isActive: row.is_active === true }));
}
