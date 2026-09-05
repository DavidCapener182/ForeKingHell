import { describe, expect, it } from "vitest";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";

import {
  buildShotPatternPoints,
  defaultShotPatternClub,
  deterministicShotSample,
  shotPatternClubs,
  shotPatternConfidence,
  summarizeShotPattern,
  type ShotPatternPoint,
} from "@/lib/shot-pattern-chart-data";

function point(index: number, clubType = "7i", sideCarryYd = 0): ShotPatternPoint {
  return {
    id: `${clubType}-${index}`,
    clubType,
    clubLabel: clubType,
    carryYd: 150 + index,
    sideCarryYd,
    apexFt: 80,
    launchAngleDeg: 18,
    shotNumber: index + 1,
    shotAt: null,
    trusted: true,
  };
}

describe("mobile shot pattern data", () => {
  it("uses reviewed eligibility without deleting excluded points or rejecting restores", () => {
    const rows = [
      { id: "included", reviewStatus: "included", carryYd: 140, sideCarryYd: 0 },
      { id: "excluded", reviewStatus: "user_excluded", carryYd: 20, sideCarryYd: 80 },
      { id: "suggested", reviewStatus: "suggested_exclusion", carryYd: 300, sideCarryYd: -90 },
      { id: "warm-up", reviewStatus: "warm_up", carryYd: 50, sideCarryYd: 40 },
      { id: "calibration", reviewStatus: "calibration", carryYd: 400, sideCarryYd: 100 },
      { id: "sensor", reviewStatus: "launch_monitor_error", carryYd: 900, sideCarryYd: 200 },
      { id: "restored", reviewStatus: "restored", carryYd: 150, sideCarryYd: 4 },
    ].map((row) => ({
      ...row,
      reviewStatus: row.reviewStatus as ShotReviewStatus,
      clubType: "7i",
      apexFt: 80,
      qualityTag: row.id === "restored" ? "misread" : null,
      dataIntegrityIssue: row.id === "restored" ? "Previously flagged" : null,
    }));
    const points = buildShotPatternPoints(rows, {
      trustedShotIds: new Set(rows.filter(isShotEvidenceEligible).map((row) => row.id)),
    });
    const trusted = points.filter((row) => row.trusted);
    expect(trusted.map((row) => row.id)).toEqual(["included", "restored"]);
    expect(summarizeShotPattern(trusted).medianCarryYd).toBe(145);
    expect(shotPatternConfidence(trusted).sampleSize).toBe(2);
    expect(points.map(({ id, carryYd, sideCarryYd }) => ({ id, carryYd, sideCarryYd }))).toEqual(
      rows.map(({ id, carryYd, sideCarryYd }) => ({ id, carryYd, sideCarryYd })),
    );
  });

  it("respects an empty authoritative selection even when raw quality flags are absent", () => {
    const rows = [point(1)];
    const points = buildShotPatternPoints(rows, { trustedShotIds: new Set() });
    expect(points).toHaveLength(1);
    expect(points[0].trusted).toBe(false);
    expect(shotPatternConfidence(points.filter((row) => row.trusted)).sampleSize).toBe(0);
    expect(buildShotPatternPoints(rows)[0].trusted).toBe(true);
  });

  it("excludes questionable quality rows from a trusted pattern summary", () => {
    const trusted = buildShotPatternPoints([
      {
        id: "clean",
        clubType: "7i",
        carryYd: 150,
        sideCarryYd: 4,
        apexFt: 80,
      },
      {
        id: "mishit",
        clubType: "7i",
        carryYd: 95,
        sideCarryYd: 45,
        apexFt: 20,
        qualityTag: "mishit",
      },
    ]).filter((shot) => shot.trusted);

    expect(summarizeShotPattern(trusted).sampleSize).toBe(1);
    expect(trusted.map((shot) => shot.id)).toEqual(["clean"]);
  });

  it("uses the requested focus club and selected-club confidence", () => {
    const points = [
      ...Array.from({ length: 18 }, (_, index) => point(index, "7i")),
      point(1, "driver"),
    ];
    const clubs = shotPatternClubs(points);
    expect(defaultShotPatternClub(clubs, "driver")).toBe("driver");
    expect(shotPatternConfidence(points.filter((item) => item.clubType === "driver")).label).toBe(
      "Low",
    );
    expect(shotPatternConfidence(points.filter((item) => item.clubType === "7i")).label).toBe(
      "High",
    );
  });

  it("derives typical miss from distribution rather than the wider bound", () => {
    const points = [
      ...Array.from({ length: 9 }, (_, index) => point(index, "7i", 8 + index)),
      point(10, "7i", -35),
      point(11, "7i", 0),
    ];
    const summary = summarizeShotPattern(points);
    expect(summary.typicalMiss).toBe("Right");
    expect(summary.widerSide).toBe("Left");
  });

  it("uses each club's playable corridor in a mixed-club view", () => {
    const points = [point(1, "driver", 28), point(2, "wedge", 28)];
    expect(summarizeShotPattern(points).insideCorridor).toBe(1);
  });

  it("downsamples deterministically without taking the first arbitrary rows", () => {
    const points = Array.from({ length: 240 }, (_, index) =>
      point(index, "7i", index === 239 ? 80 : index % 12),
    );
    const first = deterministicShotSample(points, 80);
    const second = deterministicShotSample(points, 80);
    expect(first.downsampled).toBe(true);
    expect(first.points).toHaveLength(80);
    expect(first.points.map((item) => item.id)).toEqual(second.points.map((item) => item.id));
    expect(first.points.some((item) => item.id === "7i-239")).toBe(true);
  });
});
