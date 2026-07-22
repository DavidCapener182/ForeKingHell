import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { parseCourseTwinCreateRoundInput } from "@/lib/course-twin-round";
import { createCourseTwinRound, getActiveCourseTwinRound } from "@/lib/course-twin-round-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { courseId } = await params;
  const round = await getActiveCourseTwinRound(courseId, user.id);
  return Response.json(round, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-round-create",
    subject: user.id,
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const { courseId } = await params;
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  if (!manifest) return Response.json({ error: "Course Twin not found" }, { status: 404 });
  const body = await readBoundedJsonBody(request, 16_384);
  if (!body.ok) return body.response;
  const input = parseCourseTwinCreateRoundInput(body.value);
  if (!input) return Response.json({ error: "Invalid round settings" }, { status: 400 });
  if (!manifest.supportedModes.includes(input.mode)) {
    return Response.json({ error: "This Course Twin does not support that mode" }, { status: 409 });
  }
  const activeRound = await getActiveCourseTwinRound(courseId, user.id);
  if (activeRound) {
    return Response.json(
      { error: "Finish or abandon the active Course Twin round first", round: activeRound },
      { status: 409 },
    );
  }
  const round = await createCourseTwinRound({ courseId, userId: user.id, input });
  return Response.json(round, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}
