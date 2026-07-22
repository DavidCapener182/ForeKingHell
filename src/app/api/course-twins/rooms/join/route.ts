import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { normalizeCourseTwinInviteCode } from "@/lib/course-twin-multiplayer";
import { joinCourseTwinRoom } from "@/lib/course-twin-room-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-room-join",
    subject: user.id,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 4_096);
  if (!body.ok) return body.response;
  const inviteCode =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? normalizeCourseTwinInviteCode((body.value as Record<string, unknown>).inviteCode)
      : null;
  if (!inviteCode) return Response.json({ error: "Invalid invite code" }, { status: 400 });
  const result = await joinCourseTwinRoom(inviteCode, user.id);
  if (result.status === "not_found") {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  if (result.status === "full") return Response.json({ error: "Room is full" }, { status: 409 });
  return Response.json(result.room, { headers: { "Cache-Control": "private, no-store" } });
}
