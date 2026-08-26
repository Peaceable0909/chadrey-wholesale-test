import { describe, expect, it } from "vitest";

const endpoint = process.env.VITE_API_URL;

describe("configured API endpoint", () => {
  it("responds to the public auth profile procedure", async () => {
    expect(endpoint).toBeTruthy();
    const response = await fetch(`${endpoint}/api/trpc/auth.me`);
    expect(response.ok).toBe(true);
    const payload = await response.json() as { result?: { data?: { json?: unknown } } };
    expect(payload.result?.data).toBeDefined();
  }, 15_000);
});
