import { googleStreetViewResponse } from "@/lib/google-course-enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
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

function imageNotFoundResponse(reason: string) {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900",
      "X-Google-Course-Source": reason,
    },
  });
}
