import { describe, expect, it } from "vitest";

import { buildCoachReportSnapshot, parseCoachReportSections } from "@/lib/coach-report";
import { buildCoachSummary } from "@/lib/coach";

describe("coach report snapshots", () => {
  it("includes only explicitly selected sections", () => {
    const snapshot = buildCoachReportSnapshot({
      generatedAt: new Date("2026-07-21T12:00:00Z"),
      selectedSections: ["goals", "key_trends"],
      seasonPlan: {
        outcome: "Break 80",
        targetDate: "2026-09-01",
        focus: "Approach play",
        weeklySessions: 2,
        successMeasure: "Two measured sessions each week",
      },
      coach: buildCoachSummary([]),
      recentSessions: [],
      practiceAdherence: {
        lookbackDays: 28,
        targetSessions: 8,
        plannedSessions: 4,
        completedSessions: 3,
        completionRate: 75,
        measuredSessions: 3,
      },
      savedComparisons: [],
      notes: [{ date: "2026-07-20", source: "session", text: "Private note" }],
      rawEvidence: [],
    });

    expect(snapshot.sections.goals?.outcome).toBe("Break 80");
    expect(snapshot.sections.keyTrends).toEqual([]);
    expect(snapshot.sections.notes).toBeUndefined();
    expect(snapshot.sections.practiceAdherence).toBeUndefined();
    expect(snapshot.disclosure.omittedSections).toContain("raw_evidence");
  });

  it("rejects unknown section names and de-duplicates valid selections", () => {
    expect(parseCoachReportSections(["goals", "unknown", "goals", "raw_evidence"])).toEqual([
      "goals",
      "raw_evidence",
    ]);
  });

  it("freezes only explicitly selected saved comparisons", () => {
    const snapshot = buildCoachReportSnapshot({
      generatedAt: new Date("2026-07-21T12:00:00Z"),
      selectedSections: ["saved_comparisons"],
      seasonPlan: {
        outcome: "Break 80",
        targetDate: "2026-09-01",
        focus: "Approach play",
        weeklySessions: 2,
        successMeasure: "Two measured sessions each week",
      },
      coach: buildCoachSummary([]),
      recentSessions: [],
      practiceAdherence: {
        lookbackDays: 28,
        targetSessions: 8,
        plannedSessions: 0,
        completedSessions: 0,
        completionRate: null,
        measuredSessions: 0,
      },
      savedComparisons: [
        {
          id: "comparison-1",
          name: "Session A vs Session B",
          capturedAt: "2026-07-20T12:00:00Z",
          notes: "Same ball and target",
          focusLabel: "Session A",
          baselineLabel: "Session B",
          focusShots: 20,
          baselineShots: 20,
          verdict: "Improved",
          summary: "Dispersion tightened",
          delta: { carryYd: 2.4 },
        },
      ],
      notes: [],
      rawEvidence: [],
    });

    expect(snapshot.sections.savedComparisons).toHaveLength(1);
    expect(snapshot.disclosure.selectedSections).toEqual(["saved_comparisons"]);
    expect(snapshot.sections.rawEvidence).toBeUndefined();
  });
});
