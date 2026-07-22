import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildUkFirstWaveCatalog,
  fetchRegionalCourseCandidates,
  regionalCandidatesFromElements,
} from "./catalog.mjs";

const region = { id: "test", country: "England", bounds: [53, -3, 54, -2] };

function mappedCourse({ id, name, lat, lon, holes = 18 }) {
  return [
    { type: "way", id, center: { lat, lon }, tags: { leisure: "golf_course", name } },
    ...Array.from({ length: holes }, (_, index) => ({
      type: "way",
      id: id * 100 + index,
      center: { lat: lat + index * 0.00001, lon },
      tags: { golf: "hole", ref: String(index + 1) },
    })),
    { type: "way", id: id * 1_000 + 1, center: { lat, lon }, tags: { golf: "green" } },
    { type: "way", id: id * 1_000 + 2, center: { lat, lon }, tags: { golf: "fairway" } },
  ];
}

test("catalogue parser assigns mapped holes and features to the nearest named course", () => {
  const [candidate] = regionalCandidatesFromElements(
    [
      ...mappedCourse({ id: 1, name: "Mapped Links", lat: 53.4, lon: -2.4 }),
      { type: "way", id: 99, center: { lat: 53.9, lon: -2.9 }, tags: { golf: "hole", ref: "1" } },
    ],
    region,
  );

  assert.equal(candidate.externalId, "osm-way-1");
  assert.equal(candidate.mappedHoles, 18);
  assert.equal(candidate.mappedGreens, 1);
  assert.equal(candidate.mappedFairways, 1);
  assert.ok(candidate.readinessScore >= 55);
});

test("regional fetch bounds the request and rejects failed Overpass responses", async () => {
  let body = "";
  const candidates = await fetchRegionalCourseCandidates(region, {
    fetchImpl: async (_url, options) => {
      body = String(options.body);
      return new Response(
        JSON.stringify({
          elements: mappedCourse({ id: 2, name: "Test Park", lat: 53.3, lon: -2.3 }),
        }),
        { status: 200 },
      );
    },
  });
  assert.match(body, /leisure/);
  assert.equal(candidates[0].mappedHoles, 18);

  await assert.rejects(
    () =>
      fetchRegionalCourseCandidates(region, {
        fetchImpl: async () => new Response("busy", { status: 429 }),
      }),
    /Overpass returned 429/,
  );
});

test("first-wave catalogue keeps only mapped courses, ranks them and honours the limit", async () => {
  const documents = [
    mappedCourse({ id: 10, name: "Nine Holes", lat: 53.2, lon: -2.2, holes: 9 }),
    mappedCourse({ id: 11, name: "Complete Course", lat: 53.5, lon: -2.5, holes: 18 }),
    mappedCourse({ id: 12, name: "Incomplete", lat: 53.7, lon: -2.7, holes: 4 }),
  ];
  let call = 0;
  const catalog = await buildUkFirstWaveCatalog({
    limit: 2,
    regions: [region, { ...region, id: "test-2" }],
    fetchImpl: async () =>
      new Response(JSON.stringify({ elements: documents[call++] }), { status: 200 }),
  });

  assert.equal(catalog.selected, 2);
  assert.deepEqual(
    catalog.candidates.map((candidate) => candidate.name),
    ["Complete Course", "Nine Holes"],
  );
});

test("first-wave catalogue retains successful regions and reports a failed region", async () => {
  let call = 0;
  const catalog = await buildUkFirstWaveCatalog({
    limit: 1,
    regions: [region, { ...region, id: "unavailable" }],
    fetchImpl: async () =>
      call++ === 0
        ? new Response(
            JSON.stringify({
              elements: mappedCourse({ id: 20, name: "Available Course", lat: 53.4, lon: -2.4 }),
            }),
            { status: 200 },
          )
        : new Response("timeout", { status: 504 }),
  });

  assert.equal(catalog.selected, 1);
  assert.equal(catalog.candidates[0].name, "Available Course");
  assert.match(catalog.warnings[0], /unavailable.*504/);
});

test("ingested first wave contains at least 20 mapped courses and preserves Aintree", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("./catalog/uk-first-wave-ingested.json", import.meta.url), "utf8"),
  );
  assert.ok(catalog.courses.length >= 20 && catalog.courses.length <= 50);
  assert.equal(catalog.manualVisualQaComplete, false);
  assert.ok(catalog.courses.every((course) => course.mappedHoles >= 9));
  assert.deepEqual(
    catalog.courses.find((course) => course.name === "Aintree Golf Centre"),
    {
      name: "Aintree Golf Centre",
      courseId: "4de11156-16fd-4a36-84e0-fadda53456b0",
      mappedHoles: 9,
      existingScorecard: true,
    },
  );
});
