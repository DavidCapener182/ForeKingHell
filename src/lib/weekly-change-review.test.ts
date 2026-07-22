import { describe, expect, it } from "vitest";

import { buildWeeklyChangeReview } from "@/lib/weekly-change-review";
import type { ProgressClubRow } from "@/lib/progress-summary";

describe("weekly change review", () => {
  it("selects deterministic improvement and decline signals", () => {
    const review = buildWeeklyChangeReview({
      clubRows: [
        row({ clubId: "driver", clubType: "driver", offlineDeltaYd: -4, carryDeltaYd: 2 }),
        row({ clubId: "seven", clubType: "7i", offlineDeltaYd: 5, carryDeltaYd: -1 }),
      ],
      latestSessionAt: new Date("2026-07-20T10:00:00Z"),
      completedPracticeCount: 2,
      completedSessionCount: 4,
      completedRoundCount: 1,
      dataQualityIssueCount: 2,
      personalBestCount: 1,
      now: new Date("2026-07-21T12:00:00Z"),
    });

    expect(review.largestImprovement.value).toBe("Driver");
    expect(review.largestDecline.value).toBe("7i");
    expect(review.dataFreshness.value).toBe("1 day old");
    expect(review.practiceCompleted.value).toBe("2 completed");
    expect(review.completedVolume.value).toBe("4 sessions");
    expect(review.completedVolume.detail).toContain("1 completed round");
    expect(review.dataQuality.value).toBe("2 open");
    expect(review.personalBests.value).toBe("1 new");
    expect(review.nextAction.href).toBe("/bag/seven/analytics");
  });

  it("does not invent movement without comparable samples", () => {
    const review = buildWeeklyChangeReview({
      clubRows: [row({ sampleSize: 3 })],
      latestSessionAt: null,
      completedPracticeCount: 0,
    });

    expect(review.largestImprovement.value).toBe("No clear mover");
    expect(review.largestDecline.value).toBe("No clear decline");
    expect(review.bagNumberChange.value).toBe("Needs baselines");
    expect(review.nextAction.href).toBe("/import");
  });
});

function row(overrides: Partial<ProgressClubRow> = {}): ProgressClubRow {
  return {
    clubId: "club",
    clubType: "7i",
    brandModel: "Test",
    stockCarryYd: 155,
    trustIndex: 70,
    confidenceLabel: "Moderate",
    playableRate: 70,
    primaryMiss: "Right",
    primaryShape: "fade",
    carryDeltaYd: 0,
    ballSpeedDeltaMph: 0,
    offlineDeltaYd: 0,
    launchDeltaDeg: 0,
    sampleSize: 12,
    score: 0,
    ...overrides,
  };
}
