import { SLUG_PATTERN, slugOrFallback } from "../shared/slug";
import { productsInQuotes, realDeps, requireAdmin, type AdminDeps } from "./adminAuth";
import { HttpError, UUID, defaultEdgeCache, errorResponse, json, type EdgeCache } from "./http";
import { MAX_PHOTO_BYTES, removePhotos, storePhoto } from "./photos";
import { ensureSchema } from "./schema";
import {
  ProductMissingError,
  SlugTakenError,
  addImage,
  categoryCounts,
  countImages,
  deleteImage,
  deleteProducts,
  freeSlug,
  getProduct,
  hiddenCount,
  insertProduct,
  listProducts,
  productBasics,
  productsByIds,
  setActive,
  setCategory,
  setCover,
  setLabels,
  summaries,
  updateProduct,
  type ListQuery,
  type PriceTierRow,
  type ProductInput,
  type ProductRecord,
} from "./store";
import type { Env, WorkerContext } from "./types";

/*
 * The shop's web addresses:
 *   /api/catalogue/*  what shoppers see (live products only), open to everyone
 *   /api/admin/*      changing the shop, only for a signed-in administrator
 * The reply shapes match what Supabase used to return, so the website's screens did not have to change.
 */

export type ApiDeps = { admin: AdminDeps; /** Where shopper-facing answers are remembered. Defaults to Cloudflare's own; null turns it off. */ cache?: EdgeCache | null };

/**
 * What shoppers see is the same for everyone, so one answer is shared for a short while instead of asking the database
 * again for every visitor. This keeps a busy day (or a scraper) from using up the database's free daily reads, and makes
 * pages quicker. The price of it: a change an administrator makes reaches shoppers within this many seconds.
 */
export const SHOP_CACHE_SECONDS = 30;

export const MAX_PRODUCT_PHOTOS = 30;
/** Nobody pages this deep through a catalogue; the limit keeps "page 99999" from being a different question every time. */
const MAX_PAGE = 200;
const MAX_JSON_BYTES = 200_000;

/* Reading what the website sent */

function intParam(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new HttpError(400, "A number in the address was not a whole number.");
  return Math.min(max, Math.max(min, value));
}

const searchTerm = (raw: string | null): string | undefined => {
  const cleaned = (raw ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned || undefined;
};

const sortParam = (raw: string | null): NonNullable<ListQuery["sort"]> => (raw === "moq" || raw === "name" ? raw : "newest");

function idList(raw: string | null | undefined, max: number): string[] {
  const ids = (raw ?? "").split(",").map(part => part.trim().toLowerCase()).filter(Boolean);
  if (ids.length > max) throw new HttpError(400, `Ask for at most ${max} products at a time.`);
  if (ids.some(id => !UUID.test(id))) throw new HttpError(400, "One of the product ids is not valid.");
  return ids;
}

async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_JSON_BYTES) throw new HttpError(413, "That request is too large.");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Send the details as JSON.");
  }
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Send the details as a JSON object.");
  return value as Record<string, unknown>;
};

function text(value: unknown, field: string, max: number, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new HttpError(400, `The ${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `The ${field} is too long (the limit is ${max} characters).`);
  return trimmed;
}

function strings(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) throw new HttpError(400, `The ${field} must be a list of up to 50 items.`);
  return value.map(item => text(item, field, 120)).filter(Boolean);
}

function optionGroups(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, "There can be at most 20 option groups.");
  return value.map(group => {
    const entry = asRecord(group);
    return { key: text(entry.key, "option key", 60), label: text(entry.label, "option label", 60), options: strings(entry.options, "options") };
  });
}

function tiers(value: unknown): PriceTierRow[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, "A price list can have at most 20 steps.");
  const byQuantity = new Map<number, number>();
  for (const step of value) {
    const entry = asRecord(step);
    const quantity = Number(entry.min_qty);
    const price = Number(entry.price);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000_000 || !Number.isFinite(price) || price <= 0 || price > 1e12) {
      throw new HttpError(400, "Every price step needs a whole quantity of 1 or more and a price above zero.");
    }
    byQuantity.set(quantity, Math.min(byQuantity.get(quantity) ?? price, price));
  }
  return Array.from(byQuantity, ([min_qty, price]) => ({ min_qty, price })).sort((a, b) => a.min_qty - b.min_qty);
}

/** Checks everything an administrator typed. Throws a message that says what to fix. */
export function parseProductInput(body: unknown): ProductInput {
  const b = asRecord(body);
  const name = text(b.name, "name", 200);
  if (!name) throw new HttpError(400, "Give the product a name.");
  const category = text(b.category, "category", 80);
  if (!category) throw new HttpError(400, "Choose or type a category.");
  const moq = b.moq === undefined ? 1 : Number(b.moq);
  if (!Number.isInteger(moq) || moq < 1 || moq > 100_000_000) throw new HttpError(400, "The minimum order must be a whole number of 1 or more.");
  const currency = text(b.price_currency, "currency", 8, "NGN").toUpperCase();
  if (!/^[A-Z]{2,8}$/.test(currency)) throw new HttpError(400, "The currency must be a code such as NGN, USD or THB.");
  const unit = text(b.price_unit, "price unit", 24, "pc");
  if (!unit) throw new HttpError(400, "The price unit cannot be empty.");
  if (b.is_active !== undefined && typeof b.is_active !== "boolean") throw new HttpError(400, "Visible in store must be yes or no.");
  return {
    name,
    short_description: text(b.short_description, "short description", 500),
    description: text(b.description, "description", 20_000),
    category,
    moq,
    colors: strings(b.colors, "colours"),
    sizes: strings(b.sizes, "sizes"),
    packaging_options: strings(b.packaging_options, "packaging options"),
    customization_options: strings(b.customization_options, "customisation options"),
    option_groups: optionGroups(b.option_groups),
    price_currency: currency,
    price_unit: unit,
    price_tiers: tiers(b.price_tiers),
    is_active: b.is_active ?? true,
  };
}

const requireId = (value: string | undefined, what = "product"): string => {
  if (!value || !UUID.test(value)) throw new HttpError(404, `That ${what} was not found.`);
  return value.toLowerCase();
};

/* What shoppers see */

/** Shoppers do not need to know which administrator added a product. */
const forShoppers = ({ created_by: _createdBy, ...rest }: ProductRecord) => rest;

async function catalogueRoutes(request: Request, env: Env, url: URL, rest: string[]): Promise<Response> {
  if (request.method !== "GET") throw new HttpError(405, "Method not allowed");
  const q = url.searchParams;

  if (rest[0] === "products" && rest.length === 1) {
    const size = intParam(q.get("size"), 24, 1, 60);
    const page = intParam(q.get("page"), 0, 0, MAX_PAGE);
    const category = q.get("category")?.trim();
    const { rows, total } = await listProducts(env.DB, {
      active: true,
      search: searchTerm(q.get("q")),
      category: category && category !== "All" ? category : undefined,
      slugs: q.has("slugs") ? (q.get("slugs") ?? "").split(",").map(slug => slug.trim()).filter(Boolean) : undefined,
      sort: sortParam(q.get("sort")),
      limit: size,
      offset: page * size,
    });
    return json({ items: rows.map(forShoppers), total });
  }

  if (rest[0] === "products" && rest.length === 2) {
    const product = await getProduct(env.DB, { slug: rest[1] }, { liveOnly: true });
    if (!product) throw new HttpError(404, "That product was not found.", "not_found");
    return json(forShoppers(product));
  }

  if (rest[0] === "related" && rest.length === 1) {
    const slug = q.get("slug") ?? "";
    const category = q.get("category") ?? "";
    const { rows } = await listProducts(env.DB, { active: true, category: category || undefined, excludeSlug: slug || undefined, sort: "newest", limit: intParam(q.get("limit"), 8, 1, 24), offset: 0 });
    return json({ items: category ? rows.map(forShoppers) : [] });
  }

  if (rest[0] === "categories" && rest.length === 1) return json({ items: await categoryCounts(env.DB) });

  // Names for quote screens. Products that are hidden or gone are simply left out.
  if (rest[0] === "names" && rest.length === 1) {
    const items = (await productsByIds(env.DB, idList(q.get("ids"), 80), { liveOnly: true })).map(product => ({ id: product.id, name: product.name, slug: product.slug }));
    return json({ items });
  }

  throw new HttpError(404, "Not found");
}

/* Changing the shop */

async function createProduct(request: Request, env: Env, userId: string): Promise<Response> {
  const body = await readJson(request);
  const input = parseProductInput(body);
  const extra = asRecord(body);
  const id = extra.id === undefined ? crypto.randomUUID() : requireId(typeof extra.id === "string" ? extra.id : undefined);
  let slug: string;
  let chosenSlug = false;
  if (extra.slug === undefined) {
    slug = await freeSlug(env.DB, slugOrFallback(input.name));
  } else {
    slug = String(extra.slug);
    chosenSlug = true;
    if (!SLUG_PATTERN.test(slug) || slug.length > 90) throw new HttpError(400, "The web address can only use lower-case letters, numbers and dashes.");
  }

  let createdAt: string | undefined;
  if (extra.created_at !== undefined) {
    const parsed = typeof extra.created_at === "string" ? new Date(extra.created_at) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now() + 86_400_000) throw new HttpError(400, "The date the product was added is not valid.");
    createdAt = parsed.toISOString();
  }

  const attempt = (candidate: string) => insertProduct(env.DB, { id, slug: candidate, input, createdBy: userId, createdAt });
  let outcome: "created" | "exists";
  try {
    outcome = await attempt(slug);
  } catch (error) {
    if (!(error instanceof SlugTakenError)) throw error;
    if (chosenSlug) throw new HttpError(409, "A product with this web address already exists.", "slug_taken");
    // Someone took it a moment ago: add a short random ending and try once more.
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      outcome = await attempt(slug);
    } catch (second) {
      if (second instanceof SlugTakenError) throw new HttpError(409, "A product with this web address already exists. Please try again.", "slug_taken");
      throw second;
    }
  }
  if (outcome === "exists") {
    const existing = await productBasics(env.DB, id);
    return json({ id, slug: existing?.slug ?? slug, existed: true });
  }
  return json({ id, slug }, 201);
}

async function uploadPhoto(request: Request, env: Env, url: URL, productId: string): Promise<Response> {
  const product = await productBasics(env.DB, productId);
  if (!product) throw new HttpError(404, "That product was not found.", "not_found");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is larger than 12 MB. Choose a smaller one.", "photo_too_large");
  if ((await countImages(env.DB, productId)) >= MAX_PRODUCT_PHOTOS) throw new HttpError(409, `A product can have up to ${MAX_PRODUCT_PHOTOS} photos.`, "too_many_photos");

  const q = url.searchParams;
  const imageId = q.get("imageId") ? requireId(q.get("imageId") ?? undefined, "photo") : crypto.randomUUID();
  const label = (q.get("label") ?? "").trim().slice(0, 120) || null;
  const primary = q.get("primary");
  const sort = q.get("sort");
  const stored = await storePhoto(env.PHOTOS, { productId, imageId, bytes: await request.arrayBuffer() });
  try {
    const { created, record } = await addImage(env.DB, {
      id: imageId,
      productId,
      storagePath: stored.key,
      altText: label ?? `${product.name} product image`,
      label,
      sortOrder: sort === null || sort === "" ? undefined : intParam(sort, 0, 0, 100_000),
      isPrimary: primary === "1" ? true : primary === "0" ? false : undefined,
      contentType: stored.contentType,
      sizeBytes: stored.size,
    });
    return json(record, created ? 201 : 200);
  } catch (error) {
    await removePhotos(env.PHOTOS, [stored.key]);
    if (error instanceof ProductMissingError) throw new HttpError(404, "That product was not found.", "not_found");
    throw error;
  }
}

async function bulk(request: Request, env: Env, admin: { userId: string; token: string }, deps: ApiDeps): Promise<Response> {
  const body = asRecord(await readJson(request));
  const ids = idList(Array.isArray(body.ids) ? body.ids.map(String).join(",") : "", 500);
  if (!ids.length) throw new HttpError(400, "Choose at least one product.");

  switch (body.action) {
    case "show":
      return json({ updated: await setActive(env.DB, ids, true) });
    case "hide":
      return json({ updated: await setActive(env.DB, ids, false) });
    case "category": {
      const category = text(body.category, "category", 80);
      if (!category) throw new HttpError(400, "Choose or type a category.");
      return json({ updated: await setCategory(env.DB, ids, category) });
    }
    case "delete": {
      const inQuotes = await productsInQuotes(env, admin, ids, deps.admin);
      const allowed = ids.filter(id => !inQuotes.has(id));
      const { deleted, paths } = await deleteProducts(env.DB, allowed);
      await removePhotos(env.PHOTOS, paths);
      return json({ deleted, blocked: ids.length - allowed.length });
    }
    default:
      throw new HttpError(400, "I don't know what to do with those products.");
  }
}

async function adminRoutes(request: Request, env: Env, url: URL, rest: string[], deps: ApiDeps): Promise<Response> {
  const admin = await requireAdmin(request, env, deps.admin);
  await ensureSchema(env.DB);
  const method = request.method;
  const q = url.searchParams;
  const wrongMethod = () => new HttpError(405, "Method not allowed");

  if (rest[0] === "me" && rest.length === 1) return json({ userId: admin.userId });

  if (rest[0] !== "products") throw new HttpError(404, "Not found");

  if (rest.length === 1) {
    if (method === "POST") return createProduct(request, env, admin.userId);
    if (method !== "GET") throw wrongMethod();
    const status = q.get("status");
    const size = intParam(q.get("size"), 30, 1, 60);
    const page = intParam(q.get("page"), 0, 0, MAX_PAGE);
    const { rows, total } = await listProducts(env.DB, {
      active: status === "live" ? true : status === "hidden" ? false : null,
      search: searchTerm(q.get("q")),
      searchFields: "admin",
      sort: "newest",
      limit: size,
      offset: page * size,
    });
    return json({ items: rows, total });
  }

  const second = rest[1];
  if (rest.length === 2 && second === "hidden-count") return json({ count: await hiddenCount(env.DB) });
  if (rest.length === 2 && second === "summaries") {
    const status = q.get("status");
    const items = await summaries(env.DB, { active: status === "live" ? true : status === "hidden" ? false : null, search: searchTerm(q.get("q")), limit: intParam(q.get("limit"), 1000, 1, 2000) });
    return json({ items });
  }
  if (rest.length === 2 && second === "by-ids") return json({ items: await productsByIds(env.DB, idList(q.get("ids"), 80), { liveOnly: false }) });
  if (rest.length === 2 && second === "bulk") {
    if (method !== "POST") throw wrongMethod();
    return bulk(request, env, admin, deps);
  }

  const productId = requireId(second);
  if (rest.length === 2) {
    if (method === "GET") {
      const product = await getProduct(env.DB, { id: productId }, { liveOnly: false });
      if (!product) throw new HttpError(404, "That product was not found.", "not_found");
      return json(product);
    }
    if (method === "PUT") {
      if (!(await updateProduct(env.DB, productId, parseProductInput(await readJson(request))))) throw new HttpError(404, "That product was not found.", "not_found");
      return json({ id: productId });
    }
    if (method === "DELETE") {
      const inQuotes = await productsInQuotes(env, admin, [productId], deps.admin);
      if (inQuotes.has(productId)) throw new HttpError(409, "This product is part of a quote request, so it cannot be deleted. Hide it instead.", "in_quote");
      const { deleted, paths } = await deleteProducts(env.DB, [productId]);
      if (!deleted) throw new HttpError(404, "That product was not found.", "not_found");
      await removePhotos(env.PHOTOS, paths);
      return json({ deleted });
    }
    throw wrongMethod();
  }

  if (rest[2] !== "photos") throw new HttpError(404, "Not found");

  if (rest.length === 3) {
    if (method !== "POST") throw wrongMethod();
    return uploadPhoto(request, env, url, productId);
  }

  if (rest.length === 4 && rest[3] === "labels") {
    if (method !== "PUT") throw wrongMethod();
    const body = await readJson(request);
    if (!Array.isArray(body) || body.length > MAX_PRODUCT_PHOTOS) throw new HttpError(400, "Send the captions as a list.");
    const labels = body.map(item => {
      const entry = asRecord(item);
      return { id: requireId(typeof entry.id === "string" ? entry.id : undefined, "photo"), label: text(entry.label, "caption", 120) };
    });
    if (!(await setLabels(env.DB, productId, labels))) throw new HttpError(404, "That product was not found.", "not_found");
    return json({ ok: true });
  }

  const imageId = requireId(rest[3], "photo");
  if (rest.length === 4) {
    if (method !== "DELETE") throw wrongMethod();
    const removed = await deleteImage(env.DB, productId, imageId);
    if (!removed) throw new HttpError(404, "That photo was not found.", "not_found");
    await removePhotos(env.PHOTOS, [removed.storagePath]);
    return json({ deleted: true });
  }
  if (rest.length === 5 && rest[4] === "cover") {
    if (method !== "PUT") throw wrongMethod();
    if (!(await setCover(env.DB, productId, imageId))) throw new HttpError(404, "That photo was not found.", "not_found");
    return json({ ok: true });
  }

  throw new HttpError(404, "Not found");
}

/** Lower-cases only A-Z, exactly as the database's lower() does, so two spellings share an answer only if the database would too. */
const asciiLower = (text: string) => text.replace(/[A-Z]/g, letter => letter.toLowerCase());

/**
 * The address that identifies a shopper answer in the shared memory: only the parts that change the answer, spelled the
 * one way, in a fixed order. Extra or reordered parts of the address (`?x=123`, `?q=Tote` against `?q=tote`) therefore
 * cannot make every request look new, which would bypass the memory and ask the database each time.
 */
function cacheKeyFor(url: URL, rest: string[]): string {
  const q = url.searchParams;
  const params = new URLSearchParams();
  if (rest[0] === "products" && rest.length === 1) {
    params.set("page", String(intParam(q.get("page"), 0, 0, MAX_PAGE)));
    params.set("size", String(intParam(q.get("size"), 24, 1, 60)));
    const term = searchTerm(q.get("q"));
    if (term) params.set("q", asciiLower(term));
    const category = q.get("category")?.trim();
    if (category && category !== "All") params.set("category", category);
    if (q.has("slugs")) params.set("slugs", (q.get("slugs") ?? "").split(",").map(slug => slug.trim()).filter(Boolean).slice(0, 80).join(","));
    const sort = sortParam(q.get("sort"));
    if (sort !== "newest") params.set("sort", sort);
  } else if (rest[0] === "related" && rest.length === 1) {
    for (const name of ["slug", "category"]) if (q.get(name)) params.set(name, q.get(name) ?? "");
    params.set("limit", String(intParam(q.get("limit"), 8, 1, 24)));
  } else if (rest[0] === "names" && rest.length === 1) {
    params.set("ids", idList(q.get("ids"), 80).join(","));
  }
  params.sort();
  const query = params.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

const withCacheNote = (response: Response, note: "hit" | "miss" | "off"): Response => {
  const headers = new Headers(response.headers);
  headers.set("x-shop-cache", note);
  return new Response(response.body, { status: response.status, headers });
};

async function rememberedFor(request: Request, ctx: WorkerContext, cache: EdgeCache | null, address: string, answer: () => Promise<Response>): Promise<Response> {
  if (request.method !== "GET") return answer();
  if (!cache) return withCacheNote(await answer(), "off");
  // A plain GET of the cleaned-up address, so nothing about the visitor can split or poison what is remembered.
  const key = new Request(address);
  const hit = await cache.match(key);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-shop-cache", "hit");
    return new Response(hit.body, { status: hit.status, headers });
  }
  const fresh = await answer();
  if (fresh.ok) {
    const headers = new Headers(fresh.headers);
    headers.set("cache-control", `public, max-age=${SHOP_CACHE_SECONDS}`);
    ctx.waitUntil(cache.put(key, new Response(fresh.clone().body, { status: fresh.status, headers })).catch(() => undefined));
  }
  return withCacheNote(fresh, "miss");
}

export async function handleApi(request: Request, env: Env, ctx: WorkerContext, deps: ApiDeps = { admin: realDeps }): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map(part => {
        try {
          return decodeURIComponent(part);
        } catch {
          throw new HttpError(404, "Not found");
        }
      });
    const rest = parts.slice(2);
    if (parts[1] === "catalogue") {
      return await rememberedFor(request, ctx, deps.cache === undefined ? defaultEdgeCache() : deps.cache, cacheKeyFor(url, rest), async () => {
        await ensureSchema(env.DB);
        return catalogueRoutes(request, env, url, rest);
      });
    }
    if (parts[1] === "admin") return await adminRoutes(request, env, url, rest, deps);
    throw new HttpError(404, "Not found");
  } catch (error) {
    return errorResponse(error);
  }
}
