import { describe, expect, it } from "vitest";

describe("Supabase configuration", () => {
  it("accepts the configured public key for a read-only profiles request", async () => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase environment variables are not configured.");

    const response = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
  }, 15_000);
});
