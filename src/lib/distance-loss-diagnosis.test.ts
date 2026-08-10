import { describe, expect, it } from "vitest";

import {
  buildDistanceLossDiagnosis,
  type DistanceLossExposure,
  type DistanceLossShot,
} from "@/lib/distance-loss-diagnosis";

describe("distance loss diagnosis", () => {
  it("separates measured speed, exposure, launch, efficiency and missing spin", () => {
    const diagnosis = buildDistanceLossDiagnosis({
      shots: [
        ...monthShots("2026-05-15", 8, {
          carryYd: 203,
          ballSpeedMph: 132,
          clubSpeedMph: 89.6,
          launchAngleDeg: 14.7,
          smashFactor: 1.48,
        }),
        ...monthShots("2026-06-15", 12, {
          carryYd: 200.2,
          ballSpeedMph: 131.1,
          clubSpeedMph: 90.4,
          launchAngleDeg: 14.3,
          smashFactor: 1.47,
        }),
        ...monthShots("2026-07-15", 10, {
          carryYd: 193.6,
          ballSpeedMph: 128.9,
          clubSpeedMph: 87.9,
          launchAngleDeg: 12.4,
          smashFactor: 1.46,
        }),
        ...monthShots("2026-08-05", 8, {
          carryYd: 183.8,
          ballSpeedMph: 124.8,
          clubSpeedMph: 86.2,
          launchAngleDeg: 12.1,
          smashFactor: 1.45,
        }),
      ],
      exposure: exposureRows(),
      now: new Date("2026-08-08T12:00:00Z"),
    });

    expect(diagnosis).toMatchObject({
      status: "ready",
      carryChangeYd: -16.4,
      ballSpeedChangeMph: -6.3,
      clubSpeedChangeMph: -4.2,
      launchChangeDeg: -2.2,
      smashChange: -0.02,
      baseline: { label: "Jun" },
      current: { label: "Aug" },
      exposure: {
        recentActiveDays: 6,
        previousActiveDays: 17,
        activeDayChangePercent: -64.7,
      },
    });
    expect(diagnosis.headline).toContain("multifactorial");
    expect(diagnosis.headline).not.toContain("speed-led");
    expect(diagnosis.summary).toContain("does not justify treating speed as the only cause");
    expect(diagnosis.summary).not.toContain("body weight");
    expect(diagnosis.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "speed", status: "Likely contributor" }),
        expect.objectContaining({ key: "exposure", status: "Plausible contributor" }),
        expect.objectContaining({ key: "launch", status: "Adds to the loss" }),
        expect.objectContaining({ key: "efficiency", status: "Not the main failure" }),
        expect.objectContaining({ key: "spin", status: "Unresolved" }),
      ]),
    );
  });

  it("excludes tagged mishits and estimated club data from the relevant medians", () => {
    const june = monthShots("2026-06-15", 8, {
      carryYd: 200,
      ballSpeedMph: 130,
      clubSpeedMph: 90,
      launchAngleDeg: 14,
      smashFactor: 1.47,
    });
    const august = monthShots("2026-08-05", 8, {
      carryYd: 184,
      ballSpeedMph: 125,
      clubSpeedMph: 86,
      launchAngleDeg: 12,
      smashFactor: 1.45,
    });

    june.push(
      makeShot("2026-06-16", {
        carryYd: 20,
        qualityTag: "top",
      }),
    );
    august.push(
      makeShot("2026-08-06", {
        clubSpeedMph: 120,
        smashFactor: 1.1,
        clubDataEstType: "1",
      }),
    );

    const diagnosis = buildDistanceLossDiagnosis({
      shots: [...june, ...august],
      exposure: [],
      now: new Date("2026-08-08T12:00:00Z"),
    });

    expect(diagnosis.baseline).toMatchObject({ carryYd: 200, clubSpeedMph: 90 });
    expect(diagnosis.current).toMatchObject({ clubSpeedMph: 86, smashFactor: 1.45 });
  });

  it("does not diagnose a loss from one usable month", () => {
    const diagnosis = buildDistanceLossDiagnosis({
      shots: monthShots("2026-08-05", 8, {
        carryYd: 184,
        ballSpeedMph: 125,
        clubSpeedMph: 86,
        launchAngleDeg: 12,
        smashFactor: 1.45,
      }),
      exposure: [],
      now: new Date("2026-08-08T12:00:00Z"),
    });

    expect(diagnosis.status).toBe("insufficient");
    expect(diagnosis.carryChangeYd).toBeNull();
  });
});

function monthShots(
  date: string,
  count: number,
  values: Partial<DistanceLossShot>,
): DistanceLossShot[] {
  return Array.from({ length: count }, (_, index) =>
    makeShot(date, { ...values, sessionId: `${date}-${index}` }),
  );
}

function makeShot(date: string, values: Partial<DistanceLossShot>): DistanceLossShot {
  return {
    sessionId: values.sessionId ?? `session-${date}`,
    shotAt: `${date}T12:00:00Z`,
    source: "rapsodo",
    carryYd: 190,
    ballSpeedMph: 128,
    clubSpeedMph: 88,
    launchAngleDeg: 13,
    smashFactor: 1.46,
    spinRate: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: "0",
    ...values,
  };
}

function exposureRows(): DistanceLossExposure[] {
  const recent = [
    "2026-06-18",
    "2026-06-28",
    "2026-07-08",
    "2026-07-18",
    "2026-07-28",
    "2026-08-06",
  ];
  const previous = [
    "2026-04-20",
    "2026-04-23",
    "2026-04-26",
    "2026-04-29",
    "2026-05-02",
    "2026-05-05",
    "2026-05-08",
    "2026-05-11",
    "2026-05-14",
    "2026-05-17",
    "2026-05-20",
    "2026-05-23",
    "2026-05-26",
    "2026-05-29",
    "2026-06-01",
    "2026-06-05",
    "2026-06-10",
  ];

  return [...recent, ...previous].map((date, index) => ({
    id: `exposure-${index}`,
    occurredAt: `${date}T12:00:00Z`,
  }));
}
