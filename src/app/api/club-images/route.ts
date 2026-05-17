import { isIP } from "node:net";

import { NextResponse } from "next/server";

import {
  brandLogoIconUrls,
  buildBrandLogoSearchQuery,
  buildClubProductImageSearchQuery,
  clubArtworkPath,
} from "@/lib/club-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4500;
const SEARCH_TIMEOUT_MS = 3500;

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
  urls: string[];
};

const searchCache = new Map<string, CachedSearchResult>();

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const clubType = requestUrl.searchParams.get("type");
  const brand = requestUrl.searchParams.get("brand");
  const model = requestUrl.searchParams.get("model");
  const fallback = safeFallbackPath(requestUrl.searchParams.get("fallback")) ?? clubArtworkPath(clubType);
  const hasBrand = Boolean(brand?.trim());

  if (hasBrand) {
    for (const logoIconUrl of brandLogoIconUrls(brand)) {
      const response = await imageResponseFromUrl(logoIconUrl, "brand-logo");

      if (response) {
        return response;
      }
    }

    const brandLogoQuery = buildBrandLogoSearchQuery(brand);

    if (brandLogoQuery) {
      const response = await imageResponseFromSearch(brandLogoQuery, "brand-logo");

      if (response) {
        return response;
      }
    }
  }

  const productQuery = buildClubProductImageSearchQuery({ type: clubType, brand, model });

  if (productQuery) {
    const response = await imageResponseFromSearch(productQuery, "product");

    if (response) {
      return response;
    }
  }

  return redirectToFallback(requestUrl, fallback);
}

async function imageResponseFromSearch(query: string, source: "product" | "brand-logo") {
  const urls = await searchGoogleImages(query);

  for (const url of urls) {
    const response = await imageResponseFromUrl(url, source);

    if (response) {
      return response;
    }
  }

  return null;
}

async function searchGoogleImages(query: string) {
  const cached = searchCache.get(query);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.urls;
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY ?? process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId =
    process.env.GOOGLE_SEARCH_ENGINE_ID ??
    process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID ??
    process.env.GOOGLE_CSE_ID;

  if (!apiKey || !searchEngineId) {
    searchCache.set(query, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, urls: [] });
    return [];
  }

  const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("cx", searchEngineId);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("searchType", "image");
  searchUrl.searchParams.set("safe", "active");
  searchUrl.searchParams.set("num", "6");
  searchUrl.searchParams.set("fields", "items(title,link,displayLink,mime,image/thumbnailLink,image/contextLink)");

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
    const urls = searchUrlsFromItems(payload.items ?? []);

    searchCache.set(query, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, urls });
    return urls;
  } catch {
    return [];
  }
}

function searchUrlsFromItems(items: GoogleImageSearchItem[]) {
  const urls: string[] = [];

  for (const item of items) {
    if (item.link) {
      urls.push(item.link);
    }

    if (item.image?.thumbnailLink) {
      urls.push(item.image.thumbnailLink);
    }
  }

  return [...new Set(urls)].slice(0, 10);
}

async function imageResponseFromUrl(candidate: string, source: string) {
  const image = await fetchImage(candidate);

  if (!image) {
    return null;
  }

  return new Response(image.body, {
    headers: {
      "Cache-Control": IMAGE_CACHE_CONTROL,
      "Content-Length": image.body.byteLength.toString(),
      "Content-Type": image.contentType,
      "X-Club-Image-Source": source,
    },
  });
}

async function fetchImage(candidate: string) {
  const initialUrl = safeRemoteImageUrl(candidate);

  if (!initialUrl) {
    return null;
  }

  let currentUrl: URL = initialUrl;

  for (let redirects = 0; redirects < 3; redirects += 1) {
    try {
      const response = await fetchWithTimeout(currentUrl, FETCH_TIMEOUT_MS, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
          "User-Agent":
            "Mozilla/5.0 (compatible; ForeKingHell club image resolver; +https://forekinghell.app)",
        },
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const redirectedUrl: URL | null = location ? safeRemoteImageUrl(location, currentUrl) : null;

        if (!redirectedUrl) {
          return null;
        }

        currentUrl = redirectedUrl;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

      if (!contentType.startsWith("image/")) {
        return null;
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);

      if (contentLength > MAX_IMAGE_BYTES) {
        return null;
      }

      const body = await response.arrayBuffer();

      if (body.byteLength > MAX_IMAGE_BYTES) {
        return null;
      }

      return {
        body,
        contentType,
      };
    } catch {
      return null;
    }
  }

  return null;
}

async function fetchWithTimeout(input: URL, timeoutMs: number, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function safeRemoteImageUrl(value: string, base?: URL) {
  try {
    const url = new URL(value, base);

    if (url.protocol !== "https:" || url.username || url.password || isBlockedHost(url.hostname)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    return isBlockedIpv4(normalized);
  }

  if (ipVersion === 6) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

function isBlockedIpv4(value: string) {
  const [first = 0, second = 0] = value.split(".").map((part) => Number(part));

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function safeFallbackPath(value: string | null) {
  if (!value?.startsWith("/assets/clubs/") || value.includes("..") || value.includes("//")) {
    return null;
  }

  return value;
}

function redirectToFallback(requestUrl: URL, fallback: string) {
  const response = NextResponse.redirect(new URL(fallback, requestUrl), 307);
  response.headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
  response.headers.set("X-Club-Image-Source", "generated-fallback");

  return response;
}
