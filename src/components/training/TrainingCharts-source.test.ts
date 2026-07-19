import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const barsSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingLoadBars.tsx"),
  "utf8",
);
const overTimeSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingOverTimeChart.tsx"),
  "utf8",
);

describe("training chart accessibility source", () => {
  it("adds a visible summary and fallback table to the load bars chart", () => {
    expect(barsSource).toContain("import { ChartAccessibleFallback }");
    expect(barsSource).toContain('title="Training load bars"');
    expect(barsSource).toContain("trainingLoadBarsSummary(data)");
    expect(barsSource).toContain("data.slice(-12).map");
    expect(barsSource).toContain('{ key: "load", label: "Load" }');
    expect(barsSource).toContain('{ key: "readiness", label: "Readiness" }');
    expect(barsSource).toContain('clubhouse: "#123A29"');
    expect(barsSource).toContain("var(--training-load-active, #087A3D)");
  });

  it("adds a visible summary and fallback table to the training-over-time line chart", () => {
    expect(overTimeSource).toContain("import { ChartAccessibleFallback }");
    expect(overTimeSource).toContain('title="Training over time"');
    expect(overTimeSource).toContain("trainingOverTimeSummary(chartData, sessionMarkers.length)");
    expect(overTimeSource).toContain("chartData.slice(-12).map");
    expect(overTimeSource).toContain("sessionQuality");
    expect(overTimeSource).toContain('dataKey="sessionQuality"');
    expect(overTimeSource).toContain("connectNulls");
    expect(overTimeSource).toContain('{ key: "form", label: "Golf form" }');
    expect(overTimeSource).toContain('{ key: "sessionQuality", label: "Session quality" }');
    expect(overTimeSource).toContain('{ key: "fitness", label: "Fitness" }');
    expect(overTimeSource).toContain('{ key: "fatigue", label: "Recent load" }');
    expect(overTimeSource).toContain('clubhouse: "#1555D6"');
    expect(overTimeSource).toContain('clubhouse: "#75342E"');
  });
});
