import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "tests/e2e/visual-regression.spec.ts"), "utf8");

describe("visual regression coverage", () => {
  it("covers the six core companion destinations", () => {
    for (const route of ["today", "practice", "bag", "sessions", "play", "import"]) {
      expect(source).toContain(`name: "${route}"`);
    }
  });

  it("covers phone, landscape, tablet and desktop canvases", () => {
    for (const viewport of [
      "phone-320x568",
      "phone-390x844",
      "phone-430x932",
      "phone-landscape-844x390",
      "tablet-744x1133",
      "desktop-1440x900",
    ]) {
      expect(source).toContain(`name: "${viewport}"`);
    }
  });

  it("captures light, dark and Range Night baselines", () => {
    expect(source).toContain('["light", "dark", "range-night"]');
    expect(source).toContain("toHaveScreenshot");
  });
});
