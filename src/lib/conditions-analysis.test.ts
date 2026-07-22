import { describe, expect, it } from "vitest";

import { buildConditionsAnalysis, strongestConditionDifference } from "./conditions-analysis";

describe("conditions analysis", () => {
  it("keeps contexts and recorded condition groups separate", () => {
    const shots = [
      ...makeShots("indoor", 12, 150, { Surface: "Mat", Ball: "Range ball" }),
      ...makeShots("on_course", 12, 158, { Surface: "Grass", Ball: "Pro V1" }),
    ];
    const result = buildConditionsAnalysis(shots);

    expect(
      result.find((item) => item.dimension === "context")?.groups.map((group) => group.label),
    ).toEqual(["Course", "Indoor"]);
    expect(result.find((item) => item.dimension === "surface")?.groups).toHaveLength(2);
    expect(
      result.find((item) => item.dimension === "ball")?.groups.map((group) => group.label),
    ).toContain("Premium ball");
  });

  it("does not silently classify missing metadata", () => {
    const result = buildConditionsAnalysis(makeShots("unknown", 8, 150, {}));
    const temperature = result.find((item) => item.dimension === "temperature");

    expect(temperature?.groups).toEqual([]);
    expect(temperature?.unclassifiedShots).toBe(8);
    expect(temperature?.caveat).toContain("stay outside the comparison");
  });

  it("finds the largest sufficiently sampled carry association", () => {
    const result = buildConditionsAnalysis([
      ...makeShots("indoor", 12, 150, {}),
      ...makeShots("on_course", 12, 162, {}),
    ]);

    expect(strongestConditionDifference(result)).toMatchObject({
      dimension: "Course, range and indoor",
      deltaYd: 12,
    });
  });
});

function makeShots(
  playContext: string,
  count: number,
  carryYd: number,
  sourceRaw: Record<string, string>,
) {
  return Array.from({ length: count }, (_, index) => ({
    sessionId: `${playContext}-${Math.floor(index / 6)}`,
    carryYd,
    sideCarryYd: index % 2 === 0 ? 4 : -4,
    playContext,
    sourceRaw,
    weather: null,
  }));
}
