import { describe, expect, it } from "vitest";

import {
  classifyLandingPoint,
  classifyProjectedPatternPoints,
  hasMappedCourseFeatures,
} from "./course-feature-classification";

describe("course feature classification", () => {
  it("classifies points inside mapped course features", () => {
    expect(
      classifyLandingPoint(
        [0.5, 0.5],
        [
          {
            id: "fairway",
            featureType: "fairway",
            geometryJson: square("Polygon", 0, 0, 1, 1),
          },
        ],
      ),
    ).toBe("fairway");
  });

  it("prioritizes penalty features over fairway overlap", () => {
    const features = [
      {
        id: "fairway",
        featureType: "fairway",
        geometryJson: square("Polygon", 0, 0, 1, 1),
        source: "estimated_centerline",
      },
      {
        id: "water",
        featureType: "water",
        geometryJson: square("Polygon", 0.4, 0.4, 0.7, 0.7),
        source: "osm",
      },
    ];

    expect(classifyLandingPoint([0.5, 0.5], features)).toBe("water");
  });

  it("uses a conservative buffer around mapped water before falling back to estimated fairway", () => {
    const features = [
      {
        id: "estimated",
        featureType: "fairway",
        geometryJson: square("Polygon", -2.001, 53, -1.999, 53.001),
        source: "estimated_centerline",
      },
      {
        id: "water",
        featureType: "water",
        geometryJson: square("Polygon", -1.9999, 53, -1.9997, 53.001),
        source: "osm",
      },
    ];

    expect(classifyLandingPoint([53.0005, -1.99995], features)).toBe("water");
  });

  it("does not treat estimated centreline features as mapped course features", () => {
    expect(
      hasMappedCourseFeatures([
        {
          id: "estimated",
          featureType: "fairway",
          geometryJson: square("Polygon", 0, 0, 1, 1),
          source: "estimated_centerline",
        },
      ]),
    ).toBe(false);
    expect(
      hasMappedCourseFeatures([
        {
          id: "osm",
          featureType: "water",
          geometryJson: square("Polygon", 0, 0, 1, 1),
          source: "osm",
        },
      ]),
    ).toBe(true);
  });

  it("uses estimated fairway as a fallback when mapped fairway is incomplete", () => {
    const estimatedFairway = {
      id: "estimated",
      featureType: "fairway",
      geometryJson: square("Polygon", 0, 0, 1, 1),
      source: "estimated_centerline",
    };

    expect(classifyLandingPoint([0.5, 0.5], [estimatedFairway])).toBe("fairway");
    expect(
      classifyLandingPoint(
        [0.5, 0.5],
        [
          estimatedFairway,
          {
            id: "mapped-bunker",
            featureType: "bunker",
            geometryJson: square("Polygon", 2, 2, 3, 3),
            source: "osm",
          },
        ],
      ),
    ).toBe("fairway");
    expect(
      classifyLandingPoint(
        [0.5, 0.5],
        [
          estimatedFairway,
          {
            id: "mapped-rough",
            featureType: "rough",
            geometryJson: square("Polygon", 0, 0, 1, 1),
            source: "osm",
          },
        ],
      ),
    ).toBe("fairway");
  });

  it("classifies mapped rough as rough outside the estimated fairway backstop", () => {
    expect(
      classifyLandingPoint(
        [1.5, 1.5],
        [
          {
            id: "estimated",
            featureType: "fairway",
            geometryJson: square("Polygon", 0, 0, 1, 1),
            source: "estimated_centerline",
          },
          {
            id: "mapped-rough",
            featureType: "rough",
            geometryJson: square("Polygon", 1, 1, 2, 2),
            source: "osm",
          },
        ],
      ),
    ).toBe("rough");
  });

  it("summarizes included projected points and leaves unknown as unknown", () => {
    const result = classifyProjectedPatternPoints(
      [
        {
          id: "a",
          distanceYd: 250,
          forwardYd: 250,
          sideYd: 0,
          included: true,
          latLng: [0.5, 0.5],
        },
        {
          id: "b",
          distanceYd: 260,
          forwardYd: 260,
          sideYd: 20,
          included: true,
          latLng: [2, 2],
        },
        {
          id: "c",
          distanceYd: 120,
          forwardYd: 120,
          sideYd: 80,
          included: false,
          latLng: [0.5, 0.5],
        },
      ],
      [{ id: "fairway", featureType: "fairway", geometryJson: square("Polygon", 0, 0, 1, 1) }],
    );

    expect(result.summary.sampleSize).toBe(2);
    expect(result.summary.counts.fairway).toBe(1);
    expect(result.summary.counts.unknown).toBe(1);
    expect(result.summary.expectedPenalty).toBe(0);
  });
});

function square(_type: "Polygon", minLng: number, minLat: number, maxLng: number, maxLat: number) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}
