import { NextResponse } from "next/server";

import {
  brandLogoIconUrls,
  buildBrandLogoSearchQuery,
  buildClubProductImageSearchQuery,
  clubArtworkPath,
} from "@/lib/club-images";
import { searchGoogleImages } from "@/lib/google-image-search";
import {
  DEFAULT_REMOTE_IMAGE_CACHE_CONTROL,
  remoteImageResponseFromUrl,
} from "@/lib/remote-image-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_CACHE_CONTROL = DEFAULT_REMOTE_IMAGE_CACHE_CONTROL;
const CLUB_IMAGE_USER_AGENT =
  "Mozilla/5.0 (compatible; ForeKingHell club image resolver; +https://forekinghell.app)";

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
  const candidates = await searchGoogleImages(query, { num: 6 });

  for (const candidate of candidates) {
    const response = await imageResponseFromUrl(candidate.url, source);

    if (response) {
      return response;
    }
  }

  return null;
}

async function imageResponseFromUrl(candidate: string, source: string) {
  return remoteImageResponseFromUrl(candidate, {
    cacheControl: IMAGE_CACHE_CONTROL,
    source,
    sourceHeaderName: "X-Club-Image-Source",
    userAgent: CLUB_IMAGE_USER_AGENT,
  });
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
