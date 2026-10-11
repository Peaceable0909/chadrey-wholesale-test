import { getSupabaseClient } from "@/lib/supabase";

/**
 * How the website talks to the shop's data service (the Cloudflare Worker in worker/api.ts).
 * Everything shoppers see is open to anyone. Anything that changes the shop carries the signed-in person's
 * Supabase session, and the service checks it again on its side.
 */

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the service could not be reached at all. */
    readonly status: number,
    message: string,
    /** A short stable word from the service, for example "in_quote" or "slug_taken". */
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A product that is part of a customer's quote request cannot be deleted. */
export const isStillReferencedError = (error: unknown): boolean => error instanceof ApiError && error.code === "in_quote";

type Options = {
  method?: string;
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as is, for example a photo file. */
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Attach the signed-in person's session. Required for anything that changes the shop. */
  admin?: boolean;
  /** Give up after this long. */
  timeoutMs?: number;
};

const PROBLEM_BY_STATUS: Record<number, string> = {
  401: "Please sign in again.",
  403: "Only shop administrators can do that.",
  404: "That was not found.",
  413: "That is too large.",
  429: "Too many requests. Please wait a moment and try again.",
};

async function sessionToken(refresh: boolean): Promise<string | null> {
  const auth = getSupabaseClient().auth;
  if (refresh) {
    const { data } = await auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(path: string, options: Options, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json", ...options.headers };
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.json !== undefined) headers["content-type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    return await fetch(path, { method: options.method ?? "GET", headers, body: options.json !== undefined ? JSON.stringify(options.json) : options.body, signal: controller.signal });
  } catch {
    throw new ApiError(0, "Couldn't reach the shop. Check your connection and try again.", "offline");
  } finally {
    clearTimeout(timer);
  }
}

async function request(path: string, options: Options): Promise<Response> {
  let token: string | null = null;
  if (options.admin) {
    token = await sessionToken(false);
    if (!token) throw new ApiError(401, "Please sign in again.", "sign_in");
  }
  let response = await send(path, options, token);
  if (response.status === 401 && options.admin) {
    // The session may have run out a moment ago: get a fresh one and try once more.
    const fresh = await sessionToken(true).catch(() => null);
    if (fresh) response = await send(path, options, fresh);
  }
  return response;
}

async function read<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // An address nobody answers falls through to the website's own page, which is HTML, not data.
    throw new ApiError(502, "The shop's data service did not answer properly. Please try again in a minute.", "bad_response");
  }
  if (!response.ok) {
    const body = (data && typeof data === "object" ? data : {}) as { error?: unknown; code?: unknown };
    throw new ApiError(response.status, typeof body.error === "string" && body.error ? body.error : (PROBLEM_BY_STATUS[response.status] ?? "Something went wrong. Please try again."), typeof body.code === "string" ? body.code : undefined);
  }
  return data as T;
}

export async function shopFetch<T>(path: string, options: Options = {}): Promise<T> {
  return read<T>(await request(path, options));
}

/** Like shopFetch, but "not found" is an answer (null), not a failure. */
export async function shopFetchOrNull<T>(path: string, options: Options = {}): Promise<T | null> {
  const response = await request(path, options);
  if (response.status === 404) return null;
  return read<T>(response);
}

/** Query-string text for a list of values that may be empty. */
export const listParam = (values: string[]) => values.map(encodeURIComponent).join(",");
