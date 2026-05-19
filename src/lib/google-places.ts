import "server-only";

import {
  fetchWithTimeout,
  remoteImageResponseFromUrl,
  safeRemoteResourceUrl,
} from "@/lib/remote-image-response";

const PLACES_TIMEOUT_MS = 3500;
const PLACES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PLACES_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_PLACES_PHOTO_MAX_WIDTH = 800;

type CoursePlaceInput = {
  name: string | null | undefined;
  country?: string | null | undefined;
};

type CoursePlaceMedia = {
  website: string | null;
  photoReferences: string[];
};

type GooglePlacePhotoResponseOptions = {
  cacheControl?: string;
  maxBytes?: number;
  maxWidth?: number;
  source?: string;
  sourceHeaderName?: string;
  timeoutMs?: number;
  userAgent?: string;
};

type PlacesTextSearchResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    name?: string;
    place_id?: string;
    types?: string[];
  }>;
};

type PlacesDetailsResponse = {
  status?: string;
  result?: {
    formatted_address?: string;
    name?: string;
    photos?: Array<{
      height?: number;
      html_attributions?: string[];
      photo_reference?: string;
      width?: number;
    }>;
    website?: string;
  };
};

type PlacePhoto = NonNullable<NonNullable<PlacesDetailsResponse["result"]>["photos"]>[number];

type CachedWebsite = {
  expiresAt: number;
  website: string | null;
};

const websiteCache = new Map<string, CachedWebsite>();

export async function findGooglePlaceOfficialWebsite(input: CoursePlaceInput) {
  const name = normalizePart(input.name);

  if (!name) {
    return null;
  }

  const cacheKey = `${name}|${normalizePart(input.country) ?? ""}`;
  const cached = websiteCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.website;
  }

  const media = await findGooglePlaceMedia(input);
  websiteCache.set(cacheKey, {
    expiresAt: Date.now() + PLACES_CACHE_TTL_MS,
    website: media.website,
  });

  return media.website;
}

export async function findGooglePlaceMedia(input: CoursePlaceInput): Promise<CoursePlaceMedia> {
  const name = normalizePart(input.name);

  if (!name) {
    return emptyPlaceMedia();
  }

  // Google's Places Photo docs prohibit caching photo_reference values, so full
  // media lookups always fetch fresh details.
  return findGooglePlaceMediaUncached(input);
}

export async function googlePlacePhotoResponseFromReference(
  photoReference: string,
  options: GooglePlacePhotoResponseOptions = {},
) {
  const apiKey = googlePlacesApiKey();
  const reference = photoReference.trim();

  if (!apiKey || !reference) {
    return null;
  }

  const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
  photoUrl.searchParams.set("maxwidth", String(options.maxWidth ?? DEFAULT_PLACES_PHOTO_MAX_WIDTH));
  photoUrl.searchParams.set("photo_reference", reference);
  photoUrl.searchParams.set("key", apiKey);

  try {
    const response = await fetchWithTimeout(photoUrl, options.timeoutMs ?? PLACES_TIMEOUT_MS, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
        ...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
      },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (!location) {
        return null;
      }

      return remoteImageResponseFromUrl(location, {
        cacheControl: options.cacheControl,
        maxBytes: options.maxBytes,
        source: options.source,
        sourceHeaderName: options.sourceHeaderName,
        timeoutMs: options.timeoutMs,
        userAgent: options.userAgent,
      });
    }

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

    if (!contentType.startsWith("image/")) {
      return null;
    }

    const maxBytes = options.maxBytes ?? PLACES_PHOTO_MAX_BYTES;
    const contentLength = Number(response.headers.get("content-length") ?? 0);

    if (contentLength > maxBytes) {
      return null;
    }

    const body = await response.arrayBuffer();

    if (body.byteLength === 0 || body.byteLength > maxBytes) {
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

export function isGooglePlacesConfigured() {
  return Boolean(googlePlacesApiKey());
}

async function findGooglePlaceMediaUncached(input: CoursePlaceInput): Promise<CoursePlaceMedia> {
  const apiKey = googlePlacesApiKey();
  const name = normalizePart(input.name);

  if (!apiKey || !name) {
    return emptyPlaceMedia();
  }

  try {
    for (const query of placeSearchQueries(input)) {
      const textSearchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      textSearchUrl.searchParams.set("query", query);
      textSearchUrl.searchParams.set("key", apiKey);

      const searchResponse = await fetchWithTimeout(textSearchUrl, PLACES_TIMEOUT_MS, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!searchResponse.ok) {
        continue;
      }

      const searchPayload = (await searchResponse.json()) as PlacesTextSearchResponse;

      if (searchPayload.status !== "OK") {
        continue;
      }

      const placeId = bestPlaceId(searchPayload.results ?? [], input);

      if (!placeId) {
        continue;
      }

      const media = await placeDetailsMedia(placeId, apiKey);

      if (media.website || media.photoReferences.length > 0) {
        return media;
      }
    }

    return emptyPlaceMedia();
  } catch {
    return emptyPlaceMedia();
  }
}

async function placeDetailsMedia(placeId: string, apiKey: string): Promise<CoursePlaceMedia> {
  const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailsUrl.searchParams.set("place_id", placeId);
  detailsUrl.searchParams.set("fields", "name,formatted_address,website,photos");
  detailsUrl.searchParams.set("key", apiKey);

  const detailsResponse = await fetchWithTimeout(detailsUrl, PLACES_TIMEOUT_MS, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!detailsResponse.ok) {
    return emptyPlaceMedia();
  }

  const detailsPayload = (await detailsResponse.json()) as PlacesDetailsResponse;

  if (detailsPayload.status !== "OK" || !detailsPayload.result) {
    return emptyPlaceMedia();
  }

  const websiteUrl = detailsPayload.result.website
    ? safeRemoteResourceUrl(detailsPayload.result.website, undefined, { allowHttp: true })
    : null;

  if (websiteUrl) {
    websiteUrl.protocol = "https:";
  }

  return {
    website: websiteUrl?.toString() ?? null,
    photoReferences: photoReferencesFromPlaceDetails(detailsPayload),
  };
}

function placeSearchQueries(input: CoursePlaceInput) {
  const name = normalizePart(input.name);
  const country = normalizePart(input.country);

  if (!name) {
    return [];
  }

  const normalizedName = name.replace(/\s*[-–—]\s*/g, " ");
  const splitName = name
    .split(/\s*[-–—]\s*/)
    .map(normalizePart)
    .filter(Boolean);
  const [facilityName, courseName] = splitName;
  const courseFacilityName = facilityName && courseName ? `${courseName} ${facilityName}` : null;

  return uniqueStrings(
    [
      [normalizedName, country, "golf course"],
      [courseFacilityName, country, "golf course"],
      [name, country, "golf course"],
      [facilityName, country, "golf course"],
    ]
      .filter((parts) => parts[0])
      .map((parts) => parts.filter(Boolean).join(" ")),
  );
}

function photoReferencesFromPlaceDetails(detailsPayload: PlacesDetailsResponse) {
  return (detailsPayload.result?.photos ?? [])
    .filter((photo) => (photo.html_attributions ?? []).length === 0)
    .map((photo, index) => ({
      index,
      photoReference: photo.photo_reference,
      score: photoScore(photo),
    }))
    .filter((photo): photo is { index: number; photoReference: string; score: number } =>
      Boolean(photo.photoReference),
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((photo) => photo.photoReference);
}

function photoScore(photo: PlacePhoto) {
  const width = photo.width ?? 0;
  const height = photo.height ?? 0;
  const longestSide = Math.max(width, height);
  const shortestSide = Math.min(width, height);
  const aspectRatio = shortestSide ? longestSide / shortestSide : 10;

  return (
    Math.min(longestSide, 2000) +
    Math.min(shortestSide, 1200) -
    Math.max(aspectRatio - 2.2, 0) * 300
  );
}

function emptyPlaceMedia(): CoursePlaceMedia {
  return {
    photoReferences: [],
    website: null,
  };
}

function bestPlaceId(
  results: NonNullable<PlacesTextSearchResponse["results"]>,
  input: CoursePlaceInput,
) {
  const firstResult = results.find((result) => result.place_id);

  if (firstResult && scorePlaceResult(firstResult, input) >= 4) {
    return firstResult.place_id ?? null;
  }

  const ranked = results
    .filter((result) => result.place_id)
    .map((result, index) => ({
      placeId: result.place_id,
      index,
      score: scorePlaceResult(result, input),
    }))
    .filter((entry) => entry.score >= 4)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return ranked[0]?.placeId ?? null;
}

function scorePlaceResult(
  result: NonNullable<PlacesTextSearchResponse["results"]>[number],
  input: CoursePlaceInput,
) {
  const name = normalizeForMatching(input.name);
  const country = normalizeForMatching(input.country);
  const resultName = normalizeForMatching(result.name);
  const address = normalizeForMatching(result.formatted_address);
  const haystack = [resultName, address, result.types?.join(" ")].filter(Boolean).join(" ");
  let score = 0;

  if (resultName === name) {
    score += 12;
  } else if (name && resultName.includes(name)) {
    score += 8;
  }

  for (const token of significantTokens(name)) {
    if (haystack.includes(token)) {
      score += 2;
    }
  }

  if (country && address.includes(country)) {
    score += 2;
  }

  if (haystack.includes("golf")) {
    score += 4;
  }

  return score;
}

function googlePlacesApiKey() {
  return (process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY)
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
}

function significantTokens(name: string) {
  return name
    .split(" ")
    .filter(
      (token) => token.length > 2 && !["and", "club", "course", "golf", "the"].includes(token),
    );
}

function normalizePart(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ");

  return normalized || null;
}

function normalizeForMatching(value: string | null | undefined) {
  return (
    value
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
