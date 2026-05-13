import { NextRequest } from "next/server";

import { getOptionalCurrentUserId } from "@/lib/current-user";
import { buildNominatimCourseSearchUrl, parseNominatimCourseResults } from "@/lib/osm-course-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getOptionalCurrentUserId())) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return Response.json({ results: [] });
  }

  const response = await fetch(buildNominatimCourseSearchUrl(query), {
    headers: {
      "accept": "application/json",
      "user-agent": "ForeKingHell golf analytics course importer",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    return Response.json({ message: "OpenStreetMap course search failed." }, { status: 502 });
  }

  return Response.json({ results: parseNominatimCourseResults(await response.json()) });
}
