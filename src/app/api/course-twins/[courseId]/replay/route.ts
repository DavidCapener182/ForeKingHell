import { getCurrentUser } from "@/lib/current-user";
import { getCourseTwinManifest, getCourseTwinReplay } from "@/lib/course-twin-data";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { courseId } = await params;
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  if (!manifest) return Response.json({ error: "Course Twin not found" }, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const replay = await getCourseTwinReplay({
    userId: user.id,
    courseId,
    sessionId,
    manifest,
  });
  if (!replay) return Response.json({ error: "No eligible replay found" }, { status: 404 });

  return Response.json(replay, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
