import { describe, expect, it } from "vitest";

import { parseAppSurface, resolveAppSurface } from "@/lib/app-surface";

describe("application surface resolution", () => {
  it("honours an explicit stored choice before device defaults", () => {
    expect(resolveAppSurface({ storedPreference: "workbench", deviceType: "mobile" })).toBe(
      "workbench",
    );
    expect(resolveAppSurface({ storedPreference: "companion", deviceType: "tablet" })).toBe(
      "companion",
    );
  });

  it("defaults phones to companion and tablets or desktops to workbench", () => {
    expect(resolveAppSurface({ deviceType: "mobile" })).toBe("companion");
    expect(resolveAppSurface({ deviceType: "tablet" })).toBe("workbench");
    expect(resolveAppSurface({ deviceType: undefined })).toBe("workbench");
  });

  it("rejects unknown stored values", () => {
    expect(parseAppSurface("mobile")).toBeNull();
    expect(parseAppSurface(null)).toBeNull();
  });
});
