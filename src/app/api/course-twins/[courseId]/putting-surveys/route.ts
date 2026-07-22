import { and, eq } from "drizzle-orm";

import { adminUsers } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { enqueueCourseTwinBuild } from "@/lib/course-twin-build-jobs";
import {
  importCourseTwinPuttingSurvey,
  reviewCourseTwinPuttingSurvey,
  type CourseTwinPuttingSurveyInput,
} from "@/lib/course-twin-putting-surveys";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-putting-survey-import",
    subject: userId,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 2 * 1024 * 1024);
  if (!body.ok) return body.response;
  const { courseId } = await params;
  try {
    const survey = await importCourseTwinPuttingSurvey(
      courseId,
      body.value as CourseTwinPuttingSurveyInput,
    );
    return Response.json(survey, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Putting survey could not be imported." },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const body = await readBoundedJsonBody(request, 8_192);
  if (!body.ok) return body.response;
  const payload = parseReview(body.value);
  if (!payload) return Response.json({ error: "Invalid survey review." }, { status: 400 });
  const { courseId } = await params;
  try {
    const survey = await reviewCourseTwinPuttingSurvey({
      courseId,
      surveyId: payload.surveyId,
      reviewerUserId: userId,
      status: payload.status,
      scorecardVerified: payload.scorecardVerified,
    });
    if (!survey) return Response.json({ message: "Not found." }, { status: 404 });
    const build =
      payload.status === "verified"
        ? await enqueueCourseTwinBuild({ courseId, requestedByUserId: userId, force: true })
        : null;
    return Response.json({ survey, build }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Putting survey could not be reviewed." },
      { status: 400 },
    );
  }
}

function parseReview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    typeof payload.surveyId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(payload.surveyId) ||
    (payload.status !== "verified" && payload.status !== "rejected") ||
    typeof payload.scorecardVerified !== "boolean"
  ) {
    return null;
  }
  return {
    surveyId: payload.surveyId,
    status: payload.status,
    scorecardVerified: payload.scorecardVerified,
  } as const;
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
