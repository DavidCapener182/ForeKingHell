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

test("USGS 3DEP adapter requests a bounded bare-earth float GeoTIFF", () => {
  const us = { ...plan, terrain: { primary: "usgs_3dep" } };
  const request = createTerrainRequest(us, {});
  assert.equal(request.adapter, "usgs_3dep");
  assert.match(request.url.hostname, /nationalmap\.gov/);
  assert.equal(request.url.searchParams.get("bbox"), "-2.99,53.47,-2.96,53.49");
  assert.equal(request.url.searchParams.get("pixelType"), "F32");
  assert.equal(request.url.searchParams.get("format"), "tiff");
});

test("LINZ and NRCan adapters resolve official STAC COG catalogues", () => {
  const linz = createTerrainRequest({ ...plan, terrain: { primary: "linz_elevation" } }, {});
  assert.equal(linz.reader, "linz_stac_cog");
  assert.match(linz.url.hostname, /nz-elevation\.s3/);
  assert.equal(linz.attribution.licence.includes("CC BY 4.0"), true);

  const nrcan = createTerrainRequest({ ...plan, terrain: { primary: "nrcan_hrdem" } }, {});
  assert.equal(nrcan.reader, "nrcan_stac_cog");
  assert.equal(nrcan.url.pathname, "/stac/api/search");
  assert.match(nrcan.attribution.licence, /Canada/);
});
