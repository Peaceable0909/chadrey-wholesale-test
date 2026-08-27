import { describe, expect, it } from "vitest";
import { dashboardPathForRole } from "./userProfile";

describe("dashboardPathForRole", () => {
  it("routes administrators to the operations portal", () => {
    expect(dashboardPathForRole("admin")).toBe("/admin");
  });

  it("routes regular users to the customer workspace", () => {
    expect(dashboardPathForRole("user")).toBe("/dashboard");
  });
});
