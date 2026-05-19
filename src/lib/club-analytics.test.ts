import { describe, expect, it } from "vitest";

import { calculateClubAnalytics, classifyShotShape, likelyMishitTags } from "@/lib/club-analytics";

describe("classifyShotShape", () => {
  it("classifies start line and side carry patterns", () => {
    expect(classifyShotShape({ launchDirectionDeg: 0.5, sideCarryYd: 2 })).toBe("straight");
    expect(classifyShotShape({ launchDirectionDeg: 5, sideCarryYd: -14 })).toBe("draw");
    expect(classifyShotShape({ launchDirectionDeg: -5, sideCarryYd: 14 })).toBe("fade");
    expect(classifyShotShape({ launchDirectionDeg: 6, sideCarryYd: 32 })).toBe("block");
    expect(classifyShotShape({ launchDirectionDeg: -5, sideCarryYd: -32 })).toBe("pull hook");
  });
});

describe("calculateClubAnalytics", () => {
  it("builds distance, accuracy, delivery, and progress profiles from clean shots", () => {
    const baselineShots = Array.from({ length: 20 }, (_, index) =>
      shot({
        id: `baseline-${index}`,
        sessionId: "baseline-session",
        shotAt: `2026-04-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
        carryYd: 190 + (index % 3),
        sideCarryYd: -30 + (index % 4),
        ballSpeedMph: 129 + (index % 2),
        launchAngleDeg: 12,
        launchDirectionDeg: 5,
        clubPathDeg: 10,
      }),
    );
    const currentShots = Array.from({ length: 20 }, (_, index) =>
      shot({
        id: `current-${index}`,
        sessionId: "current-session",
        shotAt: `2026-05-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
        carryYd: 205 + (index % 3),
        sideCarryYd: -10 + (index % 4),
        ballSpeedMph: 135 + (index % 2),
        launchAngleDeg: 15,
        launchDirectionDeg: 1,
        clubPathDeg: 3,
      }),
    );

    const analytics = calculateClubAnalytics({
      clubType: "driver",
      shots: [...baselineShots, ...currentShots],
    });

    expect(analytics.sample.stockShots).toBeGreaterThanOrEqual(30);
    expect(analytics.distance.safeCarryYd).toBeLessThan(analytics.distance.aggressiveCarryYd ?? 0);
    expect(analytics.accuracy.primaryMiss).toBe("Left");
    expect(analytics.launch.launchWindowScore).toBe(100);
    expect(analytics.progress.baselineDelta?.carryDeltaYd).toBeGreaterThan(10);
    expect(analytics.progress.baselineDelta?.offlineDeltaYd).toBeLessThan(0);
    expect(analytics.delivery.hookRiskScore).toBeGreaterThan(0);
    expect(analytics.insights.length).toBeGreaterThan(0);
  });

  it("keeps short-game course shots out of the stock sample", () => {
    const analytics = calculateClubAnalytics({
      clubType: "sw",
      shots: [
        shot({
          id: "touch-1",
          clubType: "sw",
          carryYd: 20,
          sideCarryYd: 1,
          courseHoleNumber: 1,
          sessionType: "simulated_course",
        }),
        shot({
          id: "touch-2",
          clubType: "sw",
          carryYd: 35,
          sideCarryYd: -2,
          courseHoleNumber: 2,
          sessionType: "simulated_course",
        }),
      ],
    });

    expect(analytics.sample.stockShots).toBe(0);
    expect(analytics.distance.stockCarryYd).toBeNull();
    expect(analytics.consistency.confidenceLabel).toBe("Not enough data");
  });

  it("warns when club delivery data is mostly estimated", () => {
    const analytics = calculateClubAnalytics({
      clubType: "7i",
      shots: Array.from({ length: 8 }, (_, index) =>
        shot({
          id: `estimated-${index}`,
          clubType: "7i",
          carryYd: 140 + index,
          sideCarryYd: index % 2 === 0 ? -5 : 5,
          clubPathDeg: 4,
          attackAngleDeg: -2,
          clubDataEstType: "Estimated",
        }),
      ),
    });

    expect(analytics.delivery.dataWarning).toContain("estimated");
  });
});

describe("likelyMishitTags", () => {
  it("tags low-flight and low-smash long-club shots", () => {
    expect(
      likelyMishitTags({
        clubType: "5w",
        stockCarryYd: 175,
        shot: shot({
          id: "thin-wood",
          clubType: "5w",
          carryYd: 90,
          launchAngleDeg: 5,
          apexFt: 12,
          smashFactor: 1.2,
          clubSpeedMph: 85,
          ballSpeedMph: 102,
        }),
      }),
    ).toEqual(
      expect.arrayContaining(["mishit floor", "low bullet", "dead strike", "speed leakage"]),
    );
  });
});

function shot(
  overrides: Partial<Parameters<typeof calculateClubAnalytics>[0]["shots"][number]> = {},
) {
  return {
    id: "shot",
    sessionId: "session",
    clubType: "driver",
    shotAt: "2026-05-01T12:00:00.000Z",
    carryYd: 200,
    totalYd: 215,
    sideCarryYd: 0,
    ballSpeedMph: 132,
    clubSpeedMph: 90,
    launchAngleDeg: 14,
    launchDirectionDeg: 0,
    apexFt: 85,
    attackAngleDeg: 2,
    clubPathDeg: 3,
    descentAngleDeg: 34,
    smashFactor: 1.46,
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
