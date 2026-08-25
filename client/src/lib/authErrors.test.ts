import { describe, expect, it } from "vitest";
import { formatFirebaseAuthError } from "./authErrors";

describe("formatFirebaseAuthError", () => {
  it("removes Firebase prefixes and technical error codes", () => {
    expect(formatFirebaseAuthError(new Error("Firebase: Error (auth/popup-closed-by-user)."))).toBe("Error");
  });

  it("returns a safe fallback for unknown failures", () => {
    expect(formatFirebaseAuthError({ reason: "offline" })).toBe("Unable to authenticate.");
  });
});
