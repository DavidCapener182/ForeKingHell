import type { PlanKey } from "@/lib/billing-plan-catalog";
import { planNumberLimit } from "@/lib/plan-entitlements";

export function monthlyImportAllowance(plan: PlanKey, used: number, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const limit = plan === "free" ? planNumberLimit(plan, "max_monthly_imports") : null;
  return { start, end, limit, allowed: limit === null || used < limit };
}
