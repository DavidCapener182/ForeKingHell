import { describe, expect, it } from "vitest";

import {
  buildEquipmentChangeImpacts,
  buildGappingMatrixRows,
  buildSessionDeltaRows,
  buildSessionRoastFacts,
  type EquipmentHistoryRow,
  type SimulatorLabClub,
  type SimulatorLabSession,
  type SimulatorLabShot,
} from "@/lib/simulator-lab";

describe("simulator lab analytics", () => {
  it("flags WITB carry overlaps and dangerous missing windows in bag order", () => {
    const clubs: SimulatorLabClub[] = [
      club("driver", "driver"),
      club("3w", "3w"),
      club("7i", "7i"),
      club("8i", "8i"),
    ];
    const shots = [
      ...stockShots("driver", "driver", 240),
      ...stockShots("3w", "3w", 236),
      ...stockShots("7i", "7i", 160),
      ...stockShots("8i", "8i", 135),
    ];

    const rows = buildGappingMatrixRows({ clubs, shots });

    expect(rows.map((row) => row.clubType)).toEqual(["driver", "3w", "7i", "8i"]);
    expect(rows.find((row) => row.clubType === "driver")).toMatchObject({
      gapToNextYd: 4,
      gapStatus: "overlap",
    });
    expect(rows.find((row) => row.clubType === "7i")).toMatchObject({
      gapToNextYd: 25,
      gapStatus: "danger",
      gapLabel: "Missing window",
    });
  });

  it("compares latest simulator clubs against the previous 30-day baseline", () => {
    const latest = Array.from({ length: 3 }, (_, index) =>
      labShot({
        id: `latest-${index}`,
        clubId: "7i",
        clubType: "7i",
        carryYd: 160,
        ballSpeedMph: 125,
        smashFactor: 1.38,
        sideCarryYd: 3,
      }),
    );
    const baseline = Array.from({ length: 5 }, (_, index) =>
      labShot({
        id: `baseline-${index}`,
        clubId: "7i",
        clubType: "7i",
        carryYd: 154,
        ballSpeedMph: 120,
        smashFactor: 1.32,
        sideCarryYd: 8,
      }),
    );

    const rows = buildSessionDeltaRows(latest, baseline);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clubType: "7i",
      latestShotCount: 3,
      baselineShotCount: 5,
      carryDeltaYd: 6,
      ballSpeedDeltaMph: 5,
      smashDelta: 0.06,
      offlineDeltaYd: -5,
      verdict: "better",
    });
  });

  it("keeps equipment after-windows bounded by the next setup change", () => {
    const firstChange = new Date("2026-05-15T09:00:00.000Z");
    const nextChange = new Date("2026-05-18T09:00:00.000Z");
    const history: EquipmentHistoryRow[] = [
      equipmentHistory("history-1", firstChange, { loftDeg: 9, notes: "Sleeve down" }),
      equipmentHistory("history-2", nextChange, { shaft: "Heavier shaft" }),
    ];
    const before = Array.from({ length: 5 }, (_, index) =>
      labShot({
        id: `before-${index}`,
        clubId: "driver",
        clubType: "driver",
        shotAt: new Date(`2026-05-${10 + index}T12:00:00.000Z`),
        carryYd: 220,
        ballSpeedMph: 145,
        smashFactor: 1.38,
        sideCarryYd: 12,
      }),
    );
    const afterBeforeNextChange = Array.from({ length: 5 }, (_, index) =>
      labShot({
        id: `after-${index}`,
        clubId: "driver",
        clubType: "driver",
        shotAt: new Date(`2026-05-16T1${index}:00:00.000Z`),
        carryYd: 230,
        ballSpeedMph: 150,
        smashFactor: 1.43,
        sideCarryYd: 5,
      }),
    );
    const afterNextChange = Array.from({ length: 5 }, (_, index) =>
      labShot({
        id: `later-${index}`,
        clubId: "driver",
        clubType: "driver",
        shotAt: new Date(`2026-05-20T1${index}:00:00.000Z`),
        carryYd: 180,
        ballSpeedMph: 130,
        smashFactor: 1.2,
        sideCarryYd: 30,
      }),
    );

    const impacts = buildEquipmentChangeImpacts(history, [
      ...before,
      ...afterBeforeNextChange,
      ...afterNextChange,
      labShot({
        id: "excluded-before",
        clubId: "driver",
        clubType: "driver",
        shotAt: new Date("2026-05-12T08:00:00.000Z"),
        reviewStatus: "calibration",
      }),
      labShot({
        id: "excluded-after",
        clubId: "driver",
        clubType: "driver",
        shotAt: new Date("2026-05-16T08:00:00.000Z"),
        reviewStatus: "user_excluded",
      }),
    ]);
    const firstImpact = impacts.find((impact) => impact.id === "history-1");

    expect(firstImpact).toMatchObject({
      equipmentLabel: "9 deg loft / Sleeve down",
      beforeShotCount: 5,
      afterShotCount: 5,
      carryDeltaYd: 10,
      ballSpeedDeltaMph: 5,
      smashDelta: 0.05,
      offlineDeltaYd: -7,
      verdict: "helped",
    });
  });

  it("extracts golf-only roast facts from latest session outliers", () => {
    const facts = buildSessionRoastFacts(
      session(),
      [
        labShot({
          id: "wild-driver",
          clubType: "driver",
          sideCarryYd: 46,
          smashFactor: 1.18,
          reviewStatus: "restored",
          qualityTag: "top",
        }),
        labShot({ id: "low-smash-7i", clubType: "7i", sideCarryYd: -12, smashFactor: 1.21 }),
        labShot({ id: "normal-8i", clubType: "8i", sideCarryYd: 3, smashFactor: 1.32 }),
      ],
      [],
    );

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Wildest miss",
          value: "Driver +46 yd",
          severity: "spicy",
        }),
        expect.objectContaining({
          label: "Low-smash strikes",
          value: "2/3",
        }),
        expect.objectContaining({
          label: "Tagged horrors",
          value: "1 flagged",
        }),
      ]),
    );
  });

  it("uses included and restored shots only across simulator-derived evidence", () => {
    const excludedStatuses = [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ] as const;
    const eligible = [
      ...Array.from({ length: 5 }, (_, index) =>
        labShot({
          id: `included-${index}`,
          clubId: "7i",
          clubType: "7i",
          carryYd: 150,
          shotAt: new Date(`2026-05-${10 + index}T12:00:00.000Z`),
        }),
      ),
      labShot({
        id: "restored-legacy-mishit",
        clubId: "7i",
        clubType: "7i",
        carryYd: 150,
        reviewStatus: "restored",
        qualityTag: "mishit",
      }),
    ];
    const excluded = [
      ...excludedStatuses.map((reviewStatus, index) =>
        labShot({
          id: `excluded-${reviewStatus}`,
          clubId: "7i",
          clubType: "7i",
          carryYd: 300 + index,
          reviewStatus,
        }),
      ),
      labShot({
        id: "legacy-suggested",
        clubId: "7i",
        clubType: "7i",
        carryYd: 320,
        reviewStatus: "included",
        qualityTag: "mishit",
      }),
    ];

    const gapping = buildGappingMatrixRows({
      clubs: [club("7i", "7i")],
      shots: [...eligible, ...excluded],
    });
    expect(gapping[0]).toMatchObject({ sampleSize: 6, bestStockCarryYd: 150 });

    const deltas = buildSessionDeltaRows(
      [...eligible.slice(0, 3).map((shot) => ({ ...shot, carryYd: 160 })), ...excluded],
      eligible.slice(0, 5),
    );
    expect(deltas[0]).toMatchObject({
      latestShotCount: 3,
      baselineShotCount: 5,
      carryDeltaYd: 10,
    });

    const facts = buildSessionRoastFacts(
      session(),
      [
        labShot({ id: "included", sideCarryYd: 2, smashFactor: 1.3 }),
        labShot({
          id: "restored",
          sideCarryYd: 30,
          smashFactor: 1.2,
          reviewStatus: "restored",
          qualityTag: "top",
        }),
        ...excluded.map((shot) => ({ ...shot, sideCarryYd: 90, smashFactor: 1.1 })),
      ],
      [],
    );
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Wildest miss", value: "7i +30 yd" }),
        expect.objectContaining({ label: "Low-smash strikes", value: "1/2" }),
        expect.objectContaining({ label: "Tagged horrors", value: "1 flagged" }),
      ]),
    );
  });
});

function club(id: string, type: string): SimulatorLabClub {
  return {
    id,
    type,
    brand: "FKH",
    model: type.toUpperCase(),
  };
}

function stockShots(clubId: string, clubType: string, carryYd: number) {
  return Array.from({ length: 5 }, (_, index) =>
    labShot({
      id: `${clubId}-${index}`,
      clubId,
      clubType,
      carryYd,
      totalYd: carryYd + 10,
      shotAt: new Date(`2026-05-${10 + index}T12:00:00.000Z`),
    }),
  );
}

function equipmentHistory(
  id: string,
  effectiveFrom: Date,
  overrides: Partial<EquipmentHistoryRow> = {},
): EquipmentHistoryRow {
  return {
    id,
    clubId: "driver",
    clubType: "driver",
    clubBrand: "FKH",
    clubModel: "Driver",
    effectiveFrom,
    effectiveTo: null,
    loftDeg: null,
    lieDeg: null,
    shaft: null,
    swingWeight: null,
    notes: null,
    ...overrides,
  };
}

function session(overrides: Partial<SimulatorLabSession> = {}): SimulatorLabSession {
  return {
    id: "session-1",
    source: "trackman",
    type: "simulator",
    date: new Date("2026-05-30T12:00:00.000Z"),
    fileName: "latest-trackman.csv",
    ...overrides,
  };
}

function labShot(overrides: Partial<SimulatorLabShot> = {}): SimulatorLabShot {
  return {
    id: "shot-1",
    sessionId: "session-1",
    clubId: "7i",
    clubType: "7i",
    shotAt: new Date("2026-05-30T12:00:00.000Z"),
    carryYd: 150,
    totalYd: 160,
    sideCarryYd: 0,
    ballSpeedMph: 120,
    clubSpeedMph: 90,
    launchAngleDeg: 15,
    smashFactor: 1.33,
    reviewStatus: "included",
    shotCategory: "full",
    qualityTag: null,
    sessionType: "simulator",
    source: "trackman",
    ...overrides,
  };
}
