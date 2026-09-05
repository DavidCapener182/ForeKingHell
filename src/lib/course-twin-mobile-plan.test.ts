import { describe, expect, it } from "vitest";
import {
  mobileCourseTwinPlanOptions,
  projectedLandingEllipse,
  mobilePlanHasMappedSurfaces,
} from "./course-twin-mobile-plan";
import type { CourseTwinFeature } from "./course-twin-contract";
import type { CourseTwinStrategyClub, CourseTwinStrategyDocument } from "./course-twin-strategy";
function club(id: string, carry: number, hazard: number, leave: number) {
  return {
    clubId: id,
    carryMedianYd: carry,
    averageRemainingYd: leave,
    expectedRiskStrokes: hazard,
    probabilities: {
      tee: 0,
      fairway: 1 - hazard,
      green: 0,
      rough: 0,
      bunker: hazard,
      water: 0,
      trees: 0,
      out_of_bounds: 0,
    },
  } as CourseTwinStrategyClub;
}
function document(clubs: CourseTwinStrategyClub[]): CourseTwinStrategyDocument {
  return { recommended: clubs[0] ?? null, clubs } as CourseTwinStrategyDocument;
}
describe("mobile map strategy comparisons", () => {
  it("withholds hazard choices when the course only has estimated outlines or missing features", () => {
    const feature = {
      holeNumber: 2,
      type: "fairway",
      source: "estimated_centerline",
    } as CourseTwinFeature;
    expect(mobilePlanHasMappedSurfaces({ features: [feature] }, 2)).toBe(false);
    expect(mobilePlanHasMappedSurfaces({ features: [] }, 2)).toBe(false);
    expect(
      mobilePlanHasMappedSurfaces({ features: [{ ...feature, source: "OpenStreetMap" }] }, 2),
    ).toBe(true);
    expect(
      mobilePlanHasMappedSurfaces(
        {
          features: [
            { ...feature, source: "OpenStreetMap" },
            { ...feature, type: "green" },
          ],
        },
        2,
      ),
    ).toBe(false);
    expect(
      mobilePlanHasMappedSurfaces({ features: [{ ...feature, source: "OpenStreetMap" }] }, 1),
    ).toBe(false);
  });

  it("uses only shorter equally safe options and longer options with an actual shorter leave", () => {
    const normal = club("normal", 180, 0.1, 150);
    const safe = club("safe", 160, 0.05, 170);
    const aggressive = club("long", 210, 0.25, 130);
    expect(mobileCourseTwinPlanOptions(document([normal, safe, aggressive]))).toEqual({
      safe,
      normal,
      aggressive,
    });
    expect(
      mobileCourseTwinPlanOptions(
        document([normal, club("short-risky", 150, 0.2, 180), club("overshoot", 350, 0.4, 200)]),
      ),
    ).toEqual({ safe: null, normal, aggressive: null });
  });
  it("does not fabricate alternatives or mutate the model's club ordering", () => {
    const normal = club("only", 180, 0, 150);
    const input = document([normal]);
    expect(mobileCourseTwinPlanOptions(input)).toEqual({ safe: null, normal, aggressive: null });
    expect(input.clubs).toEqual([normal]);
    expect(mobileCourseTwinPlanOptions(document([]))).toEqual({
      safe: null,
      normal: null,
      aggressive: null,
    });
  });
  it("derives the ellipse centre and orientation from the actual projected cloud", () => {
    const ellipse = projectedLandingEllipse([
      [0, 0],
      [2, 0],
      [-2, 0],
      [0, 1],
      [0, -1],
    ])!;
    expect(ellipse.cx).toBe(0);
    expect(ellipse.cy).toBe(0);
    expect(ellipse.rx).toBeCloseTo(2 * Math.sqrt(2));
    expect(ellipse.ry).toBeCloseTo(Math.sqrt(2));
    expect(ellipse.angle).toBe(0);
    const rotated = projectedLandingEllipse([
      [10, 10],
      [10, 12],
      [10, 8],
      [11, 10],
      [9, 10],
    ])!;
    expect(rotated.cx).toBe(10);
    expect(rotated.cy).toBe(10);
    expect(rotated.angle).toBe(90);
    expect(
      projectedLandingEllipse([
        [0, 0],
        [NaN, 0],
        [1, 1],
      ]),
    ).toBeNull();
  });
});
