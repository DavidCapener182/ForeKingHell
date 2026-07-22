import { and, eq } from "drizzle-orm";

import { adminUsers } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { enqueueUkCourseTwinBatch, listUkCourseTwinCandidates } from "@/lib/course-twin-build-jobs";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const requested = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(requested) ? Math.max(1, Math.min(100, requested)) : 50;
  const candidates = await listUkCourseTwinCandidates(limit);
  return Response.json(
    { candidates, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-batch-build",
    subject: userId,
    limit: 2,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 4_096);
  if (!body.ok) return body.response;
  const payload =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as Record<string, unknown>)
      : {};
  const limit = payload.limit === undefined ? 20 : Number(payload.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || typeof payload.force === "string") {
    return Response.json({ message: "Invalid batch settings." }, { status: 400 });
  }
  const batch = await enqueueUkCourseTwinBatch({
    requestedByUserId: userId,
    limit,
    force: payload.force === true,
  });
  return Response.json(batch, { status: 202, headers: { "Cache-Control": "private, no-store" } });
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
