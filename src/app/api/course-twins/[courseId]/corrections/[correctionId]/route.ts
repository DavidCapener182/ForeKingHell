import { and, eq } from "drizzle-orm";

import { adminUsers, courseTwinCorrections, courseTwins } from "@/db/schema";
import { getDb } from "@/db/client";
import { enqueueCourseTwinBuild } from "@/lib/course-twin-build-jobs";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ courseId: string; correctionId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await requireApiAdmin();
  if (!userId) return Response.json({ message: "Not found." }, { status: 404 });
  let action: unknown;
  try {
    action = (await request.json())?.action;
  } catch {
    action = null;
  }
  if (action !== "accept" && action !== "reject") {
    return Response.json({ message: "Action must be accept or reject." }, { status: 400 });
  }
  const { courseId, correctionId } = await context.params;
  const [updated] = await getDb()
    .update(courseTwinCorrections)
    .set({ status: action === "accept" ? "accepted" : "rejected", updatedAt: new Date() })
    .from(courseTwins)
    .where(
      and(
        eq(courseTwinCorrections.id, correctionId),
        eq(courseTwinCorrections.courseTwinId, courseTwins.id),
        eq(courseTwins.courseId, courseId),
        eq(courseTwinCorrections.status, "pending"),
      ),
    )
    .returning({ id: courseTwinCorrections.id, status: courseTwinCorrections.status });
  if (!updated) return Response.json({ message: "Pending correction not found." }, { status: 404 });

  const build =
    action === "accept"
      ? await enqueueCourseTwinBuild({ courseId, requestedByUserId: userId, force: true })
      : null;
  return Response.json(
    { correction: updated, build },
    { headers: { "Cache-Control": "no-store" } },
  );
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
