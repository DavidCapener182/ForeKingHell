import { and, eq } from "drizzle-orm";

import { adminUsers, courses } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest } from "@/lib/api-protection";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { ensureCourseFeatures } from "@/lib/course-feature-enrichment";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    courseId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const { courseId } = await context.params;
  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "course-feature-regeneration",
    subject: userId,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const [course] = await getDb()
    .select({ createdByUserId: courses.createdByUserId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return Response.json({ message: "Course not found." }, { status: 404 });
  }

  if (course.createdByUserId !== userId) {
    const [admin] = await getDb()
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(and(eq(adminUsers.userId, userId), eq(adminUsers.status, "active")))
      .limit(1);

    if (!admin) {
      return Response.json({ message: "Course not found." }, { status: 404 });
    }
  }

  const result = await ensureCourseFeatures({ courseId, force: true });

  return Response.json(result);
}
