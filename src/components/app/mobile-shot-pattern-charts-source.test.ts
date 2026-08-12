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

  it("uses the desktop chart engine while keeping summary and accessible rows explicit", () => {
    expect(source).toContain('import("@/app/today/today-shot-charts")');
    expect(source).toContain("module.SharedShotPatternVisual");
    expect(source).toContain('mode="dispersion"');
    expect(source).toContain('mode="trajectory"');
    expect(source).toContain("-side miss reaches");
    expect(source).toContain("Accessible shot data");
    expect(source).not.toContain("function DispersionChart");
    expect(source).not.toContain("function FlightChart");
    expect(source).not.toContain("slice(0, 40)");
    expect(source).not.toContain("slice(0, 12)");
  });
});
