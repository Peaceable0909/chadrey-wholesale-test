import { describe, expect, it } from "vitest";
import { getBearerToken } from "./firebaseAdmin";

describe("Firebase Admin request authentication", () => {
  it("extracts a bearer token from the Authorization header", () => {
    expect(
      getBearerToken({ headers: { authorization: "Bearer firebase-token" } })
    ).toBe("firebase-token");
  });

  it("rejects missing, malformed, and empty authorization headers", () => {
    expect(getBearerToken({ headers: {} })).toBeNull();
    expect(
      getBearerToken({ headers: { authorization: "Basic credentials" } })
    ).toBeNull();
    expect(getBearerToken({ headers: { authorization: "Bearer   " } })).toBeNull();
  });
});
