import { and, eq } from "drizzle-orm";

import { adminUsers, courseTwins } from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { publishCourseTwinVersion } from "@/lib/course-twin-package-store";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ courseId: string; versionId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const userId = await getOptionalCurrentUserId();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  const [admin] = await getDb()
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.userId, userId), eq(adminUsers.status, "active")))
    .limit(1);
  if (!admin) return Response.json({ message: "Not found." }, { status: 404 });

  const { courseId, versionId } = await context.params;
  const [twin] = await getDb()
    .select({ id: courseTwins.id })
    .from(courseTwins)
    .where(eq(courseTwins.courseId, courseId))
    .limit(1);
  if (!twin) return Response.json({ message: "Course Twin not found." }, { status: 404 });
  const result = await publishCourseTwinVersion({ courseTwinId: twin.id, versionId });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
