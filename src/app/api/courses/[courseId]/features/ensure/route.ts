import { getOptionalCurrentUserId } from "@/lib/current-user";
import { ensureCourseFeatures } from "@/lib/course-feature-enrichment";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    courseId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const { courseId } = await context.params;
  const result = await ensureCourseFeatures({ courseId, force: true });

  return Response.json(result);
}
