import { describe, expect, it } from "vitest";

import { applyImportedShotQualityTriage } from "@/lib/imports/save-rapsodo-import";
import type { EstablishedClubProfile } from "@/lib/imports/shot-quality-triage";
import { buildClubKey, formatClubType, type ParsedRapsodoShot } from "@/lib/rapsodo/parser";

describe("applyImportedShotQualityTriage", () => {
  it("keeps every row while separating strong suggestions, soft review, partials and field issues", () => {
    const profiles = new Map<string, EstablishedClubProfile>([
      profile("pw", 110, 5, 105, 116, 8),
      profile("5w", 178, 7, 170, 185, 140),
      profile("6i", 151, 4, 147, 154, 110),
      profile("driver", 199, 6, 193, 204, 180),
      profile("5i", 158, 5, 152, 163, 125),
      profile("7i", 147, 4, 143, 151, 125),
    ]);
    const inputs = [
      shot("pw", 7.7, { ballSpeedMph: 28, clubSpeedMph: 55, smashFactor: 0.51 }),
      shot("5w", 102.8, { ballSpeedMph: 84, clubSpeedMph: 82.4, smashFactor: 1.02 }),
      shot("6i", 103.9, { ballSpeedMph: 85.5, clubSpeedMph: 75, smashFactor: 1.14 }),
      shot("driver", 140, { ballSpeedMph: 130.5, clubSpeedMph: 89, smashFactor: 1.47 }),
      shot("5i", 120.3, { ballSpeedMph: 100, clubSpeedMph: null, smashFactor: 1.25 }),
      shot("5i", 123.6, { ballSpeedMph: 101, clubSpeedMph: null, smashFactor: 1.26 }),
      shot("7i", 122.5, { ballSpeedMph: 95, clubSpeedMph: null, smashFactor: 1.25 }),
      shot("7i", 124.7, { ballSpeedMph: 96, clubSpeedMph: null, smashFactor: 1.26 }),
      ...[6.6, 9.8, 16.4, 19.7, 20.8, 27.4, 33.9, 50.3].map((carryYd) =>
        shot("sw", carryYd, {
          ballSpeedMph: null,
          clubSpeedMph: null,
          smashFactor: null,
        }),
      ),
      shot("5i", 173, { ballSpeedMph: 121, clubSpeedMph: 83, smashFactor: 1.46 }),
      {
        ...shot("7i", 136.8),
        totalYd: null,
        integrityIssues: [
          {
            code: "total_below_carry" as const,
            field: "totalYd" as const,
            value: 8.8,
            explanation: "Total distance 8.8 yd is incompatible with carry distance 136.8 yd.",
          },
        ],
      },
    ];

    const result = applyImportedShotQualityTriage(inputs, profiles);

    expect(result.shots).toHaveLength(inputs.length);
    expect(result.summary).toEqual({
      version: "v1",
      totalShots: 18,
      stockQuality: 2,
      likelyMishits: 4,
      needsReview: 4,
      partialShots: 8,
      unusableShots: 0,
      fieldIssues: 1,
    });
    expect(result.shots.slice(0, 4).map((item) => item.shot.qualityTag)).toEqual([
      "mishit",
      "mishit",
      "mishit",
      "mishit",
    ]);
    expect(result.shots.slice(4, 8).map((item) => item.shot.qualityTag)).toEqual([
      "needs_review",
      "needs_review",
      "needs_review",
      "needs_review",
    ]);
    expect(result.shots.slice(8, 16).every((item) => item.shot.shotCategory === "pitch")).toBe(
      true,
    );
    expect(result.shots[16]?.shot).toMatchObject({ carryYd: 173, qualityTag: null });
    expect(result.shots[17]?.shot).toMatchObject({ carryYd: 136.8, totalYd: null });
  });

  it("uses a conservative within-import profile when a new club has no trusted history", () => {
    const inputs = [
      ...[105, 108, 110, 112].map((carryYd) => shot("pw", carryYd)),
      shot("pw", 7.7, { ballSpeedMph: 28, clubSpeedMph: 55, smashFactor: 0.51 }),
      ...[170, 176, 180, 184].map((carryYd) => shot("5w", carryYd)),
      shot("5w", 102.8, { ballSpeedMph: 84, clubSpeedMph: 82.4, smashFactor: 1.02 }),
      ...[148, 150, 152, 154].map((carryYd) => shot("6i", carryYd)),
      shot("6i", 103.9, { ballSpeedMph: 85.5, clubSpeedMph: 75, smashFactor: 1.14 }),
      ...[190, 195, 198, 202].map((carryYd) => shot("driver", carryYd)),
      shot("driver", 140, { ballSpeedMph: 130.5, clubSpeedMph: 89, smashFactor: 1.47 }),
      ...[6.6, 16.4, 27.4, 50.3].map((carryYd) =>
        shot("sw", carryYd, {
          ballSpeedMph: null,
          clubSpeedMph: null,
          smashFactor: null,
        }),
      ),
    ];

    const result = applyImportedShotQualityTriage(inputs);

    expect(
      result.shots
        .filter((item) => item.classification === "likely_mishit")
        .map((item) => [item.shot.clubType, item.shot.carryYd]),
    ).toEqual([
      ["pw", 7.7],
      ["5w", 102.8],
      ["6i", 103.9],
      ["driver", 140],
    ]);
    expect(result.summary).toMatchObject({
      likelyMishits: 4,
      partialShots: 4,
      fieldIssues: 0,
    });
  });

  it("keeps an unresolved impossible speed ratio out of stock evidence for confirmation", () => {
    const result = applyImportedShotQualityTriage([
      shot("7i", 145, { ballSpeedMph: 200, clubSpeedMph: 80, smashFactor: null }),
    ]);

    expect(result.shots[0]).toMatchObject({
      classification: "needs_review",
      shot: { carryYd: 145, qualityTag: "needs_review" },
    });
    expect(result.summary).toMatchObject({
      stockQuality: 0,
      needsReview: 1,
      fieldIssues: 1,
    });
  });

  it("quarantines invalid carry without counting the row as stock-quality", () => {
    const result = applyImportedShotQualityTriage([{ ...shot("7i", -12), totalYd: 100 }]);

    expect(result.shots[0]).toMatchObject({
      classification: "unusable_shot",
      shot: { carryYd: null, qualityTag: "bad_data" },
    });
    expect(result.summary).toMatchObject({
      stockQuality: 0,
      unusableShots: 1,
      fieldIssues: 1,
    });
  });
});

function profile(
  clubType: string,
  median: number,
  medianAbsoluteDeviation: number,
  p25: number,
  p75: number,
  p05: number,
): [string, EstablishedClubProfile] {
  return [
    buildClubKey(clubType, null, null),
    {
      clubType,
      sampleSize: 40,
      carryYd: { median, medianAbsoluteDeviation, p05, p25, p75 },
      ballSpeedMph: { median: 110, medianAbsoluteDeviation: 4, p25: 105, p75: 116 },
      smashFactor: { median: 1.38, medianAbsoluteDeviation: 0.03, p25: 1.3, p75: 1.43 },
    },
  ];
}

function shot(
  clubType: string,
  carryYd: number,
  metrics: Partial<Pick<ParsedRapsodoShot, "ballSpeedMph" | "clubSpeedMph" | "smashFactor">> = {},
): ParsedRapsodoShot {
  return {
    rowNumber: Math.round(carryYd * 10),
    shotNumber: null,
    clubTypeRaw: clubType.toUpperCase(),
    clubType,
    clubLabel: formatClubType(clubType),
    clubBrand: null,
    clubModel: null,
    clubKey: buildClubKey(clubType, null, null),
    carryYd,
    totalYd: carryYd + 4,
    ballSpeedMph: metrics.ballSpeedMph === undefined ? 105 : metrics.ballSpeedMph,
    clubSpeedMph: metrics.clubSpeedMph === undefined ? null : metrics.clubSpeedMph,
    launchAngleDeg: 18,
    launchDirectionDeg: 0,
    apexFt: 60,
    sideCarryYd: 0,
    attackAngleDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
    descentAngleDeg: null,
    smashFactor: metrics.smashFactor === undefined ? 1.38 : metrics.smashFactor,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: {},
    warnings: [],
    integrityIssues: [],
  };
}
