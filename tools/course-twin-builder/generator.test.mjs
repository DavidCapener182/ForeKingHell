import assert from "node:assert/strict";
import test from "node:test";

import { buildManifest } from "./generator.mjs";

const plan = {
  schemaVersion: 1,
  course: {
    id: "course-1",
    name: "Test Course",
    country: "England",
    origin: { latitude: 53, longitude: -3 },
  },
  terrain: { targetResolutionM: 1 },
  quality: {
    grade: "B",
    supportedModes: ["flyover", "replay", "strategy", "play"],
    warnings: ["Putting contours have not been survey-verified."],
    evidence: { holeCoverage: 1 },
  },
  sourceGeometry: {
    holes: [
      {
        holeNumber: 1,
        par: 4,
        yards: 400,
        strokeIndex: 1,
        tee: [-3, 53],
        green: [-2.995, 52.998],
        centerline: [
          [-3, 53],
          [-2.995, 52.998],
        ],
      },
    ],
    features: [
      {
        id: "green-1",
        holeNumber: 1,
        featureType: "green",
        source: "openstreetmap",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-2.996, 52.999],
              [-2.995, 52.999],
              [-2.995, 52.998],
              [-2.996, 52.999],
            ],
          ],
        },
      },
    ],
  },
};

const terrain = {
  adapter: "environment_agency_lidar",
  sample: () => 2,
  originElevationM: 12,
  localBounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
  geographicBounds: {
    minLatitude: 52.99,
    maxLatitude: 53.01,
    minLongitude: -3.01,
    maxLongitude: -2.99,
  },
  resolutionM: 1,
  verticalDatum: "ODN",
  width: 513,
  height: 513,
  minElevationM: 10,
  maxElevationM: 15,
  sha256: "a".repeat(64),
  attribution: { label: "Terrain", url: "https://example.test", licence: "Test" },
};

test("builder converts geographic holes and polygons into a runtime manifest", () => {
  const manifest = buildManifest(plan, terrain, { attribution: "Imagery" });
  assert.equal(manifest.course.id, "course-1");
  assert.equal(manifest.holes.length, 1);
  assert.equal(manifest.features[0].type, "green");
  assert.equal(manifest.terrain.heightmap.url, "asset://terrain.f32");
  assert.equal(manifest.terrain.imagery.url, "asset://imagery.jpg");
  assert.deepEqual(manifest.holes[0].tee, [0, 2, 0]);
});

test("builder labels a Copernicus fallback honestly and caps it at strategy quality", () => {
  const manifest = buildManifest(
    plan,
    { ...terrain, adapter: "copernicus_glo30", resolutionM: 30 },
    { attribution: "Imagery" },
  );
  assert.equal(manifest.terrain.kind, "global_dem");
  assert.equal(manifest.quality.grade, "C");
  assert.deepEqual(manifest.supportedModes, ["flyover", "replay", "strategy"]);
  assert.match(manifest.quality.warnings.at(-1), /30\.0 m/);
});
