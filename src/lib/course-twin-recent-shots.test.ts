import { describe, expect, it } from "vitest";

import { selectCourseTwinRecentShots } from "@/lib/course-twin-recent-shots";
import type { ShotReviewStatus } from "@/lib/shot-review";

const now = new Date("2026-08-08T12:00:00.000Z");

function shot({
  clubId = "driver",
  daysAgo,
  qualityTag = null,
  reviewStatus = "included",
  shotCategory = "full",
}: {
  clubId?: string | null;
  daysAgo: number;
  qualityTag?: string | null;
  reviewStatus?: ShotReviewStatus | null;
  shotCategory?: string | null;
}) {
  return {
    clubId,
    qualityTag,
    reviewStatus,
    shotCategory,
    shotAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1_000),
  };
}

describe("Course Twin recent shot selection", () => {
  it("keeps only recent full trusted shots and never revives an older shape", () => {
    const recent = shot({ daysAgo: 2 });
    const selected = selectCourseTwinRecentShots(
      [
        shot({ daysAgo: 31 }),
        shot({ daysAgo: 3, shotCategory: "pitch" }),
        shot({ daysAgo: 4, qualityTag: "exclude:mishit" }),
        recent,
      ],
      { now },
    );

    expect(selected).toEqual([recent]);
  });

  it("caps each club independently at the latest fifty shots", () => {
    const selected = selectCourseTwinRecentShots(
      [
        ...Array.from({ length: 58 }, (_, index) => shot({ daysAgo: index / 10 })),
        ...Array.from({ length: 8 }, (_, index) => shot({ clubId: "5i", daysAgo: index / 10 })),
      ],
      { now },
    );

    expect(selected.filter((row) => row.clubId === "driver")).toHaveLength(50);
    expect(selected.filter((row) => row.clubId === "5i")).toHaveLength(8);
  });

  it("uses only effective included/restored lifecycle evidence", () => {
    const included = shot({ daysAgo: 1, reviewStatus: "included" });
    const restored = shot({
      clubId: "5i",
      daysAgo: 2,
      reviewStatus: "restored",
      qualityTag: "mishit",
    });
    const excluded = [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ].map((reviewStatus, index) =>
      shot({ daysAgo: 3 + index, reviewStatus: reviewStatus as ShotReviewStatus }),
    );

    expect(selectCourseTwinRecentShots([included, restored, ...excluded], { now })).toEqual([
      included,
      restored,
    ]);
  });

  it("keeps the legacy fallback for unreviewed included rows without overriding restoration", () => {
    const legacyExcluded = shot({
      daysAgo: 1,
      reviewStatus: "included",
      qualityTag: "mishit",
    });
    const restored = shot({
      daysAgo: 2,
      reviewStatus: "restored",
      qualityTag: "mishit",
    });

    expect(selectCourseTwinRecentShots([legacyExcluded, restored], { now })).toEqual([restored]);
  });
});
