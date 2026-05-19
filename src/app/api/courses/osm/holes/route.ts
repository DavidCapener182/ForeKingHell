import { NextRequest } from "next/server";

import { getOptionalCurrentUserId } from "@/lib/current-user";
import { getOsmHoleGeometry } from "@/lib/osm-course-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getOptionalCurrentUserId())) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const lat = numberParam(request, "lat");
  const lon = numberParam(request, "lon");

  if (lat === null || lon === null) {
    return Response.json({ message: "Latitude and longitude are required." }, { status: 400 });
  }

  return Response.json({ holes: await getOsmHoleGeometry(lat, lon) });
}

function numberParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
