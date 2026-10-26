import type { PlanKey } from "./billing-plan-catalog";

export function proTrialEligibility(input: {
  activePlanKey: PlanKey;
  eligibleAfterImportAt: Date | null;
  consumedAt: Date | null;
  priorTrial: boolean;
}) {
  const consumed = input.consumedAt !== null || input.priorTrial;
  const reason = consumed
    ? "consumed"
    : input.activePlanKey !== "free"
      ? "paid_plan"
      : !input.eligibleAfterImportAt
        ? "no_import"
        : null;
  return { eligible: reason === null, consumed, reason };
}

export function isProTrialSubscription(
  planKey: string,
  status: string,
  metadata: Record<string, unknown>,
) {
  if (planKey !== "pro") return false;
  const nested = metadata.metadata;
  return (
    status === "trialing" ||
    metadata.trial === "pro_7d" ||
    (typeof metadata.trialStart === "number" && metadata.trialStart > 0) ||
    (typeof nested === "object" &&
      nested !== null &&
      "trial" in nested &&
      nested.trial === "pro_7d")
  );
}
