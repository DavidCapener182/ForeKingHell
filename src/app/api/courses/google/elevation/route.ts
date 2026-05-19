import { getGoogleElevations } from "@/lib/google-course-enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
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

        return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
      })
      .filter((point): point is { latitude: number; longitude: number } => Boolean(point)) ?? []
  );
}
