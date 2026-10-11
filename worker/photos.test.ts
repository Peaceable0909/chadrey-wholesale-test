import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handlePhotoRequest, sniffImage, storePhoto, type PhotoCache } from "./photos";
import { GIF_BYTES, JPEG_BYTES, PNG_BYTES, WEBP_BYTES, createTestEnv, fakeImages, type TestEnv } from "./testEnv";

let test: TestEnv;
beforeAll(async () => {
  test = await createTestEnv();
}, 60_000);
afterAll(() => test?.dispose());
beforeEach(() => test.reset());

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const IMAGE = "22222222-2222-4222-8222-222222222222";

function fakeCache() {
  const store = new Map<string, Response>();
  const cache: PhotoCache & { puts: string[]; store: Map<string, Response> } = {
    puts: [],
    store,
    async match(request) {
      return store.get(request.url)?.clone();
    },
    async put(request, response) {
      store.set(request.url, response.clone());
      cache.puts.push(request.url);
    },
  };
  return cache;
}

async function fetchPhoto(path: string, options: { method?: string; headers?: Record<string, string>; env?: Partial<typeof test.env>; cache?: PhotoCache | null } = {}) {
  const pending: Promise<unknown>[] = [];
  const response = await handlePhotoRequest(
    new Request(`https://shop.test${path}`, { method: options.method ?? "GET", headers: options.headers }),
    { ...test.env, ...options.env },
    { waitUntil: promise => void pending.push(promise) },
    { cache: options.cache === undefined ? null : options.cache },
  );
  await Promise.all(pending);
  return response;
}

const store = (bytes: Uint8Array, imageId = IMAGE) => storePhoto(test.env.PHOTOS, { productId: PRODUCT, imageId, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
const path = (key: string, query = "") => `/photos/${key}${query}`;

describe("recognising pictures", () => {
  it("knows the common kinds by their first bytes", () => {
    expect(sniffImage(JPEG_BYTES)?.contentType).toBe("image/jpeg");
    expect(sniffImage(PNG_BYTES)?.contentType).toBe("image/png");
    expect(sniffImage(WEBP_BYTES)?.contentType).toBe("image/webp");
    expect(sniffImage(GIF_BYTES)?.contentType).toBe("image/gif");
    expect(sniffImage(new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))?.ext).toBe("avif");
  });

  it("refuses everything else, including pages and scripts dressed up as pictures", () => {
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("storing", () => {
  it("names the file after the product and photo and keeps the real kind of picture", async () => {
    const stored = await store(PNG_BYTES);
    expect(stored).toEqual({ key: `products/${PRODUCT}/${IMAGE}.png`, contentType: "image/png", size: PNG_BYTES.byteLength });
    expect((await test.env.PHOTOS.head(stored.key))?.httpMetadata?.contentType).toBe("image/png");
  });
});

describe("showing a photo", () => {
  it("sends the file with headers that let browsers keep it for a year", async () => {
    const { key } = await store(JPEG_BYTES);
    const response = await fetchPhoto(path(key));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("etag")).toBeTruthy();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
  });

  it("answers 304 when the browser already has it", async () => {
    const { key } = await store(JPEG_BYTES);
    const first = await fetchPhoto(path(key));
    const again = await fetchPhoto(path(key), { headers: { "if-none-match": first.headers.get("etag")! } });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
  });

  it("answers HEAD without a body", async () => {
    const { key } = await store(JPEG_BYTES);
    const response = await fetchPhoto(path(key), { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(await response.text()).toBe("");
  });

  it("says 404 for a photo that is not there and for addresses that are not photo addresses", async () => {
    const missing = `products/${PRODUCT}/${IMAGE}.jpg`;
    expect((await fetchPhoto(path(missing))).status).toBe(404);
    for (const odd of ["", "products", `products/${PRODUCT}`, `products/${PRODUCT}/${IMAGE}`, `products/${PRODUCT}/${IMAGE}.svg`, `products/${PRODUCT}/${IMAGE}.html`, `other/${PRODUCT}/${IMAGE}.jpg`, `products/../${IMAGE}.jpg`, `products/${PRODUCT}/../x.jpg`, "%E0%A4%A"]) {
      expect((await fetchPhoto(path(odd))).status, odd).toBe(404);
    }
  });

  it("only allows reading", async () => {
    const { key } = await store(JPEG_BYTES);
    expect((await fetchPhoto(path(key), { method: "POST" })).status).toBe(405);
    expect((await fetchPhoto(path(key), { method: "DELETE" })).status).toBe(405);
  });
});

describe("smaller copies", () => {
  it("makes a smaller copy, rounding the width up to a size it offers, as WebP for browsers that can show it", async () => {
    const images = fakeImages();
    const { key } = await store(JPEG_BYTES);
    const response = await fetchPhoto(path(key, "?w=300"), { headers: { accept: "image/avif,image/webp,*/*" }, env: { IMAGES: images } });
    expect(response.status).toBe(200);
    expect(images.calls).toEqual([{ width: 320, format: "image/webp" }]);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("vary")).toBe("Accept");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("etag")).toMatch(/^W\//);
  });

  it("uses JPEG for browsers that cannot show WebP, and keeps PNG as PNG", async () => {
    const images = fakeImages();
    const jpeg = await store(JPEG_BYTES);
    await fetchPhoto(path(jpeg.key, "?w=640"), { headers: { accept: "image/png,*/*" }, env: { IMAGES: images } });
    const png = await store(PNG_BYTES, "33333333-3333-4333-8333-333333333333");
    await fetchPhoto(path(png.key, "?w=640"), { headers: { accept: "*/*" }, env: { IMAGES: images } });
    expect(images.calls).toEqual([
      { width: 640, format: "image/jpeg" },
      { width: 640, format: "image/png" },
    ]);
  });

  it("offers only a few sizes, so only a few copies ever exist", async () => {
    const images = fakeImages();
    const { key } = await store(JPEG_BYTES);
    for (const wanted of ["1", "160", "161", "700", "5000"]) await fetchPhoto(path(key, `?w=${wanted}`), { env: { IMAGES: images } });
    expect(images.calls.map(call => call.width)).toEqual([160, 160, 320, 960, 1280]);
  });

  it("remembers a smaller copy so it is not made again", async () => {
    const images = fakeImages();
    const cache = fakeCache();
    const { key } = await store(JPEG_BYTES);
    const first = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: images }, cache });
    const second = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: images }, cache });
    expect(images.calls).toHaveLength(1);
    expect(cache.puts).toHaveLength(1);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(new Uint8Array(await first.arrayBuffer()));
    // WebP and non-WebP copies are remembered separately.
    await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: images }, cache, headers: { accept: "image/webp" } });
    expect(images.calls).toHaveLength(2);
  });

  it("answers 304 for a smaller copy the browser already has", async () => {
    const images = fakeImages();
    const cache = fakeCache();
    const { key } = await store(JPEG_BYTES);
    const first = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: images }, cache });
    const again = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: images }, cache, headers: { "if-none-match": first.headers.get("etag")! } });
    expect(again.status).toBe(304);
  });

  it("shows the full photo when the resizer fails or has run out of its free allowance", async () => {
    const { key } = await store(JPEG_BYTES);
    const response = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: fakeImages({ fail: true }) } });
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
  });

  it("keeps that stand-in for only a few minutes, so it never becomes the permanent smaller copy", async () => {
    const cache = fakeCache();
    const { key } = await store(JPEG_BYTES);
    const response = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: fakeImages({ fail: true }) }, cache });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(cache.puts).toHaveLength(0);
    // Once the resizer works again, the real smaller copy is made and kept.
    await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: fakeImages() }, cache });
    expect(cache.puts).toHaveLength(1);
  });

  it("shows the full photo when there is no resizer at all (a preview)", async () => {
    const { key } = await store(JPEG_BYTES);
    const response = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: undefined } });
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
  });

  it("sends animated GIFs untouched", async () => {
    const images = fakeImages();
    const { key } = await store(GIF_BYTES);
    const response = await fetchPhoto(path(key, "?w=320"), { env: { IMAGES: images } });
    expect(images.calls).toEqual([]);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(GIF_BYTES);
  });

  it("ignores a width that is not a number", async () => {
    const images = fakeImages();
    const { key } = await store(JPEG_BYTES);
    for (const wanted of ["abc", "-5", "0", ""]) await fetchPhoto(path(key, `?w=${wanted}`), { env: { IMAGES: images } });
    expect(images.calls).toEqual([]);
  });
});
