import { describe, expect, it } from "vitest";

import { calculateScoringConfidence, isComparableScoredRound } from "@/lib/progress-readiness";

describe("progress readiness", () => {
  it("keeps sparse real-round evidence visibly low confidence", () => {
    expect(calculateScoringConfidence(0)).toEqual({ label: "No evidence", tone: "slate" });
    expect(calculateScoringConfidence(2)).toEqual({ label: "Low", tone: "amber" });
    expect(calculateScoringConfidence(3)).toEqual({ label: "Building", tone: "amber" });
    expect(calculateScoringConfidence(6)).toEqual({ label: "Moderate", tone: "sky" });
    expect(calculateScoringConfidence(10)).toEqual({ label: "Strong", tone: "green" });
  });

  it("only treats scored nine-hole-or-longer real rounds as comparable", () => {
    expect(isComparableScoredRound(Array.from({ length: 9 }, () => ({ score: 4 })))).toBe(true);
    expect(isComparableScoredRound(Array.from({ length: 8 }, () => ({ score: 4 })))).toBe(false);
    expect(
      isComparableScoredRound([
        ...Array.from({ length: 8 }, () => ({ score: 4 })),
        { score: null },
      ]),
    ).toBe(false);
  });
});
