import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/mobile-shot-pattern-charts.tsx"),
  "utf8",
);

describe("mobile shot-pattern chart surface", () => {
  it("provides club, trust, dispersion and individual-versus-average flight controls", () => {
    expect(source).toContain('ariaLabel="Shot pattern view"');
    expect(source).toContain('ariaLabel="Chart club"');
    expect(source).toContain("All clubs");
    expect(source).toContain('{ value: "trusted", label: "Trusted" }');
    expect(source).toContain("All shots");
    expect(source).toContain("Individual shots");
    expect(source).toContain("Club average");
  });

  it("can make a compact day summary open on every club without changing session reviews", () => {
    expect(source).toContain("defaultToAllClubs = false");
    expect(source).toContain('defaultToAllClubs && clubs.length > 1 ? "all"');
    expect(source).toContain("(!compact || defaultToAllClubs)");
  });

  it("keeps the desktop engine and gives mobile purpose-built chart geometry", () => {
    expect(source).toContain('import("@/app/today/today-shot-charts")');
    expect(source).toContain("module.SharedShotPatternVisual");
    expect(source).toContain('layout?: "mobile" | "desktop"');
    expect(source).toContain("data-mobile-dispersion-layout");
    expect(source).toContain("data-mobile-flight-layout");
    expect(source).toContain('mode="dispersion"');
    expect(source).toContain('mode="flight"');
    expect(source).toContain("target line");
    expect(source).toContain("Trusted zone");
    expect(source).toContain("M median");
    expect(source).toContain("compact ? 220 : 420");
    expect(source).not.toContain('compact && "max-h-52"');
  });

  it("derives mobile SVG colours from semantic theme tokens", () => {
    expect(source).toContain("--mobile-chart-surface");
    expect(source).toContain("--mobile-chart-grid");
    expect(source).toContain("--mobile-chart-series-");
    expect(source).not.toContain('fill="#f8fafc"');
    expect(source).not.toContain('stroke="#cbd5e1"');
  });

  it("keeps summary, accessible desktop rows and tappable mobile shot detail explicit", () => {
    expect(source).toContain('mode="dispersion"');
    expect(source).toContain('mode="trajectory"');
    expect(source).toContain("Typical miss reaches");
    expect(source).toContain("Accessible shot data");
    expect(source).toContain("<Table");
    expect(source).toContain("data-shot-detail-drawer");
    expect(source).toContain("<Drawer");
    expect(source).toContain('role="button"');
    expect(source).not.toContain("ios-grouped-list");
    expect(source).not.toContain("function DispersionChart");
    expect(source).not.toContain("function FlightChart");
    expect(source).not.toContain("slice(0, 40)");
    expect(source).not.toContain("slice(0, 12)");
  });
});
