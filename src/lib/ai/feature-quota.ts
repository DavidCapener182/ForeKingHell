import type { PlanKey } from "@/lib/billing-plan-catalog";
import type { AiFeatureKey } from "@/lib/ai/features";
import { planNumberLimit } from "@/lib/plan-entitlements";

export function aiFeatureQuota(plan: PlanKey, feature: AiFeatureKey, now = new Date()) {
  if (feature === "coach_chat" || feature === "data_chat") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return {
      limit: planNumberLimit(plan, "ai_daily_chat_messages"),
      features: ["coach_chat", "data_chat"],
      start,
      end: new Date(start.getTime() + 86_400_000),
      label: "Daily AI chat messages",
    };
  }
  if (feature === "scorecard_extract") {
    return {
      limit: planNumberLimit(plan, "ai_scorecard_extracts_monthly"),
      features: ["scorecard_extract"],
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      label: "Monthly scorecard extracts",
    };
  }
  return null;
}
