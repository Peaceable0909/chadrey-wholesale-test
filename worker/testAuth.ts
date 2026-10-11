import type { AdminDeps } from "./adminAuth";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./testEnv";

/** A pretend Supabase for the tests: it knows who is an administrator and which products are in quote requests. */

export const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
export const USER_ID = "22222222-2222-4222-8222-222222222222";

const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A sign-in token shaped like Supabase's (header.payload.signature). The signature is not checked here: the pretend Supabase decides. */
export const makeToken = (sub: string, expiresInSeconds = 3600, now = Date.now()) =>
  `${b64url({ alg: "ES256", typ: "JWT" })}.${b64url({ sub, exp: Math.floor(now / 1000) + expiresInSeconds, role: "authenticated" })}.signature-${Math.random().toString(36).slice(2)}`;

export type PretendSupabase = ReturnType<typeof fakeSupabase>;

export function fakeSupabase() {
  const state = {
    roles: new Map<string, string>([
      [ADMIN_ID, "admin"],
      [USER_ID, "user"],
    ]),
    /** Product ids that appear in a customer's quote request. */
    quoteProductIds: new Set<string>(),
    /** "unreachable" makes every call fail like a paused project; a number makes every call answer with that status. */
    breakWith: null as null | "unreachable" | number,
    failQuotes: false,
    rejectAllTokens: false,
    calls: [] as Array<{ url: string; headers: Record<string, string> }>,
  };

  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value]));
    state.calls.push({ url: url.href, headers });
    if (url.origin !== SUPABASE_URL) return new Response("unexpected host", { status: 502 });
    if (state.breakWith === "unreachable") throw new TypeError("fetch failed");
    if (typeof state.breakWith === "number") return reply(state.breakWith, { message: "broken" });
    if (headers.apikey !== PUBLISHABLE_KEY) return reply(401, { message: "Invalid API key" });
    const bearer = /^Bearer (.+)$/.exec(headers.authorization ?? "")?.[1];
    if (!bearer || state.rejectAllTokens) return reply(401, { code: "PGRST301", message: "JWT expired" });
    if (bearer === PUBLISHABLE_KEY) return reply(401, { message: "The publishable key must not be sent as a Bearer token" });

    if (url.pathname === "/rest/v1/profiles") {
      const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
      const role = state.roles.get(id);
      return reply(200, role ? [{ id, role }] : []);
    }
    if (url.pathname === "/rest/v1/quote_request_items") {
      if (state.failQuotes) return reply(500, { message: "boom" });
      const wanted = (url.searchParams.get("product_id") ?? "").replace(/^in\.\(/, "").replace(/\)$/, "").split(",");
      return reply(200, wanted.filter(id => state.quoteProductIds.has(id)).map(product_id => ({ product_id })));
    }
    return reply(404, { message: `no pretend route for ${url.pathname}` });
  };

  const deps: AdminDeps = { fetch: fetchImpl as typeof fetch, now: () => Date.now() };
  return { state, deps };
}
