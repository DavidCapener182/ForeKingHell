import { describe, expect, it } from "vitest";
import { mobileQuickBagClub } from "./mobile-quick-bag-evidence";
import { mobileStrategyClubs } from "./mobile-strategy-evidence";
import { buildHoleStrategies } from "./course-strategy";
import type { StockShot } from "./stock-yardage";
import { createCaddieBookSnapshot, readCaddieBookSnapshot } from "./caddie-book-snapshot";

const equipment = { id: "driver", type: "driver", brand: null, model: null };
const shots: StockShot[] = Array.from({ length: 40 }, (_, i) => ({
  carryYd: i < 20 ? 190 + (i % 3) : 215 + (i % 3),
  totalYd: null,
  sideCarryYd: i % 2 ? -12 : 22,
  shotAt: new Date(Date.UTC(2026, 8, 1, 12, 0, -i)),
  reviewStatus: "included",
  sessionType: "range",
}));
describe("mobile strategy evidence", () => {
  it("keeps carry, quartiles and observed lateral limits in the Bag's latest reliable window", () => {
    const bag = mobileQuickBagClub(equipment, shots);
    const [club] = mobileStrategyClubs([bag]);
    expect(club.carryYd).toBe(bag.trustedCarryYd);
    expect(club.carryYd).toBeLessThan(200);
    expect(club.minCarryYd).toBe(bag.lowYd);
    expect(club.maxCarryYd).toBe(bag.highYd);
    expect(club.confidence).toBe(bag.confidence / 100);
    expect(club).toMatchObject({
      leftYd: 12,
      rightYd: 22,
      sampleSize: 20,
      evidenceWindow: { basis: "latest-reliable", lateralSampleSize: 20 },
    });
    const book = createCaddieBookSnapshot({
      accountId: "owner",
      course: { id: "course", name: "Course" },
      tee: null,
      strategy: buildHoleStrategies({
        clubs: [club],
        holes: [{ holeNumber: 1, par: 4, yards: 350 }],
        hazardsByHole: new Map(),
      }),
      trustedBag: [club],
      courseMap: null,
      selectedHole: 1,
      selectedMode: "normal",
    });
    expect(readCaddieBookSnapshot(JSON.stringify(book), "owner")).toEqual(book);
  });
  it("does not recommend touch clubs or clubs without sufficient recent carry evidence", () => {
    const bag = mobileQuickBagClub(equipment, shots);
    expect(
      mobileStrategyClubs([
        { ...bag, evidenceKind: "touch" },
        { ...bag, trustedCarryYd: null },
        { ...bag, sampleSize: 4 },
      ]),
    ).toEqual([]);
  });
  it("excluded recent shots cannot advance the evidence date or widen the plotted range", () => {
    const bag = mobileQuickBagClub(equipment, [
      {
        ...shots[0],
        reviewStatus: "user_excluded",
        carryYd: 400,
        sideCarryYd: 200,
        shotAt: "2026-09-05",
      },
      ...shots,
    ]);
    expect(mobileStrategyClubs([bag])[0]).toMatchObject({
      rightYd: 22,
      evidenceWindow: { latestShotAt: "2026-09-01T12:00:00.000Z" },
    });
  });
  it("does not turn sparse side readings into a measured dispersion or a balanced miss", () => {
    const clubs = mobileStrategyClubs([
      mobileQuickBagClub(
        equipment,
        shots.map((s, i) => ({ ...s, sideCarryYd: i < 2 ? 15 : null })),
      ),
    ]);
    const [hole] = buildHoleStrategies({
      clubs,
      holes: [{ holeNumber: 1, par: 4, yards: 350 }],
      hazardsByHole: new Map(),
    });
    expect(hole.commonMiss).toBe("No measured pattern");
    expect(hole.strategyModes[0].evidence).toMatchObject({ leftYd: null, rightYd: null });
  });
});
