import { describe, expect, it } from "vitest";
import { mobileCourseTwinBagProfile } from "./mobile-course-twin-evidence";
import { mobileQuickBagClub } from "./mobile-quick-bag-evidence";
import type { StockShot } from "./stock-yardage";

const club = { id: "driver", type: "driver", brand: null, model: null };
type ModelTestShot = StockShot & { spinRate?: number | null; spinAxis?: number | null };
const shots: ModelTestShot[] = Array.from({ length: 40 }, (_, i) => ({
  carryYd: i < 20 ? 190 + (i % 3) : 215 + (i % 3),
  totalYd: i < 20 ? 210 : 245,
  sideCarryYd: i < 20 ? (i % 2 ? -10 : 20) : 90,
  ballSpeedMph: i < 20 ? 125 : 170,
  launchAngleDeg: i < 20 ? 15 : 25,
  spinRate: i < 20 ? 2500 : 5000,
  spinAxis: i < 20 ? 5 : 40,
  shotAt: new Date(Date.UTC(2026, 8, 1, 12, 0, -i)),
  reviewStatus: "included" as const,
  sessionType: "range",
}));
function model(input: ModelTestShot[] = shots) {
  return mobileCourseTwinBagProfile(mobileQuickBagClub(club, input), input);
}
describe("mobile Course Twin evidence", () => {
  it("uses Bag carry and only the same latest full-swing window for every shape metric", () => {
    const bag = mobileQuickBagClub(club, shots);
    expect(model()).toMatchObject({
      carryMedianYd: bag.trustedCarryYd,
      totalMedianYd: bag.totalYd,
      confidenceScore: bag.confidence,
      sampleSize: 20,
      sideMeanYd: 5,
      ballSpeedMeanMph: 125,
      launchMeanDeg: 15,
      spinMeanRpm: 2500,
      spinAxisMeanDeg: 5,
      evidenceWindow: {
        basis: "latest-reliable",
        latestShotAt: bag.latestEvidenceDate,
        lowCarryYd: bag.lowYd,
        highCarryYd: bag.highYd,
        lateralSampleSize: 20,
      },
    });
    expect(model()!.carryMedianYd).toBeLessThan(200);
  });
  it("does not let newer excluded shots change the model or evidence date", () => {
    expect(
      model([
        {
          ...shots[0],
          carryYd: 350,
          sideCarryYd: 100,
          reviewStatus: "user_excluded",
          shotAt: new Date("2026-09-02"),
        },
        ...shots,
      ]),
    ).toEqual(model());
  });
  it("keeps absent launch metrics absent, without borrowing older readings", () => {
    const missing = shots.map((shot, i) =>
      i < 20
        ? {
            ...shot,
            ballSpeedMph: null,
            launchAngleDeg: null,
            spinRate: null,
            spinAxis: null,
            totalYd: null,
          }
        : shot,
    );
    expect(model(missing)).toMatchObject({
      totalMedianYd: null,
      ballSpeedMeanMph: null,
      launchMeanDeg: null,
      spinMeanRpm: null,
      spinAxisMeanDeg: null,
    });
  });
  it("withholds a hazard model for sparse side evidence, pitch shots and touch clubs", () => {
    expect(model(shots.map((shot, i) => ({ ...shot, sideCarryYd: i < 4 ? 10 : null })))).toBeNull();
    expect(model(shots.slice(0, 4))).toBeNull();
    expect(model(shots.map((shot) => ({ ...shot, shotCategory: "pitch" })))).toBeNull();
    const bag = mobileQuickBagClub(club, shots);
    expect(mobileCourseTwinBagProfile({ ...bag, evidenceKind: "touch" }, shots)).toBeNull();
  });
});
