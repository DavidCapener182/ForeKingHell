import { describe, expect, it } from "vitest";

import { calculateGolfForm, calculateReadiness } from "@/lib/training/fitnessFreshness";
import { getTrainingStatus, getTrainingTrend } from "@/lib/training/trainingStatus";

describe("golf training status", () => {
  it("classifies form bands", () => {
    expect(getTrainingStatus(80, 50, 121).label).toBe("Peak Form");
    expect(getTrainingStatus(80, 50, 112).label).toBe("Very good");
    expect(getTrainingStatus(80, 65, 106).label).toBe("Good");
    expect(getTrainingStatus(80, 100, 93).label).toBe("Below baseline");
    expect(getTrainingStatus(80, 120, 86).label).toBe("Poor form");
  });

  it("uses golf-adjusted form by default", () => {
    expect(getTrainingStatus(100, 118).label).toBe("Good");
  });

  it("labels form improving over time", () => {
    expect(
      getTrainingTrend([
        point("2026-06-01", 0, 100, 20, 100),
        point("2026-06-08", 0, 100, 20, 104),
      ]),
    ).toMatchObject({
      key: "form_improving",
      label: "Golf Form improving",
    });
  });

  it("labels recent load spikes and overloaded states", () => {
    expect(
      getTrainingTrend([
        point("2026-06-01", 0, 100, 91),
        point("2026-06-02", 0, 100, 90),
        point("2026-06-03", 180, 100, 90),
      ]),
    ).toMatchObject({
      key: "acute_load_spike",
      label: "Recent Load spike",
    });

    expect(
      getTrainingTrend([point("2026-06-01", 0, 100, 180), point("2026-06-02", 0, 100, 190)]),
    ).toMatchObject({
      key: "overloaded",
      label: "Load watch",
    });
  });
});

function point(date: string, load: number, fitness: number, fatigue: number, form?: number) {
  return {
    date,
    load,
    fitness,
    fatigue,
    readiness: calculateReadiness(fatigue),
    form: form ?? calculateGolfForm(fitness, fatigue),
  };
}
