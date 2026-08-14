import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/bag/longest-shots-section.tsx"), "utf8");

describe("longest shots simulator source", () => {
  it("ships the desktop PB selector, replay and evidence without a hidden fallback bundle", () => {
    expect(source).toContain('<CardHeader className="flex gap-3">');
    expect(source).toContain('className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"');
    expect(source).toContain("<ShotSimulator");
    expect(source).toContain("data-longest-shot-workbench-details");

    for (const unreachableMobileSymbol of [
      "MobileLongestShotSelector",
      "MobileShotReplayDetails",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "@/components/app/ios-mobile",
      "data-mobile-longest-selector",
      "data-mobile-replay-details",
      "recordWarning",
      "lg:hidden",
      "hidden gap-2 lg:grid",
      "hidden flex-col gap-4",
      'className="hidden lg:block"',
      'className="mt-3 hidden lg:block"',
    ]) {
      expect(source).not.toContain(unreachableMobileSymbol);
    }
  });

  it("respects reduced motion without removing the replay canvas", () => {
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain("animation: none !important");
    expect(source).toContain("stroke-dashoffset: 0");
    expect(source).toContain('aria-label="Top-down longest-shot distance simulation"');
  });

  it("keeps the selected-shot flight profile chart accessible", () => {
    const flightProfileBlock =
      source.match(/function FlightProfile[\s\S]*?function SimulationMetric/)?.[0] ?? "";

    expect(flightProfileBlock).toContain('role="img"');
    expect(flightProfileBlock).toContain("flight profile chart");
    expect(flightProfileBlock).toContain("<ChartAccessibleFallback");
    expect(flightProfileBlock).toContain('title="Flight profile"');
    expect(flightProfileBlock).toContain("summary={flightProfileSummary(shot, preferredUnits)}");
    expect(flightProfileBlock).toContain("rows={flightProfileRows(shot, preferredUnits)}");
    expect(source).toContain("function flightProfileSummary");
    expect(source).toContain("function flightProfileRows");
    expect(source).toContain("shot.descentAngleDeg");
    expect(source).toContain("shot.ballSpeedMph");
    expect(source).toContain("shot.spinRate");
  });

  it("uses shadcn semantic selector and record-quality notices", () => {
    const selector =
      source.match(/function LongestShotButton[\s\S]*?function ShotSimulator/)?.[0] ?? "";

    expect(selector).toContain("<Button");
    expect(selector).not.toMatch(/<button\b/);
    expect(selector).toContain("aria-pressed:border-primary");
    expect(selector).not.toContain("emerald-");
    expect(selector).not.toContain("#e5e7eb");
    expect(source).toContain("<AlertTitle>Raw maximum only</AlertTitle>");
    expect(source).toContain("<AlertTitle>Higher raw maximum excluded</AlertTitle>");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-information-surface)");
    expect(source).not.toContain("bg-amber-50");
    expect(source).not.toContain("bg-sky-50");
  });
});
