import { readBoundedJsonBody } from "@/lib/api-protection";
import { isCourseTwinRoomId, parseCourseTwinRoomStateInput } from "@/lib/course-twin-multiplayer";
import { updateCourseTwinRoomState } from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await params;
  if (!isCourseTwinRoomId(roomId))
    return Response.json({ error: "Room not found" }, { status: 404 });
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  const input = parseCourseTwinRoomStateInput(body.value);
  if (!input) return Response.json({ error: "Invalid room state" }, { status: 400 });
  const room = await updateCourseTwinRoomState(roomId, user.id, input);
  if (!room) {
    return Response.json(
      { error: "Room version changed or host access is required" },
      { status: 409 },
    );
  }
  return Response.json(room, { headers: { "Cache-Control": "private, no-store" } });
}
