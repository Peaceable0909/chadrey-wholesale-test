import { HttpError } from "./http";
import type { Env, R2Bucket, WorkerContext } from "./types";

/*
 * Product photos live in Cloudflare's file storage (R2). They are shown at /photos/<key>, optionally with
 * ?w=<width> to get a smaller copy (made on the fly, then remembered), which keeps catalogue pages light.
 */

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
/** Photos are never overwritten (a new photo gets a new name), so browsers may keep them for a year. */
export const PHOTO_CACHE = "public, max-age=31536000, immutable";
/** The widths a smaller copy can have. Anything else is rounded up to the next one, so only a few copies ever exist. */
export const WIDTHS = [160, 320, 640, 960, 1280] as const;

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY = new RegExp(`^products/${ID}/${ID}\\.(jpg|png|webp|gif|avif)$`, "i");

export type ImageKind = { ext: "jpg" | "png" | "webp" | "gif" | "avif"; contentType: string };

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

/** Recognises a picture by its first bytes, so a file named .jpg that is really something else is refused. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return { ext: "png", contentType: "image/png" };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { ext: "webp", contentType: "image/webp" };
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return { ext: "gif", contentType: "image/gif" };
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(bytes, 8, 12))) return { ext: "avif", contentType: "image/avif" };
  return null;
}

export const photoKey = (productId: string, imageId: string, ext: ImageKind["ext"]) => `products/${productId.toLowerCase()}/${imageId.toLowerCase()}.${ext}`;

/** Checks the bytes are a picture and stores them. Returns what was stored. */
export async function storePhoto(bucket: R2Bucket, args: { productId: string; imageId: string; bytes: ArrayBuffer }): Promise<{ key: string; contentType: string; size: number }> {
  if (args.bytes.byteLength === 0) throw new HttpError(400, "That photo came through empty. Please choose it again.", "empty_photo");
  if (args.bytes.byteLength > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is larger than 12 MB. Choose a smaller one.", "photo_too_large");
  const kind = sniffImage(new Uint8Array(args.bytes, 0, Math.min(16, args.bytes.byteLength)));
  if (!kind) throw new HttpError(415, "That file is not a photo the shop can use. Use a JPEG, PNG, WebP, GIF or AVIF picture.", "not_a_photo");
  const key = photoKey(args.productId, args.imageId, kind.ext);
  await bucket.put(key, args.bytes, { httpMetadata: { contentType: kind.contentType, cacheControl: PHOTO_CACHE } });
  return { key, contentType: kind.contentType, size: args.bytes.byteLength };
}

/** Removes stored files. A leftover file is harmless, so a failure is logged and never stops the caller. */
export async function removePhotos(bucket: R2Bucket, keys: string[]): Promise<void> {
  for (let index = 0; index < keys.length; index += 500) {
    try {
      await bucket.delete(keys.slice(index, index + 500));
    } catch (error) {
      console.error("could not remove stored photos", error instanceof Error ? error.message : String(error));
    }
  }
}

/* Showing photos */

export type PhotoCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
export type PhotoDeps = { cache?: PhotoCache | null };

const pickWidth = (raw: string | null): number | null => {
  const wanted = Number(raw);
  if (!raw || !Number.isFinite(wanted) || wanted <= 0) return null;
  return WIDTHS.find(width => width >= wanted) ?? WIDTHS[WIDTHS.length - 1];
};

function defaultCache(): PhotoCache | null {
  const storage = (globalThis as { caches?: { default?: PhotoCache } }).caches;
  return storage?.default ?? null;
}

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } });

function finish(response: Response, request: Request, varyOnAccept: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "cross-origin");
  if (varyOnAccept) headers.set("vary", "Accept");
  const etag = headers.get("etag");
  const matches = etag && request.headers.get("if-none-match")?.split(",").map(value => value.trim()).includes(etag);
  if (matches) {
    headers.delete("content-length");
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
}

/** GET /photos/<key>[?w=<width>] */
export async function handlePhotoRequest(request: Request, env: Env, ctx: WorkerContext, deps: PhotoDeps = {}): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  const url = new URL(request.url);
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice("/photos/".length));
  } catch {
    return notFound();
  }
  if (!KEY.test(key)) return notFound();

  const width = pickWidth(url.searchParams.get("w"));
  const acceptsWebp = /image\/webp/i.test(request.headers.get("accept") ?? "");
  const variant = width ? `${width}-${acceptsWebp ? "webp" : "std"}` : "full";
  const cache = deps.cache === undefined ? defaultCache() : deps.cache;
  const cacheKey = new Request(`${url.origin}/photos/${key}?v=${variant}`);

  const hit = await cache?.match(cacheKey);
  if (hit) return finish(hit, request, Boolean(width));

  const object = await env.PHOTOS.get(key);
  if (!object) return notFound();
  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
  const headers: Record<string, string> = { "content-type": contentType, "cache-control": PHOTO_CACHE, etag: object.httpEtag };
  let response: Response;
  let keep = true;

  // Smaller copies are made for pictures that can be shrunk safely. Animated GIFs are sent as they are.
  if (width && env.IMAGES && /^image\/(jpeg|png|webp)$/.test(contentType)) {
    const bytes = await object.arrayBuffer();
    try {
      const format = acceptsWebp ? "image/webp" : contentType === "image/png" ? "image/png" : "image/jpeg";
      const resized = await env.IMAGES.input(new Response(bytes).body!).transform({ width, fit: "scale-down" }).output({ format, quality: 82 });
      // The resizer sets the content type itself, from the format it produced.
      const { "content-type": _original, ...resizedHeaders } = headers;
      response = resized.response({ headers: { ...resizedHeaders, etag: `W/"${object.httpEtag.replace(/"/g, "")}-${variant}"` } });
    } catch (error) {
      // The resizer is unavailable or over its monthly allowance: show the full-size photo instead of a broken one,
      // but only for a few minutes, so neither browsers nor Cloudflare keep it as "the" smaller copy.
      console.error("could not resize a photo", error instanceof Error ? error.message : String(error));
      response = new Response(bytes, { headers: { ...headers, "cache-control": "public, max-age=300" } });
      keep = false;
    }
  } else {
    response = new Response(object.body, { headers });
  }

  if (cache && keep && response.ok && request.method === "GET") ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
  return finish(response, request, Boolean(width));
}
