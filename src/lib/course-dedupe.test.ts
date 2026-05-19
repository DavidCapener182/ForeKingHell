import { describe, expect, it } from "vitest";

import { dedupeCoursesByName, normalisedCourseName } from "@/lib/course-dedupe";

describe("course dedupe helpers", () => {
  it("normalises punctuation and ampersands", () => {
    expect(normalisedCourseName("Mountain Park Hotel & Golf Club - Mountain Park")).toBe(
      "mountain park hotel and golf club mountain park",
    );
  });

  it("keeps the preferred duplicate for a course name", () => {
    const rows = [
      { id: "legacy", name: "Mountain Park Hotel and Golf Club - Mountain Park", score: 1 },
      { id: "mapped", name: "Mountain Park Hotel and Golf Club - Mountain Park", score: 10 },
    ];

    expect(dedupeCoursesByName(rows, (row) => row.score)).toEqual([rows[1]]);
  });

  it("dedupes Google-backed variants by place id before name", () => {
    const rows = [
      { googlePlaceId: "place-1", id: "manual-name", name: "Quail Hollow Club", score: 1 },
      {
        googlePlaceId: "place-1",
        id: "google-name",
        name: "Quail Hollow Club Charlotte",
        score: 10,
      },
    ];

    expect(dedupeCoursesByName(rows, (row) => row.score)).toEqual([rows[1]]);
  });
});
