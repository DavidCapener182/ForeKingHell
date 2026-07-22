import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import {
  isCourseTwinRoomId,
  parseCourseTwinSharedRoundEventInput,
} from "@/lib/course-twin-multiplayer";
import {
  appendCourseTwinSharedRoundEvent,
  listCourseTwinSharedRoundEvents,
} from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId)) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  const events = await listCourseTwinSharedRoundEvents(roomId, user.id);
  if (!events) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json({ events }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await context.params;
  if (!isCourseTwinRoomId(roomId)) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-shared-round-events",
    subject: `${user.id}:${roomId}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  const input = parseCourseTwinSharedRoundEventInput(body.value);
  if (!input) return Response.json({ error: "Invalid shared round event" }, { status: 400 });
  const result = await appendCourseTwinSharedRoundEvent({ roomId, userId: user.id, input });
  if (result.status === "not_found") {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  if (result.status === "forbidden") {
    return Response.json({ error: "Shared round mutation is not permitted" }, { status: 403 });
  }
  if (result.status === "conflict") {
    return Response.json(
      { error: "Shared round version changed", currentVersion: result.currentVersion },
      { status: 409 },
    );
  }
  if (result.status === "closed") {
    return Response.json({ error: "Shared round is locked" }, { status: 409 });
  }
  if (result.status === "invalid") {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json(result, {
    status: result.status === "created" ? 201 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
