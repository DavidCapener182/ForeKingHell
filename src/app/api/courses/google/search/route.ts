import { searchGoogleCourses } from "@/lib/google-course-enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json({ results: [] });
  }

  const results = await searchGoogleCourses(query, { limit: 8 });

  return Response.json({ results });
}
