import { readBoundedJsonBody, rateLimitRequest } from "@/lib/api-protection";
import { isCourseTwinRoomId, parseCourseTwinRoomEvent } from "@/lib/course-twin-multiplayer";
import { appendCourseTwinRoomEvent, listCourseTwinRoomEvents } from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId))
    return Response.json({ error: "Room not found" }, { status: 404 });
  const rawSince = new URL(request.url).searchParams.get("since");
  const since = rawSince ? new Date(rawSince) : undefined;
  if (since && !Number.isFinite(since.getTime())) {
    return Response.json({ error: "Invalid event cursor" }, { status: 400 });
  }
  const events = await listCourseTwinRoomEvents(roomId, user.id, since);
  if (!events) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json({ events }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId))
    return Response.json({ error: "Room not found" }, { status: 404 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-room-events",
    subject: `${user.id}:${roomId}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  const input = parseCourseTwinRoomEvent(body.value);
  if (!input) return Response.json({ error: "Invalid room event" }, { status: 400 });
  const event = await appendCourseTwinRoomEvent({ roomId, userId: user.id, ...input });
  if (!event) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json(event, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
