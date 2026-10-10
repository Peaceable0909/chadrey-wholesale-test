/**
 * Reads ?next= from a query string and only allows same-site paths, so a crafted link
 * (for example `?next=//evil.example` or `?next=https://evil.example`) can never send someone elsewhere.
 */
export function safeNextPath(search: string): string | null {
  const next = new URLSearchParams(search).get("next");
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  // Reject control characters that browsers strip before parsing, e.g. "/\t/evil.example".
  if (/[\u0000-\u001f]/.test(next)) return null;
  return next;
}
