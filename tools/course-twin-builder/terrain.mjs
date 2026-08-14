import { createHash } from "node:crypto";

import { fromArrayBuffer, fromUrl } from "geotiff";
import proj4 from "proj4";

const EA_COVERAGE_ID = "13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m";
const EA_WCS_URL =
  "https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs";
const OPEN_TOPOGRAPHY_URL = "https://portal.opentopography.org/API/globaldem";
const WELSH_GOVERNMENT_DTM_URL =
  "https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dtm_32bit_cog.tif";
const USGS_3DEP_URL =
  "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage";
const NRCAN_STAC_SEARCH_URL = "https://datacube.services.geo.ca/stac/api/search";
const LINZ_STAC_CATALOG_URL = "https://nz-elevation.s3.ap-southeast-2.amazonaws.com/catalog.json";
const MAPZEN_TERRAIN_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/geotiff";
const MAPZEN_TERRAIN_ZOOM = 13;
const OUTPUT_SIZE = 513;

proj4.defs(
  "EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.247,0.8421,-20.4894 +units=m +no_defs",
);
proj4.defs(
  "EPSG:2193",
  "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +datum=NZGD2000 +units=m +no_defs",
);
proj4.defs(
  "EPSG:3979",
  "+proj=lcc +lat_1=49 +lat_2=77 +lat_0=49 +lon_0=-95 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs",
);
proj4.defs(
  "EPSG:3413",
  "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +datum=WGS84 +units=m +no_defs",
);

export function createTerrainRequest(plan, env = process.env) {
  const bounds = plan.course.geographicBounds;
  if (plan.terrain.primary === "environment_agency_lidar") {
    const url = new URL(EA_WCS_URL);
    for (const [key, value] of Object.entries({
      service: "WCS",
      version: "2.0.1",
      request: "GetCoverage",
      coverageId: EA_COVERAGE_ID,
      subsettingCrs: "http://www.opengis.net/def/crs/EPSG/0/4326",
      outputCrs: "http://www.opengis.net/def/crs/EPSG/0/4326",
      format: "image/tiff",
    })) {
      url.searchParams.set(key, value);
    }
    url.searchParams.append("subset", `Long(${bounds.minLongitude},${bounds.maxLongitude})`);
    url.searchParams.append("subset", `Lat(${bounds.minLatitude},${bounds.maxLatitude})`);
    return {
      url,
      adapter: "environment_agency_lidar",
      sourceResolutionM: 1,
      verticalDatum: "Ordnance Datum Newlyn",
      attribution: {
        label: "Environment Agency LIDAR Composite DTM 1m",
        url: "https://www.data.gov.uk/dataset/01b3ee39-da3f-47b6-83da-dc98e73a461f/lidar-composite-digital-terrain-model-dtm-1m",
        licence: "Open Government Licence v3.0",
      },
    };
  }
  if (plan.terrain.primary === "welsh_government_lidar") {
    return {
      url: new URL(WELSH_GOVERNMENT_DTM_URL),
      adapter: "welsh_government_lidar",
      sourceResolutionM: 1,
      verticalDatum: "Ordnance Datum Newlyn",
      reader: "projected_cog",
      attribution: {
        label: "Welsh Government LiDAR DTM 1m",
        url: "https://datamap.gov.wales/maps/lidar-data-download/",
        licence: "Open Government Licence v3.0",
      },
    };
  }
  if (plan.terrain.primary === "usgs_3dep") {
    const url = new URL(USGS_3DEP_URL);
    for (const [key, value] of Object.entries({
      bbox: `${bounds.minLongitude},${bounds.minLatitude},${bounds.maxLongitude},${bounds.maxLatitude}`,
      bboxSR: "4326",
      imageSR: "4326",
      size: `${OUTPUT_SIZE},${OUTPUT_SIZE}`,
      format: "tiff",
      pixelType: "F32",
      interpolation: "RSP_BilinearInterpolation",
      returnSquarePixels: "true",
      f: "image",
    })) {
      url.searchParams.set(key, value);
    }
    return {
      url,
      adapter: "usgs_3dep",
      sourceResolutionM: 1,
      verticalDatum: "NAVD88 where available",
      attribution: {
        label: "USGS National Map 3D Elevation Program (3DEP)",
        url: "https://www.usgs.gov/3d-elevation-program",
        licence: "US public domain",
      },
    };
  }
  if (plan.terrain.primary === "linz_elevation") {
    return {
      url: new URL(LINZ_STAC_CATALOG_URL),
      adapter: "linz_elevation",
      sourceResolutionM: 1,
      verticalDatum: "Survey-specific New Zealand vertical datum",
      reader: "linz_stac_cog",
      attribution: {
        label: "New Zealand Elevation dataset — Toitū Te Whenua LINZ",
        url: "https://registry.opendata.aws/nz-elevation/",
        licence: "CC BY 4.0 — survey licensors recorded in STAC metadata",
      },
    };
  }
  if (plan.terrain.primary === "nrcan_hrdem") {
    return {
      url: new URL(NRCAN_STAC_SEARCH_URL),
      adapter: "nrcan_hrdem",
      sourceResolutionM: 2,
      verticalDatum: "CGVD2013",
      reader: "nrcan_stac_cog",
      attribution: {
        label: "Natural Resources Canada High Resolution Digital Elevation Model",
        url: "https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995",
        licence: "Open Government Licence — Canada",
      },
    };
  }
  if (plan.terrain.primary === "mapzen_terrain_tiles") {
    return {
      url: new URL(MAPZEN_TERRAIN_TILE_URL),
      adapter: "mapzen_terrain_tiles",
      sourceResolutionM: 30,
      verticalDatum: "EGM96",
      reader: "mapzen_geotiff_tiles",
      attribution: {
        label: "Mapzen Terrain Tiles on AWS Open Data",
        url: "https://registry.opendata.aws/terrain-tiles/",
        licence: "Source-specific open data licences recorded by Mapzen",
      },
    };
  }
  if (plan.terrain.primary !== "copernicus_glo30") {
    throw new Error(`Terrain adapter ${plan.terrain.primary} is not available in this worker.`);
  }
  const apiKey = env.OPENTOPOGRAPHY_API_KEY;
  if (!apiKey) throw new Error("OPENTOPOGRAPHY_API_KEY is required for Copernicus terrain.");
  const url = new URL(OPEN_TOPOGRAPHY_URL);
  for (const [key, value] of Object.entries({
    demtype: "COP30",
    south: String(bounds.minLatitude),
    north: String(bounds.maxLatitude),
    west: String(bounds.minLongitude),
    east: String(bounds.maxLongitude),
    outputFormat: "GTiff",
    API_Key: apiKey,
  })) {
    url.searchParams.set(key, value);
  }
  return {
    url,
    adapter: "copernicus_glo30",
    sourceResolutionM: 30,
    verticalDatum: "EGM2008",
    attribution: {
      label: "Copernicus GLO-30 via OpenTopography",
      url: "https://portal.opentopography.org/datasetMetadata?otCollectionID=OT.032021.4326.1",
      licence: "Copernicus DEM licence",
    },
  };
}

export async function fetchTerrain(plan, env = process.env) {
  const candidates = [
    ...new Set([plan.terrain.primary, ...(plan.terrain.fallbacks ?? []), "mapzen_terrain_tiles"]),
  ];
  let lastError = null;
  for (const adapter of candidates) {
    try {
      const request = createTerrainRequest(
        { ...plan, terrain: { ...plan.terrain, primary: adapter } },
        env,
      );
      if (request.reader === "projected_cog") {
        return readProjectedCog(plan, request);
      }
      if (request.reader === "nrcan_stac_cog") {
        return readNrcanStacCog(plan, request);
      }
      if (request.reader === "linz_stac_cog") {
        return readLinzStacCog(plan, request);
      }
      if (request.reader === "mapzen_geotiff_tiles") {
        return readMapzenTerrainTiles(plan, request);
      }
      const response = await fetch(request.url, {
        headers: { "user-agent": "ForeKingHell Course Twin Builder/0.2" },
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`${adapter} returned ${response.status}.`);
      return decodeTerrain(await response.arrayBuffer(), plan, request);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No terrain adapter succeeded.");
}

export async function readMapzenTerrainTiles(plan, request, fetchImpl = fetch) {
  const bounds = plan.course.geographicBounds;
  const tileRange = mapzenTileRange(bounds, MAPZEN_TERRAIN_ZOOM);
  const tileCoordinates = [];
  for (let y = tileRange.minY; y <= tileRange.maxY; y += 1) {
    for (let x = tileRange.minX; x <= tileRange.maxX; x += 1) {
      tileCoordinates.push({ x, y });
    }
  }
  if (tileCoordinates.length > 9) {
    throw new Error("Mapzen terrain request exceeds the nine-tile course limit.");
  }

  const tiles = await mapLimit(tileCoordinates, 4, async ({ x, y }) => {
    const url = new URL(
      `${request.url.toString().replace(/\/$/, "")}/${MAPZEN_TERRAIN_ZOOM}/${x}/${y}.tif`,
    );
    const response = await fetchImpl(url, {
      headers: { "user-agent": "ForeKingHell Course Twin Builder/0.2" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Mapzen terrain tile returned ${response.status}.`);
    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > 12 * 1024 * 1024) {
      throw new Error("Mapzen terrain tile exceeds the asset limit.");
    }
    const tiff = await fromArrayBuffer(await response.arrayBuffer());
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const values = Float32Array.from(await image.readRasters({ interleave: true }), Number);
    fillNoData(values, width, height, image.getGDALNoData());
    return { x, y, width, height, values };
  });
  const tilesByCoordinate = new Map(tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  const sample = (latitude, longitude) =>
    sampleMapzenTile(tilesByCoordinate, tileRange, latitude, longitude, MAPZEN_TERRAIN_ZOOM);
  const values = new Float32Array(OUTPUT_SIZE * OUTPUT_SIZE);
  for (let row = 0; row < OUTPUT_SIZE; row += 1) {
    const latitude =
      bounds.maxLatitude - (row / (OUTPUT_SIZE - 1)) * (bounds.maxLatitude - bounds.minLatitude);
    for (let column = 0; column < OUTPUT_SIZE; column += 1) {
      const longitude =
        bounds.minLongitude +
        (column / (OUTPUT_SIZE - 1)) * (bounds.maxLongitude - bounds.minLongitude);
      values[row * OUTPUT_SIZE + column] = sample(latitude, longitude);
    }
  }

  return terrainFromValues({
    values,
    originElevationM: sample(plan.course.origin.latitude, plan.course.origin.longitude),
    plan,
    request,
    geographicBounds: bounds,
    sample,
  });
}

async function readProjectedCog(plan, request) {
  const bounds = plan.course.geographicBounds;
  const tiff = await fromUrl(request.url.toString());
  const image = await tiff.getImage();
  const epsg = Number(request.epsg ?? image.getGeoKeys().ProjectedCSTypeGeoKey);
  ensureProjection(epsg);
  const projection = `EPSG:${epsg}`;
  const projectedCorners = [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.minLongitude, bounds.maxLatitude],
    [bounds.maxLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ].map((point) => proj4("EPSG:4326", projection, point));
  const eastings = projectedCorners.map((point) => point[0]);
  const northings = projectedCorners.map((point) => point[1]);
  const projectedBounds = [
    Math.min(...eastings),
    Math.min(...northings),
    Math.max(...eastings),
    Math.max(...northings),
  ];
  const imageBounds = image.getBoundingBox();
  if (!containsBounds(imageBounds, projectedBounds)) {
    throw new Error(`${request.adapter} COG does not cover the complete course bounds.`);
  }
  const rasters = await tiff.readRasters({
    bbox: projectedBounds,
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    resampleMethod: "bilinear",
    interleave: true,
  });
  const values = Float32Array.from(rasters, Number);
  fillNoData(values, OUTPUT_SIZE, OUTPUT_SIZE, image.getGDALNoData());
  const [originEasting, originNorthing] = proj4("EPSG:4326", projection, [
    plan.course.origin.longitude,
    plan.course.origin.latitude,
  ]);
  const originColumn = clampIndex(
    ((originEasting - projectedBounds[0]) / (projectedBounds[2] - projectedBounds[0])) *
      (OUTPUT_SIZE - 1),
  );
  const originRow = clampIndex(
    ((projectedBounds[3] - originNorthing) / (projectedBounds[3] - projectedBounds[1])) *
      (OUTPUT_SIZE - 1),
  );
  return terrainFromValues({
    values,
    originElevationM: values[originRow * OUTPUT_SIZE + originColumn],
    plan,
    request,
    geographicBounds: bounds,
    sample(latitude, longitude) {
      const [easting, northing] = proj4("EPSG:4326", projection, [longitude, latitude]);
      const column = clampIndex(
        ((easting - projectedBounds[0]) / (projectedBounds[2] - projectedBounds[0])) *
          (OUTPUT_SIZE - 1),
      );
      const row = clampIndex(
        ((projectedBounds[3] - northing) / (projectedBounds[3] - projectedBounds[1])) *
          (OUTPUT_SIZE - 1),
      );
      return values[row * OUTPUT_SIZE + column];
    },
  });
}

export async function readNrcanStacCog(plan, request, fetchImpl = fetch) {
  const bounds = plan.course.geographicBounds;
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "ForeKingHell Course Twin Builder/0.2",
    },
    body: JSON.stringify({
      collections: ["hrdem-lidar"],
      bbox: [bounds.minLongitude, bounds.minLatitude, bounds.maxLongitude, bounds.maxLatitude],
      limit: 10,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await boundedJson(response, "NRCan HRDEM STAC search");
  const item = result.features?.find(
    (feature) => feature?.assets?.dtm?.href && bboxContains(feature.bbox, bounds),
  );
  if (!item) throw new Error("NRCan HRDEM has no DTM covering the complete course bounds.");
  return readProjectedCog(plan, {
    ...request,
    url: new URL(item.assets.dtm.href),
    epsg: item.properties?.["proj:epsg"],
  });
}

const linzCollectionIndexPromises = new Map();

export async function readLinzStacCog(plan, request, fetchImpl = fetch) {
  const bounds = plan.course.geographicBounds;
  const collections = await loadLinzCollectionIndex(request.url, plan.course.origin, fetchImpl);
  const candidates = collections
    .filter((collection) => bboxContains(collection.extent?.spatial?.bbox?.[0], bounds))
    .sort((left, right) => collectionUpdated(right) - collectionUpdated(left));
  for (const collection of candidates) {
    const itemLinks = collection.links?.filter((link) => link.rel === "item") ?? [];
    const items = await mapLimit(itemLinks, 12, async (link) => {
      const url = new URL(link.href, collection.url);
      try {
        return { ...(await fetchBoundedJson(url, "LINZ elevation item", fetchImpl)), url };
      } catch {
        return null;
      }
    });
    const item = items.find(
      (candidate) => candidate?.assets?.visual?.href && bboxContains(candidate.bbox, bounds),
    );
    if (!item) continue;
    return readProjectedCog(plan, {
      ...request,
      url: new URL(item.assets.visual.href, item.url),
      epsg: 2193,
    });
  }
  throw new Error("LINZ has no 1 m DEM tile covering the complete course bounds.");
}

async function loadLinzCollectionIndex(catalogUrl, origin, fetchImpl) {
  const regions = linzCandidateRegions(origin);
  const cacheKey = [...regions].sort().join(",");
  if (!linzCollectionIndexPromises.has(cacheKey)) {
    const promise = (async () => {
      const catalog = await fetchBoundedJson(catalogUrl, "LINZ elevation catalog", fetchImpl);
      const links =
        catalog.links?.filter(
          (link) =>
            link.rel === "child" &&
            /\/dem_1m\//.test(String(link.href)) &&
            regions.has(String(link.href).replace(/^\.\//, "").split("/")[0]),
        ) ?? [];
      const collections = await mapLimit(links, 16, async (link) => {
        const url = new URL(link.href, catalogUrl);
        try {
          return { ...(await fetchBoundedJson(url, "LINZ elevation collection", fetchImpl)), url };
        } catch {
          return null;
        }
      });
      return collections.filter(Boolean);
    })().catch((error) => {
      linzCollectionIndexPromises.delete(cacheKey);
      throw error;
    });
    linzCollectionIndexPromises.set(cacheKey, promise);
  }
  return linzCollectionIndexPromises.get(cacheKey);
}

function linzCandidateRegions(origin) {
  const latitude = origin.latitude;
  if (latitude > -36.2) return new Set(["northland", "auckland"]);
  if (latitude > -37.5) return new Set(["northland", "auckland", "waikato", "bay-of-plenty"]);
  if (latitude > -38.9)
    return new Set(["waikato", "bay-of-plenty", "taranaki", "gisborne", "hawkes-bay"]);
  if (latitude > -40.5)
    return new Set(["taranaki", "manawatu-whanganui", "gisborne", "hawkes-bay"]);
  if (latitude > -42)
    return new Set([
      "wellington",
      "manawatu-whanganui",
      "hawkes-bay",
      "nelson",
      "tasman",
      "marlborough",
    ]);
  if (latitude > -44.2)
    return new Set(["nelson", "tasman", "marlborough", "canterbury", "west-coast"]);
  if (latitude > -46) return new Set(["canterbury", "west-coast", "otago", "southland"]);
  return new Set(["otago", "southland"]);
}

export async function decodeTerrain(arrayBuffer, plan, request) {
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters({
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    resampleMethod: "bilinear",
    interleave: true,
  });
  const values = Float32Array.from(rasters, Number);
  const noData = image.getGDALNoData();
  fillNoData(values, OUTPUT_SIZE, OUTPUT_SIZE, noData);
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = image.getBoundingBox();
  const origin = plan.course.origin;
  const originColumn = clampIndex(
    ((origin.longitude - minLongitude) / (maxLongitude - minLongitude)) * (OUTPUT_SIZE - 1),
  );
  const originRow = clampIndex(
    ((maxLatitude - origin.latitude) / (maxLatitude - minLatitude)) * (OUTPUT_SIZE - 1),
  );
  const originElevationM = values[originRow * OUTPUT_SIZE + originColumn];
  return terrainFromValues({
    values,
    originElevationM,
    plan,
    request,
    geographicBounds: { minLatitude, maxLatitude, minLongitude, maxLongitude },
    sample(latitude, longitude) {
      const column = clampIndex(
        ((longitude - minLongitude) / (maxLongitude - minLongitude)) * (OUTPUT_SIZE - 1),
      );
      const row = clampIndex(
        ((maxLatitude - latitude) / (maxLatitude - minLatitude)) * (OUTPUT_SIZE - 1),
      );
      return values[row * OUTPUT_SIZE + column];
    },
  });
}

function terrainFromValues({ values, originElevationM, plan, request, geographicBounds, sample }) {
  let minElevationM = Number.POSITIVE_INFINITY;
  let maxElevationM = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < values.length; index += 1) {
    const absolute = values[index];
    if (!Number.isFinite(absolute) || absolute < -500 || absolute > 9_000) {
      throw new Error("Terrain source contains invalid elevation samples.");
    }
    minElevationM = Math.min(minElevationM, absolute);
    maxElevationM = Math.max(maxElevationM, absolute);
    values[index] = absolute - originElevationM;
  }
  const binary = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  const origin = plan.course.origin;
  const { minLatitude, maxLatitude, minLongitude, maxLongitude } = geographicBounds;
  const metresPerDegreeLongitude = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);
  const localBounds = {
    minX: (minLongitude - origin.longitude) * metresPerDegreeLongitude,
    maxX: (maxLongitude - origin.longitude) * metresPerDegreeLongitude,
    minZ: (origin.latitude - maxLatitude) * 111_320,
    maxZ: (origin.latitude - minLatitude) * 111_320,
  };
  return {
    adapter: request.adapter,
    bytes: binary,
    sha256: createHash("sha256").update(binary).digest("hex"),
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    originElevationM,
    minElevationM,
    maxElevationM,
    localBounds,
    geographicBounds,
    resolutionM: Math.max(
      request.sourceResolutionM,
      (localBounds.maxX - localBounds.minX) / (OUTPUT_SIZE - 1),
      (localBounds.maxZ - localBounds.minZ) / (OUTPUT_SIZE - 1),
    ),
    verticalDatum: request.verticalDatum,
    attribution: request.attribution,
    sample,
  };
}

function fillNoData(values, width, height, noData) {
  const invalid = (value) =>
    !Number.isFinite(value) ||
    value < -500 ||
    value > 9_000 ||
    (Number.isFinite(noData) && value === noData);
  for (let row = 0; row < height; row += 1) {
    let previous = null;
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      if (invalid(values[index]) && previous !== null) values[index] = previous;
      else if (!invalid(values[index])) previous = values[index];
    }
    previous = null;
    for (let column = width - 1; column >= 0; column -= 1) {
      const index = row * width + column;
      if (invalid(values[index]) && previous !== null) values[index] = previous;
      else if (!invalid(values[index])) previous = values[index];
    }
  }
  for (let column = 0; column < width; column += 1) {
    let previous = null;
    for (let row = 0; row < height; row += 1) {
      const index = row * width + column;
      if (invalid(values[index]) && previous !== null) values[index] = previous;
      else if (!invalid(values[index])) previous = values[index];
    }
    previous = null;
    for (let row = height - 1; row >= 0; row -= 1) {
      const index = row * width + column;
      if (invalid(values[index]) && previous !== null) values[index] = previous;
      else if (!invalid(values[index])) previous = values[index];
    }
  }
}

function clampIndex(value) {
  return Math.max(0, Math.min(OUTPUT_SIZE - 1, Math.round(value)));
}

function ensureProjection(epsg) {
  if (!Number.isInteger(epsg)) throw new Error("Terrain COG is missing a projected EPSG code.");
  if (epsg >= 26901 && epsg <= 26923 && !proj4.defs(`EPSG:${epsg}`)) {
    proj4.defs(`EPSG:${epsg}`, `+proj=utm +zone=${epsg - 26900} +datum=NAD83 +units=m +no_defs`);
  }
  if (!proj4.defs(`EPSG:${epsg}`)) {
    throw new Error(`Terrain COG projection EPSG:${epsg} is not supported.`);
  }
}

function containsBounds(container, target) {
  return (
    Array.isArray(container) &&
    container.length >= 4 &&
    target[0] >= container[0] &&
    target[1] >= container[1] &&
    target[2] <= container[2] &&
    target[3] <= container[3]
  );
}

function bboxContains(bbox, bounds) {
  return containsBounds(bbox, [
    bounds.minLongitude,
    bounds.minLatitude,
    bounds.maxLongitude,
    bounds.maxLatitude,
  ]);
}

function collectionUpdated(collection) {
  const interval = collection.extent?.temporal?.interval?.[0];
  return Date.parse(interval?.[1] ?? interval?.[0] ?? "1970-01-01T00:00:00Z") || 0;
}

async function fetchBoundedJson(url, label, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { "user-agent": "ForeKingHell Course Twin Builder/0.2" },
    signal: AbortSignal.timeout(30_000),
  });
  return boundedJson(response, label);
}

async function boundedJson(response, label) {
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > 8 * 1024 * 1024) {
    throw new Error(`${label} exceeds the metadata limit.`);
  }
  const text = await response.text();
  if (text.length > 8 * 1024 * 1024) throw new Error(`${label} exceeds the metadata limit.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function mapzenTileRange(bounds, zoom) {
  return {
    minX: longitudeTile(bounds.minLongitude, zoom),
    maxX: longitudeTile(bounds.maxLongitude, zoom),
    minY: latitudeTile(bounds.maxLatitude, zoom),
    maxY: latitudeTile(bounds.minLatitude, zoom),
  };
}

function longitudeTile(longitude, zoom) {
  const tileCount = 2 ** zoom;
  return Math.max(0, Math.min(tileCount - 1, Math.floor(((longitude + 180) / 360) * tileCount)));
}

function latitudeTile(latitude, zoom) {
  const tileCount = 2 ** zoom;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (clamped * Math.PI) / 180;
  const normalized = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
  return Math.max(0, Math.min(tileCount - 1, Math.floor(normalized * tileCount)));
}

function sampleMapzenTile(tiles, tileRange, latitude, longitude, zoom) {
  const tileCount = 2 ** zoom;
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (clampedLatitude * Math.PI) / 180;
  const rawGlobalX = ((longitude + 180) / 360) * tileCount;
  const rawGlobalY =
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * tileCount;
  const globalX = Math.max(tileRange.minX, Math.min(tileRange.maxX + 1 - 1e-9, rawGlobalX));
  const globalY = Math.max(tileRange.minY, Math.min(tileRange.maxY + 1 - 1e-9, rawGlobalY));
  const tileX = Math.max(0, Math.min(tileCount - 1, Math.floor(globalX)));
  const tileY = Math.max(0, Math.min(tileCount - 1, Math.floor(globalY)));
  const tile = tiles.get(`${tileX}:${tileY}`);
  if (!tile) throw new Error("Mapzen terrain tile coverage is incomplete.");
  const pixelX = Math.max(0, Math.min(tile.width - 1, (globalX - tileX) * tile.width));
  const pixelY = Math.max(0, Math.min(tile.height - 1, (globalY - tileY) * tile.height));
  const left = Math.floor(pixelX);
  const right = Math.min(tile.width - 1, left + 1);
  const top = Math.floor(pixelY);
  const bottom = Math.min(tile.height - 1, top + 1);
  const horizontal = pixelX - left;
  const vertical = pixelY - top;
  const topValue =
    tile.values[top * tile.width + left] * (1 - horizontal) +
    tile.values[top * tile.width + right] * horizontal;
  const bottomValue =
    tile.values[bottom * tile.width + left] * (1 - horizontal) +
    tile.values[bottom * tile.width + right] * horizontal;
  return topValue * (1 - vertical) + bottomValue * vertical;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index], index);
      }
    }),
  );
  return results;
}
