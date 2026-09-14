import "server-only";
import { redirect } from "next/navigation";
import { getActivePlanKeyForUser } from "@/lib/billing";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  featureUpgradeMessage,
  paidFeatures,
  planHasFeature,
  type PaidFeature,
} from "@/lib/plan-access";

export async function requirePlanFeature(userId: string, feature: PaidFeature) {
  if (!planHasFeature(await getActivePlanKeyForUser(userId), feature)) {
    redirect(`/billing?required=${paidFeatures[feature].minimumPlan}&feature=${feature}`);
  }
}

export async function requirePlanUser(feature: PaidFeature) {
  const userId = await requireCurrentUserId();
  await requirePlanFeature(userId, feature);
  return userId;
}

export async function planFeatureRejection(userId: string, feature: PaidFeature) {
  if (planHasFeature(await getActivePlanKeyForUser(userId), feature)) return null;
  return Response.json(
    {
      error: featureUpgradeMessage(feature),
      code: "PLAN_REQUIRED",
      minimumPlan: paidFeatures[feature].minimumPlan,
    },
    { status: 403 },
  );
}
