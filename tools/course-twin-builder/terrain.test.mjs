import assert from "node:assert/strict";
import test from "node:test";

import { createTerrainRequest } from "./terrain.mjs";

const plan = {
  course: {
    geographicBounds: {
      minLatitude: 53.47,
      maxLatitude: 53.49,
      minLongitude: -2.99,
      maxLongitude: -2.96,
    },
  },
  terrain: { primary: "environment_agency_lidar" },
};

test("Environment Agency adapter creates a bounded WCS request", () => {
  const request = createTerrainRequest(plan, {});
  assert.equal(request.adapter, "environment_agency_lidar");
  assert.equal(request.url.searchParams.get("request"), "GetCoverage");
  assert.deepEqual(request.url.searchParams.getAll("subset"), [
    "Long(-2.99,-2.96)",
    "Lat(53.47,53.49)",
  ]);
});

test("Copernicus fallback requires a key and creates a COP30 request", () => {
  const copernicus = { ...plan, terrain: { primary: "copernicus_glo30" } };
  assert.throws(() => createTerrainRequest(copernicus, {}), /OPENTOPOGRAPHY_API_KEY/);
  const request = createTerrainRequest(copernicus, { OPENTOPOGRAPHY_API_KEY: "test-key" });
  assert.equal(request.url.searchParams.get("demtype"), "COP30");
  assert.equal(request.url.searchParams.get("API_Key"), "test-key");
});

test("Welsh Government adapter reads the official projected COG", () => {
  const welsh = { ...plan, terrain: { primary: "welsh_government_lidar" } };
  const request = createTerrainRequest(welsh, {});
  assert.equal(request.adapter, "welsh_government_lidar");
  assert.equal(request.reader, "projected_cog");
  assert.match(request.url.hostname, /dmwproductionblob\.blob\.core\.windows\.net/);
  assert.equal(request.attribution.licence, "Open Government Licence v3.0");
});
