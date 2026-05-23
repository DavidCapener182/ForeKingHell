import { describe, expect, it } from "vitest";

import { buildEstimatedCourseFeatures, lineCorridorPolygon } from "@/lib/course-feature-estimates";

const geometry: Array<[number, number]> = [
  [53.0, -2.0],
  [53.002, -2.0],
];

describe("course feature estimates", () => {
  it("builds fallback fairway, green and course-boundary polygons from hole centerlines", () => {
    const features = buildEstimatedCourseFeatures([
      {
        holeNumber: 1,
        par: 4,
        yards: 410,
        geometry,
        green: geometry[1],
      },
    ]);

    expect(features.map((feature) => feature.featureType).sort()).toEqual([
      "course_boundary",
      "fairway",
      "green",
    ]);
    expect(features.every((feature) => feature.source === "estimated_centerline")).toBe(true);
    expect(features.every((feature) => feature.geometryJson.type === "Polygon")).toBe(true);
  });

  it("creates closed GeoJSON polygon rings for centerline corridors", () => {
    const polygon = lineCorridorPolygon(geometry, 25);
    const ring = polygon.coordinates[0];

    expect(ring.length).toBeGreaterThanOrEqual(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
