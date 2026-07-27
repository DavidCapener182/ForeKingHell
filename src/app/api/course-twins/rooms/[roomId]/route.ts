import { readBoundedJsonBody } from "@/lib/api-protection";
import { isCourseTwinRoomId, parseCourseTwinPresenceInput } from "@/lib/course-twin-multiplayer";
import {
  getCourseTwinRoom,
  leaveCourseTwinRoom,
  updateCourseTwinPresence,
} from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId))
    return Response.json({ error: "Room not found" }, { status: 404 });
  const room = await getCourseTwinRoom(roomId, user.id);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json(room, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId))
    return Response.json({ error: "Room not found" }, { status: 404 });
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  const input = parseCourseTwinPresenceInput(body.value);
  if (!input) return Response.json({ error: "Invalid presence update" }, { status: 400 });
  const room = await updateCourseTwinPresence(roomId, user.id, input);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json(room, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId))
    return Response.json({ error: "Room not found" }, { status: 404 });
  const left = await leaveCourseTwinRoom(roomId, user.id);
  if (!left) return Response.json({ error: "Room not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
