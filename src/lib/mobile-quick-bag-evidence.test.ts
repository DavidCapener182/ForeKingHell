import { describe, expect, it } from "vitest";
import { mobileQuickBagClub } from "./mobile-quick-bag-evidence";
import { calculateStockYardage, type StockShot } from "./stock-yardage";
const club = { id: "seven", type: "7i", brand: null, model: null };
const shots = (): StockShot[] =>
  Array.from({ length: 12 }, (_, i) => ({
    carryYd: 150 + (i % 3),
    totalYd: i < 3 ? 160 : null,
    sideCarryYd: null,
    shotAt: new Date(Date.UTC(2026, 7, 22 - i)),
    reviewStatus: "included",
    sessionType: "range",
  }));
describe("Quick Bag evidence", () => {
  it("keeps measured carry distinct from the existing rounded course number and reports measured miss", () => {
    const measured = shots().map((shot) => ({ ...shot, sideCarryYd: -9 }));
    const data = mobileQuickBagClub(club, measured);
    expect(data.trustedCarryYd).toBe(151);
    expect(data.playNumberYd).toBe(
      calculateStockYardage(measured, measured.length, { clubType: "7i" }).coursePlayCarryYd,
    );
    expect(data.playNumberYd).not.toBe(data.trustedCarryYd);
    expect(data.typicalMiss).toBe("9 yd left");
  });
  it("uses one trusted selection and never lets a newer excluded shot advance its date", () => {
    const data = mobileQuickBagClub(club, [
      {
        ...shots()[0],
        carryYd: 300,
        totalYd: 400,
        reviewStatus: "user_excluded",
        shotAt: "2026-09-01",
      },
      ...shots(),
    ]);
    expect(data).toMatchObject({
      trustedCarryYd: 151,
      totalYd: 160,
      sampleSize: 12,
      totalSampleSize: 3,
      latestEvidenceDate: "2026-08-22T00:00:00.000Z",
      patternSampleSize: 0,
      medianLateralYd: null,
    });
  });
  it("does not invent a number or measurement date for an empty club", () => {
    expect(mobileQuickBagClub(club, [])).toMatchObject({
      trustedCarryYd: null,
      totalYd: null,
      latestEvidenceDate: null,
      sampleSize: 0,
    });
  });
  it("keeps sand wedge full swings separate from touch", () => {
    const data = mobileQuickBagClub({ ...club, type: "sw" }, [
      ...shots().map((s) => ({ ...s, carryYd: 82, totalYd: 88, shotCategory: "full" })),
      ...shots().map((s) => ({ ...s, carryYd: 25, totalYd: 30, shotCategory: "chip" })),
    ]);
    expect(data).toMatchObject({
      trustedCarryYd: 82,
      totalYd: 88,
      sampleSize: 12,
      evidenceKind: "full",
    });
  });
});
