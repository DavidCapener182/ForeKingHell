import { describe, expect, it } from "vitest";

import { buildClubEvolutionRows, type ClubEvolutionClub } from "@/lib/club-evolution";
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
    expect(fiveWood?.points.map((point) => point.label)).toEqual(["Apr", "May", "Jun"]);
    expect(fiveWood?.points.map((point) => point.carryYd)).toEqual([186, 184.9, 183.8]);
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

function shot(carryYd: number, shotAt: string): StockShot {
  return {
    carryYd,
    totalYd: carryYd + 10,
    sideCarryYd: 0,
    shotCategory: "full",
    qualityTag: null,
    shotAt,
  };
}
