export type OsmCourseResult = {
  osmType: string;
  osmId: number;
  name: string;
  displayName: string;
  country: string | null;
  lat: number;
  lon: number;
};

export type OsmHoleGeometry = {
  holeNumber: number;
  name: string | null;
  par: number;
  yards: number;
  teeLat: number;
  teeLng: number;
  greenLat: number;
  greenLng: number;
};

const OSM_USER_AGENT = "LM World Tour golf analytics course importer";

type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  address?: {
    country?: string;
  };
};

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

export function buildNominatimCourseSearchUrl(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("q", `${query} golf course`);
  return url;
}

export async function searchOsmCourses(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(buildNominatimCourseSearchUrl(trimmedQuery), {
    headers: {
      accept: "application/json",
      "user-agent": OSM_USER_AGENT,
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    return [];
  }

  return parseNominatimCourseResults(await response.json());
}

export async function getOsmHoleGeometry(lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return [];
  }

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": OSM_USER_AGENT,
    },
    body: new URLSearchParams({ data: buildOverpassGolfHoleQuery(lat, lon) }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return [];
  }

  return parseOverpassGolfHoles(await response.json());
}

export function parseNominatimCourseResults(payload: unknown): OsmCourseResult[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item): OsmCourseResult | null => {
      const result = item as NominatimResult;
      const lat = parseNumber(result.lat);
      const lon = parseNumber(result.lon);

      if (!result.osm_type || typeof result.osm_id !== "number" || lat === null || lon === null) {
        return null;
      }

      const displayName = result.display_name ?? result.name ?? "OpenStreetMap course";

      return {
        osmType: result.osm_type,
        osmId: result.osm_id,
        name: result.name ?? displayName.split(",")[0]?.trim() ?? "OpenStreetMap course",
        displayName,
        country: result.address?.country ?? null,
        lat,
        lon,
      };
    })
    .filter((result): result is OsmCourseResult => result !== null);
}

export function buildOverpassGolfHoleQuery(lat: number, lon: number) {
  return `
[out:json][timeout:25];
(
  way(around:1800,${lat},${lon})["golf"="hole"];
  relation(around:1800,${lat},${lon})["golf"="hole"];
);
out tags geom;
`;
}

export function parseOverpassGolfHoles(payload: unknown): OsmHoleGeometry[] {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    return [];
  }

  return payload.elements
    .map((element): OsmHoleGeometry | null => parseOverpassElement(element as OverpassElement))
    .filter((hole): hole is OsmHoleGeometry => hole !== null)
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

function parseOverpassElement(element: OverpassElement): OsmHoleGeometry | null {
  const tags = element.tags ?? {};
  const geometry = element.geometry ?? [];

  if (geometry.length < 2) {
    return null;
  }

  const holeNumber = parseHoleNumber(tags.ref ?? tags.hole ?? tags.name);

  if (holeNumber === null) {
    return null;
  }

  const tee = geometry[0];
  const green = geometry[geometry.length - 1];
  const par = clampInteger(parseNumber(tags.par) ?? 4, 3, 6);
  const lengthMeters = parseLengthMeters(tags.length ?? tags.distance);
  const yards = Math.max(
    1,
    Math.round((lengthMeters ?? haversineMeters(tee.lat, tee.lon, green.lat, green.lon)) * 1.09361),
  );

  return {
    holeNumber,
    name: tags.name ?? null,
    par,
    yards,
    teeLat: tee.lat,
    teeLng: tee.lon,
    greenLat: green.lat,
    greenLng: green.lon,
  };
}

function parseHoleNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{1,2}/);
  const holeNumber = match ? Number(match[0]) : null;

  return holeNumber !== null && Number.isInteger(holeNumber) && holeNumber >= 1 && holeNumber <= 27
    ? holeNumber
    : null;
}

function parseLengthMeters(value: string | undefined) {
  if (!value) {
    return null;
  }

  const number = parseNumber(value);

  if (number === null) {
    return null;
  }

  return /\byd|yard/i.test(value) ? number * 0.9144 : number;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6_371_000;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
