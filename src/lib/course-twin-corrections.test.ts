import { describe, expect, it } from "vitest";

import {
  applyCourseTwinCorrections,
  validateCourseTwinCorrectionBody,
} from "@/lib/course-twin-corrections";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";

const manifest: CourseTwinManifest = {
  schemaVersion: 1,
  packageVersion: 1,
  minimumRuntimeVersion: "1.0.0",
  course: { id: "course", name: "Course", country: "England" },
  origin: { latitude: 53, longitude: -2, elevationM: 0, coordinateSystem: "LOCAL_ENU_METRES" },
  bounds: { minX: -100, maxX: 100, minZ: -400, maxZ: 100 },
  terrain: {
    kind: "lidar_dtm",
    resolutionM: 1,
    verticalDatum: "ODN",
    warning: null,
    heightmap: null,
    imagery: null,
  },
  quality: {
    grade: "B",
    mappedHoles: 1,
    expectedHoles: 18,
    mappedFeatures: 1,
    verified: false,
    warnings: [],
  },
  supportedModes: ["flyover", "replay"],
  holes: [
    {
      holeNumber: 1,
      par: 4,
      yards: 350,
      strokeIndex: 1,
      tee: [0, 0, 0],
      green: [0, 0, -320],
      centerline: [
        [0, 0, 0],
        [0, 0, -320],
      ],
    },
  ],
  features: [
    {
      id: "old-bunker",
      holeNumber: 1,
      type: "bunker",
      rings: [
        [
          [0, 0, 0],
          [2, 0, 0],
          [2, 0, 2],
          [0, 0, 0],
        ],
      ],
      source: "osm",
    },
  ],
  attribution: [],
};

describe("Course Twin manual QA corrections", () => {
  it("applies feature deletion, feature upsert and hole anchors deterministically", () => {
    const result = applyCourseTwinCorrections(manifest, [
      {
        id: "1",
        correctionType: "feature_delete",
        targetReference: "old-bunker",
        correctionJson: {},
      },
      {
        id: "2",
        correctionType: "feature_upsert",
        targetReference: "verified-water",
        correctionJson: {
          type: "water",
          holeNumber: 1,
          rings: [
            [
              [5, 0, -10],
              [10, 0, -10],
              [10, 0, -20],
              [5, 0, -10],
            ],
          ],
        },
      },
      {
        id: "3",
        correctionType: "hole_green",
        targetReference: "hole:1",
        correctionJson: { point: [4, 0, -330] },
      },
    ]);
    expect(result.appliedCorrectionIds).toEqual(["1", "2", "3"]);
    expect(result.manifest.features).toHaveLength(1);
    expect(result.manifest.features[0]).toMatchObject({
      id: "verified-water",
      source: "manual_qa_correction",
    });
    expect(result.manifest.holes[0].green).toEqual([4, 0, -330]);
    expect(result.manifest.holes[0].centerline.at(-1)).toEqual([4, 0, -330]);
    expect(manifest.features[0].id).toBe("old-bunker");
  });

  it("rejects open polygons and implausible local coordinates", () => {
    expect(() =>
      validateCourseTwinCorrectionBody({
        correctionType: "feature_upsert",
        targetReference: "water",
        reason: "Fix mapped water",
        correctionJson: {
          type: "water",
          holeNumber: 1,
          rings: [
            [
              [0, 0, 0],
              [1, 0, 0],
              [1, 0, 1],
              [0, 0, 1],
            ],
          ],
        },
      }),
    ).toThrow(/closed/);
    expect(() =>
      validateCourseTwinCorrectionBody({
        correctionType: "hole_tee",
        targetReference: "hole:1",
        reason: "Move verified tee",
        correctionJson: { point: [100_000, 0, 0] },
      }),
    ).toThrow(/outside/);
  });
});
