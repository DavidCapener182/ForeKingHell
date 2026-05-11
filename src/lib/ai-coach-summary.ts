import type { CoachSummary } from "@/lib/coach";

export type AiCoachClubPayload = {
  clubName: string;
  issueLabel: string;
  trustIndex: number;
  sampleSize: number;
  stockCarryYd: number | null;
  playableRate: number | null;
  usualMiss: string;
  reason: string;
  drill: string;
};

export type AiCoachPayload = {
  productName: "ForeKingHell";
  headline: string;
  subhead: string;
  totals: {
    clubs: number;
    averageTrust: number;
    cleanShots: number;
    playableRate: number | null;
  };
  focusClub: AiCoachClubPayload | null;
  clubs: AiCoachClubPayload[];
  signals: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  sessionPlan: Array<{
    title: string;
    detail: string;
    duration: string;
  }>;
  trainingImpact: Array<{
    clubName: string;
    issueLabel: string;
    status: string;
    headline: string;
    detail: string;
  }>;
};

export type AiCoachGeneratedSummary = {
  headline: string;
  coachNote: string;
  practicePlan: string[];
  watchOut: string;
  confidence: "low" | "medium" | "high";
};

export function buildAiCoachPayload(coach: CoachSummary): AiCoachPayload {
  const clubs = coach.clubCards.slice(0, 8).map((card) => ({
    clubName: card.clubName,
    issueLabel: card.issueLabel,
    trustIndex: card.trustIndex,
    sampleSize: card.sampleSize,
    stockCarryYd: card.stockCarryYd,
    playableRate: card.playableRate,
    usualMiss: card.usualMiss,
    reason: card.reason,
    drill: card.drill,
  }));

  return {
    productName: "ForeKingHell",
    headline: coach.headline,
    subhead: coach.subhead,
    totals: {
      clubs: coach.summary.totals.clubs,
      averageTrust: coach.summary.totals.averageTrust,
      cleanShots: coach.summary.totals.trackedCleanShots,
      playableRate: coach.summary.totals.averagePlayableRate,
    },
    focusClub: clubs[0] ?? null,
    clubs,
    signals: coach.signals.slice(0, 6).map((signal) => ({
      label: signal.label,
      value: signal.value,
      detail: signal.detail,
    })),
    sessionPlan: coach.sessionPlan.map((block) => ({
      title: block.title,
      detail: block.detail,
      duration: block.duration,
    })),
    trainingImpact: coach.trainingImpact.slice(0, 4).map((impact) => ({
      clubName: impact.clubName,
      issueLabel: impact.issueLabel,
      status: impact.status,
      headline: impact.headline,
      detail: impact.detail,
    })),
  };
}

export function buildCoachPrompt(payload: AiCoachPayload) {
  return `You are the ForeKingHell golf coach.

Use only the metrics in the JSON. Do not invent swing facts, club specs, official handicap claims, or pro comparisons.
Write like a direct personal coach: specific, practical, calm.

Return strict JSON only:
{
  "headline": "short sentence",
  "coachNote": "90-130 words",
  "practicePlan": ["three short drill steps"],
  "watchOut": "one caution",
  "confidence": "low" | "medium" | "high"
}

Metrics:
${JSON.stringify(payload, null, 2)}`;
}

export function parseAiCoachSummary(text: string): AiCoachGeneratedSummary {
  const parsed = JSON.parse(extractJson(text)) as Partial<AiCoachGeneratedSummary>;
  const practicePlan = Array.isArray(parsed.practicePlan)
    ? parsed.practicePlan.filter((item): item is string => typeof item === "string").slice(0, 4)
    : [];
  const confidence =
    parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? parsed.confidence
      : "medium";

  return {
    headline: typeof parsed.headline === "string" ? parsed.headline : "Coach note",
    coachNote: typeof parsed.coachNote === "string" ? parsed.coachNote : text,
    practicePlan,
    watchOut: typeof parsed.watchOut === "string" ? parsed.watchOut : "Treat AI output as guidance, not a lesson diagnosis.",
    confidence,
  };
}

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) {
    throw new Error("AI coach response did not include JSON.");
  }

  return jsonText;
}
