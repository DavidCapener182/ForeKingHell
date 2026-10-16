import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { courseTwinRoundPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getActivePlanKeyForUser, recordUsageEvent } from "@/lib/billing";
import { planHasFeature } from "@/lib/plan-access";
import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { getMobileCourseTwinBagProfiles } from "@/lib/mobile-quick-bag-data";
import { assembleRoundPlan } from "@/lib/course-twin-round-plan";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ courseId: string }> };
async function authorize(context: Context) {
  const user = await getCurrentUser();
  if (!user)
    return {
      response: Response.json({ error: "Authentication required" }, { status: 401, headers }),
    };
  if (!planHasFeature(await getActivePlanKeyForUser(user.id), "course_twin_round_plan"))
    return {
      response: Response.json(
        {
          error: "Round plans require Pro",
          code: "PLAN_REQUIRED",
          minimumPlan: "pro",
          upgradeUrl: "/billing?required=pro&feature=course_twin_round_plan",
        },
        { status: 403, headers },
      ),
    };
  const { courseId } = await context.params;
  const manifest = await getCourseTwinManifest({ userId: user.id, courseId });
  if (!manifest)
    return {
      response: Response.json({ error: "Course Twin not found" }, { status: 404, headers }),
    };
  return { user, manifest };
}
export async function GET(_request: Request, context: Context) {
  const auth = await authorize(context);
  if (auth.response) return auth.response;
  const [plan] = await getDb()
    .select()
    .from(courseTwinRoundPlans)
    .where(
      and(
        eq(courseTwinRoundPlans.userId, auth.user!.id),
        eq(courseTwinRoundPlans.courseId, auth.manifest!.course.id),
      ),
    )
    .orderBy(desc(courseTwinRoundPlans.createdAt), desc(courseTwinRoundPlans.id))
    .limit(1);
  return Response.json({ plan: plan ?? null }, { headers });
}
export async function POST(request: Request, context: Context) {
  const auth = await authorize(context);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !["safe", "normal", "aggressive"].includes(body.intent) ||
    Object.keys(body).some((k) => k !== "intent")
  )
    return Response.json({ error: "Supply only a valid intent" }, { status: 400, headers });
  const bag = await getMobileCourseTwinBagProfiles();
  if (!bag.length)
    return Response.json(
      { error: "Import trusted carry and side readings before planning." },
      { status: 422, headers },
    );
  const manifest = auth.manifest!;
  const holes = assembleRoundPlan(manifest, bag, body.intent);
  const [plan] = await getDb()
    .insert(courseTwinRoundPlans)
    .values({
      userId: auth.user!.id,
      courseId: manifest.course.id,
      intent: body.intent,
      holesJson: holes,
      manifestPackageVersion: manifest.packageVersion,
    })
    .returning();
  await recordUsageEvent({
    eventType: "course_twin_plan_saved",
    sourceId: plan.id,
    metadataJson: { courseId: manifest.course.id },
  });
  return Response.json({ plan }, { headers });
}
