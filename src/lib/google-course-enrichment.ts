import "server-only";

import { fetchWithTimeout } from "@/lib/remote-image-response";

const GOOGLE_TIMEOUT_MS = 4500;
const GOOGLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type GoogleCourseSearchResult = {
  placeId: string;
  name: string;
  address: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingsTotal: number | null;
  types: string[];
};

export type GoogleCourseDetails = GoogleCourseSearchResult & {
  website: string | null;
  googleMapsUrl: string | null;
  phoneNumber: string | null;
  openingHours: Record<string, unknown>;
  attributions: string[];
  photoReferences: string[];
};

export type ElevationPoint = {
  latitude: number;
  longitude: number;
  elevation: number;
  resolution: number | null;
};

type PlacesTextSearchResponse = {
  status?: string;
  results?: GooglePlaceResult[];
};

type PlacesDetailsResponse = {
  status?: string;
  result?: GooglePlaceResult;
};

type GooglePlaceResult = {
  formatted_address?: string;
  formatted_phone_number?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  name?: string;
  opening_hours?: Record<string, unknown>;
  photos?: Array<{
    height?: number;
    html_attributions?: string[];
    photo_reference?: string;
    width?: number;
  }>;
  place_id?: string;
  rating?: number;
  types?: string[];
  url?: string;
  user_ratings_total?: number;
  website?: string;
};

type ElevationResponse = {
  status?: string;
  results?: Array<{
    elevation?: number;
    location?: {
      lat?: number;
      lng?: number;
    };
    resolution?: number;
  }>;
};

type GoogleImageResponseOptions = {
  cacheControl?: string;
  source?: string;
  sourceHeaderName?: string;
};

export async function searchGoogleCourses(query: string, options: { limit?: number } = {}) {
  const apiKey = googleMapsApiKey();
  const normalizedQuery = query.trim();

  if (!apiKey || normalizedQuery.length < 2) {
    return [];
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", `${normalizedQuery} golf course`);
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetchWithTimeout(url, GOOGLE_TIMEOUT_MS, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as PlacesTextSearchResponse;

    if (payload.status !== "OK") {
      return [];
    }

    return (payload.results ?? [])
      .map(placeResultToSearchResult)
      .filter((result): result is GoogleCourseSearchResult => Boolean(result))
      .filter((result) => isLikelyGolfCourse(result))
      .slice(0, options.limit ?? 8);
  } catch {
    return [];
  }
}

export async function getGoogleCourseDetails(placeId: string) {
  const apiKey = googleMapsApiKey();
  const normalizedPlaceId = placeId.trim();

  if (!apiKey || !normalizedPlaceId) {
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", normalizedPlaceId);
  url.searchParams.set(
    "fields",
    [
      "formatted_address",
      "formatted_phone_number",
      "geometry",
      "name",
      "opening_hours",
      "photos",
      "place_id",
      "rating",
      "types",
      "url",
      "user_ratings_total",
      "website",
    ].join(","),
  );
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetchWithTimeout(url, GOOGLE_TIMEOUT_MS, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PlacesDetailsResponse;

    if (payload.status !== "OK" || !payload.result) {
      return null;
    }

    return placeResultToDetails(payload.result);
  } catch {
    return null;
  }
}

export async function googleStaticMapResponse({
  latitude,
  longitude,
  zoom = 15,
  width = 640,
  height = 360,
}: {
  latitude: number;
  longitude: number;
  zoom?: number;
  width?: number;
  height?: number;
}) {
  const apiKey = googleMapsApiKey();

  if (!apiKey || !isFiniteCoordinate(latitude, longitude)) {
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${latitude},${longitude}`);
  url.searchParams.set("zoom", String(Math.min(Math.max(zoom, 1), 20)));
  url.searchParams.set("size", `${clampImageDimension(width)}x${clampImageDimension(height)}`);
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("markers", `color:green|${latitude},${longitude}`);
  url.searchParams.set("key", apiKey);

  return googleImageResponse(url, {
    cacheControl: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    source: "google-static-map",
    sourceHeaderName: "X-Google-Course-Source",
  });
}

export async function googleStreetViewResponse({
  latitude,
  longitude,
  width = 640,
  height = 360,
}: {
  latitude: number;
  longitude: number;
  width?: number;
  height?: number;
}) {
  const apiKey = googleMapsApiKey();

  if (!apiKey || !isFiniteCoordinate(latitude, longitude)) {
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("size", `${clampImageDimension(width)}x${clampImageDimension(height)}`);
  url.searchParams.set("source", "outdoor");
  url.searchParams.set("fov", "80");
  url.searchParams.set("key", apiKey);

  return googleImageResponse(url, {
    cacheControl: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    source: "google-street-view",
    sourceHeaderName: "X-Google-Course-Source",
  });
}

export async function getGoogleElevations(points: Array<{ latitude: number; longitude: number }>) {
  const apiKey = googleMapsApiKey();
  const validPoints = points.filter((point) => isFiniteCoordinate(point.latitude, point.longitude)).slice(0, 512);

  if (!apiKey || validPoints.length === 0) {
    return [];
  }

  const url = new URL("https://maps.googleapis.com/maps/api/elevation/json");
  url.searchParams.set(
    "locations",
    validPoints.map((point) => `${point.latitude},${point.longitude}`).join("|"),
  );
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetchWithTimeout(url, GOOGLE_TIMEOUT_MS, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as ElevationResponse;

    if (payload.status !== "OK") {
      return [];
    }

    return (payload.results ?? [])
      .map((result) => {
        const latitude = result.location?.lat;
        const longitude = result.location?.lng;
        const elevation = result.elevation;

        if (typeof latitude !== "number" || typeof longitude !== "number" || typeof elevation !== "number") {
          return null;
        }

        return {
          elevation,
          latitude,
          longitude,
          resolution: typeof result.resolution === "number" ? result.resolution : null,
        };
      })
      .filter((point): point is ElevationPoint => Boolean(point));
  } catch {
    return [];
  }
}

export function isGoogleMapsConfigured() {
  return Boolean(googleMapsApiKey());
}

function placeResultToSearchResult(result: GooglePlaceResult): GoogleCourseSearchResult | null {
  if (!result.place_id || !result.name) {
    return null;
  }

  return {
    address: result.formatted_address ?? null,
    country: countryFromAddress(result.formatted_address),
    latitude: typeof result.geometry?.location?.lat === "number" ? result.geometry.location.lat : null,
    longitude: typeof result.geometry?.location?.lng === "number" ? result.geometry.location.lng : null,
    name: result.name,
    placeId: result.place_id,
    rating: typeof result.rating === "number" ? result.rating : null,
    types: result.types ?? [],
    userRatingsTotal: typeof result.user_ratings_total === "number" ? result.user_ratings_total : null,
  };
}

function placeResultToDetails(result: GooglePlaceResult): GoogleCourseDetails | null {
  const base = placeResultToSearchResult(result);

  if (!base) {
    return null;
  }

  return {
    ...base,
    attributions: uniqueStrings((result.photos ?? []).flatMap((photo) => photo.html_attributions ?? [])),
    googleMapsUrl: result.url ?? null,
    openingHours: result.opening_hours ?? {},
    phoneNumber: result.formatted_phone_number ?? null,
    photoReferences: photoReferencesFromPlace(result),
    website: normalizeWebsite(result.website),
  };
}

function photoReferencesFromPlace(result: GooglePlaceResult) {
  return (result.photos ?? [])
    .map((photo, index) => ({
      index,
      photoReference: photo.photo_reference,
      score: photoScore(photo.width ?? 0, photo.height ?? 0),
    }))
    .filter((photo): photo is { index: number; photoReference: string; score: number } => Boolean(photo.photoReference))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((photo) => photo.photoReference);
}

async function googleImageResponse(url: URL, options: GoogleImageResponseOptions) {
  try {
    const response = await fetchWithTimeout(url, GOOGLE_TIMEOUT_MS, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
      redirect: "manual",
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

    if (!contentType.startsWith("image/")) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);

    if (contentLength > GOOGLE_IMAGE_MAX_BYTES) {
      return null;
    }

    const body = await response.arrayBuffer();

    if (body.byteLength === 0 || body.byteLength > GOOGLE_IMAGE_MAX_BYTES) {
      return null;
    }

    const headers = new Headers({
      "Cache-Control": options.cacheControl ?? "public, max-age=3600, s-maxage=3600",
      "Content-Length": body.byteLength.toString(),
      "Content-Type": contentType,
    });

    if (options.source && options.sourceHeaderName) {
      headers.set(options.sourceHeaderName, options.source);
    }

    return new Response(body, { headers });
  } catch {
    return null;
  }
}

function isLikelyGolfCourse(result: GoogleCourseSearchResult) {
  const haystack = `${result.name} ${result.address ?? ""} ${result.types.join(" ")}`.toLowerCase();

  return haystack.includes("golf") || haystack.includes("country club") || haystack.includes("club");
}

function googleMapsApiKey() {
  return (process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY)?.trim().replace(/^['"]|['"]$/g, "");
}

function countryFromAddress(address: string | null | undefined) {
  const parts = address?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];

  return parts.at(-1) ?? null;
}

function normalizeWebsite(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function photoScore(width: number, height: number) {
  const longestSide = Math.max(width, height);
  const shortestSide = Math.min(width, height);
  const aspectRatio = shortestSide ? longestSide / shortestSide : 10;

  return Math.min(longestSide, 2000) + Math.min(shortestSide, 1200) - Math.max(aspectRatio - 2.2, 0) * 300;
}

function isFiniteCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function clampImageDimension(value: number) {
  return Math.min(Math.max(Math.round(value), 120), 640);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
