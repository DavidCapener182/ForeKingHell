import { describe, expect, it } from "vitest";

import { calculateClubAnalytics, type ClubAnalyticsShot } from "@/lib/club-analytics";
import {
  buildCoachDrillChallenges,
  buildCoachSummary,
  type CoachDrillChallenge,
} from "@/lib/coach";
import { evaluateCoachDrillProgress } from "@/lib/coach-drill-awards";

describe("buildCoachSummary", () => {
  it("shows whether the latest comparable session helped the current practice target", () => {
    const previous = Array.from({ length: 4 }, (_, index) =>
      shot({
        id: `previous-${index}`,
        sessionId: "previous-session",
        shotAt: `2026-05-01T10:0${index}:00.000Z`,
        sideCarryYd: 55,
      }),
    );
    const latest = Array.from({ length: 4 }, (_, index) =>
      shot({
        id: `latest-${index}`,
        sessionId: "latest-session",
        shotAt: `2026-05-08T10:0${index}:00.000Z`,
        sideCarryYd: 20,
      }),
    );
    const analytics = calculateClubAnalytics({
      clubType: "driver",
      shots: [...previous, ...latest],
    });
    const coach = buildCoachSummary([
      {
        clubId: "driver-id",
        clubType: "driver",
        brandModel: "TaylorMade Qi4D Max",
        analytics,
      },
    ]);

    expect(coach.trainingImpact[0]?.status).toBe("better");
    expect(coach.trainingImpact[0]?.headline).toContain("improved");
    expect(coach.trainingImpact[0]?.metrics.map((metric) => metric.label)).toContain("Offline");
  });

  it("builds daily XP drill challenges from the coach priority", () => {
    const analytics = calculateClubAnalytics({
      clubType: "driver",
      shots: Array.from({ length: 8 }, (_, index) =>
        shot({
          id: `shot-${index}`,
          shotAt: `2026-05-08T10:0${index}:00.000Z`,
          sideCarryYd: 45,
        }),
      ),
    });
    const coach = buildCoachSummary([
      {
        clubId: "driver-id",
        clubType: "driver",
        brandModel: "TaylorMade Qi4D Max",
        analytics,
      },
    ]);
    const drills = buildCoachDrillChallenges(coach, new Date("2026-05-11T12:00:00.000Z"));

    expect(drills).toHaveLength(1);
    expect(drills[0]?.id).toContain("2026-05-11-driver-direction");
    expect(drills[0]?.completeAchievementId).toContain("coach_complete");
    expect(drills[0]?.winAchievementId).toContain("coach_win");
    expect(drills[0]?.winXp ?? 0).toBeGreaterThan(drills[0]?.completeXp ?? 0);
    expect(drills[0]?.winCondition).toContain("playable");
  });

  it("marks a launch drill complete and won from uploaded shots", () => {
    const challenge = {
      id: "coach-drill-2026-05-11-6i-launch",
      dateKey: "2026-05-11",
      clubId: "six-iron-id",
      clubType: "6i",
      clubName: "6i",
      issue: "launch",
      issueLabel: "Launch window",
      title: "6i launch ladder",
      detail: "Hit 12 stock shots and count launch.",
      target: "12 balls.",
      winCondition: "Win it with 8 or more launch-window shots.",
      completionTarget: 12,
      winRule: { kind: "launch-window", target: 8, low: 16, high: 24 },
      completeAchievementId: "coach_complete_2026-05-11-6i-launch",
      winAchievementId: "coach_win_2026-05-11-6i-launch",
      completeXp: 60,
      winXp: 160,
      tone: "amber",
    } satisfies CoachDrillChallenge;
    const shots = Array.from({ length: 12 }, (_, index) => ({
      clubType: "6i",
      shotCategory: "full",
      carryYd: 150,
      sideCarryYd: 8,
      launchAngleDeg: index < 8 ? 19 : 27,
      launchDirectionDeg: 2,
      ballSpeedMph: 110,
      clubSpeedMph: 80,
      smashFactor: 1.37,
      clubPathDeg: 1,
    }));

    const progress = evaluateCoachDrillProgress(challenge, shots);

    expect(progress.uploadedShotCount).toBe(12);
    expect(progress.completed).toBe(true);
    expect(progress.winCount).toBe(8);
    expect(progress.won).toBe(true);
  });
});

function shot(overrides: Partial<ClubAnalyticsShot> = {}): ClubAnalyticsShot {
  return {
    id: "shot-id",
    sessionId: "session-id",
    clubType: "driver",
    shotNumber: 1,
    shotAt: "2026-05-01T10:00:00.000Z",
    carryYd: 210,
    totalYd: 226,
    sideCarryYd: 55,
    ballSpeedMph: 132,
    clubSpeedMph: 90,
    launchAngleDeg: 14,
    launchDirectionDeg: 5,
    apexFt: 82,
    attackAngleDeg: 1,
    clubPathDeg: 2,
    descentAngleDeg: 34,
    smashFactor: 1.47,
    shotCategory: "full",
    qualityTag: "normal",
    clubDataEstType: "measured",
    ...overrides,
  };
}
