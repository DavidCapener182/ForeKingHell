import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { parseCourseTwinCreateRoomInput } from "@/lib/course-twin-multiplayer";
import { createCourseTwinRoom } from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-room-create",
    subject: user.id,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const { courseId } = await params;
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  if (!manifest) return Response.json({ error: "Course Twin not found" }, { status: 404 });
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  const input = parseCourseTwinCreateRoomInput(body.value);
  if (!input) return Response.json({ error: "Invalid room settings" }, { status: 400 });
  const room = await createCourseTwinRoom({ courseId, userId: user.id, input });
  return Response.json(room, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
