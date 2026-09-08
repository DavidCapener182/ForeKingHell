import { describe, expect, it } from "vitest";

import { buildTodayProgress, type TodayProgressHistoryDay } from "@/lib/today-progress";
import type { TodayPracticeShot } from "@/lib/today-session-data";

function shot(
  date: string,
  index: number,
  overrides: Partial<TodayPracticeShot> = {},
): TodayPracticeShot {
  return {
    id: `${date}-${index}`,
    sessionId: `upload-${date}`,
    source: "rapsodo",
    fileName: "range.csv",
    sessionType: "range",
    courseName: null,
    sessionDate: new Date(`${date}T12:00:00Z`),
    shotAt: new Date(`${date}T12:00:00Z`),
    shotNumber: index,
    clubId: "driver-one",
    clubType: "driver",
    clubBrand: "TaylorMade",
    clubModel: "Qi4D",
    shotCategory: "full",
    carryYd: 200,
    totalYd: 210,
    sideCarryYd: 5,
    launchDirectionDeg: 1,
    launchAngleDeg: 12,
    ballSpeedMph: 130,
    clubSpeedMph: 90,
    smashFactor: 1.44,
    apexFt: 65,
    descentAngleDeg: 40,
    attackAngleDeg: 2,
    clubPathDeg: 1,
    faceAngleDeg: 1,
    clubDataEstType: null,
    reviewStatus: "included",
    qualityTag: null,
    dataIntegrityIssue: null,
    ...overrides,
  };
}
function day(
  dateKey: string,
  side: number,
  count = 5,
  overrides: Partial<TodayPracticeShot> = {},
): TodayProgressHistoryDay {
  return {
    dateKey,
    rawShots: Array.from({ length: count }, (_, index) =>
      shot(dateKey, index, { sideCarryYd: side, ...overrides }),
    ),
  };
}
function report(current: TodayProgressHistoryDay, previousDays: TodayProgressHistoryDay[] = []) {
  return buildTodayProgress({ dateKey: current.dateKey, rawShots: current.rawShots, previousDays });
}

describe("automatic Today progress", () => {
  it("explains measured control and carry-consistency improvement with the actual prior date", () => {
    const previous = day("2026-09-06", -12, 3);
    previous.rawShots.forEach((row, index) => (row.carryYd = 190 + index * 10));
    const latest = day("2026-09-08", 3, 3);
    latest.rawShots.forEach((row, index) => (row.carryYd = 198 + index * 2));
    const result = report(latest, [previous]);
    expect(result.verdict).toBe("better");
    expect(result.previous?.dateKey).toBe("2026-09-06");
    expect(result.improvements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "offline",
          previous: 12,
          current: 3,
          delta: -9,
          text: expect.stringContaining("closer to target"),
        }),
        expect.objectContaining({ metric: "carrySpread", previous: 10, current: 2, delta: -8 }),
      ]),
    );
    expect(result.summary).toContain("early signal");
    expect(result.recentTrend.verdict).toBe("building");
  });

  it("does not call extra distance or speed improvement when control worsened", () => {
    const result = report(day("2026-09-08", 15, 5, { carryYd: 225, ballSpeedMph: 140 }), [
      day("2026-09-07", 4),
    ]);
    expect(result.verdict).toBe("worse");
    expect(result.improvements).toEqual([]);
    expect(result.setbacks[0]).toMatchObject({ metric: "offline", delta: 11 });
    expect(result.changes.map((change) => change.metric)).toEqual(["carry", "ballSpeed"]);
    const distanceOnly = report(day("2026-09-08", 4, 5, { carryYd: 225 }), [day("2026-09-07", 4)]);
    expect(distanceOnly.verdict).toBe("steady");
    expect(distanceOnly.changes[0]).toMatchObject({ metric: "carry", delta: 25 });
  });

  it("keeps both improvements and setbacks when clubs move in opposite directions", () => {
    const current = day("2026-09-08", 2);
    current.rawShots.push(
      ...day("2026-09-08", 15, 5, { clubId: "iron", clubType: "7i" }).rawShots.map((row) => ({
        ...row,
        id: `iron-${row.id}`,
      })),
    );
    const previous = day("2026-09-07", 12);
    previous.rawShots.push(
      ...day("2026-09-07", 3, 5, { clubId: "iron", clubType: "7i" }).rawShots.map((row) => ({
        ...row,
        id: `iron-${row.id}`,
      })),
    );
    const result = report(current, [previous]);
    expect(result.verdict).toBe("mixed");
    expect(result.improvements[0].clubLabel).toBe("Driver");
    expect(result.setbacks[0].clubLabel).toBe("7i");
  });

  it("does not mistake a different club mix for performance change", () => {
    const current = day("2026-09-08", 5, 30);
    const previous = day("2026-09-07", 5, 3);
    for (const [data, count] of [
      [current, 3],
      [previous, 30],
    ] as const) {
      data.rawShots.push(
        ...day(data.dateKey, 5, count, {
          clubId: "iron",
          clubType: "7i",
          carryYd: 150,
        }).rawShots.map((row) => ({ ...row, id: `iron-${row.id}` })),
      );
    }
    const result = report(current, [previous]);
    expect(result.verdict).toBe("steady");
    expect(result.changes).toEqual([]);
    expect(result.coverage.matchedClubs).toBe(2);
  });

  it("keeps changed and unidentified equipment visible without inventing comparisons", () => {
    const current = day("2026-09-08", 1, 5, { clubId: "replacement-driver" });
    current.rawShots.push(
      ...day("2026-09-08", 2, 5, { clubId: undefined, clubType: "7i" }).rawShots.map((row) => ({
        ...row,
        id: `unknown-${row.id}`,
      })),
    );
    const result = report(current, [day("2026-09-07", 15)]);
    expect(result.verdict).toBe("building");
    expect(result.clubs.map((club) => club.status)).toEqual([
      "equipment-changed",
      "unknown-equipment",
    ]);
    expect(
      result.clubs
        .flatMap((club) => club.metrics)
        .every((metric) => metric.previous === null && metric.delta === null),
    ).toBe(true);
    expect(result.coverage.totalClubs).toBe(2);
  });

  it("uses separate measurement counts and never treats missing or questioned direction as zero", () => {
    const current = day("2026-09-08", 0, 5, { dataConfidence: { alignment: "misaligned" } });
    const result = report(current, [day("2026-09-07", 15)]);
    expect(result.clubs[0].metrics[0]).toMatchObject({
      current: null,
      currentCount: 0,
      previous: 15,
      delta: null,
      direction: "unavailable",
    });
    expect(result.improvements).toEqual([]);
    expect(result.verdict).toBe("steady");
    const onlySide = day("2026-09-08", 0, 5, {
      carryYd: null,
      ballSpeedMph: null,
      dataConfidence: { alignment: "misaligned" },
    });
    expect(report(onlySide, [day("2026-09-07", 15)]).latest.eligibleShotCount).toBe(0);
  });

  it("requires three readings per metric rather than just three rows", () => {
    const current = day("2026-09-08", 1, 2);
    current.rawShots.push(shot("2026-09-08", 99, { carryYd: null, sideCarryYd: null }));
    const result = report(current, [day("2026-09-07", 12)]);
    expect(result.verdict).toBe("building");
    expect(result.clubs[0].status).toBe("low-sample");
    expect(result.clubs[0].metrics[0].currentCount).toBe(2);
    expect(result.clubs[0].metrics[0].delta).toBeNull();
  });

  it("honours exclusions/restoration, removes duplicate IDs and rejects rounds/future rows", () => {
    const current = day("2026-09-08", 5, 3);
    current.rawShots.push(current.rawShots[0]);
    current.rawShots.push(shot("2026-09-08", 5, { reviewStatus: "user_excluded" }));
    current.rawShots.push(shot("2026-09-08", 6, { reviewStatus: "restored", qualityTag: "top" }));
    current.rawShots.push(shot("2026-09-08", 7, { shotCategory: "pitch" }));
    current.rawShots.push(shot("2026-09-08", 8, { sessionType: "real_round" }));
    current.rawShots.push(shot("2026-09-09", 9));
    const result = report(current, [day("2026-09-09", 100), day("2026-09-07", 5)]);
    expect(result.latest).toMatchObject({
      shotCount: 6,
      eligibleShotCount: 4,
      excludedShotCount: 2,
    });
    expect(result.previous?.dateKey).toBe("2026-09-07");
    expect(result.recentTrend.days.map((value) => value.dateKey)).toEqual([
      "2026-09-08",
      "2026-09-07",
    ]);
  });

  it("keeps same-day uploads together and uses London midnight", () => {
    const current = day("2026-09-08", 4, 3);
    current.rawShots.push(
      shot("2026-09-08", 5, {
        sessionId: "second-upload",
        shotAt: new Date("2026-09-07T23:15:00Z"),
      }),
    );
    const result = report(current, [day("2026-09-07", 8)]);
    expect(result.latest).toMatchObject({ uploadCount: 2, shotCount: 4, eligibleShotCount: 4 });
  });

  it("scopes the headline when most latest clubs lack a comparable baseline", () => {
    const current = day("2026-09-08", 1, 3);
    current.rawShots.push(
      ...day("2026-09-08", 20, 30, { clubId: "new-iron", clubType: "7i" }).rawShots.map((row) => ({
        ...row,
        id: `iron-${row.id}`,
      })),
    );
    const result = report(current, [day("2026-09-07", 10)]);
    expect(result.headline).toBe("Improvement in the comparable clubs");
    expect(result.coverage).toMatchObject({
      matchedClubs: 1,
      totalClubs: 2,
      matchedShotCount: 3,
      eligibleShotCount: 33,
    });
  });

  it("finds a same-equipment trend with equal date weights and dated outcomes", () => {
    const current = day("2026-09-08", 2);
    const history = [day("2026-09-07", 8, 100), day("2026-09-06", 12)];
    const result = report(current, history);
    const balanced = report(current, [day("2026-09-07", 8), day("2026-09-06", 12)]);
    expect(result.recentTrend.verdict).toBe("better");
    expect(result.recentTrend.verdict).toBe(balanced.recentTrend.verdict);
    expect(result.recentTrend.headline).toBe("Driver trend: improving");
    expect(result.recentTrend.days.map((value) => [value.verdict, value.baselineDateKey])).toEqual([
      ["better", "2026-09-07"],
      ["better", "2026-09-06"],
      ["baseline", null],
    ]);
    expect(result.recentTrend.days[0].takeaway).toContain("closer to target");
  });

  it("does not imply every matched club improved when two stayed steady", () => {
    const current = day("2026-09-08", 1);
    const previous = day("2026-09-07", 10);
    for (const clubType of ["6i", "7i"]) {
      for (const data of [current, previous]) {
        data.rawShots.push(
          ...day(data.dateKey, 5, 5, { clubId: clubType, clubType }).rawShots.map((row) => ({
            ...row,
            id: `${clubType}-${row.id}`,
          })),
        );
      }
    }
    current.rawShots.push(
      ...day(current.dateKey, 5, 5, { clubId: "new-5i", clubType: "5i" }).rawShots.map((row) => ({
        ...row,
        id: `5i-${row.id}`,
      })),
    );
    const result = report(current, [previous]);
    expect(result.headline).toBe("Improvement in the comparable clubs");
    expect(result.summary).toContain("1 improved, 2 steady");
    expect(result.summary).not.toContain("3 improved");
    expect(result.coverage.matchedClubs).toBe(3);
  });

  it("uses a shorter stable equipment window while preserving every loaded date", () => {
    const result = report(day("2026-09-08", 2), [
      day("2026-09-07", 8),
      day("2026-09-06", 12),
      day("2026-09-05", 20, 5, { clubId: "old-driver" }),
    ]);
    expect(result.recentTrend.verdict).toBe("better");
    expect(result.recentTrend.summary).toContain("3 practice dates");
    expect(result.recentTrend.days).toHaveLength(4);
    expect(result.recentTrend.days[2].verdict).toBe("building");
  });

  it("does not call a selected upload a complete practice-day trend", () => {
    const current = day("2026-09-08", 2);
    const result = buildTodayProgress({
      dateKey: current.dateKey,
      rawShots: current.rawShots,
      previousDays: [day("2026-09-07", 8), day("2026-09-06", 12)],
      scope: "session",
    });
    expect(result.scope).toBe("session");
    expect(result.summary).toContain("Selected upload");
    expect(result.recentTrend.verdict).toBe("building");
    expect(result.recentTrend.summary).toContain("one upload");
  });

  it("keeps an explicitly empty selection empty without borrowing historical shots", () => {
    const result = buildTodayProgress({
      dateKey: "2026-09-08",
      rawShots: [],
      previousDays: [day("2026-09-07", 5)],
    });
    expect(result.latest.eligibleShotCount).toBe(0);
    expect(result.clubs).toEqual([]);
    expect(result.verdict).toBe("building");
  });

  it("shows the large carry-loss trade-off instead of calling shorter landings improvement", () => {
    const result = report(day("2026-09-08", 3, 5, { carryYd: 120 }), [
      day("2026-09-07", 15, 5, { carryYd: 215 }),
      day("2026-09-06", 20, 5, { carryYd: 215 }),
    ]);
    expect(result.verdict).toBe("mixed");
    expect(result.clubs[0].verdict).toBe("mixed");
    expect(result.summary).toContain("95 yd less carry");
    expect(result.improvements[0]).toMatchObject({ metric: "offline", delta: -12 });
    expect(result.changes[0]).toMatchObject({
      metric: "carry",
      previous: 215,
      current: 120,
      delta: -95,
    });
    expect(result.recentTrend.verdict).toBe("mixed");
    expect(result.recentTrend.summary).toContain("95 yd less carry");
    expect(result.recentTrend.days[0].verdict).toBe("mixed");
    expect(result.recentTrend.days[0].takeaway).toContain("95 yd less carry");
  });

  it.each([206, 195])(
    "keeps a smaller carry change to %s descriptive while control improves",
    (carryYd) => {
      const result = report(day("2026-09-08", 3, 5, { carryYd }), [
        day("2026-09-07", 15, 5, { carryYd: 215 }),
      ]);
      expect(result.verdict).toBe("better");
      expect(result.summary).not.toContain("so the result is mixed");
    },
  );

  it("scopes club-filtered reports but retains the actual previous date when that club was absent", () => {
    const current = day("2026-09-08", 2);
    current.rawShots.push(
      ...day(current.dateKey, 20, 5, { clubId: "iron", clubType: "7i" }).rawShots.map((row) => ({
        ...row,
        id: `iron-${row.id}`,
      })),
    );
    const previous = day("2026-09-07", 20, 5, { clubId: "iron", clubType: "7i" });
    const older = day("2026-09-06", 15);
    const result = buildTodayProgress({
      dateKey: current.dateKey,
      rawShots: current.rawShots,
      previousDays: [previous, older],
      clubType: "driver",
    });
    expect(result.headline).toBe("Driver: more comparable practice is needed");
    expect(result.previous).toMatchObject({ dateKey: "2026-09-07", shotCount: 0, clubCount: 0 });
    expect(result.latest.shotCount).toBe(5);
    expect(result.clubs).toHaveLength(1);
    expect(result.clubs[0].clubType).toBe("driver");
    expect(result.verdict).toBe("building");
    expect(result.recentTrend.days.map((value) => value.shotCount)).toEqual([5, 0, 5]);
    expect(result.method[0]).toContain("limited to Driver");
  });
});
