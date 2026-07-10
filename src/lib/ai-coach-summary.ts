import type { CoachSummary } from "@/lib/coach";
import { BRAND_NAME } from "@/lib/brand";

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
  productName: typeof BRAND_NAME;
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
  recommendation: string;
  evidence: string;
  coachNote: string;
  drill: string;
  timeNeeded: string;
  retest: string;
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
    productName: BRAND_NAME,
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

export function parseAiCoachPayload(value: unknown): AiCoachPayload | null {
  if (!isRecord(value) || value.productName !== BRAND_NAME) return null;

  const headline = boundedString(value.headline, 220);
  const subhead = boundedString(value.subhead, 320);
  const totals = parseTotals(value.totals);
  const clubs = parseBoundedArray(value.clubs, 8, parseClub);
  const signals = parseBoundedArray(value.signals, 6, parseSignal);
  const sessionPlan = parseBoundedArray(value.sessionPlan, 6, parseSessionBlock);
  const trainingImpact = parseBoundedArray(value.trainingImpact, 4, parseTrainingImpact);
  const focusClub = value.focusClub === null ? null : parseClub(value.focusClub);

  if (
    !headline ||
    !subhead ||
    !totals ||
    !clubs ||
    !signals ||
    !sessionPlan ||
    !trainingImpact ||
    (value.focusClub !== null && !focusClub)
  ) {
    return null;
  }

  return {
    productName: BRAND_NAME,
    headline,
    subhead,
    totals,
    focusClub,
    clubs,
    signals,
    sessionPlan,
    trainingImpact,
  };
}

export function buildCoachPrompt(payload: AiCoachPayload) {
  return `You are the ${BRAND_NAME} golf coach.

Use only the metrics in the JSON. Do not invent swing facts, club specs, official handicap claims, or pro comparisons.
Write like a direct personal coach: specific, practical, calm.

Return strict JSON only:
{
  "headline": "short sentence",
  "recommendation": "specific recommendation tied to the measured priority",
  "evidence": "one sentence citing only values from the JSON",
  "coachNote": "90-130 words",
  "drill": "one practical drill",
  "timeNeeded": "short time estimate",
  "retest": "when to check the data again",
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
    recommendation:
      typeof parsed.recommendation === "string"
        ? parsed.recommendation
        : "Work from the top measured practice priority.",
    evidence:
      typeof parsed.evidence === "string"
        ? parsed.evidence
        : `Evidence was limited to the structured ${BRAND_NAME} metrics supplied to the AI coach.`,
    coachNote: typeof parsed.coachNote === "string" ? parsed.coachNote : text,
    drill:
      typeof parsed.drill === "string"
        ? parsed.drill
        : (practicePlan[0] ?? "Run one controlled stock-shot block and record the result."),
    timeNeeded: typeof parsed.timeNeeded === "string" ? parsed.timeNeeded : "20-30 minutes",
    retest:
      typeof parsed.retest === "string"
        ? parsed.retest
        : "Retest after two comparable practice sessions.",
    practicePlan,
    watchOut:
      typeof parsed.watchOut === "string"
        ? parsed.watchOut
        : "Treat AI output as guidance, not a lesson diagnosis.",
    confidence,
  };
}

function extractJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) {
    throw new Error("AI coach response did not include JSON.");
  }

  return jsonText;
}

function parseTotals(value: unknown): AiCoachPayload["totals"] | null {
  if (!isRecord(value)) return null;
  const clubs = boundedNumber(value.clubs, 0, 50, true);
  const averageTrust = boundedNumber(value.averageTrust, 0, 100);
  const cleanShots = boundedNumber(value.cleanShots, 0, 1_000_000, true);
  const playableRate = nullableBoundedNumber(value.playableRate, 0, 100);
  return clubs === null ||
    averageTrust === null ||
    cleanShots === null ||
    playableRate === undefined
    ? null
    : { clubs, averageTrust, cleanShots, playableRate };
}

function parseClub(value: unknown): AiCoachClubPayload | null {
  if (!isRecord(value)) return null;
  const clubName = boundedString(value.clubName, 120);
  const issueLabel = boundedString(value.issueLabel, 120);
  const trustIndex = boundedNumber(value.trustIndex, 0, 100);
  const sampleSize = boundedNumber(value.sampleSize, 0, 1_000_000, true);
  const stockCarryYd = nullableBoundedNumber(value.stockCarryYd, 0, 600);
  const playableRate = nullableBoundedNumber(value.playableRate, 0, 100);
  const usualMiss = boundedString(value.usualMiss, 120);
  const reason = boundedString(value.reason, 400);
  const drill = boundedString(value.drill, 400);

  if (
    !clubName ||
    !issueLabel ||
    trustIndex === null ||
    sampleSize === null ||
    stockCarryYd === undefined ||
    playableRate === undefined ||
    !usualMiss ||
    !reason ||
    !drill
  ) {
    return null;
  }

  return {
    clubName,
    issueLabel,
    trustIndex,
    sampleSize,
    stockCarryYd,
    playableRate,
    usualMiss,
    reason,
    drill,
  };
}

function parseSignal(value: unknown) {
  if (!isRecord(value)) return null;
  const label = boundedString(value.label, 120);
  const signalValue = boundedString(value.value, 120);
  const detail = boundedString(value.detail, 320);
  return label && signalValue && detail ? { label, value: signalValue, detail } : null;
}

function parseSessionBlock(value: unknown) {
  if (!isRecord(value)) return null;
  const title = boundedString(value.title, 160);
  const detail = boundedString(value.detail, 400);
  const duration = boundedString(value.duration, 80);
  return title && detail && duration ? { title, detail, duration } : null;
}

function parseTrainingImpact(value: unknown) {
  if (!isRecord(value)) return null;
  const clubName = boundedString(value.clubName, 120);
  const issueLabel = boundedString(value.issueLabel, 120);
  const status =
    value.status === "better" ||
    value.status === "worse" ||
    value.status === "mixed" ||
    value.status === "needs-data"
      ? value.status
      : null;
  const headline = boundedString(value.headline, 220);
  const detail = boundedString(value.detail, 400);
  return clubName && issueLabel && status && headline && detail
    ? { clubName, issueLabel, status, headline, detail }
    : null;
}

function parseBoundedArray<T>(
  value: unknown,
  maxLength: number,
  parser: (item: unknown) => T | null,
) {
  if (!Array.isArray(value) || value.length > maxLength) return null;
  const parsed = value.map(parser);
  return parsed.some((item) => item === null) ? null : (parsed as T[]);
}

function boundedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function boundedNumber(value: unknown, min: number, max: number, integer = false) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
    ? value
    : null;
}

function nullableBoundedNumber(value: unknown, min: number, max: number) {
  if (value === null) return null;
  return boundedNumber(value, min, max) ?? undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
