import "server-only";

import type { PlanKey } from "@/lib/billing";

export const aiFeatureKeys = [
  "coach_summary",
  "coach_chat",
  "data_chat",
  "scorecard_extract",
  "weekly_recap",
  "practice_recap",
  "course_strategy",
  "social_caption",
  "session_roast",
  "challenge_copy",
  "coach_player_summary",
] as const;

export type AiFeatureKey = (typeof aiFeatureKeys)[number];

export type AiFeatureConfig = {
  key: AiFeatureKey;
  label: string;
  minimumPlan: Exclude<PlanKey, "free" | "full">;
  creditCost: number;
  modelEnvKey: string;
  fallbackModel: string;
  maxOutputTokens: number;
  cacheTtlMs?: number;
};

const hourMs = 60 * 60 * 1000;

export const aiFeatures = {
  coach_summary: {
    key: "coach_summary",
    label: "AI coach note",
    minimumPlan: "pro",
    creditCost: 1,
    modelEnvKey: "OPENAI_COACH_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 900,
    cacheTtlMs: 24 * hourMs,
  },
  coach_chat: {
    key: "coach_chat",
    label: "Ask Coach",
    minimumPlan: "pro",
    creditCost: 1,
    modelEnvKey: "OPENAI_COACH_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 700,
  },
  data_chat: {
    key: "data_chat",
    label: "Data Chat",
    minimumPlan: "pro",
    creditCost: 1,
    modelEnvKey: "OPENAI_COACH_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 900,
  },
  scorecard_extract: {
    key: "scorecard_extract",
    label: "Scorecard image extraction",
    minimumPlan: "plus",
    creditCost: 4,
    modelEnvKey: "OPENAI_SCORECARD_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 2200,
  },
  weekly_recap: {
    key: "weekly_recap",
    label: "AI weekly recap",
    minimumPlan: "plus",
    creditCost: 1,
    modelEnvKey: "OPENAI_WEEKLY_RECAP_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 750,
    cacheTtlMs: 6 * hourMs,
  },
  practice_recap: {
    key: "practice_recap",
    label: "AI practice recap",
    minimumPlan: "plus",
    creditCost: 1,
    modelEnvKey: "OPENAI_COACH_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 650,
    cacheTtlMs: 6 * hourMs,
  },
  course_strategy: {
    key: "course_strategy",
    label: "AI course strategy",
    minimumPlan: "pro",
    creditCost: 2,
    modelEnvKey: "OPENAI_COACH_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 800,
    cacheTtlMs: 6 * hourMs,
  },
  social_caption: {
    key: "social_caption",
    label: "AI social caption",
    minimumPlan: "plus",
    creditCost: 1,
    modelEnvKey: "OPENAI_FAST_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 550,
    cacheTtlMs: 24 * hourMs,
  },
  session_roast: {
    key: "session_roast",
    label: "AI session roast",
    minimumPlan: "plus",
    creditCost: 1,
    modelEnvKey: "OPENAI_FAST_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 420,
    cacheTtlMs: 24 * hourMs,
  },
  challenge_copy: {
    key: "challenge_copy",
    label: "AI challenge copy",
    minimumPlan: "pro",
    creditCost: 1,
    modelEnvKey: "OPENAI_FAST_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 550,
    cacheTtlMs: 24 * hourMs,
  },
  coach_player_summary: {
    key: "coach_player_summary",
    label: "Coach player summary",
    minimumPlan: "coach",
    creditCost: 8,
    modelEnvKey: "OPENAI_PREMIUM_MODEL",
    fallbackModel: "gpt-4.1-mini",
    maxOutputTokens: 1200,
    cacheTtlMs: 24 * hourMs,
  },
} as const satisfies Record<AiFeatureKey, AiFeatureConfig>;

export const monthlyAiCreditDefaults = {
  free: 0,
  plus: 10,
  pro: 100,
  coach: 300,
  full: 1000,
} as const satisfies Record<PlanKey, number>;

const planRank = {
  free: 0,
  plus: 1,
  pro: 2,
  coach: 3,
  full: 4,
} as const satisfies Record<PlanKey, number>;

export function getAiFeature(featureKey: AiFeatureKey): AiFeatureConfig {
  return aiFeatures[featureKey];
}

export function isAiFeatureKey(value: string): value is AiFeatureKey {
  return aiFeatureKeys.includes(value as AiFeatureKey);
}

export function planAllowsAiFeature(planKey: PlanKey, featureKey: AiFeatureKey) {
  if (planKey === "full") {
    return true;
  }

  const feature = getAiFeature(featureKey);
  return planRank[planKey] >= planRank[feature.minimumPlan];
}

export function resolveAiModel(featureKey: AiFeatureKey) {
  const feature = getAiFeature(featureKey);
  const configured = process.env[feature.modelEnvKey]?.trim();
  const fastFallback = process.env.OPENAI_FAST_MODEL?.trim();
  const coachFallback = process.env.OPENAI_COACH_MODEL?.trim();

  return configured || fastFallback || coachFallback || feature.fallbackModel;
}

export function aiFeatureAccessLabel(featureKey: AiFeatureKey) {
  const feature = getAiFeature(featureKey);
  return `${feature.label} is available on ${planLabel(feature.minimumPlan)} or higher.`;
}

function planLabel(planKey: Exclude<PlanKey, "free" | "full">) {
  if (planKey === "coach") {
    return "Coach / Club";
  }

  return planKey.slice(0, 1).toUpperCase() + planKey.slice(1);
}
