import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const mobile = readFileSync(join(root, "src/app/mobile-apple.css"), "utf8");

describe("functional appearance modes", () => {
  it("defines Outdoor, Range Night and Tour Broadcast from the agreed palettes", () => {
    for (const theme of ["outdoor", "range-night", "tour-broadcast"]) {
      expect(globals).toContain(`html[data-theme="${theme}"]`);
      expect(mobile).toContain(`html[data-theme="${theme}"]`);
      expect(globals).toContain(`[data-theme-swatch="${theme}"]`);
    }

    expect(globals).toContain("--background: #fffdf4");
    expect(globals).toContain("--ring: #ff5a1f");
    expect(globals).toContain("--background: #050c08");
    expect(globals).toContain("--primary: #7ee0a3");
    expect(globals).toContain("--background: #f6f3ea");
    expect(globals).toContain("--chart-2: #2c93d4");
  });

  it("treats High Contrast as an accessibility mode", () => {
    expect(globals).toContain('html[data-theme="high-contrast"]');
    expect(globals).toContain("outline: 3px solid #ffff00 !important");
    expect(globals).toContain("text-decoration: underline");
    expect(globals).toContain("min-height: 44px");
    expect(globals).toContain("stroke-dasharray: 9 5");
    expect(globals).toContain("opacity: 1");
  });
});
