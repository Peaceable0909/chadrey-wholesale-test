import { describe, expect, it } from "vitest";
import { safeNextPath } from "./authRedirect";

describe("safeNextPath", () => {
  it("allows same-site paths, including their query strings", () => {
    expect(safeNextPath("?next=/quote")).toBe("/quote");
    expect(safeNextPath("?next=%2Fquote%3Fproduct%3Dtee%26qty%3D50")).toBe("/quote?product=tee&qty=50");
  });

  it("returns null when there is no next parameter", () => {
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("?other=1")).toBeNull();
  });

  it("rejects absolute URLs and protocol-relative URLs", () => {
    expect(safeNextPath("?next=https://evil.example")).toBeNull();
    expect(safeNextPath("?next=//evil.example")).toBeNull();
    expect(safeNextPath("?next=javascript:alert(1)")).toBeNull();
  });

  it("rejects backslash and control-character tricks", () => {
    expect(safeNextPath("?next=/\\evil.example")).toBeNull();
    expect(safeNextPath("?next=/%09/evil.example")).toBeNull();
    expect(safeNextPath("?next=/%0A/evil.example")).toBeNull();
  });
});
