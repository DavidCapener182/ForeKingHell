import { describe, expect, it } from "vitest";

import { calculateSessionImpact, type SessionImpactShot } from "@/lib/session-impact";
import type { ShotReviewStatus } from "@/lib/shot-review";

const excludedReviewStatuses = [
  "suggested_exclusion",
  "user_excluded",
  "calibration",
  "warm_up",
  "launch_monitor_error",
] as const satisfies readonly ShotReviewStatus[];

const baseShots: SessionImpactShot[] = [
  { id: "1", carryYd: 150, totalYd: 155, sideYd: -3, sessionSource: "rapsodo" },
  { id: "2", carryYd: 152, totalYd: 158, sideYd: 2, sessionSource: "rapsodo" },
  { id: "3", carryYd: 149, totalYd: 154, sideYd: 1, sessionSource: "rapsodo" },
  { id: "4", carryYd: 151, totalYd: 157, sideYd: -1, sessionSource: "rapsodo" },
  { id: "outlier", carryYd: 310, totalYd: 330, sideYd: 80, sessionSource: "rapsodo" },
];

describe("calculateSessionImpact", () => {
  it("shows the reversible before/after effect of one selected shot", () => {
    const result = calculateSessionImpact(baseShots, { kind: "selected", shotId: "outlier" });
    expect(result.originalShots).toHaveLength(5);
    expect(result.includedShots).toHaveLength(4);
    expect(result.excludedShotIds).toEqual(["outlier"]);
    expect(result.after.averageYd).toBeLessThan(result.before.averageYd!);
    expect(result.after.standardDeviationYd).toBeLessThan(result.before.standardDeviationYd!);
  });

  it("filters topped and misread shots without deleting them", () => {
    const shots = [
      ...baseShots,
      {
        id: "top",
        carryYd: 30,
        totalYd: 40,
        sideYd: 0,
        qualityTag: "topped",
        sessionSource: "rapsodo",
      },
      {
        id: "misread",
        carryYd: 800,
        totalYd: 900,
        sideYd: 0,
        qualityTag: null,
        sessionSource: "rapsodo",
      },
      {
        id: "legacy-misread",
        carryYd: 800,
        totalYd: 900,
        sideYd: 0,
        qualityTag: "misread",
        sessionSource: "rapsodo",
      },
    ];
    expect(calculateSessionImpact(shots, { kind: "topped" }).excludedShotIds).toEqual(["top"]);
    expect(calculateSessionImpact(shots, { kind: "likely-misreads" }).excludedShotIds).toContain(
      "misread",
    );
    expect(
      calculateSessionImpact(shots, { kind: "none" }).originalShots.map((shot) => shot.id),
    ).not.toContain("legacy-misread");
  });

  it("handles empty and one-shot datasets", () => {
    expect(calculateSessionImpact([], { kind: "none" }).before.sessionScore).toBeNull();
    const one = calculateSessionImpact([baseShots[0]!], { kind: "none" }).before;
    expect(one.shotCount).toBe(1);
    expect(one.standardDeviationYd).toBeNull();
    expect(one.dispersionAreaSqYd).toBeNull();
  });

  it("keeps excluded lifecycle rows out of both derived comparison states", () => {
    const lifecycleShots: SessionImpactShot[] = [
      { ...baseShots[0]!, id: "included", reviewStatus: "included" },
      {
        ...baseShots[1]!,
        id: "restored",
        reviewStatus: "restored",
        qualityTag: "bad_data",
        shotCategory: "warm_up",
      },
      ...excludedReviewStatuses.map((reviewStatus, index) => ({
        ...baseShots[2]!,
        id: `excluded-${reviewStatus}`,
        carryYd: 300 + index,
        reviewStatus,
      })),
    ];

    const result = calculateSessionImpact(lifecycleShots, { kind: "none" });

    expect(result.originalShots.map((shot) => shot.id)).toEqual(["included", "restored"]);
    expect(result.includedShots.map((shot) => shot.id)).toEqual(["included", "restored"]);
    expect(result.before.shotCount).toBe(2);
    expect(result.after.shotCount).toBe(2);
  });
});
