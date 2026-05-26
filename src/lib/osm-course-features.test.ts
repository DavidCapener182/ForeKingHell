import { describe, expect, it } from "vitest";

import {
  buildOverpassGolfFeatureQuery,
  parseOverpassGolfFeatures,
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
});
