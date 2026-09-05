import { describe, expect, it } from "vitest";
import { mobileQuickBagClub } from "./mobile-quick-bag-evidence";
import { mobileBagDistanceView } from "./mobile-bag-distance-view";
const baseline = mobileQuickBagClub({ id: "one", type: "7i", brand: null, model: null }, []);
describe("mobile 3D bag evidence", () => {
  it("uses the exact trusted carry and keeps lane offsets separate from measured side", () => {
    const input = [
      { ...baseline, id: "short", trustedCarryYd: 145.4, sampleSize: 20, medianLateralYd: 12 },
      { ...baseline, id: "long", trustedCarryYd: 190.4, sampleSize: 17, medianLateralYd: -8 },
    ];
    const model = mobileBagDistanceView(input);
    expect(model.limit).toBe(200);
    expect(model.clubs.map((club) => [club.id, club.carry, club.distance])).toEqual([
      ["long", 190.4, 95.2],
      ["short", 145.4, 72.7],
    ]);
    expect(model.clubs.map((club) => club.lane)).toEqual([-4, 4]);
    expect(input[0].medianLateralYd).toBe(12);
  });
  it("does not invent carry from play numbers, include touch or render unavailable values", () => {
    const rows = [
      baseline,
      {
        ...baseline,
        id: "touch",
        evidenceKind: "touch" as const,
        trustedCarryYd: 50,
        sampleSize: 30,
      },
      { ...baseline, id: "bad", trustedCarryYd: NaN, sampleSize: 20 },
      { ...baseline, id: "empty", trustedCarryYd: 150, sampleSize: 0 },
      { ...baseline, id: "play", playNumberYd: 160 },
    ];
    expect(mobileBagDistanceView(rows)).toEqual({ limit: 50, clubs: [] });
  });
});
