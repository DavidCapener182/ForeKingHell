const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

export const UK_FIRST_WAVE_REGIONS = [
  { id: "north-west", country: "England", bounds: [52.75, -3.55, 54.65, -1.35] },
  { id: "midlands", country: "England", bounds: [51.7, -3.2, 53.2, -0.45] },
  { id: "south-east", country: "England", bounds: [50.65, -1.1, 52.1, 1.65] },
  { id: "south-west", country: "England", bounds: [50.1, -5.8, 51.7, -1.0] },
  { id: "north-wales", country: "Wales", bounds: [52.2, -5.0, 53.5, -2.55] },
  { id: "south-wales", country: "Wales", bounds: [51.25, -5.55, 52.25, -2.55] },
  { id: "west-scotland", country: "Scotland", bounds: [54.9, -5.25, 57.2, -3.6] },
  { id: "east-scotland", country: "Scotland", bounds: [54.9, -3.6, 57.2, -2.0] },
];

export async function buildUkFirstWaveCatalog({
  limit = 20,
  regions = UK_FIRST_WAVE_REGIONS,
  endpoint = DEFAULT_OVERPASS_URL,
  fetchImpl = fetch,
} = {}) {
  const boundedLimit = Math.max(1, Math.min(50, Math.round(limit)));
  const merged = new Map();
  const warnings = [];
  for (const region of regions) {
    let candidates;
    try {
      candidates = await fetchRegionalCourseCandidates(region, { endpoint, fetchImpl });
    } catch (error) {
      warnings.push(
        `${region.id}: ${error instanceof Error ? error.message : "catalogue query failed"}`,
      );
      continue;
    }
    for (const candidate of candidates) {
      const existing = merged.get(candidate.externalId);
      if (!existing || candidate.readinessScore > existing.readinessScore) {
        merged.set(candidate.externalId, candidate);
      }
    }
  }
  const candidates = [...merged.values()]
    .filter((candidate) => candidate.mappedHoles >= 9)
    .sort(
      (left, right) =>
        right.readinessScore - left.readinessScore || left.name.localeCompare(right.name),
    )
    .slice(0, boundedLimit);
  return {
    schemaVersion: 1,
    source: "openstreetmap",
    licence: "ODbL 1.0",
    requested: boundedLimit,
    selected: candidates.length,
    warnings,
    candidates,
  };
}

export async function fetchRegionalCourseCandidates(
  region,
  { endpoint = DEFAULT_OVERPASS_URL, fetchImpl = fetch } = {},
) {
  validateRegion(region);
  const bbox = region.bounds.join(",");
  const query = `[out:json][timeout:90];
(
  nwr["leisure"="golf_course"](${bbox});
  way["golf"="hole"](${bbox});
  nwr["golf"~"^(green|fairway|bunker|tee|water_hazard)$"](${bbox});
);
out center tags;`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": "ForeKingHell Course Twin Catalogue/0.2",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Overpass returned ${response.status} for ${region.id}`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
    throw new Error(`Overpass response exceeds the catalogue limit for ${region.id}`);
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Overpass response exceeds the catalogue limit for ${region.id}`);
  }
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error(`Overpass returned invalid JSON for ${region.id}`);
  }
  return regionalCandidatesFromElements(document.elements, region);
}

export function regionalCandidatesFromElements(elements, region) {
  validateRegion(region);
  if (!Array.isArray(elements)) return [];
  const courses = elements.flatMap((element) => {
    if (element?.tags?.leisure !== "golf_course" || !String(element.tags?.name ?? "").trim()) {
      return [];
    }
    const position = elementPosition(element);
    if (!position) return [];
    return [
      {
        externalId: `osm-${element.type}-${element.id}`,
        osmType: element.type,
        osmId: String(element.id),
        name: String(element.tags.name).trim(),
        country: region.country,
        latitude: position.latitude,
        longitude: position.longitude,
        website: safeHttpUrl(element.tags.website ?? element.tags["contact:website"]),
        mappedHoles: 0,
        mappedGreens: 0,
        mappedFairways: 0,
        mappedBunkers: 0,
        mappedTees: 0,
        mappedWater: 0,
        readinessScore: 0,
        sourceRegion: region.id,
      },
    ];
  });
  const mappedElements = elements.flatMap((element) => {
    const featureType = element?.tags?.golf;
    if (!featureType || featureType === "course") return [];
    const position = elementPosition(element);
    return position ? [{ ...position, featureType, ref: parseHoleRef(element.tags?.ref) }] : [];
  });
  for (const feature of mappedElements) {
    const nearest = nearestCourse(courses, feature);
    if (!nearest || nearest.distanceM > 2_500) continue;
    const course = nearest.course;
    if (feature.featureType === "hole" && feature.ref !== null) {
      course._holeRefs ??= new Set();
      course._holeRefs.add(feature.ref);
      course.mappedHoles = course._holeRefs.size;
    } else if (feature.featureType === "green") course.mappedGreens += 1;
    else if (feature.featureType === "fairway") course.mappedFairways += 1;
    else if (feature.featureType === "bunker") course.mappedBunkers += 1;
    else if (feature.featureType === "tee") course.mappedTees += 1;
    else if (feature.featureType === "water_hazard") course.mappedWater += 1;
  }
  return courses.map((course) => {
    const candidate = { ...course, readinessScore: readinessScore(course) };
    delete candidate._holeRefs;
    return candidate;
  });
}

function readinessScore(course) {
  return Math.min(
    100,
    Math.round(
      (Math.min(course.mappedHoles, 18) / 18) * 55 +
        (Math.min(course.mappedGreens, 18) / 18) * 15 +
        (Math.min(course.mappedFairways, 18) / 18) * 15 +
        (Math.min(course.mappedTees, 18) / 18) * 10 +
        (course.mappedBunkers > 0 ? 3 : 0) +
        (course.mappedWater > 0 ? 2 : 0),
    ),
  );
}

function nearestCourse(courses, point) {
  let nearest = null;
  for (const course of courses) {
    const distanceM = haversineMetres(course, point);
    if (!nearest || distanceM < nearest.distanceM) nearest = { course, distanceM };
  }
  return nearest;
}

function elementPosition(element) {
  const latitude = Number(element?.lat ?? element?.center?.lat);
  const longitude = Number(element?.lon ?? element?.center?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function parseHoleRef(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 54 ? parsed : null;
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function haversineMetres(left, right) {
  const earthRadiusM = 6_371_000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function validateRegion(region) {
  if (
    !region ||
    typeof region.id !== "string" ||
    typeof region.country !== "string" ||
    !Array.isArray(region.bounds) ||
    region.bounds.length !== 4 ||
    !region.bounds.every(Number.isFinite) ||
    region.bounds[0] >= region.bounds[2] ||
    region.bounds[1] >= region.bounds[3]
  ) {
    throw new Error("Course catalogue region is invalid");
  }
}
