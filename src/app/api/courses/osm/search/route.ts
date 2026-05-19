import { NextRequest } from "next/server";

import { getOptionalCurrentUserId } from "@/lib/current-user";
import { searchOsmCourses } from "@/lib/osm-course-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getOptionalCurrentUserId())) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return Response.json({ results: [] });
  }

  return Response.json({ results: await searchOsmCourses(query) });
}
