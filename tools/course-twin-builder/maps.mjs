import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const execFileAsync = promisify(execFile);

const expectedPerHole = new Set(["tee", "fairway", "green"]);

export async function enrichCourseTwinMapGeometry(plan, env = process.env, fetchImpl = fetch) {
  if (env.COURSE_TWIN_OSM_REFRESH === "0") {
    return { plan, warnings: [], addedFeatures: 0 };
  }
  try {
    const fetched = await fetchOpenStreetMapFeatures(plan.course.geographicBounds, {
      endpoint: env.COURSE_TWIN_OVERPASS_URL ?? DEFAULT_OVERPASS_URL,
      fetchImpl,
    });
    let mapFeatures = fetched;
    const warnings = [];
    if (env.COURSE_TWIN_OVERTURE_ENABLED === "1") {
      try {
        mapFeatures = [
          ...mapFeatures,
          ...(await fetchOvertureFeatures(plan.course.geographicBounds, {
            binary: env.OVERTUREMAPS_BIN ?? "overturemaps",
          })),
        ];
      } catch (error) {
        warnings.push(
          `Overture refresh was unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    const features = mergeFeatures(plan, mapFeatures);
    return {
      plan: { ...plan, sourceGeometry: { ...plan.sourceGeometry, features } },
      warnings,
      addedFeatures: features.length - plan.sourceGeometry.features.length,
    };
  } catch (error) {
    return {
      plan,
      warnings: [
        `OpenStreetMap refresh was unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      ],
      addedFeatures: 0,
    };
  }
}

export async function fetchOvertureFeatures(
  bounds,
  { binary = "overturemaps", execFileImpl = execFileAsync } = {},
) {
  validateBounds(bounds);
  const directory = await mkdtemp(join(tmpdir(), "forekinghell-overture-"));
  const bbox = [
    bounds.minLongitude,
    bounds.minLatitude,
    bounds.maxLongitude,
    bounds.maxLatitude,
  ].join(",");
  try {
    const features = [];
    for (const type of ["water", "land_cover"]) {
      const output = join(directory, `${type}.geojson`);
      await execFileImpl(
        binary,
        ["download", "--bbox", bbox, "-f", "geojson", "--type", type, "-o", output],
        { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
      );
      const text = await readFile(output, "utf8");
      if (text.length > MAX_RESPONSE_BYTES) throw new Error(`${type} output exceeds the map limit`);
      features.push(...overtureGeoJsonFeatures(JSON.parse(text), type));
    }
    return features;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function overtureGeoJsonFeatures(document, type) {
  if (!Array.isArray(document?.features)) return [];
  return document.features.flatMap((feature, index) => {
    const featureType = overtureFeatureType(feature, type);
    if (!featureType || !["Polygon", "MultiPolygon"].includes(feature.geometry?.type)) return [];
    return [
      {
        id: `overture-${feature.id ?? `${type}-${index}`}`,
        holeNumber: null,
        featureType,
        geometry: feature.geometry,
        source: "overture",
      },
    ];
  });
}

export async function fetchOpenStreetMapFeatures(
  bounds,
  { endpoint = DEFAULT_OVERPASS_URL, fetchImpl = fetch } = {},
) {
  validateBounds(bounds);
  const bbox = `${bounds.minLatitude},${bounds.minLongitude},${bounds.maxLatitude},${bounds.maxLongitude}`;
  const query = `[out:json][timeout:35];
(
  way["golf"~"^(tee|fairway|green|bunker|water_hazard|rough)$"](${bbox});
  relation["golf"~"^(tee|fairway|green|bunker|water_hazard|rough)$"](${bbox});
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["natural"="wood"](${bbox});
  relation["natural"="wood"](${bbox});
  way["landuse"="forest"](${bbox});
  relation["landuse"="forest"](${bbox});
  way["leisure"="golf_course"](${bbox});
  relation["leisure"="golf_course"](${bbox});
);
out tags geom;`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": "ForeKingHell Course Twin Builder/0.2",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
    throw new Error("Overpass response exceeds the map-data limit");
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES)
    throw new Error("Overpass response exceeds the map-data limit");
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("Overpass returned invalid JSON");
  }
  if (!Array.isArray(document.elements)) throw new Error("Overpass response has no elements");
  return document.elements.flatMap(osmElementFeatures);
}

export function osmElementFeatures(element) {
  const featureType = mapFeatureType(element?.tags ?? {});
  if (!featureType) return [];
  const rings = elementRings(element);
  const holeNumber = parseHoleNumber(element.tags?.ref);
  return rings.map((ring, index) => ({
    id: `osm-${element.type}-${element.id}-${index}`,
    holeNumber,
    featureType,
    geometry: { type: "Polygon", coordinates: [ring] },
    source: "openstreetmap",
  }));
}

function mergeFeatures(plan, fetched) {
  const existing = plan.sourceGeometry.features;
  const expectedHoles = Math.max(1, plan.sourceGeometry.holes.length);
  const counts = existing.reduce((result, feature) => {
    result.set(feature.featureType, (result.get(feature.featureType) ?? 0) + 1);
    return result;
  }, new Map());
  const accepted = fetched.filter((feature) => {
    const current = counts.get(feature.featureType) ?? 0;
    const required = expectedPerHole.has(feature.featureType) ? expectedHoles : 1;
    if (current >= required) return false;
    counts.set(feature.featureType, current + 1);
    return true;
  });
  return [...existing, ...accepted];
}

function mapFeatureType(tags) {
  if (tags.leisure === "golf_course") return "course_boundary";
  if (tags.natural === "water" || tags.water) return "water";
  if (tags.natural === "wood" || tags.landuse === "forest") return "trees";
  if (tags.golf === "water_hazard") return "water";
  if (["tee", "fairway", "green", "bunker", "rough"].includes(tags.golf)) return tags.golf;
  return null;
}

function overtureFeatureType(feature, type) {
  if (type === "water") return "water";
  const descriptor = [
    feature?.properties?.subtype,
    feature?.properties?.class,
    feature?.properties?.subclass,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(forest|wood|scrub|shrub)/.test(descriptor) ? "trees" : null;
}

function elementRings(element) {
  if (element?.type === "way") return normaliseRings([element.geometry]);
  if (element?.type !== "relation" || !Array.isArray(element.members)) return [];
  return normaliseRings(
    element.members
      .filter((member) => member.type === "way" && (member.role === "outer" || !member.role))
      .map((member) => member.geometry),
  );
}

function normaliseRings(geometries) {
  return geometries.flatMap((geometry) => {
    if (!Array.isArray(geometry) || geometry.length < 3) return [];
    const ring = geometry
      .map((point) => [Number(point?.lon), Number(point?.lat)])
      .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
    if (ring.length < 3) return [];
    const first = ring[0];
    const last = ring.at(-1);
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return ring.length >= 4 ? [ring] : [];
  });
}

function parseHoleNumber(value) {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(number) && number >= 1 && number <= 54 ? number : null;
}

function validateBounds(bounds) {
  if (
    !bounds ||
    ![bounds.minLatitude, bounds.maxLatitude, bounds.minLongitude, bounds.maxLongitude].every(
      Number.isFinite,
    ) ||
    bounds.minLatitude >= bounds.maxLatitude ||
    bounds.minLongitude >= bounds.maxLongitude
  ) {
    throw new Error("Course map bounds are invalid");
  }
  const area =
    (bounds.maxLatitude - bounds.minLatitude) * (bounds.maxLongitude - bounds.minLongitude);
  if (area > 0.02) throw new Error("Course map bounds exceed the Overpass safety limit");
}
