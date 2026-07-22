import { describe, expect, it } from "vitest";

import {
  parseDashboardPins,
  parsePreferredUnits,
  parsePrivacySettings,
  parseTableDensity,
  parseTheme,
} from "@/lib/user-settings";

describe("user settings parsing", () => {
  it("normalizes select values to safe defaults", () => {
    expect(parsePreferredUnits("metres")).toBe("metres");
    expect(parsePreferredUnits("feet")).toBe("yards");
    expect(parseTableDensity("compact")).toBe("compact");
    expect(parseTableDensity("dense")).toBe("comfortable");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("clubhouse")).toBe("clubhouse");
    expect(parseTheme("outdoor")).toBe("outdoor");
    expect(parseTheme("range-night")).toBe("range-night");
    expect(parseTheme("tour-broadcast")).toBe("tour-broadcast");
    expect(parseTheme("high-contrast")).toBe("high-contrast");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("sunlight")).toBe("system");
  });

  it("filters dashboard pins to known values", () => {
    expect(parseDashboardPins(["shots", "rounds", "admin"])).toEqual(["shots", "rounds"]);
  });

  it("parses privacy toggles from form data", () => {
    const formData = new FormData();
    formData.set("allowCoachAccess", "on");
    formData.set("publicProfile", "on");

    expect(parsePrivacySettings(formData)).toEqual({
      allowCoachAccess: true,
      allowLeaderboard: false,
      publicProfile: true,
    });
  });
});
