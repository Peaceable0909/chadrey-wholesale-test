type DatabaseError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/**
 * True when a query failed only because a column does not exist yet. The pricing columns are added by
 * `supabase_product_pricing.sql`, and the storefront must keep working before that migration is run.
 *
 * Postgres reports 42703 ("column does not exist"); PostgREST reports PGRST204 / PGRST200 style
 * "Could not find the 'x' column ... in the schema cache" for writes.
 */
export function isMissingColumnError(error: DatabaseError | null | undefined, column?: string): boolean {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  const missing =
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist/i.test(message) ||
    /could not find the .* column/i.test(message);
  if (!missing) return false;
  return column ? message.includes(column) : true;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message || fallback;
  }
  return fallback;
}

/** Columns added by supabase_product_pricing.sql. */
export const PRICING_COLUMNS = ["price_currency", "price_unit", "price_tiers"] as const;
