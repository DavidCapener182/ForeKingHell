import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { aiUsageEvents, planLimits } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  aiFeatureAccessLabel,
  getAiFeature,
  monthlyAiCreditDefaults,
  planAllowsAiFeature,
  type AiFeatureKey,
} from "@/lib/ai/features";
import { getActivePlanKeyForUser, type PlanKey } from "@/lib/billing";

export type AiFeatureEntitlement = {
  userId: string;
  featureKey: AiFeatureKey;
  planKey: PlanKey;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
};

export type AiUsageTokenStats = {
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export class AiAccessError extends Error {
  status: number;
  code: "ai_feature_locked" | "ai_quota_exhausted" | "ai_not_configured" | "ai_upstream_error";
  details: Record<string, unknown>;

  constructor(input: {
    message: string;
    status: number;
    code: AiAccessError["code"];
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "AiAccessError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details ?? {};
  }
}

export async function getAiFeatureEntitlement(
  userId: string,
  featureKey: AiFeatureKey,
): Promise<AiFeatureEntitlement> {
  const planKey = await getActivePlanKeyForUser(userId);
  const monthlyLimit = await getMonthlyAiCreditLimit(planKey);
  const monthlyUsed = await getMonthlyAiCreditsUsed(userId);

  return {
    userId,
    featureKey,
    planKey,
    monthlyLimit,
    monthlyUsed,
    monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
  };
}

export async function requireAiFeaturePlan(userId: string, featureKey: AiFeatureKey) {
  const entitlement = await getAiFeatureEntitlement(userId, featureKey);

  if (!planAllowsAiFeature(entitlement.planKey, featureKey)) {
    throw new AiAccessError({
      message: aiFeatureAccessLabel(featureKey),
      status: 403,
      code: "ai_feature_locked",
      details: {
        featureKey,
        planKey: entitlement.planKey,
        minimumPlan: getAiFeature(featureKey).minimumPlan,
      },
    });
  }

  return entitlement;
}

export function requireAiCredits(
  entitlement: AiFeatureEntitlement,
  creditCost = getAiFeature(entitlement.featureKey).creditCost,
) {
  if (creditCost > entitlement.monthlyRemaining) {
    throw new AiAccessError({
      message: "Monthly AI credits are exhausted for this plan.",
      status: 429,
      code: "ai_quota_exhausted",
      details: {
        featureKey: entitlement.featureKey,
        planKey: entitlement.planKey,
        creditCost,
        monthlyLimit: entitlement.monthlyLimit,
        monthlyUsed: entitlement.monthlyUsed,
        monthlyRemaining: entitlement.monthlyRemaining,
      },
    });
  }
}

export async function logAiUsageEvent(input: {
  userId: string;
  featureKey: AiFeatureKey;
  planKeySnapshot: PlanKey;
  model: string;
  status: "success" | "cache_hit" | "error";
  aiCredits: number;
  requestHash?: string | null;
  responseId?: string | null;
  tokenStats?: AiUsageTokenStats;
  metadataJson?: Record<string, unknown>;
}) {
  await getDb()
    .insert(aiUsageEvents)
    .values({
      userId: input.userId,
      featureKey: input.featureKey,
      planKeySnapshot: input.planKeySnapshot,
      model: input.model,
      status: input.status,
      aiCredits: Math.max(0, input.aiCredits),
      requestHash: input.requestHash ?? null,
      responseId: input.responseId ?? null,
      inputTokens: input.tokenStats?.inputTokens ?? null,
      outputTokens: input.tokenStats?.outputTokens ?? null,
      metadataJson: input.metadataJson ?? {},
    });
}

export async function getMonthlyAiCreditsUsed(userId: string) {
  const [row] = await getDb()
    .select({
      value: sql<number>`coalesce(sum(${aiUsageEvents.aiCredits}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, monthStartUtc())));

  return Number(row?.value ?? 0);
}

export async function getMonthlyAiCreditLimit(planKey: PlanKey) {
  const [row] = await getDb()
    .select({ value: planLimits.limitValueJson })
    .from(planLimits)
    .where(and(eq(planLimits.planKey, planKey), eq(planLimits.limitKey, "ai_monthly_credits")))
    .limit(1);

  return numberLimit(row?.value) ?? monthlyAiCreditDefaults[planKey];
}

function numberLimit(value: Record<string, unknown> | undefined) {
  const raw = value?.value;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : null;
}

function monthStartUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
