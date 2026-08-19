import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpeedFatigueChart, type SpeedFatigueReading } from "./speed-fatigue-chart";

const source = readFileSync(
  join(process.cwd(), "src/components/speed/speed-fatigue-chart.tsx"),
  "utf8",
);

const baseline: SpeedFatigueReading[] = [
  { swingNumber: 1, clubSpeedMph: 91.2 },
  { swingNumber: 2, clubSpeedMph: 92 },
  { swingNumber: 3, clubSpeedMph: 93.1 },
  { swingNumber: 4, clubSpeedMph: 92.8 },
];

describe("speed fatigue chart source", () => {
  it("delegates the fatigue decision to the shared pure model", () => {
    expect(source).toContain("analyseSpeedFatigueSwings,");
    expect(source).toContain("analyseSpeedFatigueSwings(orderedReadings)");
    expect(source).toContain("analysis.stopRecommended");
    expect(source).not.toContain("0.96");
  });

  it("provides a labelled chart and an accessible textual data table", () => {
    expect(source).toContain("ChartAccessibleFallback");
    expect(source).toContain('role="img"');
    expect(source).toContain('aria-label="Speed fatigue chart legend"');
    expect(source).toContain('title="Speed fatigue"');
    expect(source).toContain('{ key: "threshold", label: "96% line" }');
    expect(source).toContain("orderedReadings.map");
  });
});

describe("speed fatigue chart decision", () => {
  it("does not issue the stop advisory after only one reading crosses the line", () => {
    const markup = renderToStaticMarkup(
      <SpeedFatigueChart
        readings={[
          ...baseline,
          { swingNumber: 5, clubSpeedMph: 89.2 },
          { swingNumber: 6, clubSpeedMph: 91 },
        ]}
      />,
    );

    expect(markup).toContain('data-fatigue-advisory="continue"');
    expect(markup).toContain("No two-swing fatigue trigger");
    expect(markup).toContain("89.4 mph");
    expect(markup).not.toContain("End maximum-speed work");
  });

  it("issues the advisory only after two consecutive readings cross the line", () => {
    const markup = renderToStaticMarkup(
      <SpeedFatigueChart
        readings={[
          ...baseline,
          { swingNumber: 5, clubSpeedMph: 89.2 },
          { swingNumber: 6, clubSpeedMph: 89.1 },
        ]}
      />,
    );

    expect(markup).toContain('data-fatigue-advisory="stop"');
    expect(markup).toContain("End maximum-speed work");
    expect(markup).toContain("after swing 6");
    expect(markup).toContain("Two consecutive swings crossed the fatigue line");
    expect(markup).toContain("View Speed fatigue chart data table");
  });

  it("labels missing individual readings instead of inventing fatigue evidence", () => {
    const markup = renderToStaticMarkup(<SpeedFatigueChart readings={[]} />);

    expect(markup).toContain('data-fatigue-advisory="continue"');
    expect(markup).toContain("Individual swing readings are required");
    expect(markup).toContain("cannot be measured");
    expect(markup).not.toContain("End maximum-speed work");
  });
});
