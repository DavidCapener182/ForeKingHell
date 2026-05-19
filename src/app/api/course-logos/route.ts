import {
  buildCourseLogoSearchQueries,
  rankCourseLogoSearchCandidates,
} from "@/lib/course-images";
import { searchGoogleImages } from "@/lib/google-image-search";
import {
  findGooglePlaceMedia,
  googlePlacePhotoResponseFromReference,
} from "@/lib/google-places";
import {
  DEFAULT_REMOTE_IMAGE_CACHE_CONTROL,
  remoteImageResponseFromUrl,
} from "@/lib/remote-image-response";
import { findWebsiteIconUrls, findWebsiteImageUrls } from "@/lib/website-icons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COURSE_LOGO_CACHE_CONTROL = DEFAULT_REMOTE_IMAGE_CACHE_CONTROL;
const COURSE_PLACE_PHOTO_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
const COURSE_LOGO_MISS_CACHE_CONTROL = "public, max-age=300, s-maxage=900";
const COURSE_LOGO_USER_AGENT =
  "Mozilla/5.0 (compatible; ForeKingHell course logo resolver; +https://forekinghell.app)";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const name = requestUrl.searchParams.get("name");
  const country = requestUrl.searchParams.get("country");
  const queries = buildCourseLogoSearchQueries({ name, country }).slice(0, 2);

  for (const query of queries) {
    const rankedCandidates = rankCourseLogoSearchCandidates(
      await searchGoogleImages(query, { num: 8 }),
      { name, country },
    );

    for (const candidate of rankedCandidates.slice(0, 8)) {
      const response = await remoteImageResponseFromUrl(candidate.url, {
        cacheControl: COURSE_LOGO_CACHE_CONTROL,
        source: candidate.source === "thumbnail" ? "google-image-thumbnail" : "google-image-search",
        sourceHeaderName: "X-Course-Logo-Source",
        userAgent: COURSE_LOGO_USER_AGENT,
      });

      if (response) {
        return response;
      }
    }
  }

  const placeMedia = await findGooglePlaceMedia({ name, country });
  const websiteImageUrls = placeMedia.website
    ? await findWebsiteImageUrls(placeMedia.website, { keywords: [name, country, "golf course"] })
    : [];

  for (const imageUrl of websiteImageUrls.slice(0, 6)) {
    const response = await remoteImageResponseFromUrl(imageUrl, {
      cacheControl: COURSE_LOGO_CACHE_CONTROL,
      source: "google-places-website-image",
      sourceHeaderName: "X-Course-Logo-Source",
      userAgent: COURSE_LOGO_USER_AGENT,
    });

    if (response) {
      return response;
    }
  }

  const websiteIconUrls = placeMedia.website ? await findWebsiteIconUrls(placeMedia.website) : [];

  for (const iconUrl of websiteIconUrls) {
    const response = await remoteImageResponseFromUrl(iconUrl, {
      cacheControl: COURSE_LOGO_CACHE_CONTROL,
      minWidth: 96,
      source: "google-places-website-icon",
      sourceHeaderName: "X-Course-Logo-Source",
      userAgent: COURSE_LOGO_USER_AGENT,
    });

    if (response) {
      return response;
    }
  }

  for (const photoReference of placeMedia.photoReferences.slice(0, 4)) {
    const response = await googlePlacePhotoResponseFromReference(photoReference, {
      cacheControl: COURSE_PLACE_PHOTO_CACHE_CONTROL,
      source: "google-places-course-photo",
      sourceHeaderName: "X-Course-Logo-Source",
      userAgent: COURSE_LOGO_USER_AGENT,
    });

    if (response) {
      return response;
    }
  }

  const fallbackIconUrls = placeMedia.website
    ? await findWebsiteIconUrls(placeMedia.website, {
        includeGoogleFavicon: true,
        includeLegacyFavicon: true,
      })
    : [];

  for (const iconUrl of fallbackIconUrls.filter((url) => !websiteIconUrls.includes(url))) {
    const response = await remoteImageResponseFromUrl(iconUrl, {
      cacheControl: COURSE_LOGO_CACHE_CONTROL,
      minWidth: 96,
      source: "google-places-website-favicon",
      sourceHeaderName: "X-Course-Logo-Source",
      userAgent: COURSE_LOGO_USER_AGENT,
    });

    if (response) {
      return response;
    }
  }

  return logoNotFoundResponse();
}

function logoNotFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": COURSE_LOGO_MISS_CACHE_CONTROL,
      "X-Course-Logo-Source": "not-found",
    },
  });
}
