import { describe, expect, it } from "vitest";
import type { ClubDayComparison } from "./today-session-data";
import { mobileComparisonSummary, mobileReviewHighlights } from "./mobile-review-copy";

function comparison(miss: number | null, count = 20): ClubDayComparison {
  return {
    offlineDeltaYd: miss,
    carryDeltaYd: 6,
    verdict: "mixed",
    summary: "Baseline evidence",
    today: { shotCount: count },
    previous: { shotCount: 50 },
  } as ClubDayComparison;
}

describe("mobile practice explanation", () => {
  it("describes measured direction without calling extra distance an improvement", () => {
    expect(mobileComparisonSummary(comparison(-2))).toBe(
      "2.0 yd less average sideways miss. 6.0 yd longer average carry.",
    );
    expect(mobileComparisonSummary(comparison(0))).toBe(
      "Average sideways miss was unchanged. 6.0 yd longer average carry.",
    );
    expect(mobileComparisonSummary({ ...comparison(null), carryDeltaYd: null })).toBe(
      "Baseline evidence",
    );
  });
  it("finds the control gain and cost across the bag and leaves tiny samples out of headlines", () => {
    const clubs = [
      { id: "driver", comparison: comparison(4) },
      { id: "tiny", comparison: comparison(40, 3) },
      { id: "iron", comparison: comparison(-12) },
      { id: "wedge", comparison: comparison(8) },
    ];
    expect(mobileReviewHighlights(clubs).map((club) => club.id)).toEqual(["iron", "wedge"]);
    expect(clubs).toHaveLength(4);
  });
});
