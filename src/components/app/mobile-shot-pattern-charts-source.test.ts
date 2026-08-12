import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/mobile-shot-pattern-charts.tsx"),
  "utf8",
);

describe("mobile shot-pattern chart surface", () => {
  it("provides club, trust, dispersion and individual-versus-average flight controls", () => {
    expect(source).toContain('label="Shot pattern view"');
    expect(source).toContain('aria-label="Chart club"');
    expect(source).toContain("All clubs");
    expect(source).toContain("Trusted shots");
    expect(source).toContain("All shots");
    expect(source).toContain("Individual shots");
    expect(source).toContain("Club average");
  });

  it("keeps axes, median, summary and accessible rows explicit", () => {
    for (const label of [
      "Left",
      "Right",
      "Target line",
      "Median landing point",
      "Central 10–90% region",
    ]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("10th-to-90th-percentile carry and lateral region");
    expect(source).toContain("-side miss reaches");
    expect(source).toContain('role="img"');
    expect(source).toContain("Accessible shot data");
    expect(source).toContain("deterministicShotSample");
    expect(source).not.toContain("slice(0, 40)");
    expect(source).not.toContain("slice(0, 12)");
  });
});
