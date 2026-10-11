import { HttpError, UUID } from "./http";
import type { Env } from "./types";

/*
 * Sign-in still lives in Supabase for now. The website sends the signed-in person's session with every change they
 * make, and the Worker asks Supabase one question with it: "which role does this person have?". Supabase checks that
 * the session is genuine before it answers, so the Worker never has to hold a secret key to do this.
 */

export type AdminDeps = {
  fetch: typeof fetch;
  now: () => number;
};

export const realDeps: AdminDeps = { fetch: (input, init) => fetch(input, init), now: () => Date.now() };

export type Admin = { userId: string; token: string };

const REMEMBER_MS = 60_000;
const remembered = new Map<string, { userId: string; until: number }>();

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");

function readPayload(token: string): { sub?: unknown; exp?: unknown } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), char => char.charCodeAt(0)))) as { sub?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

const SIGN_IN_AGAIN = "Please sign in again.";

function supabaseSettings(env: Env): { base: string; key: string } {
  const base = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!base || !key) throw new HttpError(503, "Sign-in checks are not set up on the server yet (SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY).", "auth_not_configured");
  return { base, key };
}

/** Asks Supabase and returns its JSON answer, turning "cannot reach it" into a message that says what to do. */
async function askSupabase(deps: AdminDeps, url: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await deps.fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(
      503,
      "I couldn't reach the sign-in service (Supabase). If the project is paused, open the Supabase dashboard and press Restore. Otherwise try again in a minute.",
      "auth_unreachable",
    );
  }
  const raw = await response.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }
  return { status: response.status, body };
}

/** Lets the request through only when it carries the session of a signed-in administrator. */
export async function requireAdmin(request: Request, env: Env, deps: AdminDeps = realDeps): Promise<Admin> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new HttpError(401, SIGN_IN_AGAIN, "sign_in");

  const payload = readPayload(token);
  const subject = typeof payload?.sub === "string" ? payload.sub : "";
  if (!UUID.test(subject)) throw new HttpError(401, SIGN_IN_AGAIN, "sign_in");
  if (typeof payload?.exp === "number" && payload.exp * 1000 <= deps.now()) throw new HttpError(401, "Your session has run out. Please sign in again.", "sign_in");

  const fingerprint = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const known = remembered.get(fingerprint);
  if (known && known.until > deps.now()) return { userId: known.userId, token };

  const { base, key } = supabaseSettings(env);
  // Only the caller's own profile is asked for. Supabase's own rules decide what that session may read.
  const { status, body } = await askSupabase(deps, `${base}/rest/v1/profiles?select=id,role&id=eq.${subject.toLowerCase()}&limit=1`, { apikey: key, authorization: `Bearer ${token}` });
  if (status === 401 || status === 403) throw new HttpError(401, SIGN_IN_AGAIN, "sign_in");
  if (status >= 500) throw new HttpError(503, "The sign-in service (Supabase) is having trouble. Please try again in a minute.", "auth_unreachable");
  if (status !== 200 || !Array.isArray(body)) throw new HttpError(502, "The sign-in service gave an answer I didn't understand. Please try again.", "auth_unexpected");

  const row = body[0] as { id?: unknown; role?: unknown } | undefined;
  if (!row || String(row.id).toLowerCase() !== subject.toLowerCase()) throw new HttpError(403, "This account has no profile, so it cannot change the shop.", "not_admin");
  if (row.role !== "admin") throw new HttpError(403, "Only shop administrators can change the shop.", "not_admin");

  remembered.set(fingerprint, { userId: subject.toLowerCase(), until: deps.now() + REMEMBER_MS });
  if (remembered.size > 200) for (const [name, entry] of remembered) if (entry.until <= deps.now()) remembered.delete(name);
  return { userId: subject.toLowerCase(), token };
}

/** Forgets every remembered sign-in. Used by the tests. */
export const forgetAdmins = () => remembered.clear();

/**
 * Which of these products are part of a customer's quote request? Those must not be deleted.
 * Quote requests still live in Supabase, so it is asked with the administrator's own session.
 * If it cannot be answered, nothing is deleted: guessing "none" could break a customer's quote.
 */
export async function productsInQuotes(env: Env, admin: Admin, ids: string[], deps: AdminDeps = realDeps): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { base, key } = supabaseSettings(env);
  const safe = ids.filter(id => UUID.test(id));
  const found = new Set<string>();
  for (let index = 0; index < safe.length; index += 80) {
    const part = safe.slice(index, index + 80);
    const { status, body } = await askSupabase(deps, `${base}/rest/v1/quote_request_items?select=product_id&product_id=in.(${part.join(",")})`, { apikey: key, authorization: `Bearer ${admin.token}` });
    if (status !== 200 || !Array.isArray(body)) {
      throw new HttpError(502, "I couldn't check whether these products are part of a quote request, so nothing was deleted. Please try again in a minute.", "quote_check_failed");
    }
    for (const row of body as Array<{ product_id?: unknown }>) if (typeof row.product_id === "string") found.add(row.product_id.toLowerCase());
  }
  return found;
}
