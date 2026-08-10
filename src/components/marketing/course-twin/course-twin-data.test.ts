import { describe, expect, it } from "vitest";

import { SHOT_PLANS, seededUnit, terrainHeight } from "./course-twin-data";

describe("marketing Course Twin plans", () => {
  it("keeps the safer 3 Wood plan visibly distinct from Driver", () => {
    const threeWood = SHOT_PLANS["three-wood"];
    const driver = SHOT_PLANS.driver;

    expect(threeWood.label).toBe("3 Wood");
    expect(driver.label).toBe("Driver");
    expect(driver.carryYards).toBeGreaterThan(threeWood.carryYards);
    expect(driver.dispersion.radiusX).toBeGreaterThan(threeWood.dispersion.radiusX);
    expect(driver.dispersion.radiusZ).toBeGreaterThan(threeWood.dispersion.radiusZ);
    expect(driver.landing).not.toEqual(threeWood.landing);
    expect(driver.missLabel).toMatch(/water/i);
    expect(threeWood.trajectoryLabel).toMatch(/controlled/i);
  });

  it("generates stable terrain and seeded placement inputs", () => {
    const first = seededUnit(18_690_401);
    const second = seededUnit(18_690_401);

    expect(Array.from({ length: 12 }, first)).toEqual(Array.from({ length: 12 }, second));
    expect(terrainHeight(-3.25, 18.5)).toBe(terrainHeight(-3.25, 18.5));
  });
});
