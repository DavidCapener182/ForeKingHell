import { describe, expect, it } from "vitest";

import {
  buildConfidenceHeatMaps,
  buildPathTrendTracking,
  buildSmartBagBuilder,
  buildWedgeMatrix,
  type BagIntelligenceClub,
} from "@/lib/bag-intelligence";

describe("bag intelligence", () => {
  it("suggests a gap wedge when PW to SW leaves a scoring window", () => {
    const clubs = [club("pw", 112), club("sw", 84)];
    const wedgeMatrix = buildWedgeMatrix(clubs);
    const suggested = wedgeMatrix.find((entry) => entry.isSuggested);

    expect(suggested?.clubType).toBe("gw");
    expect(suggested?.rows.map((row) => [row.label, row.carryYd, row.status])).toEqual([
      ["Full", 98, "target"],
      ["3/4", 83, "target"],
      ["Half", 69, "target"],
    ]);

    const smartBag = buildSmartBagBuilder({
      clubs,
      wedgeMatrix,
      gappingRows: [
        {
          id: "pw",
          clubType: "pw",
          gappingCarryYd: 112,
          gapToNextYd: 28,
          nextClubType: "sw",
          confidenceScore: 82,
          sampleSize: 18,
        },
      ],
    });

    expect(smartBag.suggestions[0]?.title).toBe("Add 48 deg GW");
    expect(smartBag.suggestions[0]?.scoreAfter).toBeGreaterThan(smartBag.currentScore);
  });

  it("keeps measured partial wedges separate from calibration targets", () => {
    const matrix = buildWedgeMatrix([
      club("gw", 100, {
        shots: [
          shot("2026-01-01", 100, "full"),
          shot("2026-01-02", 101, "full"),
          shot("2026-01-03", 86, "pitch"),
          shot("2026-01-04", 84, "pitch"),
          shot("2026-01-05", 85, "pitch"),
        ],
      }),
    ]);

    const gapWedge = matrix.find((entry) => entry.clubType === "gw");
    const threeQuarter = gapWedge?.rows.find((row) => row.key === "threeQuarter");
    const half = gapWedge?.rows.find((row) => row.key === "half");

    expect(threeQuarter).toMatchObject({
      carryYd: 85,
      sampleSize: 3,
      status: "measured",
    });
    expect(half).toMatchObject({
      carryYd: 70,
      sampleSize: 0,
      status: "target",
    });
  });

  it("does not double-count low pitch shots as both 3/4 and half wedges", () => {
    const matrix = buildWedgeMatrix([
      club("pw", 120, {
        shots: [
          shot("2026-01-01", 120, "full"),
          shot("2026-01-02", 121, "full"),
          shot("2026-01-03", 72, "pitch"),
          shot("2026-01-04", 73, "pitch"),
          shot("2026-01-05", 74, "pitch"),
        ],
      }),
    ]);

    const pitchingWedge = matrix.find((entry) => entry.clubType === "pw");

    expect(pitchingWedge?.rows.find((row) => row.key === "threeQuarter")).toMatchObject({
      carryYd: 102,
      sampleSize: 0,
      status: "target",
    });
    expect(pitchingWedge?.rows.find((row) => row.key === "half")).toMatchObject({
      carryYd: 73,
      sampleSize: 3,
      status: "measured",
    });
  });

  it("tracks monthly driver path movement without swing diagnosis", () => {
    const trend = buildPathTrendTracking([
      club("driver", 220, {
        shots: [
          pathShot("2026-01-10", 14, 17),
          pathShot("2026-01-20", 12, 15),
          pathShot("2026-02-10", 8, 10),
          pathShot("2026-02-20", 6, 8),
        ],
      }),
    ]);

    expect(trend.status).toBe("neutralising");
    expect(trend.points.map((point) => [point.label, point.pathDeg])).toEqual([
      ["Jan", 13],
      ["Feb", 7],
    ]);
    expect(trend.points[0]).toMatchObject({
      faceDeg: 16,
      faceToPathProxyDeg: 3,
      patternCode: "I",
      patternLabel: "Push fade/slice",
    });
    expect(trend.points[0].faceToPathProxyDeg).toBe(3);
  });

  it("builds confidence heat maps around the recommended course number", () => {
    const heatMaps = buildConfidenceHeatMaps([
      club("7i", 155, {
        personalBestCarryYd: 165,
        shots: [
          shot("2026-01-01", 140),
          shot("2026-01-02", 145),
          shot("2026-01-03", 150),
          shot("2026-01-04", 155),
          shot("2026-01-05", 165),
        ],
      }),
    ]);

    expect(heatMaps[0]?.bands[0]).toMatchObject({
      label: "Green",
      rangeLabel: "145-155",
    });
    expect(heatMaps[0]?.bands[2].detail).toContain("165 yd exists");
  });
});

function club(
  type: string,
  carryYd: number,
  overrides: Partial<BagIntelligenceClub["stock"]> & {
    shots?: BagIntelligenceClub["shots"];
  } = {},
): BagIntelligenceClub {
  return {
    id: type,
    type,
    brandModel: `${type} test`,
    shots: overrides.shots ?? [
      shot("2026-01-01", carryYd),
      shot("2026-01-02", carryYd + 1),
      shot("2026-01-03", carryYd - 1),
      shot("2026-01-04", carryYd),
    ],
    stock: {
      bestStockCarryYd: carryYd,
      coursePlayCarryYd: carryYd,
      latestReliableCarryYd: carryYd,
      latestReliableCarryP25Yd: carryYd - 10,
      latestReliableCarryP75Yd: carryYd,
      personalBestCarryYd: carryYd + 5,
      confidenceScore: 82,
      sampleSize: 18,
      dispersionLeftYd: 8,
      dispersionRightYd: 10,
      shotRoleSummaries: [
        {
          role: "full",
          sampleSize: 10,
          carryMedianYd: carryYd,
          carryP25Yd: carryYd - 2,
          carryP75Yd: carryYd + 2,
          longestCarryYd: carryYd + 4,
        },
      ],
      ...overrides,
    },
  };
}

function shot(shotAt: string, carryYd: number, shotCategory = "full") {
  return {
    shotAt,
    clubType: null,
    carryYd,
    totalYd: carryYd,
    sideCarryYd: 0,
    shotCategory,
    qualityTag: null,
  };
}

function pathShot(shotAt: string, clubPathDeg: number, launchDirectionDeg: number) {
  return {
    ...shot(shotAt, 220),
    clubPathDeg,
    launchDirectionDeg,
  };
}
