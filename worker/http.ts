/** Small helpers shared by the Worker's web addresses. */

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

/** A problem to report to the person using the website, with a message they can act on. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** A short stable word the website can react to, for example "slug_taken". */
    readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const describe = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

/** Turns anything that went wrong into a reply. Details go to the log, never to the visitor. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status);
  const message = error instanceof Error ? error.message : String(error);
  if (/exceeded D1's free tier daily/i.test(message)) {
    return json(
      {
        error: "The shop's database has used up today's free allowance. It starts again at midnight UTC. The $5/month Cloudflare Workers plan removes the limit.",
        code: "daily_limit",
      },
      503,
    );
  }
  console.error("request failed", describe(error));
  return json({ error: "Something went wrong on our side. Please try again in a minute." }, 500);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
