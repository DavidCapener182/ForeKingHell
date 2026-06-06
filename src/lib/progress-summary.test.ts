import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateClubAnalytics, type ClubAnalyticsShot } from "@/lib/club-analytics";
import { buildProgressSummary, type ProgressClub } from "@/lib/progress-summary";

describe("buildProgressSummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces the most improved, most trusted, and practice-priority clubs", () => {
    const clubs: ProgressClub[] = [
      progressClub({
        clubId: "driver",
        clubType: "driver",
        baselineCarry: 190,
        currentCarry: 207,
        baselineOffline: -34,
        currentOffline: -10,
        currentBallSpeed: 136,
      }),
      progressClub({
        clubId: "five-wood",
        clubType: "5w",
        baselineCarry: 164,
        currentCarry: 166,
        baselineOffline: 26,
        currentOffline: 42,
        currentBallSpeed: 118,
        volatile: true,
      }),
      progressClub({
        clubId: "eight-iron",
        clubType: "8i",
        baselineCarry: 128,
        currentCarry: 132,
        baselineOffline: 7,
        currentOffline: 4,
        currentBallSpeed: 96,
      }),
    ];

    const summary = buildProgressSummary(clubs);

    expect(summary.totals.clubs).toBe(3);
    expect(summary.rankings.mostImproved?.clubType).toBe("driver");
    expect(summary.rankings.mostTrusted?.clubType).toBe("driver");
    expect(summary.practicePlan[0]?.clubType).toBe("5w");
    expect(summary.rankings.currentForm?.clubType).toBe("driver");
    expect(summary.signals.some((signal) => signal.label.includes("Driver"))).toBe(true);
    expect(summary.journey.some((event) => event.title.includes("Driver"))).toBe(true);
  });

  it("separates latest-session form from long-term trust", () => {
    const clubs: ProgressClub[] = [
      progressClub({
        clubId: "seven-iron",
        clubType: "7i",
        baselineCarry: 139,
        currentCarry: 140,
        baselineOffline: 3,
        currentOffline: 3,
        currentBallSpeed: 99,
        launchAngleDeg: 22,
      }),
      progressClub({
        clubId: "nine-iron",
        clubType: "9i",
        baselineCarry: 112,
        currentCarry: 124,
        baselineOffline: 24,
        currentOffline: 2,
        currentBallSpeed: 94,
        launchAngleDeg: 26,
      }),
    ];

    const summary = buildProgressSummary(clubs);

    expect(summary.rankings.mostTrusted?.clubType).toBe("7i");
    expect(summary.rankings.currentForm?.clubType).toBe("9i");
  });

  it("prioritises volatile long-game start line over new wedge strike work", () => {
    const clubs: ProgressClub[] = [
      progressClub({
        clubId: "five-wood",
        clubType: "5w",
        baselineCarry: 164,
        currentCarry: 166,
        baselineOffline: 26,
        currentOffline: 42,
        currentBallSpeed: 118,
        launchAngleDeg: 14,
        volatile: true,
      }),
      progressClub({
        clubId: "gap-wedge",
        clubType: "gw",
        baselineCarry: 82,
        currentCarry: 84,
        baselineOffline: 5,
        currentOffline: 4,
        currentBallSpeed: 70,
        launchAngleDeg: 30,
        smashFactor: 1,
      }),
    ];

    const summary = buildProgressSummary(clubs);

    expect(summary.practicePlan[0]?.clubType).toBe("5w");
    expect(summary.practicePlan[0]?.title).toBe("Stabilise 5W start line");
    expect(summary.practicePlan.find((priority) => priority.clubType === "gw")?.title).toBe(
      "Centre GW strike",
    );
  });

  it("creates a baseline-building signal when there is not enough comparison data", () => {
    const club: ProgressClub = {
      clubId: "seven-iron",
      clubType: "7i",
      brandModel: "TaylorMade Qi",
      analytics: calculateClubAnalytics({
        clubType: "7i",
        shots: [shot({ id: "one", clubType: "7i", carryYd: 136 })],
      }),
    };

    const summary = buildProgressSummary([club]);

    expect(summary.signals[0]?.label).toBe("Baseline building");
    expect(summary.practicePlan[0]?.reason).toContain("Needs more clean full-shot data");
    expect(summary.clubRows[0]?.confidenceLabel).toBe("Not enough data");
  });
});

function progressClub({
  clubId,
  clubType,
  baselineCarry,
  currentCarry,
  baselineOffline,
  currentOffline,
  currentBallSpeed,
  launchAngleDeg = 14,
  smashFactor = 1.44,
  volatile = false,
}: {
  clubId: string;
  clubType: string;
  baselineCarry: number;
  currentCarry: number;
  baselineOffline: number;
  currentOffline: number;
  currentBallSpeed: number;
  launchAngleDeg?: number;
  smashFactor?: number;
  volatile?: boolean;
}): ProgressClub {
  const baseline = Array.from({ length: 18 }, (_, index) =>
    shot({
      id: `${clubId}-base-${index}`,
      clubType,
      sessionId: `${clubId}-base`,
      shotAt: `2026-03-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      carryYd: baselineCarry + (index % 3),
      sideCarryYd: baselineOffline + (index % 3),
      ballSpeedMph: currentBallSpeed - 5,
      launchAngleDeg,
      smashFactor,
    }),
  );
  const current = Array.from({ length: 18 }, (_, index) =>
    shot({
      id: `${clubId}-current-${index}`,
      clubType,
      sessionId: `${clubId}-current`,
      shotAt: `2026-05-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      carryYd: currentCarry + (index % 3),
      sideCarryYd: currentOffline + (volatile ? (index % 2 === 0 ? 18 : -22) : index % 3),
      ballSpeedMph: currentBallSpeed,
      launchAngleDeg,
      smashFactor,
    }),
  );

  return {
    clubId,
    clubType,
    brandModel: "TaylorMade Qi",
    analytics: calculateClubAnalytics({ clubType, shots: [...baseline, ...current] }),
  };
}

function shot(overrides: Partial<ClubAnalyticsShot> = {}): ClubAnalyticsShot {
  return {
    id: "shot",
    sessionId: "session",
    clubType: "driver",
    shotAt: "2026-05-01T12:00:00.000Z",
    carryYd: 200,
    totalYd: 210,
    sideCarryYd: 0,
    ballSpeedMph: 130,
    clubSpeedMph: 90,
    launchAngleDeg: 14,
    launchDirectionDeg: 0,
    apexFt: 82,
    attackAngleDeg: 1,
    clubPathDeg: 2,
    descentAngleDeg: 35,
    smashFactor: 1.44,
    spinRate: 2400,
    spinAxis: 0,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: "Measured",
    courseHoleNumber: null,
    sessionType: "range",
    ...overrides,
  };
}
