import { describe, expect, it } from "vitest";

import { calculateClubAnalytics, type ClubAnalyticsShot } from "@/lib/club-analytics";
import { buildCoachSummary } from "@/lib/coach";

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
