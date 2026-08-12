import { describe, expect, it } from "vitest";

import { classifyTodayRecommendationIssue } from "@/lib/today-recommendation-issue";

describe("Today recommendation issue classification", () => {
  it.each([
    ["Stabilise Driver start line", "start-line"],
    ["Centre 7 Iron strike", "strike-efficiency"],
    ["Repair the 6 Iron and 7 Iron gapping overlap", "distance-gap"],
    ["Driver speed transfer", "speed"],
    ["Prepare the scoring club for the next round", "round-preparation"],
  ])("classifies evidence-backed wording: %s", (title, key) => {
    expect(classifyTodayRecommendationIssue(input({ title, reason: title })).key).toBe(key);
  });

  it("uses neutral control language for a thin sample", () => {
    expect(
      classifyTodayRecommendationIssue({
        ...input(null),
        club: { shotCount: 5, straightRate: 10, offlineAverageYd: 30 },
      }),
    ).toEqual({ label: "Control", key: "low-confidence-baseline" });
  });

  it("uses directional dispersion without inventing a start-line diagnosis", () => {
    expect(
      classifyTodayRecommendationIssue({
        ...input(null),
        club: { shotCount: 12, straightRate: 30, offlineAverageYd: 21 },
      }).key,
    ).toBe("directional-dispersion");
  });

  it("uses carry consistency for a volatile otherwise neutral club", () => {
    expect(
      classifyTodayRecommendationIssue({
        ...input(null),
        bagClub: { volatilityScore: 72, playableRate: 75 },
      }).key,
    ).toBe("carry-consistency");
  });
});

function input(priority: { title: string; reason: string } | null) {
  return {
    club: { shotCount: 12, straightRate: 65, offlineAverageYd: 8 },
    bagClub: { volatilityScore: 20, playableRate: 75 },
    priority,
    bagIssues: [],
    scoring: { weakestCategory: null, penaltyPattern: null },
    speed: { priority: "Medium", recommendation: "Maintain speed." },
  };
}
