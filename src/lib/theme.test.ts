import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("keeps explicit light, dark and clubhouse preferences", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("clubhouse", true)).toBe("clubhouse");
    expect(resolveTheme("clubhouse", false)).toBe("clubhouse");
  });

  it("follows the colour scheme only for system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
