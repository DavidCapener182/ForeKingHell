import { describe, expect, it } from "vitest";

import { analysisConfidence, confidenceDisplayLabel } from "@/lib/analysis-confidence";

describe("analysisConfidence", () => {
  it("labels a small one-session sample as an early signal", () => {
    expect(
      analysisConfidence({
        sampleSize: 5,
        sessionCount: 1,
        recencyDays: 2,
        outlierRate: 0,
        metricCompleteness: 0.5,
        coefficientOfVariation: 0.3,
        crossSessionConsistency: null,
      }).label,
    ).toBe("early");
  });

  it("requires broad, recent, multi-session evidence for strong evidence", () => {
    const result = analysisConfidence({
      sampleSize: 180,
      sessionCount: 8,
      recencyDays: 5,
      outlierRate: 0.03,
      metricCompleteness: 0.95,
      coefficientOfVariation: 0.07,
      crossSessionConsistency: 0.9,
    });
    expect(result.label).toBe("strong");
    expect(confidenceDisplayLabel(result.label)).toBe("Strong evidence");
    expect(result.components.every((component) => component.assessment === "healthy")).toBe(true);
  });
});
