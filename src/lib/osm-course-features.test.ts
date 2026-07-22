import { describe, expect, it } from "vitest";

import {
  buildOverpassGolfFeatureQuery,
  parseOverpassGolfFeatures,
  scopeOsmFeaturesToCourse,
} from "@/lib/osm-course-features";

describe("osm course features", () => {
  it("builds an Overpass query for golf surface polygons", () => {
    const query = buildOverpassGolfFeatureQuery(53.0, -2.0);

    expect(query).toContain('"golf"~"^(fairway|green|bunker|rough|water|water_hazard)$"');
    expect(query).toContain('"leisure"="golf_course"');
    expect(query).toContain("53");
  });

  it("parses closed OSM ways into course feature polygons", () => {
    const features = parseOverpassGolfFeatures({
      elements: [
        {
          type: "way",
          id: 100,
          tags: { golf: "fairway", ref: "4" },
          geometry: [
            { lat: 53.0, lon: -2.0 },
            { lat: 53.001, lon: -2.0 },
            { lat: 53.001, lon: -1.999 },
            { lat: 53.0, lon: -2.0 },
          ],
        },
        {
          type: "way",
          id: 101,
          tags: { golf: "water" },
          geometry: [
            { lat: 53.0, lon: -2.0 },
            { lat: 53.0002, lon: -2.0 },
            { lat: 53.0002, lon: -1.9998 },
            { lat: 53.0, lon: -2.0 },
          ],
        },
      ],
    });

    expect(features).toHaveLength(2);
    expect(features[0]).toMatchObject({
      featureType: "fairway",
      holeNumber: 4,
      source: "osm",
    });
    expect(features[1]).toMatchObject({
      featureType: "water",
      holeNumber: null,
    });
  });

  it("ignores open ways because they are not usable landing-zone polygons", () => {
    const features = parseOverpassGolfFeatures({
      elements: [
        {
          type: "way",
          id: 100,
          tags: { golf: "fairway" },
          geometry: [
            { lat: 53.0, lon: -2.0 },
            { lat: 53.001, lon: -2.0 },
            { lat: 53.001, lon: -1.999 },
          ],
        },
      ],
    });

    expect(features).toEqual([]);
  });

  it("scopes nearby OSM surfaces to the golf-course boundary containing the requested course", () => {
    const polygon = (minLon: number, minLat: number, maxLon: number, maxLat: number) => ({
      type: "Polygon" as const,
      coordinates: [
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ],
    });
    const features = [
      {
        osmType: "way",
        osmId: 1,
        featureType: "course_boundary" as const,
        holeNumber: null,
        geometryJson: polygon(-2.94, 53.47, -2.93, 53.48),
        source: "osm" as const,
      },
      {
        osmType: "way",
        osmId: 2,
        featureType: "green" as const,
        holeNumber: 1,
        geometryJson: polygon(-2.937, 53.474, -2.936, 53.475),
        source: "osm" as const,
      },
      {
        osmType: "way",
        osmId: 3,
        featureType: "course_boundary" as const,
        holeNumber: null,
        geometryJson: polygon(-2.92, 53.47, -2.91, 53.48),
        source: "osm" as const,
      },
      {
        osmType: "way",
        osmId: 4,
        featureType: "bunker" as const,
        holeNumber: 1,
        geometryJson: polygon(-2.917, 53.474, -2.916, 53.475),
        source: "osm" as const,
      },
    ];
    expect(scopeOsmFeaturesToCourse(features, 53.476, -2.936).map((item) => item.osmId)).toEqual([
      1, 2,
    ]);
  });
});
