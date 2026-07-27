import { getCurrentUser } from "@/lib/current-user";
import { getCourseTwinBagProfiles, getCourseTwinManifest } from "@/lib/course-twin-data";
import { buildCourseTwinStrategy } from "@/lib/course-twin-strategy";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { courseId } = await params;
  const requestedHole = Number(new URL(request.url).searchParams.get("holeNumber") ?? "1");
  if (!Number.isInteger(requestedHole) || requestedHole < 1 || requestedHole > 18) {
    return Response.json({ error: "holeNumber must be an integer from 1 to 18" }, { status: 400 });
  }
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  if (!manifest) return Response.json({ error: "Course Twin not found" }, { status: 404 });
  if (!manifest.holes.some((hole) => hole.holeNumber === requestedHole)) {
    return Response.json({ error: "Hole not found" }, { status: 404 });
  }
  const bag = await getCourseTwinBagProfiles(user.id);
  if (bag.length === 0) {
    return Response.json(
      { error: "No measured bag profile is available for strategy modelling" },
      { status: 422 },
    );
  }
  const strategy = buildCourseTwinStrategy({
    manifest,
    holeNumber: requestedHole,
    bag,
  });
  return Response.json(strategy, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
