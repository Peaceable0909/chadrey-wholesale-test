import path from "node:path";
import { ensureSchema } from "./schema";
import type { D1Database, Env, ImagesBinding, R2Bucket } from "./types";

/**
 * A real, empty copy of Cloudflare's database (D1) and file storage (R2) running on this computer, for the tests.
 * It is the same engine Cloudflare runs, so SQL mistakes show up here instead of on the live shop.
 */

export const SUPABASE_URL = "https://proj.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_TEST_KEY";

type Platform = { env: { DB: D1Database; FRESH_DB: D1Database; PHOTOS: R2Bucket & { list(options?: { cursor?: string }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }> } }; dispose(): Promise<void> };

export type TestEnv = {
  env: Env;
  /** A second database that nothing has set up yet. */
  freshDb: D1Database;
  /** Empties every table and every stored file, so each test starts from nothing. */
  reset(): Promise<void>;
  dispose(): Promise<void>;
};

export async function createTestEnv(overrides: Partial<Env> = {}): Promise<TestEnv> {
  const { getPlatformProxy } = (await import("wrangler")) as unknown as { getPlatformProxy(options: { configPath: string; persist: boolean }): Promise<Platform> };
  const platform = await getPlatformProxy({ configPath: path.resolve(import.meta.dirname, "wrangler.test.jsonc"), persist: false });
  const { DB, FRESH_DB, PHOTOS } = platform.env;
  await ensureSchema(DB);

  const env: Env = {
    ASSETS: { fetch: async () => new Response("asset") },
    DB,
    PHOTOS,
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
    DEFAULT_CURRENCY: "NGN",
    DEFAULT_UNIT: "pc",
    DEFAULT_MOQ: "1",
    ...overrides,
  };

  return {
    env,
    freshDb: FRESH_DB,
    async reset() {
      await DB.batch([DB.prepare("DELETE FROM product_images"), DB.prepare("DELETE FROM products")]);
      let cursor: string | undefined;
      do {
        const page = await PHOTOS.list({ cursor });
        if (page.objects.length) await PHOTOS.delete(page.objects.map(object => object.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    },
    dispose: () => platform.dispose(),
  };
}

/** A stand-in for Cloudflare's image resizer: returns a tiny "resized" file and remembers what it was asked. */
export function fakeImages(options: { fail?: boolean } = {}): ImagesBinding & { calls: Array<{ width?: number; format: string }> } {
  const calls: Array<{ width?: number; format: string }> = [];
  return {
    calls,
    input() {
      let width: number | undefined;
      const chain = {
        transform(next: { width?: number }) {
          width = next.width;
          return chain;
        },
        async output(output: { format: string }) {
          if (options.fail) throw new Error("resizer unavailable");
          calls.push({ width, format: output.format });
          return {
            response: (init?: { headers?: Record<string, string> }) =>
              // Like the real resizer, the content type always comes from the output format.
              new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { headers: { ...init?.headers, "content-type": output.format } }),
          };
        },
      };
      return chain;
    },
  };
}

/** The first bytes of real files, enough for the Worker to recognise the kind of picture. */
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);
export const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 0, 0, 0, 0]);
export const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b]);
