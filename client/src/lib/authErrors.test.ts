import { describe, expect, it } from "vitest";
import { formatAuthError } from "./authErrors";

describe("formatAuthError", () => {
  it("maps invalid Supabase credentials to a safe message", () => {
    expect(formatAuthError(new Error("Invalid login credentials"))).toBe("The email or password is incorrect.");
  });

  it("returns a safe fallback for unknown failures", () => {
    expect(formatAuthError({ reason: "offline" })).toBe("Authentication could not be completed. Please try again.");
  });
});
