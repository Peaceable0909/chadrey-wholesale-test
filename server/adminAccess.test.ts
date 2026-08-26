import { describe, expect, it } from "vitest";
import { isFirebaseAdminUid, parseAdminFirebaseUids } from "./adminAccess";

describe("Firebase admin UID allowlist", () => {
  it("normalizes comma-separated UID configuration", () => {
    expect(parseAdminFirebaseUids(" first , second,, ")).toEqual(["first", "second"]);
  });

  it("matches only an exact configured UID", () => {
    const configured = parseAdminFirebaseUids("hmCLDJP0Png1x1IOGtNZxJdXjcH3,other");
    expect(isFirebaseAdminUid("hmCLDJP0Png1x1IOGtNZxJdXjcH3", configured)).toBe(true);
    expect(isFirebaseAdminUid("hmCLDJP0Png1x1IOGtNZxJdXjcH30", configured)).toBe(false);
  });
});
