import { describe, it, expect } from "vitest";
import { courseTwinVisualFeatures } from "./course-twin-visual-features";
import type { CourseTwinFeature } from "./course-twin-contract";
const mapped: CourseTwinFeature = {
  id: "mapped",
  type: "green",
  source: "osm",
  holeNumber: null,
  rings: [
    [
      [-10, 0, -10],
      [10, 0, -10],
      [10, 0, 10],
      [-10, 0, 10],
    ],
  ],
};
describe("display source precedence", () => {
  it("removes estimated circles over a mapped green without mutating the source", () => {
    const estimate = { ...mapped, id: "estimate", source: "estimated_centerline" };
    const source = [estimate, mapped];
    expect(courseTwinVisualFeatures(source)).toEqual([mapped]);
    expect(source).toHaveLength(2);
  });
  it("retains an estimate where no corresponding mapped feature exists", () => {
    const estimate = {
      ...mapped,
      id: "estimate",
      type: "fairway" as const,
      source: "estimated_centerline",
    };
    expect(courseTwinVisualFeatures([mapped, estimate])).toEqual([estimate, mapped]);
  });
});
