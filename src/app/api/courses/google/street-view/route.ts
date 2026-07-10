import { googleStreetViewResponse } from "@/lib/google-course-enrichment";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { rateLimitRequest } from "@/lib/api-protection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getOptionalCurrentUserId();
  if (!userId) return imageNotFoundResponse("authentication-required", 401);
  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "google-street-view",
    subject: userId,
    limit: 60,
    windowMs: 5 * 60 * 1000,
  });
  if (rateLimitRejection) return rateLimitRejection;

  const requestUrl = new URL(request.url);
  const latitude = numberParam(requestUrl, "lat");
  const longitude = numberParam(requestUrl, "lng");

  if (latitude === null || longitude === null) {
    return imageNotFoundResponse("missing-coordinates");
  }

  const response = await googleStreetViewResponse({
    height: numberParam(requestUrl, "height") ?? 360,
    latitude,
    longitude,
    width: numberParam(requestUrl, "width") ?? 640,
  });

  return response ?? imageNotFoundResponse("not-found");
}

function numberParam(url: URL, key: string) {
  const value = Number(url.searchParams.get(key));

  return Number.isFinite(value) ? value : null;
}

function imageNotFoundResponse(reason: string, status = 404) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900",
      "X-Google-Course-Source": reason,
    },
  });
}
