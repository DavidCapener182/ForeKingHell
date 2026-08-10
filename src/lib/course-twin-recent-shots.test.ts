import { describe, expect, it } from "vitest";

import { selectCourseTwinRecentShots } from "@/lib/course-twin-recent-shots";

const now = new Date("2026-08-08T12:00:00.000Z");

function shot({
  clubId = "driver",
  daysAgo,
  qualityTag = null,
  shotCategory = "full",
}: {
  clubId?: string | null;
  daysAgo: number;
  qualityTag?: string | null;
  shotCategory?: string | null;
}) {
  return {
    clubId,
    qualityTag,
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
});
