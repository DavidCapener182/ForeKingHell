import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("keeps every explicit appearance preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("clubhouse", true)).toBe("clubhouse");
    expect(resolveTheme("clubhouse", false)).toBe("clubhouse");
    expect(resolveTheme("outdoor", true)).toBe("outdoor");
    expect(resolveTheme("range-night", false)).toBe("range-night");
    expect(resolveTheme("tour-broadcast", true)).toBe("tour-broadcast");
    expect(resolveTheme("high-contrast", false)).toBe("high-contrast");
  });

  it("follows the colour scheme only for system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
