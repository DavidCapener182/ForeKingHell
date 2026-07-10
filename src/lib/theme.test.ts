import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("keeps explicit light and dark preferences", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the colour scheme only for system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
