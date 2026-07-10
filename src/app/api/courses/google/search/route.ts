import { searchGoogleCourses } from "@/lib/google-course-enrichment";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { rateLimitRequest } from "@/lib/api-protection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getOptionalCurrentUserId();
  if (!userId) return Response.json({ message: "Authentication required." }, { status: 401 });

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "google-course-search",
    subject: userId,
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });
  if (rateLimitRejection) return rateLimitRejection;

  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("query")?.trim().slice(0, 160) ?? "";

  if (query.length < 2) {
    return Response.json({ results: [] });
  }

  const results = await searchGoogleCourses(query, { limit: 8 });

  return Response.json({ results });
}
