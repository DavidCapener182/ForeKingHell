import { and, eq } from "drizzle-orm";

import { adminUsers } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import {
  importCourseTwinCatalog,
  type CourseTwinCatalogCandidate,
} from "@/lib/course-twin-catalog-import";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-catalog-import",
    subject: userId,
    limit: 1,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 256 * 1024);
  if (!body.ok) return body.response;
  const payload =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as Record<string, unknown>)
      : null;
  if (!payload || !Array.isArray(payload.candidates) || typeof payload.force === "string") {
    return Response.json({ message: "Invalid catalogue." }, { status: 400 });
  }
  try {
    const result = await importCourseTwinCatalog({
      candidates: payload.candidates as CourseTwinCatalogCandidate[],
      requestedByUserId: userId,
      force: payload.force === true,
    });
    return Response.json(result, {
      status: 202,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Catalogue could not be imported." },
      { status: 400 },
    );
  }
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
