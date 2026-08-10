import { getCurrentUser } from "@/lib/current-user";
import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { courseTwinCanUseEsriDetail, courseTwinEsriImageryUrl } from "@/lib/course-twin-imagery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const { courseId } = await params;
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  const imagery = manifest?.terrain.imagery;
  if (!manifest || !imagery) {
    return Response.json({ error: "Course Twin imagery not found" }, { status: 404 });
  }
  if (!courseTwinCanUseEsriDetail(imagery)) {
    return Response.json({ error: "No compatible high-detail source" }, { status: 422 });
  }

  const imageryUrl = courseTwinEsriImageryUrl(imagery.geographicBounds);
  if (!imageryUrl) {
    return Response.json({ error: "Course Twin imagery bounds are invalid" }, { status: 422 });
  }

  const response = await fetch(imageryUrl, {
    cache: "no-store",
    headers: { "user-agent": "ForeKingHell Course Twin imagery/0.2" },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return Response.json(
      { error: "High-detail imagery is temporarily unavailable" },
      { status: 502 },
    );
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, max-age=604800, stale-while-revalidate=2592000",
      "Content-Type": contentType,
    },
  });
}
