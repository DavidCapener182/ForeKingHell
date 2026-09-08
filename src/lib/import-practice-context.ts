import "server-only";
import { getSavedPracticePlan } from "@/lib/practice-planner";

/** A URL may select only an owned, unlinked plan supported by import matching. */
export async function getImportPracticeContext(
  userId: string,
  value: string | string[] | undefined,
) {
  const planId = Array.isArray(value) ? value[0] : value;
  if (!planId) return null;
  const plan = await getSavedPracticePlan(userId, planId);
  return plan &&
    ["planned", "active", "awaiting_import", "match_found", "completed"].includes(plan.status) &&
    !plan.sourceSessionId
    ? plan
    : null;
}
