import { describe, expect, it } from "vitest";

import {
  buildAnalysisSnapshot,
  buildDataQualityIssues,
  validateAnalysisAnnotation,
} from "@/lib/analysis-workspace";

describe("analysis workspace", () => {
  it("prioritises direct data-quality fixes", () => {
    const issues = buildDataQualityIssues({
      unmappedClubs: 2,
      duplicateImports: 1,
      suspiciousDistances: 3,
      likelyUnitMismatch: false,
      incompleteScorecards: 1,
      missingRatingRounds: 2,
      lowSampleClubs: 4,
      unclassifiedSessions: 1,
      staleStockYardages: 2,
      failedProviderSyncs: 1,
      failedOfflineActions: 1,
    });

    expect(issues[0]?.severity).toBe("high");
    expect(issues.map((issue) => issue.action)).toContain("Map clubs");
    expect(issues.map((issue) => issue.action)).toContain("Review provider");
    expect(issues.map((issue) => issue.action)).toContain("Review action");
    expect(issues.every((issue) => issue.href.startsWith("/"))).toBe(true);
  });

  it("validates typed annotations and date ranges", () => {
    expect(
      validateAnalysisAnnotation({
        annotationType: "lesson",
        title: "  Start-line lesson  ",
        body: "  Keep the face quieter.  ",
        rangeFrom: new Date("2026-07-01T00:00:00Z"),
        rangeTo: new Date("2026-07-02T00:00:00Z"),
      }),
    ).toMatchObject({ title: "Start-line lesson", body: "Keep the face quieter." });

    expect(() =>
      validateAnalysisAnnotation({
        annotationType: "unknown",
        title: "Test",
        body: "Test",
      }),
    ).toThrow("supported annotation type");
  });

  it("captures an immutable point-in-time snapshot payload", () => {
    const filters = { club: "7i", from: "2026-06-01", to: "2026-07-01" };
    const snapshot = buildAnalysisSnapshot({
      name: "June 7i review",
      filters,
      chartState: { view: "dispersion" },
      selectedMetrics: ["carry", "offline", "carry"],
      summary: { shots: 42, carryMedianYd: 141.2 },
      capturedAt: new Date("2026-07-02T12:00:00Z"),
    });
    filters.club = "driver";

    expect(snapshot.filtersJson).toEqual({
      club: "7i",
      from: "2026-06-01",
      to: "2026-07-01",
    });
    expect(snapshot.selectedMetricsJson).toEqual(["carry", "offline"]);
    expect(snapshot.capturedAt.toISOString()).toBe("2026-07-02T12:00:00.000Z");
  });
});
