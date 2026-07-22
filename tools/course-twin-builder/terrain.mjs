import { createHash } from "node:crypto";

import { fromArrayBuffer, fromUrl } from "geotiff";
import proj4 from "proj4";

const EA_COVERAGE_ID = "13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m";
const EA_WCS_URL =
  "https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs";
const OPEN_TOPOGRAPHY_URL = "https://portal.opentopography.org/API/globaldem";
const WELSH_GOVERNMENT_DTM_URL =
  "https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dtm_32bit_cog.tif";
const OUTPUT_SIZE = 513;

proj4.defs(
  "EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.247,0.8421,-20.4894 +units=m +no_defs",
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
  const candidates = [plan.terrain.primary, ...(plan.terrain.fallbacks ?? [])];
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

async function readProjectedCog(plan, request) {
  const bounds = plan.course.geographicBounds;
  const projectedCorners = [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.minLongitude, bounds.maxLatitude],
    [bounds.maxLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ].map((point) => proj4("EPSG:4326", "EPSG:27700", point));
  const eastings = projectedCorners.map((point) => point[0]);
  const northings = projectedCorners.map((point) => point[1]);
  const projectedBounds = [
    Math.min(...eastings),
    Math.min(...northings),
    Math.max(...eastings),
    Math.max(...northings),
  ];
  const tiff = await fromUrl(request.url.toString());
  const image = await tiff.getImage();
  if (image.getGeoKeys().ProjectedCSTypeGeoKey !== 27700) {
    throw new Error("Welsh LiDAR COG is not in the expected British National Grid projection.");
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
  const [originEasting, originNorthing] = proj4("EPSG:4326", "EPSG:27700", [
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
      const [easting, northing] = proj4("EPSG:4326", "EPSG:27700", [longitude, latitude]);
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
