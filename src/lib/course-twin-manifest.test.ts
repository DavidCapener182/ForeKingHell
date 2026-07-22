import { describe, expect, it } from "vitest";

import {
  averageCourseTwinCoordinate,
  courseTwinBoundsForPoints,
  createCourseTwinProjector,
} from "@/lib/course-twin-geometry";

describe("Course Twin manifest transforms", () => {
  it("projects geographic coordinates into stable local metre coordinates", () => {
    const project = createCourseTwinProjector(53.451, -3.034);
    const first = project(53.452, -3.032);
    const second = project(53.452, -3.032);

    expect(first).toEqual(second);
    expect(project(53.451, -3.034)).toEqual([0, 0, 0]);
    expect(first[0]).toBeCloseTo(132.7, 0);
    expect(first[1]).toBe(0);
    expect(first[2]).toBeCloseTo(-111.3, 0);
  });

  it("derives deterministic padded bounds with a finite empty fallback", () => {
    const points: Array<[number, number, number]> = [
      [-10, 0, 20],
      [45, 0, -30],
    ];

    expect(courseTwinBoundsForPoints(points)).toEqual({
      minX: -90,
      maxX: 125,
      minZ: -110,
      maxZ: 100,
    });
    expect(courseTwinBoundsForPoints([])).toEqual({
      minX: -80,
      maxX: 80,
      minZ: -80,
      maxZ: 80,
    });
    expect(averageCourseTwinCoordinate([53, 55])).toBe(54);
  });
});
