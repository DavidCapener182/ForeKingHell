import type { PlanKey } from "@/lib/billing-plan-catalog";
import { planNumberLimit } from "@/lib/plan-entitlements";

export function monthlyImportAllowance(plan: PlanKey, used: number, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const limit = plan === "free" ? planNumberLimit(plan, "max_monthly_imports") : null;
  used = Math.max(0, Math.trunc(used));
  return {
    start,
    end,
    monthStart: start,
    monthEnd: end,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: end.toISOString(),
    allowed: limit === null || used < limit,
  };
}

export function importResetLabel(resetsAt: string) {
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(resetsAt))} (UTC)`;
}
