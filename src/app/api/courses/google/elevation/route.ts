import { getGoogleElevations } from "@/lib/google-course-enrichment";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { rateLimitRequest } from "@/lib/api-protection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getOptionalCurrentUserId();
  if (!userId) return Response.json({ message: "Authentication required." }, { status: 401 });
  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "google-course-elevation",
    subject: userId,
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });
  if (rateLimitRejection) return rateLimitRejection;

  const requestUrl = new URL(request.url);
  const points = parsePathParam(requestUrl.searchParams.get("path"));

  if (points.length === 0) {
    return Response.json({ elevations: [] });
  }

  const elevations = await getGoogleElevations(points);

  return Response.json({ elevations });
}

function parsePathParam(value: string | null) {
  return (
    value
      ?.split("|")
      .map((pair) => {
        const [latitude, longitude] = pair.split(",").map(Number);

        return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { latitude, longitude }
          : null;
      })
      .filter((point): point is { latitude: number; longitude: number } => Boolean(point)) ?? []
  );
}
