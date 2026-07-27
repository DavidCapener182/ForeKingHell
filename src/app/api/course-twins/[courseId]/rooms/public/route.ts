import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { listPublicCourseTwinRooms } from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { courseId } = await params;
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  if (!manifest) return Response.json({ error: "Course Twin not found" }, { status: 404 });
  const lobbies = await listPublicCourseTwinRooms(courseId, user.id);
  return Response.json(lobbies, { headers: { "Cache-Control": "private, no-store" } });
}
