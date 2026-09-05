import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileTrainingChart } from "./mobile-training-chart";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";
const point = (date: string, fitness: number) =>
  ({
    date,
    fitness,
    fatigue: 0,
    form: 100,
    readiness: 100,
    load: 0,
  }) satisfies FitnessFreshnessPoint;
describe("mobile training chart evidence", () => {
  it("uses calendar spacing and exposes exact index values for non-hover inspection", () => {
    const data = [point("2026-09-01", 10), point("2026-09-02", 20), point("2026-09-05", 0)];
    const html = renderToStaticMarkup(<MobileTrainingChart data={data} inspect />);
    expect(html).toContain('points="8,73 79,20 292,126"');
    expect(html).toContain('aria-valuetext="5 Sep, Fitness 0.0"');
    expect(html).toContain('aria-label="Training day"');
    expect(data.map((p) => p.fitness)).toEqual([10, 20, 0]);
  });
  it("does not render invalid numeric or date evidence as a trend", () => {
    const html = renderToStaticMarkup(
      <MobileTrainingChart data={[point("invalid", 10), point("2026-09-05", NaN)]} inspect />,
    );
    expect(html).toContain("More activity will establish a trend.");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("NaN");
  });
});
