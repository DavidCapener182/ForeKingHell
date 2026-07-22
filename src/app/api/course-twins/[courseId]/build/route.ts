import { and, eq } from "drizzle-orm";

import { adminUsers } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest } from "@/lib/api-protection";
import { enqueueCourseTwinBuild, getLatestCourseTwinBuild } from "@/lib/course-twin-build-jobs";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const { courseId } = await context.params;
  const build = await getLatestCourseTwinBuild(courseId);
  if (!build) return Response.json({ message: "Course Twin build not found." }, { status: 404 });
  return Response.json(build, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-build",
    subject: userId,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;

  const { courseId } = await context.params;
  const body = await readOptionalBody(request);
  const build = await enqueueCourseTwinBuild({
    courseId,
    requestedByUserId: userId,
    force: body.force === true,
  });
  if (!build) {
    return Response.json(
      { message: "Course not found or does not have usable coordinates." },
      { status: 404 },
    );
  }
  return Response.json(build, { status: 202, headers: { "Cache-Control": "no-store" } });
}

async function requireApiAdmin() {
  const userId = await getOptionalCurrentUserId();
  if (!userId) return null;
  const [admin] = await getDb()
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.userId, userId), eq(adminUsers.status, "active")))
    .limit(1);
  return admin ? userId : null;
}

async function readOptionalBody(request: Request): Promise<{ force?: unknown }> {
  if (!request.headers.get("content-type")?.includes("application/json")) return {};
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}
