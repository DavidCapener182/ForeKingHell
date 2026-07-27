import { describe, expect, it } from "vitest";

import type { CourseTwinFeature } from "@/lib/course-twin-contract";
import {
  courseTwinFeatureContains,
  courseTwinRingArea,
  createCourseTwinSurfaceClassifier,
} from "@/lib/course-twin-surface";

const square = (type: CourseTwinFeature["type"], size: number, id = type): CourseTwinFeature => ({
  id,
  holeNumber: 1,
  type,
  source: "test",
  rings: [
    [
      [-size, 0, -size],
      [size, 0, -size],
      [size, 0, size],
      [-size, 0, size],
      [-size, 0, -size],
    ],
  ],
});

describe("Course Twin semantic surfaces", () => {
  it("uses hazard priority over broader playable polygons", () => {
    const classify = createCourseTwinSurfaceClassifier({
      features: [square("course_boundary", 100), square("fairway", 50), square("bunker", 5)],
    });
    expect(classify(0, 0)).toBe("bunker");
    expect(classify(20, 0)).toBe("fairway");
    expect(classify(75, 0)).toBe("rough");
    expect(classify(120, 0)).toBe("out_of_bounds");
  });

  it("supports holes in polygons and deterministic area calculation", () => {
    const feature = square("water", 10);
    feature.rings.push(square("rough", 2).rings[0]);
    expect(courseTwinFeatureContains(feature, 8, 0)).toBe(true);
    expect(courseTwinFeatureContains(feature, 0, 0)).toBe(false);
    expect(courseTwinRingArea(feature.rings[0])).toBe(400);
  });
});
