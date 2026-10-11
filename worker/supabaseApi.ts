import { uniqueSlug } from "../shared/slug";
import type { KnownProduct } from "./category";

export const BUCKET = "product-images";

export class SupabaseError extends Error {
  constructor(
    /** HTTP status, or 0 when Supabase could not be reached. */
    readonly status: number,
    /** Postgres or PostgREST error code, for example 23505 (duplicate) or PGRST204 (unknown column). */
    readonly code: string | null,
    message: string,
    /** Which request failed, for example "POST /rest/v1/products". Never contains the key. */
    readonly where: string,
    readonly details = "",
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

/** The database refused a write only because a column does not exist yet (supabase_product_pricing.sql not run). */
export function isMissingColumn(error: unknown): boolean {
  if (!(error instanceof SupabaseError) || error.status === 0) return false;
  return error.code === "PGRST204" || error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(`${error.message} ${error.details}`);
}

/** Two products wanted the same web address. */
export function isSlugConflict(error: unknown): boolean {
  return error instanceof SupabaseError && error.code === "23505" && /slug/i.test(`${error.message} ${error.details}`);
}

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** Reads and writes products with the Supabase secret key. Used only by the Telegram intake. */
export function createSupabase(baseUrl: string, key: string, doFetch: typeof fetch) {
  const base = baseUrl.replace(/\/+$/, "");
  // Older service_role keys are JWTs and also go in Authorization. Newer "sb_secret_" keys only go in apikey.
  const auth: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) auth.authorization = `Bearer ${key}`;

  async function send(method: string, path: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}): Promise<unknown> {
    const where = `${method} ${path.split("?")[0]}`;
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, { method, headers: { ...auth, ...init.headers }, body: init.body });
    } catch (error) {
      throw new SupabaseError(0, null, `Supabase could not be reached: ${error instanceof Error ? error.message : String(error)}`.split(key).join("***"), where);
    }
    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    if (!response.ok) {
      const body: Row = data && typeof data === "object" ? (data as Row) : {};
      throw new SupabaseError(
        response.status,
        text(body.code) ?? text(body.statusCode),
        (text(body.message) ?? raw.slice(0, 200)).split(key).join("***"),
        where,
        text(body.details) ?? "",
      );
    }
    return data;
  }

  const jsonInit = (body: unknown, prefer?: string) => ({
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(prefer ? { prefer } : {}) },
  });

  return {
    /** Recent products, used to guess the category and to spot a product that already exists. */
    async listProducts(limit = 500): Promise<KnownProduct[]> {
      const data = await send("GET", `/rest/v1/products?select=id,name,category,is_active&order=created_at.desc&limit=${limit}`);
      return (Array.isArray(data) ? (data as Row[]) : [])
        .filter(row => typeof row.name === "string")
        .map(row => ({ id: String(row.id), name: String(row.name), category: String(row.category ?? ""), is_active: row.is_active === true }));
    },

    /** "rattan-bag", or "rattan-bag-2" when that address is taken. */
    async freeSlug(slugBase: string): Promise<string> {
      const data = await send("GET", `/rest/v1/products?select=slug&slug=ilike.${encodeURIComponent(slugBase)}%25&limit=200`);
      return uniqueSlug(slugBase, (Array.isArray(data) ? (data as Row[]) : []).map(row => String(row.slug)));
    },

    /** "exists" means a product with this id is already saved (Telegram sent the message twice). */
    async insertProduct(row: Row): Promise<"created" | "exists"> {
      try {
        await send("POST", "/rest/v1/products", jsonInit(row, "return=minimal"));
        return "created";
      } catch (error) {
        if (error instanceof SupabaseError && error.code === "23505" && /products_pkey|\(id\)/.test(`${error.message} ${error.details}`)) return "exists";
        throw error;
      }
    },

    async getProduct(id: string): Promise<{ id: string; slug: string; name: string; is_active: boolean } | null> {
      const data = await send("GET", `/rest/v1/products?select=id,slug,name,is_active&id=eq.${encodeURIComponent(id)}&limit=1`);
      const row = Array.isArray(data) ? (data[0] as Row | undefined) : undefined;
      if (!row) return null;
      return { id: String(row.id), slug: String(row.slug), name: String(row.name), is_active: row.is_active === true };
    },

    async countImages(productId: string): Promise<number> {
      const data = await send("GET", `/rest/v1/product_images?select=id&product_id=eq.${encodeURIComponent(productId)}`);
      return Array.isArray(data) ? data.length : 0;
    },

    /** Stores the photo in the public product-images bucket. A file that is already there counts as done. */
    async uploadImage(path: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
      const encoded = path.split("/").map(encodeURIComponent).join("/");
      try {
        await send("POST", `/storage/v1/object/${BUCKET}/${encoded}`, {
          body: bytes,
          headers: { "content-type": contentType, "x-upsert": "false", "cache-control": "max-age=31536000" },
        });
      } catch (error) {
        if (error instanceof SupabaseError && (error.status === 409 || error.code === "409" || /already exists|duplicate/i.test(error.message))) return;
        throw error;
      }
    },

    publicImageUrl(path: string): string {
      return `${base}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
    },

    async insertImage(row: Row): Promise<void> {
      try {
        await send("POST", "/rest/v1/product_images", jsonInit(row, "return=minimal"));
      } catch (error) {
        if (error instanceof SupabaseError && error.code === "23505") return;
        throw error;
      }
    },
  };
}

export type SupabaseApi = ReturnType<typeof createSupabase>;
