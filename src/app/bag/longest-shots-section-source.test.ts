import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/bag/longest-shots-section.tsx"), "utf8");

describe("longest shots simulator source", () => {
  it("keeps the replay first on phones with a 44px selector and one disclosure level", () => {
    const selector = source.indexOf("<MobileLongestShotSelector");
    const simulator = source.indexOf("<ShotSimulator", selector);

    expect(source).toContain("data-mobile-longest-selector");
    expect(source).toContain('aria-label="Choose a club record to replay"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("data-mobile-record-warning");
    expect(source).toContain("<MobileShotReplayDetails");
    expect(source).toContain("data-mobile-replay-details");
    expect(source).toContain('label="Longest shot replay details"');
    expect(source).toContain('title: "Flight profile"');
    expect(source).toContain('title: "Shot metrics"');
    expect(source).toContain('title: "Record evidence"');
    expect(selector).toBeGreaterThan(-1);
    expect(simulator).toBeGreaterThan(selector);
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
});
