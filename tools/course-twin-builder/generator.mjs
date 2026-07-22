import { createHash } from "node:crypto";

import { fetchTerrain } from "./terrain.mjs";

const SUPPORTED_FEATURES = new Set([
  "tee",
  "fairway",
  "green",
  "bunker",
  "water",
  "rough",
  "trees",
  "course_boundary",
]);

export async function generateCourseTwinCompletion(plan, env = process.env) {
  validatePlan(plan);
  const terrain = await fetchTerrain(plan, env);
  const imagery = await fetchImagery(terrain.geographicBounds);
  const manifest = buildManifest(plan, terrain, imagery);
  return {
    status: "completed",
    manifest,
    assets: [
      workerAsset("terrain.f32", "application/octet-stream", terrain.bytes),
      workerAsset("imagery.jpg", "image/jpeg", imagery.bytes),
    ],
    metrics: {
      terrainAdapter: terrain.adapter,
      terrainResolutionM: terrain.resolutionM,
      terrainSamples: terrain.width * terrain.height,
      imageryBytes: imagery.bytes.length,
      mappedHoles: manifest.quality.mappedHoles,
      mappedFeatures: manifest.quality.mappedFeatures,
    },
  };
}

export function buildManifest(plan, terrain, imagery) {
  const toLocal = ([longitude, latitude]) => [
    (longitude - plan.course.origin.longitude) *
      111_320 *
      Math.cos((plan.course.origin.latitude * Math.PI) / 180),
    terrain.sample(latitude, longitude),
    (plan.course.origin.latitude - latitude) * 111_320,
  ];
  const holes = plan.sourceGeometry.holes
    .map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      strokeIndex: hole.strokeIndex,
      tee: toLocal(hole.tee),
      green: toLocal(hole.green),
      centerline: hole.centerline.map(toLocal),
    }))
    .sort((left, right) => left.holeNumber - right.holeNumber);
  const features = plan.sourceGeometry.features.flatMap((feature) => {
    if (!SUPPORTED_FEATURES.has(feature.featureType)) return [];
    const rings = geometryRings(feature.geometry).map((ring) => ring.map(toLocal));
    if (!rings.length) return [];
    return [
      {
        id: feature.id,
        holeNumber: feature.holeNumber,
        type: feature.featureType,
        rings,
        source: feature.source,
      },
    ];
  });
  const warnings = [...plan.quality.warnings];
  if (terrain.resolutionM > plan.terrain.targetResolutionM * 1.5) {
    warnings.push(
      `Generated terrain resolution is ${terrain.resolutionM.toFixed(1)} m, below the ${plan.terrain.targetResolutionM.toFixed(1)} m target.`,
    );
  }
  const actualGrade =
    terrain.resolutionM > 5 && ["A", "B"].includes(plan.quality.grade) ? "C" : plan.quality.grade;
  const actualSupportedModes =
    actualGrade === "C" ? ["flyover", "replay", "strategy"] : plan.quality.supportedModes;
  return {
    schemaVersion: 1,
    packageVersion: 1,
    minimumRuntimeVersion: "1.0.0",
    course: {
      id: plan.course.id,
      name: plan.course.name,
      country: plan.course.country,
    },
    origin: {
      ...plan.course.origin,
      elevationM: terrain.originElevationM,
      coordinateSystem: "LOCAL_ENU_METRES",
    },
    bounds: terrain.localBounds,
    terrain: {
      kind: terrain.adapter === "copernicus_glo30" ? "global_dem" : "lidar_dtm",
      resolutionM: terrain.resolutionM,
      verticalDatum: terrain.verticalDatum,
      warning: warnings[0] ?? null,
      heightmap: {
        url: "asset://terrain.f32",
        encoding: "float32_le_relative_metres",
        width: terrain.width,
        height: terrain.height,
        localBounds: terrain.localBounds,
        geographicBounds: terrain.geographicBounds,
        minElevationM: terrain.minElevationM,
        maxElevationM: terrain.maxElevationM,
        sha256: terrain.sha256,
      },
      imagery: {
        url: "asset://imagery.jpg",
        kind: "aerial_reference",
        geographicBounds: terrain.geographicBounds,
        attribution: imagery.attribution,
      },
    },
    quality: {
      grade: actualGrade,
      mappedHoles: holes.length,
      expectedHoles: Math.max(
        holes.length,
        plan.quality.evidence.holeCoverage > 0
          ? Math.round(holes.length / plan.quality.evidence.holeCoverage)
          : 18,
      ),
      mappedFeatures: features.length,
      verified: false,
      warnings,
    },
    supportedModes: actualSupportedModes,
    holes,
    features,
    attribution: [
      terrain.attribution,
      {
        label: "Map data from OpenStreetMap contributors",
        url: "https://www.openstreetmap.org/copyright",
        licence: "ODbL 1.0",
      },
      {
        label: imagery.attribution,
        url: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
        licence: "Esri World Imagery terms",
      },
    ],
  };
}

async function fetchImagery(bounds) {
  const width = 1536;
  const height = Math.max(
    512,
    Math.round(
      width *
        ((bounds.maxLatitude - bounds.minLatitude) /
          Math.max(0.000001, bounds.maxLongitude - bounds.minLongitude)),
    ),
  );
  const url = new URL(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
  );
  for (const [key, value] of Object.entries({
    bbox: `${bounds.minLongitude},${bounds.minLatitude},${bounds.maxLongitude},${bounds.maxLatitude}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${width},${Math.min(2048, height)}`,
    format: "jpg",
    transparent: "false",
    f: "image",
  })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { "user-agent": "ForeKingHell Course Twin Builder/0.2" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Aerial imagery returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1 || bytes.length > 6 * 1024 * 1024) {
    throw new Error("Aerial imagery is empty or exceeds the worker asset limit.");
  }
  return {
    bytes,
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  };
}

function workerAsset(fileName, contentType, bytes) {
  return {
    fileName,
    contentType,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    dataBase64: bytes.toString("base64"),
  };
}

function geometryRings(geometry) {
  if (!geometry || typeof geometry !== "object") return [];
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.filter(validRing);
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.flatMap((polygon) =>
      Array.isArray(polygon) ? polygon.filter(validRing) : [],
    );
  }
  return [];
}

function validRing(ring) {
  return (
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1])),
    )
  );
}

function validatePlan(plan) {
  if (plan?.schemaVersion !== 1 || !plan.course?.id || !plan.course?.origin) {
    throw new Error("Course Twin build plan is incomplete.");
  }
  if (!Array.isArray(plan.sourceGeometry?.holes) || !Array.isArray(plan.sourceGeometry?.features)) {
    throw new Error("Course Twin source geometry is missing.");
  }
  if (plan.sourceGeometry.holes.length < 1 || plan.sourceGeometry.holes.length > 54) {
    throw new Error("Course Twin requires between 1 and 54 mapped holes.");
  }
}
