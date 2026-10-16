"use server";
import { requireCurrentUserId } from "@/lib/current-user";
import { getActivePlanKeyForUser } from "@/lib/billing";
import { planHasFeature } from "@/lib/plan-access";
export async function canUseFullRoundPlan() {
  return planHasFeature(
    await getActivePlanKeyForUser(await requireCurrentUserId()),
    "course_twin_round_plan",
  );
}
