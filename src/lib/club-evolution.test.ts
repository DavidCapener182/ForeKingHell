import { describe, expect, it } from "vitest";

import {
  buildClubEvolutionRows,
  classifyClubEvolutionMovement,
  type ClubEvolutionClub,
  type ClubEvolutionMeasuredPoint,
} from "@/lib/club-evolution";
import type { StockShot } from "@/lib/stock-yardage";

describe("buildClubEvolutionRows", () => {
  it("renders every club against the same recent calendar-month window", () => {
    const rows = buildClubEvolutionRows(
      [
        club("driver", [
          shot(216.1, "2026-05-08T12:00:00.000Z"),
          shot(217.2, "2026-06-08T12:00:00.000Z"),
        ]),
        club("5w", [
          shot(186, "2026-04-08T12:00:00.000Z"),
          shot(184.9, "2026-05-08T12:00:00.000Z"),
          shot(183.8, "2026-06-08T12:00:00.000Z"),
        ]),
      ],
      { monthCount: 3 },
    );

    const driver = rows.find((row) => row.club.id === "driver");
    const fiveWood = rows.find((row) => row.club.id === "5w");

    expect(driver?.points.map((point) => point.label)).toEqual(["Apr", "May", "Jun"]);
    expect(driver?.points.map((point) => point.carryYd)).toEqual([null, 216.1, 217.2]);
    expect(driver?.points.map((point) => point.sampleSize)).toEqual([0, 1, 1]);
    expect(fiveWood?.points.map((point) => point.label)).toEqual(["Apr", "May", "Jun"]);
    expect(fiveWood?.points.map((point) => point.carryYd)).toEqual([186, 184.9, 183.8]);
    expect(fiveWood?.points.map((point) => point.sampleSize)).toEqual([1, 1, 1]);
  });

  it("drops populated months outside the latest three-calendar-month window", () => {
    const rows = buildClubEvolutionRows(
      [
        club("7i", [
          shot(155, "2026-03-08T12:00:00.000Z"),
          shot(157, "2026-05-08T12:00:00.000Z"),
          shot(158, "2026-06-08T12:00:00.000Z"),
        ]),
      ],
      { monthCount: 3 },
    );

    expect(rows[0]?.points.map((point) => point.label)).toEqual(["Apr", "May", "Jun"]);
    expect(rows[0]?.points.map((point) => point.carryYd)).toEqual([null, 157, 158]);
  });

  it("keeps an older month even when a club has more newer shots than the stock window", () => {
    const rows = buildClubEvolutionRows(
      [
        club("driver", [
          ...Array.from({ length: 44 }, (_, index) =>
            shot(214, `2026-04-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`),
          ),
          ...Array.from({ length: 260 }, (_, index) =>
            shot(216, `2026-05-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`),
          ),
          ...Array.from({ length: 58 }, (_, index) =>
            shot(217, `2026-06-${String((index % 22) + 1).padStart(2, "0")}T12:00:00.000Z`),
          ),
        ]),
      ],
      { maxShots: 200, monthCount: 3 },
    );

    expect(rows[0]?.points.map((point) => point.label)).toEqual(["Apr", "May", "Jun"]);
    expect(rows[0]?.points.map((point) => point.carryYd)).toEqual([214, 216, 217]);
    expect(rows[0]?.points.map((point) => point.sampleSize)).toEqual([44, 200, 58]);
  });

  it("uses median clean-stock carry and exposes clean sample counts", () => {
    const rows = buildClubEvolutionRows(
      [
        club("7i", [
          shot(140, "2026-05-08T12:00:00.000Z"),
          shot(160, "2026-05-08T12:05:00.000Z"),
          { ...shot(80, "2026-05-08T12:10:00.000Z"), qualityTag: "top" },
          shot(135, "2026-06-08T12:00:00.000Z"),
          shot(139, "2026-06-08T12:05:00.000Z"),
          shot(143, "2026-06-08T12:10:00.000Z"),
        ]),
      ],
      { monthCount: 2 },
    );

    expect(rows[0]?.points.map((point) => point.label)).toEqual(["May", "Jun"]);
    expect(rows[0]?.points.map((point) => point.carryYd)).toEqual([150, 139]);
    expect(rows[0]?.points.map((point) => point.sampleSize)).toEqual([2, 3]);
  });

  it("measures monthly lateral control from the same clean-stock sample", () => {
    const rows = buildClubEvolutionRows(
      [
        club("driver", [
          shot(200, "2026-05-08T12:00:00.000Z", -20),
          shot(202, "2026-05-08T12:05:00.000Z", 10),
          shot(188, "2026-06-08T12:00:00.000Z", -8),
          shot(190, "2026-06-08T12:05:00.000Z", 4),
          { ...shot(80, "2026-06-08T12:10:00.000Z", 40), qualityTag: "top" },
        ]),
      ],
      { monthCount: 2 },
    );

    expect(rows[0]?.points.map((point) => point.medianAbsoluteOfflineYd)).toEqual([15, 6]);
    expect(rows[0]?.points.map((point) => point.directionalSampleSize)).toEqual([2, 2]);
  });

  it("treats shorter carry with enough tighter directional evidence as a trade-off", () => {
    const movement = classifyClubEvolutionMovement([
      measuredPoint({ carryYd: 200, medianAbsoluteOfflineYd: 18 }),
      measuredPoint({
        key: "2026-06",
        label: "Jun",
        carryYd: 188,
        medianAbsoluteOfflineYd: 10,
      }),
    ]);

    expect(movement.kind).toBe("shorter-straighter");
    expect(movement.carryDeltaYd).toBe(-12);
    expect(movement.controlDeltaYd).toBe(-8);
  });

  it("keeps a carry drop as distance-down when control did not improve", () => {
    const movement = classifyClubEvolutionMovement([
      measuredPoint({ carryYd: 200, medianAbsoluteOfflineYd: 12 }),
      measuredPoint({
        key: "2026-06",
        label: "Jun",
        carryYd: 188,
        medianAbsoluteOfflineYd: 13,
      }),
    ]);

    expect(movement.kind).toBe("distance-down");
    expect(movement.controlDeltaYd).toBe(1);
  });

  it("does not call a trade-off from thin directional evidence", () => {
    const movement = classifyClubEvolutionMovement([
      measuredPoint({
        carryYd: 200,
        medianAbsoluteOfflineYd: 18,
        directionalSampleSize: 3,
      }),
      measuredPoint({
        key: "2026-06",
        label: "Jun",
        carryYd: 188,
        medianAbsoluteOfflineYd: 8,
        directionalSampleSize: 3,
      }),
    ]);

    expect(movement.kind).toBe("distance-down");
    expect(movement.controlDeltaYd).toBeNull();
  });

  it("omits clubs without two measured months in the shared window", () => {
    const rows = buildClubEvolutionRows(
      [
        club("driver", [
          shot(216, "2026-05-08T12:00:00.000Z"),
          shot(217, "2026-06-08T12:00:00.000Z"),
        ]),
        club("pw", [shot(126, "2026-06-08T12:00:00.000Z")]),
      ],
      { monthCount: 3 },
    );

    expect(rows.map((row) => row.club.id)).toEqual(["driver"]);
  });
});

function club(id: string, shots: StockShot[]): ClubEvolutionClub {
  return {
    id,
    type: id,
    shots,
  };
}

function shot(carryYd: number, shotAt: string, sideCarryYd = 0): StockShot {
  return {
    carryYd,
    totalYd: carryYd + 10,
    sideCarryYd,
    shotCategory: "full",
    qualityTag: null,
    shotAt,
  };
}

function measuredPoint(
  overrides: Partial<ClubEvolutionMeasuredPoint> = {},
): ClubEvolutionMeasuredPoint {
  return {
    key: "2026-05",
    label: "May",
    carryYd: 200,
    sampleSize: 12,
    medianAbsoluteOfflineYd: 12,
    directionalSampleSize: 12,
    ...overrides,
  };
}
