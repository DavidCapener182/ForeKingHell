import type { PlanKey } from "@/lib/billing-plan-catalog";

export const paidFeatures = {
  advanced_analytics: { minimumPlan: "plus", label: "Advanced analytics and saved comparisons" },
  private_competitions: { minimumPlan: "plus", label: "Private competitions" },
  share_customisation: { minimumPlan: "plus", label: "Portrait share-card exports" },
  selective_reports: { minimumPlan: "plus", label: "Selective reports" },
  player_comparison: { minimumPlan: "pro", label: "Player comparison and social intelligence" },
  premium_imports: { minimumPlan: "pro", label: "Square and TrackMan imports" },
  coach_workspace: { minimumPlan: "coach", label: "Coach workspace" },
  major_hosting: { minimumPlan: "coach", label: "Major tournament hosting" },
} as const;
export type PaidFeature = keyof typeof paidFeatures;
export const planRank: Record<PlanKey, number> = { free: 0, plus: 1, pro: 2, coach: 3, full: 4 };

export function planHasFeature(plan: PlanKey, feature: PaidFeature) {
  return planRank[plan] >= planRank[paidFeatures[feature].minimumPlan];
}

export function featureUpgradeMessage(feature: PaidFeature) {
  const { label, minimumPlan } = paidFeatures[feature];
  const name = minimumPlan === "coach" ? "Coach / Club" : minimumPlan === "plus" ? "Plus" : "Pro";
  return `${label} requires ${name} or higher.`;
}
