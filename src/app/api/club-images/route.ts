import { NextResponse } from "next/server";

import { BRAND_NAME, BRAND_PUBLIC_URL } from "@/lib/brand";
import {
  brandLogoIconUrls,
  brandPreferredLogoImageUrls,
  buildBrandLogoSearchQuery,
  clubArtworkPath,
  rankBrandLogoSearchCandidates,
} from "@/lib/club-images";
import { searchGoogleImages } from "@/lib/google-image-search";
import {
  DEFAULT_REMOTE_IMAGE_CACHE_CONTROL,
  remoteImageResponseFromUrl,
} from "@/lib/remote-image-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_CACHE_CONTROL = DEFAULT_REMOTE_IMAGE_CACHE_CONTROL;
const CLUB_IMAGE_USER_AGENT = `Mozilla/5.0 (compatible; ${BRAND_NAME} club image resolver; +${BRAND_PUBLIC_URL})`;

type ImageSearchCandidates = Awaited<ReturnType<typeof searchGoogleImages>>;
type ImageSearchRanker = (candidates: ImageSearchCandidates) => ImageSearchCandidates;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const clubType = requestUrl.searchParams.get("type");
  const brand = requestUrl.searchParams.get("brand");
  const fallback =
    safeFallbackPath(requestUrl.searchParams.get("fallback")) ?? clubArtworkPath(clubType);

  try {
    const hasBrand = Boolean(brand?.trim());

    if (hasBrand) {
      for (const logoImageUrl of brandPreferredLogoImageUrls(brand)) {
        const response = await imageResponseFromUrl(logoImageUrl, "brand-logo");

        if (response) {
          return response;
        }
      }

      const brandLogoQuery = buildBrandLogoSearchQuery(brand);

      if (brandLogoQuery) {
        const response = await imageResponseFromSearch(brandLogoQuery, "brand-logo", (candidates) =>
          rankBrandLogoSearchCandidates(candidates, brand),
        );

        if (response) {
          return response;
        }
      }

      for (const logoIconUrl of brandLogoIconUrls(brand)) {
        const response = await imageResponseFromUrl(logoIconUrl, "brand-logo");

        if (response) {
          return response;
        }
      }
    }
  } catch {
    return redirectToFallback(requestUrl, fallback, brand);
  }

  return redirectToFallback(requestUrl, fallback, brand);
}

async function imageResponseFromSearch(
  query: string,
  source: "brand-logo",
  rankCandidates?: ImageSearchRanker,
) {
  const candidates = rankCandidates
    ? rankCandidates(await searchGoogleImages(query, { num: 10 }))
    : await searchGoogleImages(query, { num: 6 });

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

function redirectToFallback(requestUrl: URL, fallback: string, brand: string | null) {
  const brandLogoUrl = brandLogoFallbackUrl(brand);

  if (brandLogoUrl) {
    const response = NextResponse.redirect(brandLogoUrl, 307);
    response.headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
    response.headers.set("X-Club-Image-Source", "brand-logo-fallback");

    return response;
  }

  const response = NextResponse.redirect(new URL(fallback, requestUrl), 307);
  response.headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
  response.headers.set("X-Club-Image-Source", "generated-fallback");

  return response;
}

function brandLogoFallbackUrl(brand: string | null) {
  return brandPreferredLogoImageUrls(brand)[0] ?? brandLogoIconUrls(brand)[0] ?? null;
}
