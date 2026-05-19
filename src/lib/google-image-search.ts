import "server-only";

import { fetchWithTimeout } from "@/lib/remote-image-response";

const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 3500;

export type GoogleImageCandidate = {
  url: string;
  title?: string;
  displayLink?: string;
  contextLink?: string;
  mime?: string;
  source: "image" | "thumbnail";
};

type GoogleImageSearchItem = {
  title?: string;
  link?: string;
  displayLink?: string;
  mime?: string;
  image?: {
    thumbnailLink?: string;
    contextLink?: string;
  };
};

type GoogleImageSearchResponse = {
  items?: GoogleImageSearchItem[];
};

type CachedSearchResult = {
  expiresAt: number;
  candidates: GoogleImageCandidate[];
};

type GoogleImageSearchOptions = {
  num?: number;
};

const searchCache = new Map<string, CachedSearchResult>();

export async function searchGoogleImages(
  query: string,
  options: GoogleImageSearchOptions = {},
) {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const num = Math.min(Math.max(options.num ?? 6, 1), 10);
  const cacheKey = `${normalizedQuery}|${num}`;
  const cached = searchCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.candidates;
  }

  const credentials = googleSearchCredentials();

  if (!credentials) {
    const empty: GoogleImageCandidate[] = [];
    searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, candidates: empty });
    return empty;
  }

  const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
  searchUrl.searchParams.set("key", credentials.apiKey);
  searchUrl.searchParams.set("cx", credentials.searchEngineId);
  searchUrl.searchParams.set("q", normalizedQuery);
  searchUrl.searchParams.set("searchType", "image");
  searchUrl.searchParams.set("safe", "active");
  searchUrl.searchParams.set("num", String(num));
  searchUrl.searchParams.set("fields", "items(title,link,displayLink,mime,image(thumbnailLink,contextLink))");

  try {
    const response = await fetchWithTimeout(searchUrl, SEARCH_TIMEOUT_MS, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as GoogleImageSearchResponse;
    const candidates = imageCandidatesFromItems(payload.items ?? []);

    searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, candidates });
    return candidates;
  } catch {
    return [];
  }
}

export function isGoogleImageSearchConfigured() {
  return Boolean(googleSearchCredentials());
}

function googleSearchCredentials() {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY ?? process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId =
    process.env.GOOGLE_SEARCH_ENGINE_ID ??
    process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID ??
    process.env.GOOGLE_CSE_ID;

  if (!apiKey || !searchEngineId) {
    return null;
  }

  return { apiKey, searchEngineId };
}

function imageCandidatesFromItems(items: GoogleImageSearchItem[]) {
  const candidates: GoogleImageCandidate[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    addCandidate(candidates, seen, item.link, item, "image");
    addCandidate(candidates, seen, item.image?.thumbnailLink, item, "thumbnail");
  }

  return candidates;
}

function addCandidate(
  candidates: GoogleImageCandidate[],
  seen: Set<string>,
  url: string | null | undefined,
  item: GoogleImageSearchItem,
  source: GoogleImageCandidate["source"],
) {
  if (!url || seen.has(url)) {
    return;
  }

  seen.add(url);
  candidates.push({
    url,
    source,
    title: item.title,
    displayLink: item.displayLink,
    contextLink: item.image?.contextLink,
    mime: item.mime,
  });
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
