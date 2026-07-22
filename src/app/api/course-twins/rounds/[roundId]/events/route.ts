import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { isCourseTwinRoundId, parseCourseTwinRoundEventInput } from "@/lib/course-twin-round";
import { appendCourseTwinRoundEvent } from "@/lib/course-twin-round-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-round-event",
    subject: user.id,
    limit: 240,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const { roundId } = await params;
  if (!isCourseTwinRoundId(roundId)) {
    return Response.json({ error: "Course Twin round not found" }, { status: 404 });
  }
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  if (
    !body.value ||
    typeof body.value !== "object" ||
    Array.isArray(body.value) ||
    !Number.isInteger((body.value as { expectedVersion?: unknown }).expectedVersion) ||
    Number((body.value as { expectedVersion: number }).expectedVersion) < 1
  ) {
    return Response.json({ error: "Invalid expected round version" }, { status: 400 });
  }
  const value = body.value as { expectedVersion: number; event?: unknown };
  const event = parseCourseTwinRoundEventInput(value.event);
  if (!event) return Response.json({ error: "Invalid round event" }, { status: 400 });
  const result = await appendCourseTwinRoundEvent({
    roundId,
    userId: user.id,
    expectedVersion: value.expectedVersion,
    input: event,
  });
  if (result.status === "not_found") {
    return Response.json({ error: "Course Twin round not found" }, { status: 404 });
  }
  if (result.status === "conflict") {
    return Response.json(
      { error: "Round state changed", currentVersion: result.currentVersion },
      { status: 409 },
    );
  }
  if (result.status === "closed") {
    return Response.json({ error: "Course Twin round is closed" }, { status: 409 });
  }
  if (result.status === "invalid") {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json(result.round, {
    status: result.status === "created" ? 201 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
