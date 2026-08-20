import { describe, expect, it } from "vitest";

import {
  buildShotPatternClubOptions,
  buildShotPatternResult,
  DEFAULT_PATTERN_LIMIT,
  MAX_PATTERN_LIMIT,
  filterShotPatternRawShots,
  type ShotPatternRawShot,
} from "./shot-patterns";
import type { ShotReviewStatus } from "./shot-review";

const excludedReviewStatuses = [
  "suggested_exclusion",
  "user_excluded",
  "calibration",
  "warm_up",
  "launch_monitor_error",
] as const satisfies readonly ShotReviewStatus[];

describe("shot patterns", () => {
  it("best90 removes the worst 10 percent", () => {
    const rawShots = Array.from({ length: 10 }, (_, index): ShotPatternRawShot => {
      const isOutlier = index === 9;
      return shot({
        id: `shot-${index}`,
        carryYd: isOutlier ? 80 : 250 + index,
        totalYd: isOutlier ? 90 : 265 + index,
        sideCarryYd: isOutlier ? 140 : index - 4,
      });
    });
    const pattern = buildShotPatternResult({
      rawShots,
      clubId: null,
      clubType: "driver",
      clubLabel: "Driver",
      mode: "total",
      outlierMode: "best90",
    });

    expect(pattern.summary.sampleSize).toBe(10);
    expect(pattern.summary.includedSampleSize).toBe(9);
    expect(pattern.summary.maxDistanceYd).toBe(273);
    expect(pattern.points.find((point) => point.id === "shot-9")?.included).toBe(false);
  });

  it("all mode keeps all valid shots", () => {
    const rawShots = [shot({ id: "a" }), shot({ id: "b", sideCarryYd: 12 })];
    const pattern = buildShotPatternResult({
      rawShots,
      clubId: null,
      clubType: "driver",
      clubLabel: "Driver",
      mode: "total",
      outlierMode: "all",
    });

    expect(pattern.points).toHaveLength(2);
    expect(pattern.points.every((point) => point.included)).toBe(true);
  });

  it("filters by clubId", () => {
    const rawShots = [
      shot({ id: "driver-a", clubId: "club-a", clubType: "driver" }),
      shot({ id: "driver-b", clubId: "club-b", clubType: "driver" }),
    ];

    expect(filterShotPatternRawShots(rawShots, { clubId: "club-a", mode: "total" })).toEqual([
      rawShots[0],
    ]);
  });

  it("filters by clubType and removes obvious junk", () => {
    const rawShots = [
      shot({ id: "driver", clubType: "driver" }),
      shot({ id: "iron", clubType: "7i" }),
      shot({ id: "chip", clubType: "driver", shotCategory: "chip" }),
      shot({ id: "bad-distance", clubType: "driver", totalYd: 600 }),
      shot({ id: "bad-side", clubType: "driver", sideCarryYd: 220 }),
      shot({ id: "bad-quality", clubType: "driver", qualityTag: "misread" }),
    ];

    expect(
      filterShotPatternRawShots(rawShots, { clubType: "driver", mode: "total" }).map(
        (item) => item.id,
      ),
    ).toEqual(["driver"]);
  });

  it("uses only included and restored lifecycle evidence", () => {
    const rawShots = [
      shot({ id: "included", reviewStatus: "included" }),
      shot({
        id: "restored",
        reviewStatus: "restored",
        qualityTag: "bad_data",
        shotCategory: "warm_up",
      }),
      ...excludedReviewStatuses.map((reviewStatus) =>
        shot({ id: `excluded-${reviewStatus}`, reviewStatus }),
      ),
    ];

    expect(
      filterShotPatternRawShots(rawShots, { clubType: "driver", mode: "total" }).map(
        (item) => item.id,
      ),
    ).toEqual(["included", "restored"]);
    expect(
      filterShotPatternRawShots(
        [shot({ id: "restored-chip", reviewStatus: "restored", shotCategory: "chip" })],
        { clubType: "driver", mode: "total" },
      ),
    ).toEqual([]);
  });

  it("returns low-sample warning", () => {
    const pattern = buildShotPatternResult({
      rawShots: [shot({ id: "a" }), shot({ id: "b" }), shot({ id: "c" })],
      clubId: null,
      clubType: "driver",
      clubLabel: "Driver",
      mode: "total",
      outlierMode: "best90",
    });

    expect(pattern.summary.confidence).toBe("not_enough");
    expect(pattern.summary.warning).toMatch(/Import more rounds/);
  });

  it("uses the last 50 shots as the pattern limit", () => {
    expect(DEFAULT_PATTERN_LIMIT).toBe(50);
    expect(MAX_PATTERN_LIMIT).toBe(50);
  });

  it("only returns active in-bag club choices without aggregate club-type options", () => {
    const options = buildShotPatternClubOptions(
      [
        {
          id: "current-driver",
          type: "driver",
          brand: "TaylorMade",
          model: "Qi10",
          active: true,
        },
        {
          id: "retired-driver",
          type: "driver",
          brand: "Old",
          model: "Driver",
          active: false,
        },
        {
          id: "retired-3w",
          type: "3w",
          brand: "Old",
          model: "3 Wood",
          active: false,
        },
        {
          id: "current-7i",
          type: "7i",
          brand: "TaylorMade",
          model: "7i",
          active: true,
        },
      ],
      [
        { clubId: "current-driver", clubType: "driver" },
        { clubId: "current-driver", clubType: "driver" },
        {
          clubId: "current-driver",
          clubType: "driver",
          reviewStatus: "restored",
          qualityTag: "bad_data",
          shotCategory: "warm_up",
        },
        ...excludedReviewStatuses.map((reviewStatus) => ({
          clubId: "current-driver",
          clubType: "driver",
          reviewStatus,
        })),
        { clubId: "retired-driver", clubType: "driver" },
        { clubId: "retired-driver", clubType: "driver" },
        { clubId: "retired-driver", clubType: "driver" },
        { clubId: "retired-3w", clubType: "3w" },
      ],
    );

    expect(
      options.map((option) => ({
        clubId: option.clubId,
        clubType: option.clubType,
        sampleSize: option.sampleSize,
      })),
    ).toEqual([{ clubId: "current-driver", clubType: "driver", sampleSize: 3 }]);
  });
});

function shot(overrides: Partial<ShotPatternRawShot>): ShotPatternRawShot {
  return {
    id: overrides.id ?? "shot",
    clubId: overrides.clubId ?? "club-a",
    clubType: overrides.clubType ?? "driver",
    carryYd: overrides.carryYd ?? 250,
    totalYd: overrides.totalYd ?? 265,
    sideCarryYd: overrides.sideCarryYd ?? 0,
    shotAt: overrides.shotAt ?? new Date("2026-01-01T00:00:00.000Z"),
    reviewStatus: overrides.reviewStatus ?? "included",
    shotCategory: overrides.shotCategory ?? "full",
    qualityTag: overrides.qualityTag ?? null,
    sessionType: overrides.sessionType ?? "practice",
  };
}
