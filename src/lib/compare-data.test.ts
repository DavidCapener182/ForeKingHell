import { describe, expect, it } from "vitest";

import {
  buildProgressCompareData,
  type CompareClubOption,
  type CompareShot,
} from "@/lib/compare-data";

const clubs: CompareClubOption[] = [
  { id: "driver-club", type: "driver", label: "Driver", shotCount: 0 },
  { id: "seven-iron-club", type: "7i", label: "7 Iron", shotCount: 0 },
  { id: "wedge-club", type: "sw", label: "SW", shotCount: 0 },
];

describe("buildProgressCompareData", () => {
  it("compares the latest 7-day window against previous 7-day club baselines", () => {
    const data = buildProgressCompareData({
      clubs,
      shots: [
        shot({
          id: "latest-driver",
          sessionId: "latest-session",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 214,
          sideCarryYd: 8,
        }),
        shot({
          id: "latest-7i",
          sessionId: "latest-session",
          clubId: "seven-iron-club",
          clubType: "7i",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 150,
          sideCarryYd: 2,
        }),
        shot({
          id: "focus-driver-2",
          sessionId: "focus-week",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-30",
          carryYd: 210,
          sideCarryYd: 10,
        }),
        shot({
          id: "baseline-driver-1",
          sessionId: "week-baseline",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-24",
          carryYd: 200,
          sideCarryYd: 24,
        }),
        shot({
          id: "baseline-driver-2",
          sessionId: "week-baseline",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-25",
          carryYd: 202,
          sideCarryYd: 22,
        }),
        shot({
          id: "baseline-7i",
          sessionId: "week-baseline",
          clubId: "seven-iron-club",
          clubType: "7i",
          sessionDate: "2026-05-24",
          carryYd: 142,
          sideCarryYd: 12,
        }),
        shot({
          id: "older-driver",
          sessionId: "older-baseline",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-12",
          carryYd: 196,
          sideCarryYd: 30,
        }),
      ],
    });

    expect(data.latestSession?.id).toBe("latest-session");
    expect(data.previousWeek.focus.label).toBe("Last 7 days");
    expect(data.previousWeek.label).toBe("Previous 7 days");
    expect(data.previousWeek.focus.detail).toBe("27 May 2026 to 02 Jun 2026");
    expect(data.previousWeek.focus.stockShots).toBe(3);
    expect(data.previousWeek.baseline.stockShots).toBe(3);
    expect(data.previousWeek.detail).toBe("20 May 2026 to 26 May 2026");

    const driverRow = data.previousWeek.clubRows.find((row) => row.clubId === "driver-club");
    const sevenIronRow = data.previousWeek.clubRows.find((row) => row.clubId === "seven-iron-club");

    expect(driverRow?.delta.carryDeltaYd).toBe(11);
    expect(driverRow?.delta.offlineDeltaYd).toBe(-14);
    expect(sevenIronRow?.delta.carryDeltaYd).toBe(8);
    expect(data.previousMonth.baseline.stockShots).toBe(4);
  });

  it("uses the nearest earlier practice week when the exact previous 7 days are empty", () => {
    const data = buildProgressCompareData({
      clubs,
      shots: [
        shot({
          id: "latest-driver",
          sessionId: "latest-session",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-06-01",
          sessionCreatedAt: "2026-06-01T19:00:00.000Z",
          carryYd: 214,
          sideCarryYd: 8,
        }),
        shot({
          id: "focus-driver",
          sessionId: "focus-week",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-30",
          carryYd: 210,
          sideCarryYd: 10,
        }),
        shot({
          id: "previous-practice-driver",
          sessionId: "previous-practice-week",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-18",
          carryYd: 202,
          sideCarryYd: 22,
        }),
      ],
    });

    expect(data.previousWeek.focus.detail).toBe("26 May 2026 to 01 Jun 2026");
    expect(data.previousWeek.label).toBe("Previous practice week");
    expect(data.previousWeek.detail).toBe("18 May 2026 to 24 May 2026");
    expect(data.previousWeek.baseline.stockShots).toBe(1);
    expect(data.previousWeek.delta.carryDeltaYd).toBe(10);
  });

  it("scores shorter but tighter shots as useful progress", () => {
    const data = buildProgressCompareData({
      clubs,
      shots: [
        shot({
          id: "focus-5i-1",
          sessionId: "latest-session",
          clubId: "seven-iron-club",
          clubType: "5i",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 150,
          sideCarryYd: 0,
        }),
        shot({
          id: "focus-5i-2",
          sessionId: "latest-session",
          clubId: "seven-iron-club",
          clubType: "5i",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 152,
          sideCarryYd: 2,
        }),
        shot({
          id: "focus-5i-3",
          sessionId: "latest-session",
          clubId: "seven-iron-club",
          clubType: "5i",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 154,
          sideCarryYd: 4,
        }),
        shot({
          id: "baseline-5i-1",
          sessionId: "baseline-session",
          clubId: "seven-iron-club",
          clubType: "5i",
          sessionDate: "2026-05-24",
          carryYd: 160,
          sideCarryYd: -30,
        }),
        shot({
          id: "baseline-5i-2",
          sessionId: "baseline-session",
          clubId: "seven-iron-club",
          clubType: "5i",
          sessionDate: "2026-05-24",
          carryYd: 162,
          sideCarryYd: 0,
        }),
        shot({
          id: "baseline-5i-3",
          sessionId: "baseline-session",
          clubId: "seven-iron-club",
          clubType: "5i",
          sessionDate: "2026-05-24",
          carryYd: 164,
          sideCarryYd: 30,
        }),
      ],
    });

    const row = data.previousWeek.clubRows.find((item) => item.clubId === "seven-iron-club");

    expect(row?.delta.carryDeltaYd).toBe(-10);
    expect(row?.delta.coneDeltaYd).toBe(-44.8);
    expect(row?.delta.playableRateDelta).toBe(66.7);
    expect(row?.benefitScore).toBeGreaterThanOrEqual(60);
    expect(data.previousWeek.benefit.positives).toContain("Shot cone tightened by 44.8 yd.");
  });

  it("returns newest week and month periods with deltas from the previous period", () => {
    const data = buildProgressCompareData({
      clubs,
      shots: [
        shot({
          id: "jun-driver",
          sessionId: "jun-session",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 214,
        }),
        shot({
          id: "jun-7i",
          sessionId: "jun-session",
          clubId: "seven-iron-club",
          clubType: "7i",
          sessionDate: "2026-06-02",
          sessionCreatedAt: "2026-06-02T19:00:00.000Z",
          carryYd: 150,
        }),
        shot({
          id: "may-driver",
          sessionId: "may-session",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-05-21",
          carryYd: 204,
        }),
        shot({
          id: "may-7i",
          sessionId: "may-session",
          clubId: "seven-iron-club",
          clubType: "7i",
          sessionDate: "2026-05-21",
          carryYd: 144,
        }),
        shot({
          id: "apr-driver",
          sessionId: "apr-session",
          clubId: "driver-club",
          clubType: "driver",
          sessionDate: "2026-04-14",
          carryYd: 198,
        }),
      ],
    });

    expect(data.weeklyPeriods[0]?.key).toBe("2026-06-01");
    expect(data.weeklyPeriods[0]?.summary.stockShots).toBe(2);
    expect(data.weeklyPeriods[0]?.deltaFromPrevious.carryDeltaYd).toBeGreaterThan(0);
    expect(data.monthlyPeriods[0]?.key).toBe("2026-06-01");
    expect(data.monthlyPeriods[0]?.label).toBe("Jun 2026");
    expect(data.monthlyPeriods[1]?.key).toBe("2026-05-01");
  });
});

type ShotInput = {
  id: string;
  sessionId: string;
  clubId: string;
  clubType: string;
  sessionDate: string;
  sessionCreatedAt?: string;
  carryYd?: number;
  totalYd?: number;
  sideCarryYd?: number;
};

function shot(input: ShotInput): CompareShot {
  const shotAt = new Date(`${input.sessionDate}T12:00:00.000Z`);
  const carryYd = input.carryYd ?? null;

  return {
    id: input.id,
    sessionId: input.sessionId,
    sessionDate: shotAt,
    sessionCreatedAt: new Date(input.sessionCreatedAt ?? `${input.sessionDate}T13:00:00.000Z`),
    sessionType: "practice",
    sessionLabel: `${input.sessionId} label`,
    clubId: input.clubId,
    clubType: input.clubType,
    shotAt,
    shotNumber: 1,
    carryYd,
    totalYd: input.totalYd ?? (carryYd === null ? null : carryYd + 8),
    sideCarryYd: input.sideCarryYd ?? 0,
    ballSpeedMph: carryYd === null ? null : carryYd * 0.62,
    clubSpeedMph: null,
    launchAngleDeg: 14,
    launchDirectionDeg: 0,
    apexFt: null,
    attackAngleDeg: null,
    clubPathDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    courseHoleNumber: null,
  };
}
