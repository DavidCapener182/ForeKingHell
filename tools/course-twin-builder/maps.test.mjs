import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichCourseTwinMapGeometry,
  osmElementFeatures,
  overtureGeoJsonFeatures,
} from "./maps.mjs";

test("OSM polygons become semantic golf features with honest provenance", () => {
  assert.deepEqual(
    osmElementFeatures({
      type: "way",
      id: 42,
      tags: { golf: "bunker", ref: "5" },
      geometry: [
        { lon: -2.99, lat: 53.48 },
        { lon: -2.98, lat: 53.48 },
        { lon: -2.98, lat: 53.47 },
      ],
    }),
    [
      {
        id: "osm-way-42-0",
        holeNumber: 5,
        featureType: "bunker",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-2.99, 53.48],
              [-2.98, 53.48],
              [-2.98, 53.47],
              [-2.99, 53.48],
            ],
          ],
        },
        source: "openstreetmap",
      },
    ],
  );
});

test("map refresh fills missing semantic classes without duplicating complete ones", async () => {
  const plan = {
    course: {
      geographicBounds: {
        minLatitude: 53.47,
        maxLatitude: 53.49,
        minLongitude: -2.99,
        maxLongitude: -2.96,
      },
    },
    sourceGeometry: {
      holes: [{ holeNumber: 1 }],
      features: [{ id: "saved-green", featureType: "green", source: "database", geometry: {} }],
    },
  };
  const response = {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () =>
      JSON.stringify({
        elements: [
          {
            type: "way",
            id: 1,
            tags: { golf: "green" },
            geometry: triangle(),
          },
          {
            type: "way",
            id: 2,
            tags: { natural: "water" },
            geometry: triangle(),
          },
        ],
      }),
  };
  const enriched = await enrichCourseTwinMapGeometry(plan, {}, async () => response);
  assert.equal(enriched.addedFeatures, 1);
  assert.deepEqual(
    enriched.plan.sourceGeometry.features.map((feature) => feature.featureType),
    ["green", "water"],
  );
});

test("Overture water and wooded land-cover polygons map to supported semantics", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [-2.99, 53.48],
        [-2.98, 53.48],
        [-2.98, 53.47],
        [-2.99, 53.48],
      ],
    ],
  };
  assert.equal(
    overtureGeoJsonFeatures({ features: [{ id: "lake", geometry }] }, "water")[0].featureType,
    "water",
  );
  assert.equal(
    overtureGeoJsonFeatures(
      { features: [{ id: "wood", geometry, properties: { subtype: "forest" } }] },
      "land_cover",
    )[0].featureType,
    "trees",
  );
});

function triangle() {
  return [
    { lon: -2.99, lat: 53.48 },
    { lon: -2.98, lat: 53.48 },
    { lon: -2.98, lat: 53.47 },
  ];
}
