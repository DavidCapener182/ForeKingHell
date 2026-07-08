import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/bag/longest-shots-section.tsx"), "utf8");

describe("longest shots simulator source", () => {
  it("keeps the selected-shot flight profile chart accessible", () => {
    const flightProfileBlock =
      source.match(/function FlightProfile[\s\S]*?function SimulationMetric/)?.[0] ?? "";

    expect(flightProfileBlock).toContain('role="img"');
    expect(flightProfileBlock).toContain("flight profile chart");
    expect(flightProfileBlock).toContain("<ChartAccessibleFallback");
    expect(flightProfileBlock).toContain('title="Flight profile"');
    expect(flightProfileBlock).toContain("summary={flightProfileSummary(shot)}");
    expect(flightProfileBlock).toContain("rows={flightProfileRows(shot)}");
    expect(source).toContain("function flightProfileSummary");
    expect(source).toContain("function flightProfileRows");
    expect(source).toContain("shot.descentAngleDeg");
    expect(source).toContain("shot.ballSpeedMph");
    expect(source).toContain("shot.spinRate");
  });
});
