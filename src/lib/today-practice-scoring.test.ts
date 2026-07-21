import { describe, expect, it } from "vitest";

import {
  buildPlanResultReadout,
  buildScoringControlReadout,
  buildSessionQualityReadout,
  clubControlLabel,
  clubSessionBadgeReadout,
  latestPracticeHeadline,
  type TodaySessionQualityInput,
} from "@/lib/today-practice-scoring";

describe("latest practice scoring split", () => {
  it("keeps a highly playable failed-plan session productive and labels the plan incomplete", () => {
    const quality = buildSessionQualityReadout(todayLikeQualityInput);
    const scoringControl = buildScoringControlReadout(5.4);
    const planResult = buildPlanResultReadout({
      score: 43,
      verdict: "Repeat once before moving on.",
      totalBlocks: 3,
      passedBlocks: 1,
      mixedBlocks: 1,
      incompleteBlocks: 1,
    });

    expect(quality.score).toBeGreaterThanOrEqual(70);
    expect(latestPracticeHeadline(quality, scoringControl)).toBe(
      "Productive session - scoring control mixed",
    );
    expect(planResult?.label).toBe("Incomplete");
    expect(planResult?.tone).toBe("amber");
    expect(planResult?.detail).toBe(
      "The session was useful. The planned drill was not fully proven.",
    );
  });

  it("does not let plan score overwrite session quality score", () => {
    const quality = buildSessionQualityReadout(todayLikeQualityInput);
    const planResult = buildPlanResultReadout({
      score: 43,
      verdict: "Plan incomplete.",
      totalBlocks: 2,
      passedBlocks: 0,
      incompleteBlocks: 1,
    });

    expect(quality.score).toBeGreaterThan(70);
    expect(planResult?.scoreLabel).toBe("43/100");
    expect(planResult?.label).toBe("Incomplete");
    expect(quality.score).toBeGreaterThan(Number(planResult?.scoreLabel.split("/")[0]));
  });

  it("calls a fully playable low-straight club playable but not scoring-tight", () => {
    expect(clubControlLabel({ playableRate: 100, straightRate: 9.1 })).toBe(
      "Playable but not scoring-tight",
    );
  });

  it("uses golfer-facing club badges instead of generic mixed labels", () => {
    expect(
      clubSessionBadgeReadout("driver", {
        shotCount: 22,
        playableRate: 95.5,
        straightRate: 36,
        offlineAverageYd: 15.3,
      }),
    ).toMatchObject({
      label: "Playable - tighten start line",
      tone: "amber",
    });
    expect(
      clubSessionBadgeReadout("7i", {
        shotCount: 22,
        playableRate: 100,
        straightRate: 9.1,
        offlineAverageYd: 11.8,
      }),
    ).toMatchObject({
      label: "Playable - not scoring-tight",
      tone: "amber",
    });
    expect(
      clubSessionBadgeReadout("gw", {
        shotCount: 14,
        playableRate: 100,
        straightRate: 42,
        offlineAverageYd: 7,
      }),
    ).toMatchObject({
      label: "Good",
      tone: "green",
    });
    expect(
      clubSessionBadgeReadout("sw", {
        shotCount: 3,
        playableRate: 100,
        straightRate: 50,
        offlineAverageYd: 5,
      }),
    ).toMatchObject({
      label: "Low sample",
      tone: "slate",
    });
  });

  it("uses robust carry spread for session quality when one raw carry outlier is obvious", () => {
    const rawOutlier = buildSessionQualityReadout({
      ...todayLikeQualityInput,
      clubs: todayLikeQualityInput.clubs.map((club) => ({
        ...club,
        carryStdDevYd: club.clubType === "7i" ? 42 : club.carryStdDevYd,
        carryRobustStdDevYd: club.clubType === "7i" ? 7 : club.carryRobustStdDevYd,
      })),
    });
    const rawOnly = buildSessionQualityReadout({
      ...todayLikeQualityInput,
      clubs: todayLikeQualityInput.clubs.map((club) => ({
        ...club,
        carryStdDevYd: club.clubType === "7i" ? 42 : club.carryStdDevYd,
        carryRobustStdDevYd: null,
      })),
    });

    expect(rawOutlier.score).toBeGreaterThanOrEqual(70);
    expect(rawOutlier.score).toBeGreaterThan(rawOnly.score);
  });
});

const todayLikeQualityInput: TodaySessionQualityInput = {
  shotCount: 111,
  selectedClubCount: 8,
  playableRate: 98.5,
  bigMissRate: 1.5,
  offlineAverageYd: 10.6,
  strikeScore: 8.1,
  pbMomentCount: 4,
  clubs: [
    {
      clubType: "driver",
      shotCount: 22,
      playableRate: 95.5,
      bigMissRate: 0,
      offlineAverageYd: 15.3,
      straightRate: 36,
      carryStdDevYd: 18,
      carryRobustStdDevYd: 13,
    },
    {
      clubType: "7i",
      shotCount: 22,
      playableRate: 100,
      bigMissRate: 0,
      offlineAverageYd: 11.8,
      straightRate: 9.1,
      carryStdDevYd: 16,
      carryRobustStdDevYd: 9,
    },
    {
      clubType: "gw",
      shotCount: 14,
      playableRate: 100,
      bigMissRate: 0,
      offlineAverageYd: 7,
      straightRate: 42,
      carryStdDevYd: 12,
      carryRobustStdDevYd: 8,
    },
  ],
};
