import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { fromArrayBuffer } from "geotiff";

const root = resolve(import.meta.dirname, "../..");
const packageVersion = 3;
const packageKey = "bootle-v3";
const outputWidth = 513;
const outputHeight = 513;
const origin = { latitude: 53.4815, longitude: -2.9765 };
const requestedBounds = {
  minLatitude: 53.476,
  maxLatitude: 53.487,
  minLongitude: -2.984,
  maxLongitude: -2.969,
};
const coverageId = "13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m";
const wcsUrl =
  "https://environment.data.gov.uk/geoservices/datasets/13787b9a-26a4-4775-8523-806d13af58fc/wcs";
const overpassUrl = "https://overpass-api.de/api/interpreter";

const requestUrl = new URL(wcsUrl);
for (const [key, value] of Object.entries({
  service: "WCS",
  version: "2.0.1",
  request: "GetCoverage",
  coverageId,
  subsettingCrs: "http://www.opengis.net/def/crs/EPSG/0/4326",
  outputCrs: "http://www.opengis.net/def/crs/EPSG/0/4326",
  format: "image/tiff",
})) {
  requestUrl.searchParams.set(key, value);
}
requestUrl.searchParams.append(
  "subset",
  `Long(${requestedBounds.minLongitude},${requestedBounds.maxLongitude})`,
);
requestUrl.searchParams.append(
  "subset",
  `Lat(${requestedBounds.minLatitude},${requestedBounds.maxLatitude})`,
);

const response = await fetch(requestUrl, {
  headers: { "user-agent": "ForeKingHell Course Twin builder/0.2" },
});
if (!response.ok) {
  throw new Error(`Environment Agency WCS returned ${response.status} ${response.statusText}`);
}

const tiff = await fromArrayBuffer(await response.arrayBuffer());
const image = await tiff.getImage();
const rasters = await image.readRasters({
  width: outputWidth,
  height: outputHeight,
  resampleMethod: "bilinear",
  interleave: true,
});
const [minLongitude, minLatitude, maxLongitude, maxLatitude] = image.getBoundingBox();
const noData = image.getGDALNoData();
const absoluteElevations = Float32Array.from(rasters, Number);
const isInvalidElevation = (elevation) =>
  !Number.isFinite(elevation) ||
  elevation < -500 ||
  elevation > 2_000 ||
  (Number.isFinite(noData) && elevation === noData);

const sourceNoDataSampleCount = fillNoDataSamples(absoluteElevations, outputWidth, outputHeight);

let minElevationM = Number.POSITIVE_INFINITY;
let maxElevationM = Number.NEGATIVE_INFINITY;
let invalidSampleCount = 0;
for (const elevation of absoluteElevations) {
  if (isInvalidElevation(elevation)) {
    invalidSampleCount += 1;
    continue;
  }
  minElevationM = Math.min(minElevationM, elevation);
  maxElevationM = Math.max(maxElevationM, elevation);
}
if (invalidSampleCount > 0) {
  throw new Error(
    `The LiDAR coverage contains ${invalidSampleCount} invalid samples (no-data value: ${String(noData)}).`,
  );
}

const originColumn = Math.round(
  ((origin.longitude - minLongitude) / (maxLongitude - minLongitude)) * (outputWidth - 1),
);
const originRow = Math.round(
  ((maxLatitude - origin.latitude) / (maxLatitude - minLatitude)) * (outputHeight - 1),
);
const originElevationM = absoluteElevations[originRow * outputWidth + originColumn];
const relativeElevations = new Float32Array(absoluteElevations.length);
for (let index = 0; index < absoluteElevations.length; index += 1) {
  relativeElevations[index] = absoluteElevations[index] - originElevationM;
}

const binary = Buffer.from(
  relativeElevations.buffer,
  relativeElevations.byteOffset,
  relativeElevations.byteLength,
);
const metresPerDegreeLongitude = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);
const localBounds = {
  minX: (minLongitude - origin.longitude) * metresPerDegreeLongitude,
  maxX: (maxLongitude - origin.longitude) * metresPerDegreeLongitude,
  minZ: (origin.latitude - maxLatitude) * 111_320,
  maxZ: (origin.latitude - minLatitude) * 111_320,
};
const geographicBounds = {
  minLatitude,
  maxLatitude,
  minLongitude,
  maxLongitude,
};
const physicalWidthM = localBounds.maxX - localBounds.minX;
const physicalHeightM = localBounds.maxZ - localBounds.minZ;
const packageResolutionM = Math.max(
  physicalWidthM / (outputWidth - 1),
  physicalHeightM / (outputHeight - 1),
);
const imageryWidth = 1536;
const imageryHeight = Math.round(
  imageryWidth * ((maxLatitude - minLatitude) / (maxLongitude - minLongitude)),
);
const imageryUrl = new URL(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
);
for (const [key, value] of Object.entries({
  bbox: `${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`,
  bboxSR: "4326",
  imageSR: "4326",
  size: `${imageryWidth},${imageryHeight}`,
  format: "jpg",
  transparent: "false",
  f: "image",
})) {
  imageryUrl.searchParams.set(key, value);
}

const overpassQuery = `[out:json][timeout:25];(
  way["golf"~"bunker|water_hazard|lateral_water_hazard|tee"](${requestedBounds.minLatitude},${requestedBounds.minLongitude},${requestedBounds.maxLatitude},${requestedBounds.maxLongitude});
  way["natural"="water"](${requestedBounds.minLatitude},${requestedBounds.minLongitude},${requestedBounds.maxLatitude},${requestedBounds.maxLongitude});
  way["natural"="wood"](${requestedBounds.minLatitude},${requestedBounds.minLongitude},${requestedBounds.maxLatitude},${requestedBounds.maxLongitude});
  way["landuse"="forest"](${requestedBounds.minLatitude},${requestedBounds.minLongitude},${requestedBounds.maxLatitude},${requestedBounds.maxLongitude});
);out tags geom;`;
const overpassRequestUrl = new URL(overpassUrl);
overpassRequestUrl.searchParams.set("data", overpassQuery);
const overpassResponse = await fetch(overpassRequestUrl, {
  headers: { "user-agent": "ForeKingHell Course Twin builder/0.2" },
});
if (!overpassResponse.ok) {
  throw new Error(
    `OpenStreetMap Overpass returned ${overpassResponse.status} ${overpassResponse.statusText}`,
  );
}
const overpassDocument = await overpassResponse.json();
const semanticFeatures = overpassDocument.elements
  .map(osmElementToSemanticFeature)
  .filter((feature) => feature !== null);

const metadata = {
  schemaVersion: 1,
  packageVersion,
  packageKey,
  generatedAt: new Date().toISOString(),
  origin: { ...origin, elevationM: originElevationM },
  sourceResolutionM: 1,
  packageResolutionM,
  verticalDatum: "Ordnance Datum Newlyn",
  heightmap: {
    url: `/course-twins/${packageKey}/terrain.f32`,
    encoding: "float32_le_relative_metres",
    width: outputWidth,
    height: outputHeight,
    localBounds,
    geographicBounds,
    minElevationM,
    maxElevationM,
    sha256: createHash("sha256").update(binary).digest("hex"),
  },
  imagery: {
    url: imageryUrl.toString(),
    kind: "aerial_reference",
    geographicBounds,
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  semanticFeatures,
  source: {
    label: "Environment Agency LIDAR Composite DTM 1m",
    url: "https://www.data.gov.uk/dataset/01b3ee39-da3f-47b6-83da-dc98e73a461f/lidar-composite-digital-terrain-model-dtm-1m",
    licence: "Open Government Licence v3.0",
    coverageRequest: requestUrl.toString(),
    filledNoDataSamples: sourceNoDataSampleCount,
  },
  mapSource: {
    label: "Map data from OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    licence: "ODbL 1.0",
    querySha256: createHash("sha256").update(overpassQuery).digest("hex"),
  },
};

const publicPath = resolve(root, `public/course-twins/${packageKey}/terrain.f32`);
const metadataPath = resolve(root, `src/generated/course-twins/${packageKey}.json`);
await mkdir(dirname(publicPath), { recursive: true });
await mkdir(dirname(metadataPath), { recursive: true });
await Promise.all([
  writeFile(publicPath, binary),
  writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8"),
]);

process.stdout.write(`${JSON.stringify({ publicPath, metadataPath, ...metadata }, null, 2)}\n`);

function osmElementToSemanticFeature(element) {
  if (element?.type !== "way" || !Array.isArray(element.geometry)) return null;
  const type = osmSemanticType(element.tags ?? {});
  if (!type) return null;
  const bounds = element.bounds;
  if (!bounds || !featureIntersectsBounds(bounds, requestedBounds)) return null;
  const boundsWidth = bounds.maxlon - bounds.minlon;
  const boundsHeight = bounds.maxlat - bounds.minlat;
  if (boundsWidth > 0.02 || boundsHeight > 0.02) return null;

  const coordinates = simplifyRing(
    element.geometry.map((point) => [Number(point.lon), Number(point.lat)]),
    0.000008,
  );
  if (coordinates.length < 4) return null;

  return {
    id: `osm-way-${element.id}`,
    type,
    source: "openstreetmap",
    coordinates,
    tags: {
      golf: element.tags?.golf ?? null,
      natural: element.tags?.natural ?? null,
      landuse: element.tags?.landuse ?? null,
      water: element.tags?.water ?? null,
      ref: element.tags?.ref ?? null,
    },
  };
}

function osmSemanticType(tags) {
  if (tags.golf === "bunker") return "bunker";
  if (["water_hazard", "lateral_water_hazard"].includes(tags.golf)) return "water";
  if (tags.golf === "tee") return "tee";
  if (tags.natural === "water") return "water";
  if (tags.natural === "wood" || tags.landuse === "forest") return "trees";
  return null;
}

function featureIntersectsBounds(bounds, requested) {
  return !(
    bounds.maxlat < requested.minLatitude ||
    bounds.minlat > requested.maxLatitude ||
    bounds.maxlon < requested.minLongitude ||
    bounds.minlon > requested.maxLongitude
  );
}

function simplifyRing(points, tolerance) {
  if (points.length < 4) return [];
  const source = points.slice();
  const first = source[0];
  const last = source.at(-1);
  if (first[0] === last[0] && first[1] === last[1]) source.pop();
  const simplified = simplifyLine(source, tolerance);
  if (simplified.length < 3) return [];
  simplified.push([...simplified[0]]);
  return simplified;
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;
  let farthestDistance = 0;
  let farthestIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  if (farthestDistance <= tolerance) return [points[0], points.at(-1)];
  return [
    ...simplifyLine(points.slice(0, farthestIndex + 1), tolerance).slice(0, -1),
    ...simplifyLine(points.slice(farthestIndex), tolerance),
  ];
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const amount = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(point[0] - (start[0] + amount * dx), point[1] - (start[1] + amount * dy));
}

function fillNoDataSamples(values, width, height) {
  let count = 0;
  for (const value of values) if (isInvalidElevation(value)) count += 1;
  if (count === 0) return 0;

  for (let row = 0; row < height; row += 1) {
    let lastValid = null;
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      if (isInvalidElevation(values[index])) {
        if (lastValid !== null) values[index] = lastValid;
      } else {
        lastValid = values[index];
      }
    }
    lastValid = null;
    for (let column = width - 1; column >= 0; column -= 1) {
      const index = row * width + column;
      if (isInvalidElevation(values[index])) {
        if (lastValid !== null) values[index] = lastValid;
      } else {
        lastValid = values[index];
      }
    }
  }

  for (let column = 0; column < width; column += 1) {
    let lastValid = null;
    for (let row = 0; row < height; row += 1) {
      const index = row * width + column;
      if (isInvalidElevation(values[index])) {
        if (lastValid !== null) values[index] = lastValid;
      } else {
        lastValid = values[index];
      }
    }
    lastValid = null;
    for (let row = height - 1; row >= 0; row -= 1) {
      const index = row * width + column;
      if (isInvalidElevation(values[index])) {
        if (lastValid !== null) values[index] = lastValid;
      } else {
        lastValid = values[index];
      }
    }
  }

  return count;
}
