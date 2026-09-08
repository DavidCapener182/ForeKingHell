import { describe, expect, it } from "vitest";

import { buildDispersionScale, carryAxisMax } from "@/lib/dispersion-scale";

describe("carry axis maximum", () => {
  it.each([
    [234, 240],
    [224, 230],
    [206.8, 210],
    [200, 200],
    [0, 10],
    [-4, 10],
    [Number.NaN, 10],
    [Number.POSITIVE_INFINITY, 10],
  ])("rounds %s up to %s yards", (carry, expected) => {
    expect(carryAxisMax(carry)).toBe(expected);
  });
});

describe("dispersion scale", () => {
  it("keeps ordinary 20-yard misses inside a consistent 50-yard frame", () => {
    expect(
      buildDispersionScale([
        { carryYd: 195.8, sideCarryYd: 19.4 },
        { carryYd: 206.8, sideCarryYd: -20 },
      ]),
    ).toEqual({ maxSideYd: 50, maxCarryYd: 210, targetSideYd: 10 });
    expect(buildDispersionScale([{ carryYd: 70, sideCarryYd: 2 }])).toEqual({
      maxSideYd: 50,
      maxCarryYd: 70,
      targetSideYd: 10,
    });
  });

  it("includes wider and longer landings without changing the target width", () => {
    const scale = buildDispersionScale([
      { carryYd: 315, sideCarryYd: -80 },
      { carryYd: null, totalYd: 365, sideCarryYd: 120 },
    ]);
    expect(scale).toEqual({ maxSideYd: 150, maxCarryYd: 370, targetSideYd: 10 });
  });

  it("does not let missing or non-finite coordinates distort the view", () => {
    expect(
      buildDispersionScale([
        { carryYd: 500, sideCarryYd: null },
        { carryYd: null, sideCarryYd: 500 },
        { carryYd: Number.NaN, sideCarryYd: 500 },
        { carryYd: 200, sideCarryYd: Number.POSITIVE_INFINITY },
      ]),
    ).toEqual(buildDispersionScale([]));
  });

  it("retains the full sideways range for a plotted zero-carry shot", () => {
    expect(buildDispersionScale([{ carryYd: 0, sideCarryYd: 100 }])).toEqual({
      maxSideYd: 100,
      maxCarryYd: 10,
      targetSideYd: 10,
    });
  });
});
