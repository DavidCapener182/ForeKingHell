import { and, desc, eq } from "drizzle-orm";

import { adminUsers, courseTwinCorrections, courseTwins } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest } from "@/lib/api-protection";
import { validateCourseTwinCorrectionBody } from "@/lib/course-twin-corrections";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const { courseId } = await context.params;
  const rows = await getDb()
    .select({
      id: courseTwinCorrections.id,
      correctionType: courseTwinCorrections.correctionType,
      targetReference: courseTwinCorrections.targetReference,
      reason: courseTwinCorrections.reason,
      correctionJson: courseTwinCorrections.correctionJson,
      status: courseTwinCorrections.status,
      createdAt: courseTwinCorrections.createdAt,
      updatedAt: courseTwinCorrections.updatedAt,
    })
    .from(courseTwinCorrections)
    .innerJoin(courseTwins, eq(courseTwinCorrections.courseTwinId, courseTwins.id))
    .where(eq(courseTwins.courseId, courseId))
    .orderBy(desc(courseTwinCorrections.createdAt));
  return Response.json({ corrections: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-correction",
    subject: userId,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;

  let correction;
  try {
    correction = validateCourseTwinCorrectionBody(await request.json());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Correction is invalid." },
      { status: 400 },
    );
  }
  const { courseId } = await context.params;
  const [twin] = await getDb()
    .select({ id: courseTwins.id })
    .from(courseTwins)
    .where(eq(courseTwins.courseId, courseId))
    .limit(1);
  if (!twin) return Response.json({ message: "Course Twin not found." }, { status: 404 });
  const [created] = await getDb()
    .insert(courseTwinCorrections)
    .values({
      courseTwinId: twin.id,
      createdByUserId: userId,
      correctionType: correction.correctionType,
      targetReference: correction.targetReference,
      reason: correction.reason,
      correctionJson: correction.correctionJson,
      status: "pending",
    })
    .returning({ id: courseTwinCorrections.id, status: courseTwinCorrections.status });
  return Response.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
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
