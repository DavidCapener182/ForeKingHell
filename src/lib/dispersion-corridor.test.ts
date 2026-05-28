import { describe, expect, it } from "vitest";

import { buildDispersionCorridorBuckets } from "@/lib/dispersion-corridor";

describe("buildDispersionCorridorBuckets", () => {
  it("splits visible side dispersion into left, target, and right percentages", () => {
    const buckets = buildDispersionCorridorBuckets(
      [-60, -45, -30, -12, -10, 0, 8, 10, 12, 30, 31, 60],
      {
        maxSideYd: 60,
        targetSideYd: 10,
      },
    );

    expect(buckets.map((bucket) => bucket.id)).toEqual([
      "far-left",
      "left",
      "target",
      "right",
      "far-right",
    ]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([3, 1, 4, 1, 3]);
    expect(buckets.find((bucket) => bucket.id === "target")?.percent).toBe(33.3);
  });

  it("collapses zero-width edge buckets when the target corridor reaches the mid tick", () => {
    const buckets = buildDispersionCorridorBuckets([-18, -8, 0, 8, 18], {
      maxSideYd: 20,
      targetSideYd: 10,
    });

    expect(buckets.map((bucket) => bucket.id)).toEqual(["left", "target", "right"]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([1, 3, 1]);
  });
});
