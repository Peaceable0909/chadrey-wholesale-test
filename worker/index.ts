import { allowedUserIds, missingConfig, safeEqual } from "./config";
import { handleUpdate, type IntakeDeps } from "./intake";
import type { Env, TelegramUpdate, WorkerContext } from "./types";

/**
 * Cloudflare runs this only for /api/telegram (see run_worker_first in wrangler.jsonc). Every other address is
 * served straight from the website files without waking the Worker.
 */

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const MAX_BODY_BYTES = 1_000_000;

/**
 * Telegram calls this address for every message sent to the bot.
 *  - GET shows whether the setup is complete (names of missing settings only, never values).
 *  - POST must carry the secret Telegram was told to send, otherwise nothing happens.
 * The reply goes back to Telegram at once; saving the product continues in the background.
 */
export async function handleTelegramRequest(request: Request, env: Env, ctx: WorkerContext, overrides: Partial<IntakeDeps> = {}): Promise<Response> {
  const missing = missingConfig(env);

  if (request.method === "GET") {
    return json({ ready: missing.length === 0 && allowedUserIds(env).size > 0, missing, allowedUsers: allowedUserIds(env).size });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "GET, POST" });
  if (missing.length) return json({ error: "Telegram intake is not set up yet", missing }, 503);

  const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!(await safeEqual(supplied, env.TELEGRAM_WEBHOOK_SECRET ?? ""))) return json({ error: "Unauthorized" }, 401);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Too large" }, 413);
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const deps: IntakeDeps = {
    fetch: (input, init) => fetch(input, init),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    origin: env.SITE_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin,
    ...overrides,
  };
  ctx.waitUntil(handleUpdate(update, env, deps).catch(error => console.error("update failed", error instanceof Error ? `${error.name}: ${error.message}` : String(error))));
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/telegram") return handleTelegramRequest(request, env, ctx);
    if (pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
