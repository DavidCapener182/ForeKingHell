import { NextRequest } from "next/server";

import { buildOverpassGolfHoleQuery, parseOverpassGolfHoles } from "@/lib/osm-course-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lat = numberParam(request, "lat");
  const lon = numberParam(request, "lon");

  if (lat === null || lon === null) {
    return Response.json({ message: "Latitude and longitude are required." }, { status: 400 });
  }

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "ForeKingHell golf analytics course importer",
    },
    body: new URLSearchParams({ data: buildOverpassGolfHoleQuery(lat, lon) }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return Response.json({ message: "OpenStreetMap hole geometry lookup failed." }, { status: 502 });
  }

  return Response.json({ holes: parseOverpassGolfHoles(await response.json()) });
}

function numberParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
