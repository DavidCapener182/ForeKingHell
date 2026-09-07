import { describe, expect, it } from "vitest";
import { sessionCarryMedian } from "./session-carry-summary";
import { buildShotPatternPoints, summarizeShotPattern } from "./shot-pattern-chart-data";

const rows = [150, 152].map((carryYd, index) => ({
  id: `carry-${index}`,
  clubType: "7i",
  carryYd,
  sideCarryYd: null,
  apexFt: null,
}));

describe("selected session carry summary", () => {
  it("shows the151yd median without manufacturing a directional sample", () => {
    const included = new Set(rows.map((row) => row.id));
    const pattern = summarizeShotPattern(
      buildShotPatternPoints(rows, { trustedShotIds: included }),
    );
    expect(pattern.sampleSize).toBe(0);
    expect(pattern.medianCarryYd).toBeNull();
    expect(pattern.medianSideYd).toBeNull();
    expect(sessionCarryMedian(rows, included, "7i")).toBe(151);
    expect(rows.every((row) => row.sideCarryYd === null)).toBe(true);
  });

  it("retains reviewed exclusions and the selected club independently of missing fields", () => {
    const sample = [
      ...rows,
      { id: "excluded", clubType: "7i", carryYd: 999, sideCarryYd: null, apexFt: null },
      { id: "other-club", clubType: "driver", carryYd: 280, sideCarryYd: null, apexFt: null },
      { id: "missing", clubType: "7i", carryYd: null, sideCarryYd: null, apexFt: null },
      { id: "invalid", clubType: "7i", carryYd: NaN, sideCarryYd: null, apexFt: null },
    ];
    const included = new Set(sample.filter((row) => row.id !== "excluded").map((row) => row.id));
    expect(sessionCarryMedian(sample, included, "7i")).toBe(151);
    expect(sessionCarryMedian(sample, included, "driver")).toBe(280);
    expect(sessionCarryMedian(sample, new Set(), "7i")).toBeNull();
    expect(sessionCarryMedian(sample, included, "putter")).toBeNull();
  });
});
