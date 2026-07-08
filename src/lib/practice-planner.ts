import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  practiceBlockResults,
  practiceBlocks,
  practicePlanMatches,
  practicePlans,
  practiceResults,
  practiceTemplates,
  sessions,
  shots,
  strokesGainedShotEvents,
  userAchievements,
  xpLedger,
} from "@/db/schema";
import {
  buildWedgeMatrix,
  type BagIntelligenceClub,
  type WedgeMatrixClub,
} from "@/lib/bag-intelligence";
import { formatClubType } from "@/lib/club-format";
import { getProgressData } from "@/lib/progress-data";
import {
  buildProgressSummary,
  type PracticePriority,
  type ProgressSummary,
} from "@/lib/progress-summary";
import { getSpeedCoachCardData } from "@/lib/speed-training-data";
import { getTodayPracticeData, type ClubDayComparison } from "@/lib/today-session-data";
import { getTrainingOverTimeData } from "@/lib/training/trainingData";
import type { TrainingStatusKey } from "@/lib/training/trainingStatus";
import { normalizeClubType } from "@/lib/rapsodo/parser";
import { getAchievement } from "@/lib/achievements/registry";
import { xpForAchievement } from "@/lib/achievements/xp";

export type PracticeSessionType =
  | "range"
  | "short_game"
  | "speed"
  | "putting"
  | "course_warmup"
  | "mixed";

export type PracticeEnergyLevel = "fresh" | "normal" | "tired" | "niggle";

export type PracticeIntent =
  | "scoring"
  | "confidence"
  | "latest_weakness"
  | "round_preparation"
  | "distance_mapping"
  | "speed";

export type PracticeCompletionStatus = "complete" | "partial" | "missed";
export type PracticeBlockEvaluationResult = "passed" | "mixed" | "failed" | "insufficient_data";
export type PracticeBlockEvaluationConfidence = "high" | "medium" | "low";
export type PracticeBlockScoringMode = "ordered" | "aggregate";

export type PracticeBlockType =
  | "warmup"
  | "baseline"
  | "technical"
  | "scoring"
  | "speed"
  | "putting"
  | "short_game"
  | "random"
  | "test"
  | "warmup_round";

export type PracticePlanStatus =
  | "draft"
  | "planned"
  | "awaiting_import"
  | "match_found"
  | "analysed"
  | "abandoned"
  | "active"
  | "completed";

export type PracticeFacilityOptions = {
  customBalls?: number | null;
  chippingGreen?: boolean;
  bunker?: boolean;
  puttingGreen?: boolean;
  indoorMat?: boolean;
  distanceAvailableFt?: number | null;
  speedSticks?: boolean;
  golfClubOnly?: boolean;
  rapsodoSpeed?: boolean;
  overrideTrainingLoad?: boolean;
};

export type GeneratePracticePlanOptions = {
  sessionType: PracticeSessionType;
  ballCount?: number | null;
  timeMinutes: number;
  energy: PracticeEnergyLevel;
  intent: PracticeIntent;
  facility?: PracticeFacilityOptions;
};

export type PracticePlannerClub = {
  clubId: string;
  clubType: string;
  label: string;
  stockCarryYd: number | null;
  trustIndex: number;
  confidenceScore: number;
  confidenceLabel: string;
  sampleSize: number;
  playableRate: number | null;
  offlineAverageYd: number | null;
  bigMissRate: number | null;
  volatilityScore: number;
  practiceTitle: string;
  practiceDrill: string;
};

export type PracticePlannerContext = {
  generatedAt: string;
  latestPractice: {
    sessionId: string | null;
    dateLabel: string;
    bestPerformer: string | null;
    biggestOpportunity: string | null;
    scoringIssue: string;
    straightRate: number | null;
    playableRate: number | null;
    offlineAverageYd: number | null;
    clubs: Array<{
      clubType: string;
      label: string;
      shotCount: number;
      score: number;
      playableRate: number | null;
      straightRate: number | null;
      offlineAverageYd: number | null;
      bigMissRate: number | null;
    }>;
  };
  progress: {
    priorities: PracticePriority[];
    trustLadder: ProgressSummary["trustLadder"];
    mostVolatile: string | null;
    weakestSignal: string | null;
    currentForm: string | null;
  };
  bag: {
    clubs: PracticePlannerClub[];
    issues: string[];
    wedgeMatrix: WedgeMatrixClub[];
  };
  trainingLoad: {
    statusKey: TrainingStatusKey;
    statusLabel: string;
    advice: string;
    recentLoad: number;
    golfForm: number;
    recommendation: string;
    highRecentLoad: boolean;
  };
  speed: {
    currentSpeedMph: number | null;
    targetSpeedMph: number | null;
    recommendation: string;
    priority: string;
  };
  scoring: {
    weakestCategory: string | null;
    penaltyPattern: string | null;
  };
};

export type PracticePriorityItem = {
  key: string;
  clubType: string | null;
  label: string;
  score: number;
  certainty: "high" | "medium" | "low";
  reason: string;
  drill: string;
  category: "long_game" | "wedge" | "driver" | "speed" | "putting" | "short_game" | "warmup";
  roadmap: boolean;
};

export type PracticeBlock = {
  id: string;
  order: number;
  type: PracticeBlockType;
  title: string;
  clubs: string[];
  ballCount: number | null;
  timeMinutes: number;
  purpose: string;
  drill: string;
  successTarget: string;
  recordPrompt: string;
  scoringRules: {
    metric: string;
    target: number;
    maxBigMisses?: number;
    unit?: string;
  };
};

export type PracticePlan = {
  id?: string;
  status?: PracticePlanStatus;
  sessionType: PracticeSessionType;
  title: string;
  summary: string;
  totalBalls: number | null;
  estimatedTimeMinutes: number;
  energy: PracticeEnergyLevel;
  intent: PracticeIntent;
  focusClubs: string[];
  confidenceLabel: "High" | "Medium" | "Low";
  trainingStatus: string;
  why: string[];
  blocks: PracticeBlock[];
  postSessionRules: string[];
  sourceContext: PracticePlannerContext;
  generation: PracticePlanGeneration;
  createdAt: string;
};

export type PracticeBlockResultInput = {
  blockId: string;
  completionStatus: PracticeCompletionStatus;
  actualBalls?: number | null;
  actualMinutes?: number | null;
  score?: number | null;
  passed?: boolean;
  result?: PracticeBlockEvaluationResult;
  summary?: string | null;
  linkedShotIds?: string[];
  metrics?: Record<string, unknown>;
  notes?: string | null;
};

export type PracticeResultInput = {
  completionStatus: PracticeCompletionStatus;
  actualBalls?: number | null;
  actualMinutes?: number | null;
  notes?: string | null;
  sourceSessionId?: string | null;
  blockResults: PracticeBlockResultInput[];
};

export type PracticeComparison = {
  sourceSessionId: string | null;
  scoringMode: PracticeBlockScoringMode;
  matchConfidence: number | null;
  importedSession: {
    shotCount: number;
    sessionType: string;
    dateLabel: string;
    clubTypes: string[];
  } | null;
  planVsActual: {
    plannedBalls: number | null;
    actualShots: number;
    plannedClubs: string[];
    actualClubs: string[];
  };
  whatWorked: string[];
  needsWork: string[];
  nextRecommendation: string;
  summary: string;
  decisions: Array<{
    blockId: string;
    title: string;
    target: string;
    actual: string;
    plannedBalls: number | null;
    actualBalls: number;
    matchedPlannedVolume: boolean;
    result: PracticeBlockEvaluationResult;
    confidence: PracticeBlockEvaluationConfidence;
    scoringMode: PracticeBlockScoringMode;
    linkedShotIds: string[];
    metrics: Record<string, unknown>;
    summary: string;
    decision: "maintain" | "repeat_once" | "keep_priority" | "move_down";
  }>;
};

export type PracticePlanImportMatch = {
  planId: string;
  title: string;
  score: PracticeScore;
  comparison: PracticeComparison;
  matchScore: number;
  matchConfidence: "high" | "medium" | "low";
  matchReason: string;
  matchBreakdown: PracticePlanMatchScoreBreakdown;
  importedSession: {
    shotCount: number;
    sessionType: string;
    dateLabel: string;
  };
};

export type PracticeLatestSessionReview = {
  sourceSessionId: string;
  comparison: PracticeComparison;
  score: PracticeScore;
  matchScore: number;
  matchReason: string;
  partialEvidence: boolean;
  importedSession: {
    shotCount: number;
    sessionType: string;
    sourceType: string;
    dateLabel: string;
    clubTypes: string[];
  };
};

export type PracticePlanMatchScoreBreakdown = {
  dateScore: number;
  sessionTypeScore: number;
  ballCountScore: number;
  focusClubScore: number;
  clubMixScore: number;
  sourceTypeScore: number;
};

type PracticePlanMatchScore = {
  score: number;
  reason: string;
  breakdown: PracticePlanMatchScoreBreakdown;
};

export type PracticeScore = {
  score: number;
  completionPercent: number;
  verdict: string;
  nextAction: string;
  mainPriority: "improved" | "mixed" | "missed";
  transfer: "strong" | "mixed" | "missed";
};

export type PracticePlanGeneration = {
  source: "rules" | "openai";
  label: string;
  model: string | null;
  cached: boolean;
  creditsCharged: number;
  creditsRemaining: number | null;
  note: string | null;
};

export type SavedPracticePlan = {
  id: string;
  title: string;
  sessionType: PracticeSessionType;
  status: PracticePlanStatus;
  totalBalls: number | null;
  timeMinutes: number;
  focusClubs: string[];
  plannedAt: string;
  completedAt: string | null;
  score: number | null;
  matchConfidence: number | null;
  matchReason: string | null;
  summary: string;
  generation: PracticePlanGeneration;
  sourceSessionId: string | null;
  blocks: Array<PracticeBlock & { dbId: string }>;
  result: {
    verdict: string;
    nextAction: string;
    practiceScore: number;
    comparison: PracticeComparison | null;
  } | null;
};

export type PracticeTemplateView = {
  id: string;
  title: string;
  description: string;
  sessionType: PracticeSessionType;
  ballCount: number | null;
  timeMinutes: number;
  intent: PracticeIntent;
};

export type PracticeImportOption = {
  id: string;
  label: string;
  sessionType: string;
  dateLabel: string;
  shotCount: number;
};

export type ImportedPracticeSessionSummary = {
  id: string;
  sourceType: string;
  sessionType: string;
  sessionDate: Date;
  uploadedAt: Date;
  shotCount: number;
  clubTypes: string[];
  clubSummaries: Array<{
    clubType: string;
    shotCount: number;
    playableRate: number | null;
    offlineAverageYd: number | null;
    carryAverageYd: number | null;
  }>;
  shotRows: ImportedPracticeShotRow[];
};

export type ImportedPracticeShotRow = {
  id: string;
  clubType: string;
  shotNumber: number | null;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  offlineYd: number | null;
  launchDirectionDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
};

const RANGE_BALL_OPTIONS = [30, 50, 80, 100, 120];
const WEDGE_TYPES = new Set(["pw", "gw", "aw", "sw", "lw"]);
const DRIVER_TYPES = new Set(["driver"]);
const LONG_GAME_TYPES = new Set(["driver", "3w", "5w", "7w", "3h", "4h", "4i", "5i"]);

export async function getPracticePlannerContext(userId: string): Promise<PracticePlannerContext> {
  const [progressData, todayData, trainingData, speedData, scoring] = await Promise.all([
    getProgressData(userId),
    getTodayPracticeData().catch(() => null),
    getTrainingOverTimeData(userId, "1y").catch(() => null),
    getSpeedCoachCardData(userId).catch(() => null),
    getScoringContext(userId).catch(() => ({ weakestCategory: null, penaltyPattern: null })),
  ]);
  const progressSummary = buildProgressSummary(progressData.clubs);
  const bagClubs = progressData.clubs.map((club) => {
    const analytics = club.analytics;

    return {
      clubId: club.clubId,
      clubType: club.clubType,
      label: formatClubType(club.clubType),
      stockCarryYd: analytics.distance.stockCarryYd,
      trustIndex: analytics.consistency.clubTrustIndex,
      confidenceScore: analytics.consistency.confidenceScore,
      confidenceLabel: analytics.consistency.confidenceLabel,
      sampleSize: analytics.sample.stockShots,
      playableRate: analytics.accuracy.playableShotRate,
      offlineAverageYd: analytics.accuracy.absoluteOfflineAverageYd,
      bigMissRate: analytics.accuracy.bigMissRate,
      volatilityScore: volatilityScoreForClub(analytics),
      practiceTitle: analytics.practice.title,
      practiceDrill: analytics.practice.drill,
    } satisfies PracticePlannerClub;
  });
  const latestPractice = todayData
    ? latestPracticeContext(todayData.clubComparisons, {
        sessionId: todayData.filters.sessionId || todayData.sessions[0]?.id || null,
        dateLabel: todayData.dateLabel,
        straightRate: todayData.overall.today.straightRate,
        playableRate: todayData.overall.today.playableRate,
        offlineAverageYd: todayData.overall.today.offlineAverageYd,
      })
    : emptyLatestPractice();
  const trainingStatus = trainingData?.status ?? {
    key: "balanced" as TrainingStatusKey,
    label: "Good",
    advice: "A normal practice session should keep momentum.",
  };
  const recentLoad = Math.round(trainingData?.latest?.fatigue ?? 0);
  const golfForm = Math.round(trainingData?.latest?.form ?? 0);
  const highRecentLoad =
    recentLoad >= 120 ||
    trainingStatus.key === "load_high" ||
    trainingData?.trend.key === "acute_load_spike" ||
    trainingData?.trend.key === "overloaded";

  return {
    generatedAt: new Date().toISOString(),
    latestPractice,
    progress: {
      priorities: progressSummary.practicePlan,
      trustLadder: progressSummary.trustLadder,
      mostVolatile: progressSummary.rankings.mostVolatile?.clubType ?? null,
      weakestSignal: progressSummary.rankings.needsWork?.clubType ?? null,
      currentForm: progressSummary.rankings.currentForm?.clubType ?? null,
    },
    bag: {
      clubs: bagClubs,
      issues: bagIssues(progressSummary),
      wedgeMatrix: buildContextWedgeMatrix(progressData.clubs),
    },
    trainingLoad: {
      statusKey: trainingStatus.key,
      statusLabel: trainingStatus.label,
      advice: trainingStatus.advice,
      recentLoad,
      golfForm,
      recommendation: highRecentLoad
        ? "Technical practice only"
        : trainingStatus.key === "very_fresh"
          ? "Quality practice window"
          : "Technical practice recommended",
      highRecentLoad,
    },
    speed: {
      currentSpeedMph: speedData?.summary.currentSpeedMph ?? null,
      targetSpeedMph: speedData?.summary.targetSpeedMph ?? null,
      recommendation:
        speedData?.summary.prescription.recommendation ?? "Build speed baseline first.",
      priority: speedData?.summary.prescription.priority ?? "Medium",
    },
    scoring,
  };
}

export function buildPracticePriorityList(
  context: PracticePlannerContext,
  options: Partial<GeneratePracticePlanOptions> = {},
): PracticePriorityItem[] {
  const roadmapTypes = new Set(context.progress.priorities.map((priority) => priority.clubType));
  const latestOpportunity = context.latestPractice.biggestOpportunity;
  const latestBest = context.latestPractice.bestPerformer;
  const tired = options.energy === "tired" || options.energy === "niggle";
  const speedIntent = options.intent === "speed" || options.sessionType === "speed";
  const items = context.bag.clubs.map((club) => {
    const roadmap = roadmapTypes.has(club.clubType);
    const latestPenalty = latestOpportunity === club.clubType ? 18 : 0;
    const confidenceAdjustment =
      club.sampleSize < 5 && !roadmap
        ? -24
        : club.confidenceScore < 35 && !roadmap
          ? -16
          : club.confidenceScore >= 70
            ? 5
            : 0;
    const trustGap = Math.max(0, 100 - club.trustIndex) * 0.28;
    const weaknessScore =
      (club.bigMissRate ?? 0) * 0.45 +
      Math.max(0, (club.offlineAverageYd ?? 0) - offlineTarget(club.clubType)) * 0.9 +
      Math.max(0, 80 - (club.playableRate ?? 55)) * 0.18;
    const scoringImpact = WEDGE_TYPES.has(club.clubType)
      ? options.intent === "scoring"
        ? 18
        : 11
      : DRIVER_TYPES.has(club.clubType)
        ? options.intent === "round_preparation"
          ? 16
          : 10
        : LONG_GAME_TYPES.has(club.clubType)
          ? 12
          : 6;
    const roadmapPriority = roadmap
      ? Math.max(
          14,
          26 - context.progress.priorities.findIndex((p) => p.clubType === club.clubType) * 4,
        )
      : 0;
    const fatigueRisk =
      tired && (DRIVER_TYPES.has(club.clubType) || LONG_GAME_TYPES.has(club.clubType)) ? 9 : 0;
    const latestBestAdjustment =
      latestBest === club.clubType && options.intent !== "confidence" ? -8 : 0;
    const score = Math.round(
      weaknessScore +
        trustGap +
        latestPenalty +
        scoringImpact +
        roadmapPriority +
        confidenceAdjustment +
        latestBestAdjustment -
        fatigueRisk,
    );

    return {
      key: `club-${club.clubType}`,
      clubType: club.clubType,
      label: formatClubType(club.clubType),
      score: Math.max(0, score),
      certainty:
        club.sampleSize >= 12 ? "high" : club.sampleSize >= 5 || roadmap ? "medium" : "low",
      reason: priorityReason(club, roadmap, latestOpportunity === club.clubType),
      drill: club.practiceDrill,
      category: categoryForClub(club.clubType),
      roadmap,
    } satisfies PracticePriorityItem;
  });

  if (speedIntent) {
    items.push({
      key: "speed-driver",
      clubType: "driver",
      label: "Driver speed",
      score:
        context.trainingLoad.highRecentLoad && !options.facility?.overrideTrainingLoad ? 12 : 72,
      certainty: context.speed.currentSpeedMph ? "medium" : "low",
      reason: context.trainingLoad.highRecentLoad
        ? "Recent load says speed work should wait."
        : context.speed.recommendation,
      drill: "Short overspeed set with full rest, then driver transfer swings.",
      category: "speed",
      roadmap: false,
    });
  }

  return items
    .sort((left, right) => right.score - left.score || Number(right.roadmap) - Number(left.roadmap))
    .slice(0, 10);
}

export function generatePracticePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
): PracticePlan {
  const normalized = normalizeOptions(options, context);
  const priorities = buildPracticePriorityList(context, normalized);

  switch (normalized.sessionType) {
    case "range":
      return generateRangePracticePlan(context, normalized, priorities);
    case "short_game":
      return generateShortGamePracticePlan(context, normalized, priorities);
    case "speed":
      return generateSpeedPracticePlan(context, normalized, priorities);
    case "putting":
      return generatePuttingPracticePlan(context, normalized);
    case "course_warmup":
      return generateCourseWarmupPlan(context, normalized, priorities);
    case "mixed":
      return generateMixedPracticePlan(context, normalized, priorities);
  }
}

export function generateRangePracticePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
  priorities = buildPracticePriorityList(context, options),
): PracticePlan {
  const totalBalls = normalizeBallCount(options.ballCount ?? 80);
  const allocation = rangeAllocation(totalBalls);
  const main =
    selectPriority(priorities, (item) => item.category !== "speed") ?? fallbackPriority(context);
  const secondary =
    selectPriority(priorities, (item) => item.key !== main.key && item.category !== "speed") ??
    fallbackSecondary(context, main);
  const wedge =
    selectPriority(priorities, (item) => item.category === "wedge") ?? wedgeFallback(context);
  const driver =
    selectPriority(priorities, (item) => item.category === "driver") ?? driverFallback(context);
  const transferSequence = buildTransferSequence(
    [main, secondary, wedge, driver],
    allocation.transfer ?? 0,
  );
  const blocks: PracticeBlock[] = [];

  if (allocation.warmup) {
    blocks.push(
      block("warmup", "Warm-up", ["pw", "8i", "6i"], allocation.warmup, 8, {
        purpose: "Find rhythm and strike without chasing distance.",
        drill:
          "Build from half-speed wedges to stock mid-irons. Stop after each shot and call playable or not.",
        successTarget: `${Math.max(6, Math.round(allocation.warmup * 0.75))} of ${allocation.warmup} playable.`,
        recordPrompt: "Playable count and any strike pattern.",
        metric: "playable",
        target: Math.max(6, Math.round(allocation.warmup * 0.75)),
      }),
    );
  }

  if (allocation.baseline) {
    blocks.push(
      block(
        "baseline",
        "Baseline check",
        [main.clubType ?? "7i", wedge.clubType ?? "sw"],
        allocation.baseline,
        7,
        {
          purpose: "Check whether today matches the latest data before changing anything.",
          drill: "Alternate the main priority club and the scoring club. Normal stock swings only.",
          successTarget: `${Math.ceil(allocation.baseline * 0.6)} playable or inside carry target.`,
          recordPrompt: "Start line, carry miss, and whether the pattern matches the last import.",
          metric: "baseline",
          target: Math.ceil(allocation.baseline * 0.6),
        },
      ),
    );
  }

  blocks.push(priorityBlock(main, allocation.main, "Main priority"));

  if (allocation.secondary) {
    blocks.push(priorityBlock(secondary, allocation.secondary, "Secondary priority"));
  }

  if (allocation.scoring) {
    blocks.push(wedgeBlock(context, wedge, allocation.scoring));
  }

  if (allocation.maintenance && driver.clubType) {
    blocks.push(driverMaintenanceBlock(driver, allocation.maintenance));
  }

  if (allocation.transfer) {
    blocks.push(
      block("random", "Randomised scoring finish", transferSequence, allocation.transfer, 8, {
        purpose: "Transfer the range work into one-ball course decisions.",
        drill: `Random club every ball: ${transferSequence.map((club) => formatClubType(club)).join(", ")}.`,
        successTarget: `${Math.round(allocation.transfer * 1.35)}+ points from ${allocation.transfer * 2} possible.`,
        recordPrompt: "One point for playable, one bonus for target corridor.",
        metric: "points",
        target: Math.round(allocation.transfer * 1.35),
      }),
    );
  }

  return finalizePlan(context, options, {
    title: `Today's Range Plan`,
    summary: `${totalBalls}-ball range session built around ${main.label} and ${wedge.label}.`,
    totalBalls,
    focus: compactFocus([main, secondary, wedge, driver]),
    why: planWhy(context, main, secondary),
    blocks: resequence(blocks),
  });
}

export function comparePlanWithShotSummaries(
  plan: PracticePlan,
  sourceSessionId: string | null,
  summaries: Array<{
    clubType: string;
    shotCount: number;
    playableRate: number | null;
    offlineAverageYd: number | null;
    carryAverageYd: number | null;
  }>,
): PracticeComparison {
  const decisions = plan.blocks.map((block) => {
    const blockClubs = new Set(uniqueClubs(block.clubs));
    const clubSummaries = summaries.filter((summary) =>
      blockClubs.has(normalizeClubType(summary.clubType)),
    );
    const actualBalls = clubSummaries.reduce((total, summary) => total + summary.shotCount, 0);
    const clubSummary = aggregateBlockShotSummary(block, clubSummaries);
    const matchedPlannedVolume =
      block.ballCount === null ? actualBalls > 0 : actualBalls >= block.ballCount;
    const actual =
      actualBalls > 0
        ? `${actualBalls}/${block.ballCount ?? actualBalls} matching shots - ${formatRate(clubSummary?.playableRate ?? null)} playable - ${formatYards(clubSummary?.offlineAverageYd ?? null)} offline`
        : "No matching imported shots";
    const decision = blockDecision(block, clubSummary);
    const result = decisionToBlockResult(decision, actualBalls, matchedPlannedVolume);

    return {
      blockId: block.id,
      title: block.title,
      target: block.successTarget,
      actual,
      plannedBalls: block.ballCount,
      actualBalls,
      matchedPlannedVolume,
      result,
      confidence: "medium" as const,
      scoringMode: "aggregate" as const,
      linkedShotIds: [],
      metrics: {
        plannedBalls: block.ballCount,
        actualBalls,
        playableRate: clubSummary?.playableRate ?? null,
        offlineAverageYd: clubSummary?.offlineAverageYd ?? null,
        carryAverageYd: clubSummary?.carryAverageYd ?? null,
      },
      summary: blockResultSummary(block, result, actualBalls, "aggregate"),
      decision,
    };
  });

  return buildPracticeComparison(plan, sourceSessionId, "aggregate", null, decisions);
}

export function comparePlanWithShotRows(
  plan: PracticePlan,
  sourceSessionId: string | null,
  session: {
    shotCount: number;
    sessionType: string;
    dateLabel: string;
    clubTypes: string[];
    shotRows: ImportedPracticeShotRow[];
  },
  matchConfidence: number | null = null,
  options: { scoringMode?: PracticeBlockScoringMode } = {},
): PracticeComparison {
  const ordered =
    options.scoringMode === "aggregate" ? false : canUseOrderedBlockScoring(plan, session.shotRows);
  const decisions = ordered
    ? evaluateOrderedPracticeBlocks(plan, session.shotRows)
    : evaluateAggregatePracticeBlocks(plan, session.shotRows);

  return buildPracticeComparison(
    plan,
    sourceSessionId,
    ordered ? "ordered" : "aggregate",
    {
      shotCount: session.shotCount,
      sessionType: session.sessionType,
      dateLabel: session.dateLabel,
      clubTypes: session.clubTypes,
      matchConfidence,
    },
    decisions,
  );
}

function buildPracticeComparison(
  plan: PracticePlan,
  sourceSessionId: string | null,
  scoringMode: PracticeBlockScoringMode,
  importedSession: {
    shotCount: number;
    sessionType: string;
    dateLabel: string;
    clubTypes: string[];
    matchConfidence: number | null;
  } | null,
  decisions: PracticeComparison["decisions"],
): PracticeComparison {
  const passed = decisions.filter(
    (item) =>
      item.result === "passed" || item.decision === "maintain" || item.decision === "move_down",
  );
  const whatWorked = decisions
    .filter((item) => item.result === "passed")
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.summary}`);
  const needsWork = decisions
    .filter(
      (item) =>
        item.result === "mixed" || item.result === "failed" || item.result === "insufficient_data",
    )
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.summary}`);
  const nextBlock = decisions.find((item) => item.result !== "passed");
  const plannedClubs = uniqueClubs(plan.blocks.flatMap((block) => block.clubs));
  const actualClubs = importedSession?.clubTypes ?? [];

  return {
    sourceSessionId,
    scoringMode,
    matchConfidence: importedSession?.matchConfidence ?? null,
    importedSession: importedSession
      ? {
          shotCount: importedSession.shotCount,
          sessionType: importedSession.sessionType,
          dateLabel: importedSession.dateLabel,
          clubTypes: importedSession.clubTypes,
        }
      : null,
    planVsActual: {
      plannedBalls: plan.totalBalls,
      actualShots: importedSession?.shotCount ?? 0,
      plannedClubs,
      actualClubs,
    },
    whatWorked,
    needsWork,
    nextRecommendation: nextBlock
      ? `Repeat ${nextBlock.title.toLowerCase()} before moving it down the roadmap.`
      : "Move the next practice toward transfer scoring and maintenance.",
    summary:
      decisions.length === 0
        ? "No comparable plan blocks found."
        : `${passed.length}/${decisions.length} blocks met, maintained or moved on using ${scoringMode} scoring.`,
    decisions,
  };
}

function canUseOrderedBlockScoring(plan: PracticePlan, rows: ImportedPracticeShotRow[]) {
  if (rows.length === 0 || rows.some((row) => row.shotNumber === null)) {
    return false;
  }

  const plannedBalls =
    plan.totalBalls ??
    plan.blocks.reduce((total, blockItem) => total + (blockItem.ballCount ?? 0), 0);

  if (plannedBalls > 0 && rows.length < Math.ceil(plannedBalls * 0.65)) {
    return false;
  }

  return new Set(rows.map((row) => row.shotNumber)).size === rows.length;
}

function evaluateOrderedPracticeBlocks(
  plan: PracticePlan,
  rows: ImportedPracticeShotRow[],
): PracticeComparison["decisions"] {
  const orderedRows = [...rows].sort(
    (left, right) =>
      Number(left.shotNumber ?? 0) - Number(right.shotNumber ?? 0) ||
      left.shotAt.getTime() - right.shotAt.getTime(),
  );
  let cursor = 0;

  return plan.blocks.map((blockItem) => {
    const plannedBalls =
      blockItem.ballCount ?? Math.max(1, Math.round(rows.length / plan.blocks.length));
    const blockRows = orderedRows.slice(cursor, cursor + plannedBalls);
    cursor += plannedBalls;

    return evaluatePracticeBlockFromShots(blockItem, blockRows, "ordered");
  });
}

function evaluateAggregatePracticeBlocks(
  plan: PracticePlan,
  rows: ImportedPracticeShotRow[],
): PracticeComparison["decisions"] {
  return plan.blocks.map((blockItem) => {
    const blockClubs = new Set(uniqueClubs(blockItem.clubs));
    const blockRows =
      blockItem.clubs.length > 0 ? rows.filter((row) => blockClubs.has(row.clubType)) : rows;

    return evaluatePracticeBlockFromShots(blockItem, blockRows, "aggregate");
  });
}

function evaluatePracticeBlockFromShots(
  blockItem: PracticeBlock,
  rows: ImportedPracticeShotRow[],
  scoringMode: PracticeBlockScoringMode,
): PracticeComparison["decisions"][number] {
  const blockClubs = new Set(uniqueClubs(blockItem.clubs));
  const relevantRows =
    scoringMode === "ordered" && blockItem.clubs.length > 0
      ? rows.filter((row) => blockClubs.has(row.clubType))
      : rows;
  const actualBalls = relevantRows.length;
  const plannedBalls = blockItem.ballCount;
  const matchedPlannedVolume =
    plannedBalls === null ? actualBalls > 0 : actualBalls >= plannedBalls;
  const metrics = blockMetrics(blockItem, relevantRows);
  const result = evaluateBlockResult(blockItem, actualBalls, matchedPlannedVolume, metrics);
  const decision = blockDecisionFromResult(blockItem, result);
  const confidence = blockEvaluationConfidence(scoringMode, actualBalls, plannedBalls);
  const passLabel = blockMetricPassLabel(blockItem, metrics);
  const actual =
    actualBalls > 0
      ? `${passLabel} from ${actualBalls}/${plannedBalls ?? actualBalls} matching shots - ${formatRate(metrics.playableRate)} playable - ${formatYards(metrics.offlineAverageYd)} offline`
      : "No matching imported shots";

  return {
    blockId: blockItem.id,
    title: blockItem.title,
    target: blockItem.successTarget,
    actual,
    plannedBalls,
    actualBalls,
    matchedPlannedVolume,
    result,
    confidence,
    scoringMode,
    linkedShotIds: relevantRows.map((row) => row.id),
    metrics,
    summary: blockResultSummary(blockItem, result, actualBalls, scoringMode),
    decision,
  };
}

function blockMetrics(blockItem: PracticeBlock, rows: ImportedPracticeShotRow[]) {
  const actualBalls = rows.length;
  const playableRows = rows.filter(
    (row) => row.offlineYd !== null && Math.abs(row.offlineYd) <= 32,
  );
  const offlineRows = rows.filter((row) => row.offlineYd !== null);
  const launchRows = rows.filter((row) => row.launchDirectionDeg !== null);
  const corridorRows =
    launchRows.length > 0
      ? launchRows.filter((row) => Math.abs(Number(row.launchDirectionDeg)) <= 5)
      : offlineRows.filter((row) => Math.abs(Number(row.offlineYd)) <= 15);
  const pathRows = rows.filter((row) => row.clubPathDeg !== null);
  const pathWindowRows = pathRows.filter((row) => Math.abs(Number(row.clubPathDeg)) <= 5);
  const carryRows = rows.filter((row) => row.carryYd !== null);
  const bigMissRows = offlineRows.filter((row) => Math.abs(Number(row.offlineYd)) > 32);

  return {
    plannedBalls: blockItem.ballCount,
    actualBalls,
    playableCount: playableRows.length,
    playableRate:
      actualBalls > 0 && offlineRows.length > 0
        ? Math.round((playableRows.length / actualBalls) * 100)
        : null,
    corridorCount: corridorRows.length,
    corridorRate:
      actualBalls > 0 && (launchRows.length > 0 || offlineRows.length > 0)
        ? Math.round((corridorRows.length / actualBalls) * 100)
        : null,
    bigMisses: bigMissRows.length,
    offlineAverageYd:
      offlineRows.length > 0
        ? roundOne(
            offlineRows.reduce((total, row) => total + Math.abs(Number(row.offlineYd)), 0) /
              offlineRows.length,
          )
        : null,
    carryAverageYd:
      carryRows.length > 0
        ? roundOne(
            carryRows.reduce((total, row) => total + Number(row.carryYd), 0) / carryRows.length,
          )
        : null,
    pathWindowRate:
      pathRows.length > 0 ? Math.round((pathWindowRows.length / pathRows.length) * 100) : null,
  };
}

function blockMetricPassLabel(blockItem: PracticeBlock, metrics: ReturnType<typeof blockMetrics>) {
  const target = blockItem.scoringRules.target;

  switch (blockItem.scoringRules.metric) {
    case "corridor":
      return `${metrics.corridorCount}/${target} inside corridor`;
    case "baseline":
    case "playable":
      return `${metrics.playableCount}/${target} playable`;
    case "carry_ladder":
      return `${metrics.playableCount}/${target} playable carry-window shots`;
    case "points":
      return `${metrics.playableCount}/${target} playable points`;
    default:
      return `${Math.max(metrics.playableCount, metrics.corridorCount)}/${target} passes`;
  }
}

function evaluateBlockResult(
  blockItem: PracticeBlock,
  actualBalls: number,
  matchedPlannedVolume: boolean,
  metrics: ReturnType<typeof blockMetrics>,
): PracticeBlockEvaluationResult {
  if (actualBalls === 0) {
    return "insufficient_data";
  }

  const plannedBalls = blockItem.ballCount ?? actualBalls;
  const enoughSignal = actualBalls >= Math.ceil(plannedBalls * 0.65);

  if (!enoughSignal) {
    return "insufficient_data";
  }

  const target = blockItem.scoringRules.target;
  const maxBigMisses =
    blockItem.scoringRules.maxBigMisses ?? Math.max(1, Math.floor(plannedBalls * 0.18));
  const metric = blockItem.scoringRules.metric;
  const metricPassed =
    metric === "corridor"
      ? metrics.corridorCount >= target && metrics.bigMisses <= maxBigMisses
      : metric === "playable" || metric === "baseline"
        ? metrics.playableCount >= target || (metrics.playableRate ?? 0) >= 70
        : metric === "carry_ladder"
          ? (metrics.playableRate ?? 0) >= 65 && (metrics.offlineAverageYd ?? 99) <= 20
          : (metrics.playableRate ?? 0) >= 65 || metrics.corridorCount >= target;

  if (matchedPlannedVolume && metricPassed) {
    return "passed";
  }

  if (
    metricPassed ||
    (metrics.playableRate ?? 0) >= 60 ||
    metrics.corridorCount >= Math.ceil(target * 0.75)
  ) {
    return "mixed";
  }

  return "failed";
}

function blockDecisionFromResult(
  blockItem: PracticeBlock,
  result: PracticeBlockEvaluationResult,
): PracticeComparison["decisions"][number]["decision"] {
  if (result === "passed") {
    return blockItem.type === "technical" ? "move_down" : "maintain";
  }

  if (result === "mixed") {
    return "repeat_once";
  }

  return "keep_priority";
}

function decisionToBlockResult(
  decision: PracticeComparison["decisions"][number]["decision"],
  actualBalls: number,
  matchedPlannedVolume: boolean,
): PracticeBlockEvaluationResult {
  if (actualBalls === 0) {
    return "insufficient_data";
  }

  if ((decision === "maintain" || decision === "move_down") && matchedPlannedVolume) {
    return "passed";
  }

  if (decision === "repeat_once" || decision === "maintain" || decision === "move_down") {
    return "mixed";
  }

  return "failed";
}

function blockEvaluationConfidence(
  scoringMode: PracticeBlockScoringMode,
  actualBalls: number,
  plannedBalls: number | null,
): PracticeBlockEvaluationConfidence {
  if (actualBalls === 0) {
    return "low";
  }

  if (scoringMode === "ordered" && (plannedBalls === null || actualBalls >= plannedBalls)) {
    return "high";
  }

  return actualBalls >= Math.ceil((plannedBalls ?? actualBalls) * 0.65) ? "medium" : "low";
}

function blockResultSummary(
  blockItem: PracticeBlock,
  result: PracticeBlockEvaluationResult,
  actualBalls: number,
  scoringMode: PracticeBlockScoringMode,
) {
  if (actualBalls === 0) {
    return "No matching uploaded shots found.";
  }

  if (result === "passed") {
    return scoringMode === "ordered"
      ? "Block target passed from the planned shot window."
      : "Club-group data met the target with medium confidence.";
  }

  if (result === "mixed") {
    return "Useful signal, but this block should be repeated once.";
  }

  if (result === "failed") {
    return `${formatClubType(blockItem.clubs[0] ?? "club")} did not meet the planned target.`;
  }

  return `${actualBalls} matching shots found, but not enough to complete this planned block.`;
}

export async function comparePracticePlanToImport(
  userId: string,
  plan: PracticePlan,
  sourceSessionId: string | null,
): Promise<PracticeComparison> {
  if (!sourceSessionId) {
    return comparePlanWithShotSummaries(plan, null, []);
  }

  const sessionSummary = await getImportedPracticeSessionSummary(userId, sourceSessionId);

  if (!sessionSummary) {
    return comparePlanWithShotSummaries(plan, sourceSessionId, []);
  }

  return comparePlanWithShotRows(plan, sourceSessionId, {
    shotCount: sessionSummary.shotCount,
    sessionType: sessionSummary.sessionType,
    dateLabel: sessionSummary.sessionDate.toISOString().slice(0, 10),
    clubTypes: sessionSummary.clubTypes,
    shotRows: sessionSummary.shotRows,
  });
}

export function evaluatePracticePlanAgainstImportedSession(
  plan: PracticePlan,
  sessionSummary: ImportedPracticeSessionSummary,
  matchConfidence: number | null = null,
  options: { scoringMode?: PracticeBlockScoringMode } = {},
) {
  const comparison = comparePlanWithShotRows(
    plan,
    sessionSummary.id,
    {
      shotCount: sessionSummary.shotCount,
      sessionType: sessionSummary.sessionType,
      dateLabel: sessionSummary.sessionDate.toISOString().slice(0, 10),
      clubTypes: sessionSummary.clubTypes,
      shotRows: sessionSummary.shotRows,
    },
    matchConfidence,
    options,
  );
  const resultInput = buildPracticeResultFromImport(plan, sessionSummary, comparison);
  const score = scoreCompletedPractice(plan, resultInput, comparison);

  return { comparison, score, resultInput };
}

export async function getLatestPracticeSessionReview(
  userId: string,
  plan: PracticePlan,
): Promise<PracticeLatestSessionReview | null> {
  const sessionSummary = await getLatestImportedPracticeSessionSummary(userId);

  if (!sessionSummary || sessionSummary.shotCount <= 0) {
    return null;
  }

  const matchPlan = transientSavedPlanForMatch(plan);

  if (!canImportedSessionReviewPracticePlan(matchPlan, sessionSummary)) {
    return null;
  }

  const match = scorePracticePlanSessionMatch(matchPlan, sessionSummary);
  const partialEvidence = hasPartialPracticeEvidence(matchPlan, sessionSummary);

  if (!partialEvidence && match.score < 35) {
    return null;
  }

  const { comparison, score } = evaluatePracticePlanAgainstImportedSession(
    plan,
    sessionSummary,
    match.score,
    { scoringMode: "aggregate" },
  );

  return {
    sourceSessionId: sessionSummary.id,
    comparison,
    score,
    matchScore: match.score,
    matchReason: match.reason,
    partialEvidence,
    importedSession: {
      shotCount: sessionSummary.shotCount,
      sessionType: sessionSummary.sessionType,
      sourceType: sessionSummary.sourceType,
      dateLabel: sessionSummary.sessionDate.toISOString().slice(0, 10),
      clubTypes: sessionSummary.clubTypes,
    },
  };
}

export function scoreCompletedPractice(
  plan: PracticePlan,
  result: PracticeResultInput,
  comparison: PracticeComparison = comparePlanWithShotSummaries(
    plan,
    result.sourceSessionId ?? null,
    [],
  ),
): PracticeScore {
  const plannedBalls =
    plan.totalBalls ?? plan.blocks.reduce((total, item) => total + (item.ballCount ?? 0), 0);
  const actualBalls =
    result.actualBalls ??
    result.blockResults.reduce((total, item) => total + (item.actualBalls ?? 0), 0);
  const completedBlocks = result.blockResults.filter(
    (item) => item.completionStatus === "complete",
  ).length;
  const blockCompletion = plan.blocks.length > 0 ? completedBlocks / plan.blocks.length : 0;
  const ballCompletion =
    plannedBalls > 0 ? Math.min(1, actualBalls / plannedBalls) : blockCompletion;
  const passedRate =
    result.blockResults.length > 0
      ? result.blockResults.filter((item) => item.passed || (item.score ?? 0) >= 70).length /
        result.blockResults.length
      : 0;
  const comparisonRate =
    comparison.decisions.length > 0
      ? comparison.decisions.filter(
          (item) => item.decision === "maintain" || item.decision === "move_down",
        ).length / comparison.decisions.length
      : passedRate;
  const completionPercent = Math.round(((blockCompletion + ballCompletion) / 2) * 100);
  const score = clamp(
    Math.round(completionPercent * 0.4 + passedRate * 35 + comparisonRate * 25),
    0,
    100,
  );
  const mainPriority =
    comparison.decisions[0]?.decision === "maintain" || passedRate >= 0.75
      ? "improved"
      : score >= 55
        ? "mixed"
        : "missed";
  const transferBlock = plan.blocks.find(
    (blockItem) => blockItem.type === "random" || blockItem.type === "test",
  );
  const transferResult = transferBlock
    ? result.blockResults.find((item) => item.blockId === transferBlock.id)
    : null;
  const transfer = transferResult?.passed
    ? "strong"
    : (transferResult?.score ?? 0) >= 50
      ? "mixed"
      : "missed";

  return {
    score,
    completionPercent,
    verdict:
      score >= 80
        ? "Practice landed"
        : score >= 60
          ? "Useful, repeat the weak block"
          : "Incomplete signal",
    nextAction:
      mainPriority === "improved"
        ? "Maintain the main priority and move the next plan toward transfer scoring."
        : "Repeat the main priority once before changing the focus.",
    mainPriority,
    transfer,
  };
}

export function adaptPracticePlanAfterBlock(
  plan: PracticePlan,
  blockResult: PracticeBlockResultInput,
): PracticePlan {
  const blockIndex = plan.blocks.findIndex((blockItem) => blockItem.id === blockResult.blockId);

  if (blockIndex < 0 || blockResult.passed || (blockResult.score ?? 0) >= 70) {
    return plan;
  }

  const nextBlocks = plan.blocks.map((blockItem, index) => {
    if (index <= blockIndex || blockItem.type === "warmup" || blockItem.type === "baseline") {
      return blockItem;
    }

    if (index === blockIndex + 1) {
      return {
        ...blockItem,
        title: `Repeat feel: ${blockItem.title}`,
        purpose: `${blockItem.purpose} Keep the previous block's miss pattern in view.`,
        drill: `${blockItem.drill} Start with two rehearsals and reduce target size only after three playable shots.`,
      };
    }

    return blockItem;
  });

  return {
    ...plan,
    blocks: nextBlocks,
    summary: `${plan.summary} Adaptive note: the next block has been softened because the previous target was missed.`,
  };
}

export async function savePracticePlanForUser(userId: string, plan: PracticePlan) {
  const now = new Date();
  const db = getDb();
  const [insertedPlan] = await db
    .insert(practicePlans)
    .values({
      userId,
      sessionType: plan.sessionType,
      ballCount: plan.totalBalls,
      timeMinutes: plan.estimatedTimeMinutes,
      energyLevel: plan.energy,
      intent: plan.intent,
      facilityJson: { generation: plan.generation },
      contextJson: plannerContextSnapshot(plan.sourceContext),
      focusClubsJson: plan.focusClubs,
      title: plan.title,
      generatedSummary: plan.summary,
      status: "planned",
      plannedAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(practiceBlocks).values(
    plan.blocks.map((blockItem) => ({
      practicePlanId: insertedPlan.id,
      userId,
      blockOrder: blockItem.order,
      blockType: blockItem.type,
      title: blockItem.title,
      clubsJson: blockItem.clubs,
      ballCount: blockItem.ballCount,
      timeMinutes: blockItem.timeMinutes,
      goal: blockItem.purpose,
      drill: blockItem.drill,
      successCriteria: blockItem.successTarget,
      recordPrompt: blockItem.recordPrompt,
      scoringRulesJson: blockItem.scoringRules,
    })),
  );
  await awardPracticePlannerAchievements(userId, "created");

  return insertedPlan.id;
}

export async function updatePracticePlanStatusForUser(
  userId: string,
  planId: string,
  status: Extract<PracticePlanStatus, "awaiting_import" | "abandoned">,
) {
  const now = new Date();

  await getDb()
    .update(practicePlans)
    .set({
      status,
      startedAt: status === "awaiting_import" ? now : undefined,
      completedAt: status === "abandoned" ? now : undefined,
      updatedAt: now,
    })
    .where(and(eq(practicePlans.id, planId), eq(practicePlans.userId, userId)));
}

export async function completePracticePlanForUser(
  userId: string,
  planId: string,
  input: PracticeResultInput,
) {
  const saved = await getSavedPracticePlan(userId, planId);

  if (!saved) {
    throw new Error("Practice plan not found");
  }

  const plan = savedPlanToPracticePlan(saved);
  const comparison = await comparePracticePlanToImport(userId, plan, input.sourceSessionId ?? null);

  return persistCompletedPracticePlan(userId, saved, plan, input, comparison);
}

export async function completeMatchingPracticePlanFromImport(
  userId: string,
  sourceSessionId: string,
): Promise<PracticePlanImportMatch | null> {
  const sessionSummary = await getImportedPracticeSessionSummary(userId, sourceSessionId);

  if (!sessionSummary || sessionSummary.shotCount <= 0) {
    return null;
  }

  const candidates = (await getSavedPracticePlans(userId, 20)).filter(
    (plan) =>
      (plan.status === "planned" ||
        plan.status === "awaiting_import" ||
        plan.status === "match_found" ||
        plan.status === "active") &&
      !plan.sourceSessionId &&
      plan.blocks.length > 0 &&
      canImportedSessionReviewPracticePlan(plan, sessionSummary),
  );

  if (candidates.length === 0) {
    return null;
  }

  const matched = candidates
    .map((candidate) => ({
      plan: candidate,
      match: scorePracticePlanSessionMatch(candidate, sessionSummary),
    }))
    .sort(
      (left, right) =>
        right.match.score - left.match.score ||
        Date.parse(right.plan.plannedAt) - Date.parse(left.plan.plannedAt),
    )[0];

  const partialPracticeEvidence = matched
    ? hasPartialPracticeEvidence(matched.plan, sessionSummary)
    : false;

  if (!matched || (matched.match.score < 60 && !partialPracticeEvidence)) {
    return null;
  }

  await recordPracticePlanMatch(userId, matched.plan, sessionSummary, matched.match, false);

  if (!shouldAutoLinkPracticePlanMatch(matched.match.score, partialPracticeEvidence)) {
    await getDb()
      .update(practicePlans)
      .set({
        status: "match_found",
        matchConfidence: matched.match.score,
        matchReason: matched.match.reason,
        updatedAt: new Date(),
      })
      .where(and(eq(practicePlans.id, matched.plan.id), eq(practicePlans.userId, userId)));

    return null;
  }

  const plan = savedPlanToPracticePlan(matched.plan);
  const comparison = comparePlanWithShotRows(
    plan,
    sourceSessionId,
    {
      shotCount: sessionSummary.shotCount,
      sessionType: sessionSummary.sessionType,
      dateLabel: sessionSummary.sessionDate.toISOString().slice(0, 10),
      clubTypes: sessionSummary.clubTypes,
      shotRows: sessionSummary.shotRows,
    },
    matched.match.score,
  );
  const input = buildPracticeResultFromImport(plan, sessionSummary, comparison);
  const { score } = await persistCompletedPracticePlan(
    userId,
    matched.plan,
    plan,
    input,
    comparison,
    matched.match,
  );
  await recordPracticePlanMatch(userId, matched.plan, sessionSummary, matched.match, true);

  return {
    planId: matched.plan.id,
    title: matched.plan.title,
    score,
    comparison,
    matchScore: matched.match.score,
    matchConfidence:
      matched.match.score >= 75 ? "high" : matched.match.score >= 60 ? "medium" : "low",
    matchReason: matched.match.reason,
    matchBreakdown: matched.match.breakdown,
    importedSession: {
      shotCount: sessionSummary.shotCount,
      sessionType: sessionSummary.sessionType,
      dateLabel: sessionSummary.sessionDate.toISOString().slice(0, 10),
    },
  };
}

export async function completePracticePlanFromSelectedImport(
  userId: string,
  planId: string,
  sourceSessionId: string,
): Promise<PracticeLatestSessionReview | null> {
  const [saved, sessionSummary] = await Promise.all([
    getSavedPracticePlan(userId, planId),
    getImportedPracticeSessionSummary(userId, sourceSessionId),
  ]);

  if (!saved || !sessionSummary || sessionSummary.shotCount <= 0) {
    return null;
  }

  const match = scorePracticePlanSessionMatch(saved, sessionSummary);
  const partialEvidence = hasPartialPracticeEvidence(saved, sessionSummary);
  const plan = savedPlanToPracticePlan(saved);
  const { comparison, score, resultInput } = evaluatePracticePlanAgainstImportedSession(
    plan,
    sessionSummary,
    match.score,
    { scoringMode: "aggregate" },
  );

  await persistCompletedPracticePlan(userId, saved, plan, resultInput, comparison, match);
  await recordPracticePlanMatch(userId, saved, sessionSummary, match, true);

  return {
    sourceSessionId: sessionSummary.id,
    comparison,
    score,
    matchScore: match.score,
    matchReason: match.reason,
    partialEvidence,
    importedSession: {
      shotCount: sessionSummary.shotCount,
      sessionType: sessionSummary.sessionType,
      sourceType: sessionSummary.sourceType,
      dateLabel: sessionSummary.sessionDate.toISOString().slice(0, 10),
      clubTypes: sessionSummary.clubTypes,
    },
  };
}

async function persistCompletedPracticePlan(
  userId: string,
  saved: SavedPracticePlan,
  plan: PracticePlan,
  input: PracticeResultInput,
  comparison: PracticeComparison,
  match?: PracticePlanMatchScore,
) {
  const score = scoreCompletedPractice(plan, input, comparison);
  const now = new Date();
  const db = getDb();
  const [result] = await db
    .insert(practiceResults)
    .values({
      practicePlanId: saved.id,
      userId,
      sourceSessionId: input.sourceSessionId ?? null,
      completionStatus: input.completionStatus,
      actualBalls: input.actualBalls ?? null,
      actualMinutes: input.actualMinutes ?? null,
      practiceScore: score.score,
      verdict: score.verdict,
      nextAction: score.nextAction,
      notes: input.notes ?? null,
      comparisonJson: comparison,
    })
    .onConflictDoUpdate({
      target: practiceResults.practicePlanId,
      set: {
        sourceSessionId: input.sourceSessionId ?? null,
        completionStatus: input.completionStatus,
        actualBalls: input.actualBalls ?? null,
        actualMinutes: input.actualMinutes ?? null,
        practiceScore: score.score,
        verdict: score.verdict,
        nextAction: score.nextAction,
        notes: input.notes ?? null,
        comparisonJson: comparison,
        createdAt: now,
      },
    })
    .returning();

  await db.delete(practiceBlockResults).where(eq(practiceBlockResults.practiceResultId, result.id));

  if (input.blockResults.length > 0) {
    const blockIdByOrderId = new Map(
      saved.blocks.map((blockItem) => [blockItem.id, blockItem.dbId]),
    );
    await db.insert(practiceBlockResults).values(
      input.blockResults
        .map((blockResult) => {
          const dbBlockId = blockIdByOrderId.get(blockResult.blockId);

          if (!dbBlockId) {
            return null;
          }

          return {
            practiceResultId: result.id,
            practiceBlockId: dbBlockId,
            userId,
            completionStatus: blockResult.completionStatus,
            actualBalls: blockResult.actualBalls ?? null,
            actualMinutes: blockResult.actualMinutes ?? null,
            score: blockResult.score ?? null,
            passed: blockResult.passed ?? false,
            result: blockResult.result ?? "insufficient_data",
            summary: blockResult.summary ?? null,
            linkedShotIdsJson: blockResult.linkedShotIds ?? [],
            metricsJson: blockResult.metrics ?? {},
            notes: blockResult.notes ?? null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    );
  }

  await db
    .update(practicePlans)
    .set({
      status: input.completionStatus === "missed" ? "abandoned" : "analysed",
      practiceScore: score.score,
      matchConfidence: match?.score ?? comparison.matchConfidence ?? null,
      matchReason: match?.reason ?? null,
      sourceSessionId: input.sourceSessionId ?? null,
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(practicePlans.id, saved.id), eq(practicePlans.userId, userId)));
  await awardPracticePlannerAchievements(userId, "completed", score, {
    blockResults: input.blockResults,
    comparison,
    planBlockCount: plan.blocks.length,
    sourceSessionId: input.sourceSessionId ?? comparison.sourceSessionId,
  });

  return { score, comparison };
}

async function recordPracticePlanMatch(
  userId: string,
  plan: SavedPracticePlan,
  session: ImportedPracticeSessionSummary,
  match: PracticePlanMatchScore,
  accepted: boolean,
) {
  await getDb()
    .insert(practicePlanMatches)
    .values({
      practicePlanId: plan.id,
      userId,
      sessionId: session.id,
      matchConfidence: match.score,
      matchReason: match.reason,
      dateScore: match.breakdown.dateScore,
      sessionTypeScore: match.breakdown.sessionTypeScore,
      ballCountScore: match.breakdown.ballCountScore,
      focusClubScore: match.breakdown.focusClubScore,
      clubMixScore: match.breakdown.clubMixScore,
      sourceTypeScore: match.breakdown.sourceTypeScore,
      accepted,
    })
    .onConflictDoUpdate({
      target: [practicePlanMatches.practicePlanId, practicePlanMatches.sessionId],
      set: {
        matchConfidence: match.score,
        matchReason: match.reason,
        dateScore: match.breakdown.dateScore,
        sessionTypeScore: match.breakdown.sessionTypeScore,
        ballCountScore: match.breakdown.ballCountScore,
        focusClubScore: match.breakdown.focusClubScore,
        clubMixScore: match.breakdown.clubMixScore,
        sourceTypeScore: match.breakdown.sourceTypeScore,
        accepted,
      },
    });
}

export async function getPracticePlannerPageData(userId: string) {
  const [context, savedPlans, templates, importOptions] = await Promise.all([
    getPracticePlannerContext(userId),
    getSavedPracticePlans(userId),
    getPracticeTemplates(userId),
    getPracticeImportOptions(userId),
  ]);

  return { context, savedPlans, templates, importOptions };
}

export async function getSavedPracticePlans(
  userId: string,
  limit = 8,
): Promise<SavedPracticePlan[]> {
  const rows = await getDb()
    .select({
      plan: practicePlans,
      result: practiceResults,
    })
    .from(practicePlans)
    .leftJoin(practiceResults, eq(practiceResults.practicePlanId, practicePlans.id))
    .where(eq(practicePlans.userId, userId))
    .orderBy(desc(practicePlans.createdAt))
    .limit(limit);
  const planIds = rows.map((row) => row.plan.id);
  const blockRows =
    planIds.length > 0
      ? await getDb()
          .select()
          .from(practiceBlocks)
          .where(inArray(practiceBlocks.practicePlanId, planIds))
          .orderBy(practiceBlocks.blockOrder)
      : [];

  return rows.map(({ plan, result }) => {
    const blocks = blockRows
      .filter((blockRow) => blockRow.practicePlanId === plan.id)
      .map(dbBlockToView);

    return {
      id: plan.id,
      title: plan.title,
      sessionType: plan.sessionType as PracticeSessionType,
      status: plan.status as PracticePlanStatus,
      totalBalls: plan.ballCount,
      timeMinutes: plan.timeMinutes,
      focusClubs: plan.focusClubsJson,
      plannedAt: plan.plannedAt.toISOString(),
      completedAt: plan.completedAt?.toISOString() ?? null,
      score: plan.practiceScore,
      matchConfidence: plan.matchConfidence,
      matchReason: plan.matchReason,
      summary: plan.generatedSummary,
      generation: parsePlanGeneration(plan.facilityJson.generation),
      sourceSessionId: plan.sourceSessionId,
      blocks,
      result: result
        ? {
            verdict: result.verdict,
            nextAction: result.nextAction,
            practiceScore: result.practiceScore,
            comparison: parsePracticeComparison(result.comparisonJson),
          }
        : null,
    };
  });
}

export async function getSavedPracticePlan(userId: string, planId: string) {
  const plans = await getSavedPracticePlans(userId, 25);
  return plans.find((plan) => plan.id === planId) ?? null;
}

export async function getPracticeImportOptions(
  userId: string,
  limit = 12,
): Promise<PracticeImportOption[]> {
  const rows = await getDb()
    .select({
      id: sessions.id,
      fileName: sessions.fileName,
      courseName: sessions.courseName,
      sessionType: sessions.type,
      sessionDate: sessions.date,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(sessions)
    .innerJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(eq(sessions.userId, userId))
    .groupBy(sessions.id, sessions.fileName, sessions.courseName, sessions.type, sessions.date)
    .orderBy(desc(sessions.date))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    label: row.fileName || row.courseName || `${formatSessionType(row.sessionType)} session`,
    sessionType: row.sessionType,
    dateLabel: row.sessionDate.toISOString().slice(0, 10),
    shotCount: Number(row.shotCount ?? 0),
  }));
}

export async function getPracticeTemplates(userId: string): Promise<PracticeTemplateView[]> {
  const userRows = await getDb()
    .select()
    .from(practiceTemplates)
    .where(and(eq(practiceTemplates.userId, userId), eq(practiceTemplates.active, true)))
    .orderBy(desc(practiceTemplates.updatedAt))
    .limit(8)
    .catch(() => []);

  return [
    ...userRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? "Saved custom practice template.",
      sessionType: row.sessionType as PracticeSessionType,
      ballCount: asNumber(row.inputsJson.ballCount),
      timeMinutes: asNumber(row.inputsJson.timeMinutes) ?? 45,
      intent: parseIntent(String(row.inputsJson.intent ?? "latest_weakness")),
    })),
    ...STATIC_PRACTICE_TEMPLATES,
  ];
}

export async function getCurrentPracticePlanSummary(userId: string) {
  const [plan] = await getSavedPracticePlans(userId, 1);
  return plan ?? null;
}

export async function getPracticePlannerProgressSummary(userId: string) {
  const rows = await getDb()
    .select({
      id: practicePlans.id,
      title: practicePlans.title,
      status: practicePlans.status,
      focusClubsJson: practicePlans.focusClubsJson,
      practiceScore: practicePlans.practiceScore,
      completedAt: practicePlans.completedAt,
      timeMinutes: practicePlans.timeMinutes,
      ballCount: practicePlans.ballCount,
    })
    .from(practicePlans)
    .where(eq(practicePlans.userId, userId))
    .orderBy(desc(practicePlans.completedAt), desc(practicePlans.createdAt))
    .limit(80);
  const completed = rows.filter((row) => row.status === "analysed" || row.status === "completed");
  const planned = rows.filter(
    (row) =>
      row.status === "planned" ||
      row.status === "awaiting_import" ||
      row.status === "match_found" ||
      row.status === "active",
  );
  const focusCounts = new Map<string, number>();

  for (const row of completed) {
    for (const focus of row.focusClubsJson) {
      focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
    }
  }

  const topFocus = [...focusCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
  const latestCompleted = completed[0] ?? null;

  return {
    plannedCount: planned.length,
    completedCount: completed.length,
    averageScore:
      completed.length > 0
        ? Math.round(
            completed.reduce((total, row) => total + (row.practiceScore ?? 0), 0) /
              completed.length,
          )
        : null,
    topFocus: topFocus ? { label: topFocus[0], completedCount: topFocus[1] } : null,
    latestCompleted: latestCompleted
      ? {
          id: latestCompleted.id,
          title: latestCompleted.title,
          score: latestCompleted.practiceScore,
          completedAt: latestCompleted.completedAt?.toISOString() ?? null,
          timeMinutes: latestCompleted.timeMinutes,
          ballCount: latestCompleted.ballCount,
        }
      : null,
  };
}

export async function getPracticePlanForSourceSessions(userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return null;
  }

  const rows = await getDb()
    .select({
      plan: practicePlans,
      result: practiceResults,
    })
    .from(practicePlans)
    .leftJoin(practiceResults, eq(practiceResults.practicePlanId, practicePlans.id))
    .where(
      and(eq(practicePlans.userId, userId), inArray(practicePlans.sourceSessionId, sessionIds)),
    )
    .orderBy(desc(practicePlans.completedAt))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return null;
  }

  const comparison = row.result ? parsePracticeComparison(row.result.comparisonJson) : null;
  const decisions = comparison?.decisions ?? [];
  const passedBlocks = decisions.filter(
    (decision) =>
      decision.result === "passed" ||
      decision.decision === "maintain" ||
      decision.decision === "move_down",
  ).length;
  const mixedBlocks = decisions.filter((decision) => decision.result === "mixed").length;
  const incompleteBlocks = decisions.filter(
    (decision) => decision.result === "failed" || decision.result === "insufficient_data",
  ).length;

  return {
    id: row.plan.id,
    title: row.plan.title,
    score: row.plan.practiceScore,
    verdict: row.result?.verdict ?? "Plan followed",
    href: "/practice",
    comparisonSummary: comparison?.summary ?? null,
    totalBlocks: decisions.length,
    passedBlocks,
    mixedBlocks,
    incompleteBlocks,
  };
}

export async function getPracticePlanReviewForSourceSession(
  userId: string,
  sourceSessionId: string,
) {
  const rows = await getDb()
    .select({
      plan: practicePlans,
      result: practiceResults,
    })
    .from(practicePlans)
    .innerJoin(practiceResults, eq(practiceResults.practicePlanId, practicePlans.id))
    .where(
      and(
        eq(practicePlans.userId, userId),
        eq(practicePlans.sourceSessionId, sourceSessionId),
        eq(practiceResults.sourceSessionId, sourceSessionId),
      ),
    )
    .orderBy(desc(practiceResults.createdAt))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    planId: row.plan.id,
    title: row.plan.title,
    score: row.result.practiceScore,
    verdict: row.result.verdict,
    nextAction: row.result.nextAction,
    comparison: parsePracticeComparison(row.result.comparisonJson),
  };
}

async function getImportedPracticeSessionSummary(
  userId: string,
  sourceSessionId: string,
): Promise<ImportedPracticeSessionSummary | null> {
  const [session] = await getDb()
    .select({
      id: sessions.id,
      sourceType: sessions.source,
      sessionType: sessions.type,
      sessionDate: sessions.date,
      uploadedAt: sessions.createdAt,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(sessions)
    .innerJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(and(eq(sessions.id, sourceSessionId), eq(sessions.userId, userId)))
    .groupBy(sessions.id, sessions.source, sessions.type, sessions.date, sessions.createdAt)
    .limit(1);

  if (!session) {
    return null;
  }

  const shotRows = await getDb()
    .select({
      id: shots.id,
      clubType: shots.clubType,
      shotNumber: shots.shotNumber,
      shotAt: shots.shotAt,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      offlineYd: shots.sideCarryYd,
      launchDirectionDeg: shots.launchDirectionDeg,
      clubPathDeg: shots.clubPathDeg,
      faceAngleDeg: shots.faceAngleDeg,
      ballSpeedMph: shots.ballSpeedMph,
      clubSpeedMph: shots.clubSpeedMph,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sourceSessionId), eq(shots.userId, userId)))
    .orderBy(shots.shotNumber, shots.shotAt);
  const normalizedShotRows = shotRows.map((row) => ({
    id: row.id,
    clubType: normalizeClubType(row.clubType),
    shotNumber: row.shotNumber,
    shotAt: row.shotAt,
    carryYd: row.carryYd === null ? null : roundOne(Number(row.carryYd)),
    totalYd: row.totalYd === null ? null : roundOne(Number(row.totalYd)),
    offlineYd: row.offlineYd === null ? null : roundOne(Number(row.offlineYd)),
    launchDirectionDeg:
      row.launchDirectionDeg === null ? null : roundOne(Number(row.launchDirectionDeg)),
    clubPathDeg: row.clubPathDeg === null ? null : roundOne(Number(row.clubPathDeg)),
    faceAngleDeg: row.faceAngleDeg === null ? null : roundOne(Number(row.faceAngleDeg)),
    ballSpeedMph: row.ballSpeedMph === null ? null : roundOne(Number(row.ballSpeedMph)),
    clubSpeedMph: row.clubSpeedMph === null ? null : roundOne(Number(row.clubSpeedMph)),
  }));

  return {
    id: session.id,
    sourceType: session.sourceType,
    sessionType: session.sessionType,
    sessionDate: session.sessionDate,
    uploadedAt: session.uploadedAt,
    shotCount: Number(session.shotCount ?? 0),
    clubTypes: uniqueClubs(normalizedShotRows.map((row) => row.clubType)),
    clubSummaries: summarizeImportedPracticeShotRows(normalizedShotRows),
    shotRows: normalizedShotRows,
  };
}

function summarizeImportedPracticeShotRows(
  rows: ImportedPracticeShotRow[],
): ImportedPracticeSessionSummary["clubSummaries"] {
  const rowsByClub = new Map<string, ImportedPracticeShotRow[]>();

  for (const row of rows) {
    const clubRows = rowsByClub.get(row.clubType) ?? [];
    clubRows.push(row);
    rowsByClub.set(row.clubType, clubRows);
  }

  return [...rowsByClub.entries()].map(([clubType, clubRows]) => {
    const offlineRows = clubRows.filter((row) => row.offlineYd !== null);
    const playableRows = offlineRows.filter((row) => Math.abs(Number(row.offlineYd)) <= 32);
    const carryRows = clubRows.filter((row) => row.carryYd !== null);

    return {
      clubType,
      shotCount: clubRows.length,
      playableRate:
        clubRows.length > 0 && offlineRows.length > 0
          ? Math.round((playableRows.length / clubRows.length) * 100)
          : null,
      offlineAverageYd:
        offlineRows.length > 0
          ? roundOne(
              offlineRows.reduce((total, row) => total + Math.abs(Number(row.offlineYd)), 0) /
                offlineRows.length,
            )
          : null,
      carryAverageYd:
        carryRows.length > 0
          ? roundOne(
              carryRows.reduce((total, row) => total + Number(row.carryYd), 0) / carryRows.length,
            )
          : null,
    };
  });
}

async function getLatestImportedPracticeSessionSummary(
  userId: string,
): Promise<ImportedPracticeSessionSummary | null> {
  const [latest] = await getDb()
    .select({
      id: sessions.id,
    })
    .from(sessions)
    .innerJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.date), desc(sessions.createdAt))
    .limit(1);

  if (!latest) {
    return null;
  }

  return getImportedPracticeSessionSummary(userId, latest.id);
}

function generateShortGamePracticePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
  priorities: PracticePriorityItem[],
): PracticePlan {
  const minutes = options.timeMinutes;
  const wedge =
    selectPriority(priorities, (item) => item.category === "wedge") ?? wedgeFallback(context);
  const hasBunker = options.facility?.bunker !== false;
  const blocks = [
    timeBlock("warmup", "Landing spot warm-up", ["sw", "gw"], minutesPart(minutes, 0.18), {
      purpose: "Establish landing spot and contact before adding scoring pressure.",
      drill: "Throw three balls by hand, then chip to the same landing towel.",
      successTarget: "6 of 10 finish within a flagstick length.",
      recordPrompt: "Landing hit count and rollout miss.",
      metric: "landing_spot",
      target: 6,
    }),
    timeBlock(
      "short_game",
      "Main short-game priority",
      [wedge.clubType ?? "sw"],
      minutesPart(minutes, 0.28),
      {
        purpose: wedge.reason,
        drill: "Alternate stock chip and slightly higher flight. Keep the same landing zone.",
        successTarget: "Beat 60% inside the scoring circle.",
        recordPrompt: "Inside-circle count and strike quality.",
        metric: "inside_circle",
        target: 60,
      },
    ),
    timeBlock(
      "short_game",
      hasBunker ? "Bunker control" : "Up-and-down ladder",
      ["sw"],
      minutesPart(minutes, 0.22),
      {
        purpose: hasBunker
          ? "Add sand control without chasing perfect contact."
          : "Turn technique into a one-ball scoring task.",
        drill: hasBunker
          ? "Three long, three medium, three short bunker shots."
          : "Drop one ball in nine lies and finish each hole.",
        successTarget: hasBunker ? "6 of 9 out with controlled distance." : "4 of 9 up-and-downs.",
        recordPrompt: "Leave distance and one-word lie note.",
        metric: hasBunker ? "bunker_out" : "up_down",
        target: hasBunker ? 6 : 4,
      },
    ),
    timeBlock("test", "Pressure finish", ["sw", "gw"], minutesPart(minutes, 0.22), {
      purpose: "Make the session competitive enough to matter.",
      drill: "Nine-ball up-and-down challenge. Change lie every ball.",
      successTarget: "12+ points from 18.",
      recordPrompt: "Score, lie, and miss side.",
      metric: "points",
      target: 12,
    }),
  ];

  return finalizePlan(context, options, {
    title: "Short Game Practice Plan",
    summary: `${minutes}-minute short-game session around landing spot control and pressure scoring.`,
    totalBalls: null,
    focus: compactFocus([wedge]),
    why: [
      ...planWhy(context, wedge, null),
      "Short-game sessions use time and scoring tasks instead of fixed ball count.",
    ],
    blocks: resequence(blocks),
  });
}

function generateSpeedPracticePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
  priorities: PracticePriorityItem[],
): PracticePlan {
  const blocked =
    (context.trainingLoad.highRecentLoad ||
      options.energy === "tired" ||
      options.energy === "niggle") &&
    !options.facility?.overrideTrainingLoad;
  const minutes = options.timeMinutes;
  const speed =
    selectPriority(priorities, (item) => item.category === "speed") ??
    ({
      key: "speed-driver",
      clubType: "driver",
      label: "Driver speed",
      score: 50,
      certainty: "medium",
      reason: context.speed.recommendation,
      drill: "Fast swings with full rest.",
      category: "speed",
      roadmap: false,
    } satisfies PracticePriorityItem);
  const blocks = blocked
    ? [
        timeBlock("warmup", "Mobility and rhythm", ["driver"], minutesPart(minutes, 0.25), {
          purpose: "Respect the training-load warning and keep the body fresh.",
          drill: "Mobility, slow driver rehearsals, and easy tempo swings only.",
          successTarget: "No max-effort swings.",
          recordPrompt: "Energy after warm-up.",
          metric: "rpe",
          target: 5,
        }),
        timeBlock("technical", "Driver delivery window", ["driver"], minutesPart(minutes, 0.45), {
          purpose: "Keep the speed pattern alive without adding high-intensity work.",
          drill: "Stock driver swings at 80%. Track face-to-path and playable start line.",
          successTarget: "7 of 10 playable.",
          recordPrompt: "Playable count and path/face pattern.",
          metric: "playable",
          target: 7,
        }),
        timeBlock("test", "Stop-light finish", ["driver"], minutesPart(minutes, 0.2), {
          purpose: "End before the session becomes a load spike.",
          drill: "Five smooth drivers. Stop if two big misses appear.",
          successTarget: "No more than one big miss.",
          recordPrompt: "Big misses and effort level.",
          metric: "big_miss",
          target: 1,
        }),
      ]
    : [
        timeBlock("warmup", "Speed warm-up", ["driver"], minutesPart(minutes, 0.2), {
          purpose: "Prepare to swing fast without cold max-effort reps.",
          drill: "Mobility, progressive rehearsals, then five controlled driver swings.",
          successTarget: "Speed rises without strike collapse.",
          recordPrompt: "First five average and body feel.",
          metric: "speed_warmup",
          target: 1,
        }),
        timeBlock("speed", "Baseline swings", ["driver"], minutesPart(minutes, 0.18), {
          purpose: "Set today's speed reference.",
          drill: "Five measured swings with full rest.",
          successTarget: `Average within 3 mph of ${formatSpeedValue(context.speed.currentSpeedMph)}.`,
          recordPrompt: "Best, average, and effort level.",
          metric: "speed",
          target: Math.round(context.speed.currentSpeedMph ?? 85),
        }),
        timeBlock("speed", "Overspeed set", ["driver"], minutesPart(minutes, 0.24), {
          purpose: speed.reason,
          drill: options.facility?.speedSticks
            ? "Dominant and non-dominant overspeed sets."
            : "No-ball driver swings, three sets of three.",
          successTarget: "One swing beats baseline.",
          recordPrompt: "Best swing and fatigue note.",
          metric: "speed",
          target: Math.round((context.speed.currentSpeedMph ?? 85) + 1),
        }),
        timeBlock("test", "Driver transfer", ["driver"], minutesPart(minutes, 0.25), {
          purpose: "Make the speed usable with a ball.",
          drill:
            "Ten driver shots with full target routine. No more than one ball every 45 seconds.",
          successTarget: "6 of 10 playable while holding speed intent.",
          recordPrompt: "Playable count, best speed, and big misses.",
          metric: "playable",
          target: 6,
        }),
      ];

  return finalizePlan(context, options, {
    title: blocked ? "Technical Speed-Safe Plan" : "Speed Practice Plan",
    summary: blocked
      ? "Training load says avoid max-speed work, so this becomes a technical driver session."
      : `${minutes}-minute speed session using Speed Centre targets and driver transfer.`,
    totalBalls: blocked ? 15 : 10,
    focus: ["Driver"],
    why: blocked
      ? [
          "Recent load is high, so the plan avoids overspeed intensity.",
          context.trainingLoad.advice,
        ]
      : [
          context.speed.recommendation,
          `Current speed: ${formatSpeedValue(context.speed.currentSpeedMph)}. Target: ${formatSpeedValue(context.speed.targetSpeedMph)}.`,
        ],
    blocks: resequence(blocks),
  });
}

function generatePuttingPracticePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
): PracticePlan {
  const minutes = options.timeMinutes;
  const distance = options.facility?.distanceAvailableFt ?? 30;
  const blocks = [
    timeBlock("putting", "Start-line gate", ["putter"], minutesPart(minutes, 0.24), {
      purpose: "Start the ball on line before judging pace.",
      drill: "Gate at 3 feet. Move only after three makes in a row.",
      successTarget: "15 of 20 start through the gate.",
      recordPrompt: "Gate makes and miss side.",
      metric: "start_line",
      target: 15,
    }),
    timeBlock("putting", "3-foot circle", ["putter"], minutesPart(minutes, 0.2), {
      purpose: "Protect the scorecard range.",
      drill: "Five stations around the hole, four putts at each.",
      successTarget: "17 of 20 holed.",
      recordPrompt: "Makes and weak miss side.",
      metric: "makes",
      target: 17,
    }),
    timeBlock("putting", "Lag ladder", ["putter"], minutesPart(minutes, 0.3), {
      purpose: `Build pace control up to ${distance} ft.`,
      drill: "Putt to 15, 25, then max available distance. No same distance twice.",
      successTarget: "8 of 12 finish inside 3 feet.",
      recordPrompt: "Leave distance and long/short pattern.",
      metric: "lag",
      target: 8,
    }),
    timeBlock("test", "Pressure ladder", ["putter"], minutesPart(minutes, 0.18), {
      purpose: "Make the last block feel like scoring.",
      drill: "Must make 3 ft, then 5 ft, then lag inside 3 ft. Reset on failure.",
      successTarget: "Complete the ladder twice.",
      recordPrompt: "Completed ladders and failure distance.",
      metric: "ladders",
      target: 2,
    }),
  ];

  return finalizePlan(context, options, {
    title: "Putting Practice Plan",
    summary: `${minutes}-minute putting session for start line, short makes, and lag transfer.`,
    totalBalls: null,
    focus: ["Putter"],
    why: ["Putting work is built from facility constraints rather than launch-monitor ball count."],
    blocks: resequence(blocks),
  });
}

function generateCourseWarmupPlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
  priorities: PracticePriorityItem[],
): PracticePlan {
  const balls = normalizeBallCount(options.ballCount ?? 25, 20, 40);
  const main = priorities[0] ?? fallbackPriority(context);
  const allocations = warmupAllocation(balls);
  const blocks = [
    block("warmup_round", "Wedges", ["sw", "gw"], allocations.wedges, 5, {
      purpose: "Find contact and carry feel. No technical changes.",
      drill: "Half wedge, three-quarter wedge, full wedge. Hold finish.",
      successTarget: `${Math.max(3, allocations.wedges - 1)} playable.`,
      recordPrompt: "Strike feel only.",
      metric: "playable",
      target: Math.max(3, allocations.wedges - 1),
    }),
    block("warmup_round", "Mid-irons", ["8i", "6i"], allocations.irons, 5, {
      purpose: "Confirm tempo and start line.",
      drill: "Pick a target and go through the full pre-shot routine.",
      successTarget: `${Math.max(3, allocations.irons - 1)} playable.`,
      recordPrompt: "Start direction.",
      metric: "playable",
      target: Math.max(3, allocations.irons - 1),
    }),
    block("warmup_round", "Long clubs", [main.clubType ?? "5w", "driver"], allocations.long, 6, {
      purpose: "See the ball flight you will take to the first tee.",
      drill: "One rehearsal, one committed swing. Do not solve mechanics.",
      successTarget: `No more than ${Math.max(1, Math.floor(allocations.long / 4))} big miss.`,
      recordPrompt: "First-tee club confidence.",
      metric: "big_miss",
      target: Math.max(1, Math.floor(allocations.long / 4)),
    }),
    block(
      "random",
      "Random targets",
      buildTransferSequence(
        [main, wedgeFallback(context), driverFallback(context)],
        allocations.random,
      ),
      allocations.random,
      5,
      {
        purpose: "Finish by changing clubs and targets like the course.",
        drill: "Every ball gets a new target and full routine.",
        successTarget: `${Math.ceil(allocations.random * 0.65)} playable.`,
        recordPrompt: "Playable count.",
        metric: "playable",
        target: Math.ceil(allocations.random * 0.65),
      },
    ),
  ];

  return finalizePlan(context, options, {
    title: "Round Warm-up",
    summary: `${balls}-ball round warm-up. No swing rebuilds, only readiness.`,
    totalBalls: balls,
    focus: compactFocus([main]),
    why: ["Course warm-up stays short and non-technical.", context.trainingLoad.advice],
    blocks: resequence(blocks),
  });
}

function generateMixedPracticePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
  priorities: PracticePriorityItem[],
): PracticePlan {
  const balls = normalizeBallCount(options.ballCount ?? 60, 30, 120);
  const main = priorities[0] ?? fallbackPriority(context);
  const wedge =
    selectPriority(priorities, (item) => item.category === "wedge") ?? wedgeFallback(context);
  const blocks = [
    block(
      "warmup",
      "Warm-up",
      ["pw", "8i"],
      Math.round(balls * 0.15),
      minutesPart(options.timeMinutes, 0.15),
      {
        purpose: "Get loose and read today's strike.",
        drill: "Half wedge, stock wedge, stock 8i.",
        successTarget: "75% playable.",
        recordPrompt: "Playable count.",
        metric: "playable",
        target: Math.round(balls * 0.11),
      },
    ),
    priorityBlock(main, Math.round(balls * 0.28), "Main priority"),
    wedgeBlock(context, wedge, Math.round(balls * 0.22)),
    block(
      "short_game",
      "Short-game transfer",
      ["sw"],
      Math.round(balls * 0.15),
      minutesPart(options.timeMinutes, 0.2),
      {
        purpose: "Make scoring practice more than full swings.",
        drill: "Landing spot challenge, then one-ball up-and-down reps.",
        successTarget: "10+ points from 16.",
        recordPrompt: "Landing hits and up-and-down points.",
        metric: "points",
        target: 10,
      },
    ),
    block(
      "random",
      "Randomised finish",
      buildTransferSequence(
        [main, wedge, driverFallback(context)],
        balls - Math.round(balls * 0.8),
      ),
      balls - Math.round(balls * 0.8),
      minutesPart(options.timeMinutes, 0.2),
      {
        purpose: "End with course transfer.",
        drill: "Random club every ball. Score playable and target corridor.",
        successTarget: "70% playable.",
        recordPrompt: "Playable and corridor points.",
        metric: "playable",
        target: Math.round((balls - Math.round(balls * 0.8)) * 0.7),
      },
    ),
  ];

  return finalizePlan(context, options, {
    title: "Mixed Practice Plan",
    summary: `${balls}-ball mixed session balancing the highest safe priority with scoring transfer.`,
    totalBalls: balls,
    focus: compactFocus([main, wedge]),
    why: planWhy(context, main, wedge),
    blocks: normalizeBlockBallTotal(resequence(blocks), balls),
  });
}

function priorityBlock(
  priority: PracticePriorityItem,
  balls: number,
  label: string,
): PracticeBlock {
  const club = priority.clubType ?? "7i";
  const isDriver = DRIVER_TYPES.has(club);

  return block(
    "technical",
    `${label}: ${priority.label} ${isDriver ? "delivery" : "start line"}`,
    [club],
    balls,
    12,
    {
      purpose: priority.reason,
      drill: isDriver
        ? "Neutral delivery window. Track path and face-to-path, but only score playable shots."
        : "Start-line gate. Pick a clear start window and hit stock swings only.",
      successTarget: `${Math.ceil(balls * 0.6)} of ${balls} start inside the corridor. No more than ${Math.max(1, Math.floor(balls * 0.12))} big misses.`,
      recordPrompt: "Corridor hits, big misses, and one miss pattern note.",
      metric: "corridor",
      target: Math.ceil(balls * 0.6),
      maxBigMisses: Math.max(1, Math.floor(balls * 0.12)),
    },
  );
}

function wedgeBlock(
  context: PracticePlannerContext,
  priority: PracticePriorityItem,
  balls: number,
): PracticeBlock {
  const wedge = priority.clubType && WEDGE_TYPES.has(priority.clubType) ? priority.clubType : "sw";
  const matrix = context.bag.wedgeMatrix.find((item) => item.clubType === wedge);
  const rows = matrix?.rows ?? [];
  const targets = rows.map((row) => `${row.label}: ${row.carryYd ?? "target"} yd`).join(", ");

  return block("scoring", `${formatClubType(wedge)} wedge ladder`, [wedge, "gw", "pw"], balls, 10, {
    purpose: "Turn the scoring-zone opportunity into measured carry control.",
    drill: `Split the block between full, three-quarter and half wedges. Targets: ${targets || "stock, 3/4, half"}.`,
    successTarget: `${Math.ceil(balls * 0.65)} of ${balls} finish inside the carry window.`,
    recordPrompt: "Carry, offline, and whether the shot was full, 3/4, or half.",
    metric: "carry_ladder",
    target: Math.ceil(balls * 0.65),
  });
}

function driverMaintenanceBlock(priority: PracticePriorityItem, balls: number): PracticeBlock {
  return block("technical", "Driver maintenance", [priority.clubType ?? "driver"], balls, 8, {
    purpose: "Driver is maintained without letting it steal the whole session.",
    drill: "Normal routine, neutral delivery window, ignore distance unless strike collapses.",
    successTarget: `${Math.ceil(balls * 0.7)} of ${balls} playable. No more than ${Math.max(1, Math.floor(balls * 0.2))} outside corridor.`,
    recordPrompt: "Playable, path, face-to-path, and big misses.",
    metric: "playable",
    target: Math.ceil(balls * 0.7),
    maxBigMisses: Math.max(1, Math.floor(balls * 0.2)),
  });
}

function block(
  type: PracticeBlockType,
  title: string,
  clubs: string[],
  ballCount: number | null,
  timeMinutes: number,
  detail: {
    purpose: string;
    drill: string;
    successTarget: string;
    recordPrompt: string;
    metric: string;
    target: number;
    maxBigMisses?: number;
  },
): PracticeBlock {
  return {
    id: slug(`${type}-${title}`),
    order: 0,
    type,
    title,
    clubs: uniqueClubs(clubs),
    ballCount,
    timeMinutes,
    purpose: detail.purpose,
    drill: detail.drill,
    successTarget: detail.successTarget,
    recordPrompt: detail.recordPrompt,
    scoringRules: {
      metric: detail.metric,
      target: detail.target,
      maxBigMisses: detail.maxBigMisses,
    },
  };
}

function timeBlock(
  type: PracticeBlockType,
  title: string,
  clubs: string[],
  timeMinutes: number,
  detail: Parameters<typeof block>[5],
) {
  return block(type, title, clubs, null, timeMinutes, detail);
}

function finalizePlan(
  context: PracticePlannerContext,
  options: GeneratePracticePlanOptions,
  input: {
    title: string;
    summary: string;
    totalBalls: number | null;
    focus: string[];
    why: string[];
    blocks: PracticeBlock[];
  },
): PracticePlan {
  return {
    status: "draft",
    sessionType: options.sessionType,
    title: input.title,
    summary: input.summary,
    totalBalls: input.totalBalls,
    estimatedTimeMinutes: options.timeMinutes,
    energy: options.energy,
    intent: options.intent,
    focusClubs: input.focus,
    confidenceLabel: confidenceLabel(input.why, context),
    trainingStatus: context.trainingLoad.recommendation,
    why: input.why,
    blocks: input.blocks,
    postSessionRules: [
      "Save the plan before practising so the next upload can be matched automatically.",
      "Upload or sync the launch-monitor session after practice.",
      "Repeat any main-priority block that the imported data marks short of target.",
    ],
    sourceContext: context,
    generation: {
      source: "rules",
      label: "Rules engine",
      model: null,
      cached: false,
      creditsCharged: 0,
      creditsRemaining: null,
      note: "Deterministic plan generation.",
    },
    createdAt: new Date().toISOString(),
  };
}

function rangeAllocation(totalBalls: number) {
  if (totalBalls <= 30) {
    return { warmup: 8, main: 14, transfer: totalBalls - 22 };
  }

  if (totalBalls <= 50) {
    return { warmup: 10, baseline: 8, main: 17, transfer: totalBalls - 35 };
  }

  if (totalBalls <= 80) {
    return {
      warmup: 10,
      baseline: 10,
      main: 20,
      secondary: 15,
      scoring: 15,
      transfer: totalBalls - 70,
    };
  }

  const warmup = 12;
  const baseline = 12;
  const main = Math.round(totalBalls * 0.25);
  const secondary = Math.round(totalBalls * 0.18);
  const scoring = Math.round(totalBalls * 0.18);
  const maintenance = Math.round(totalBalls * 0.1);
  const transfer = totalBalls - warmup - baseline - main - secondary - scoring - maintenance;

  return { warmup, baseline, main, secondary, scoring, maintenance, transfer };
}

function normalizeBlockBallTotal(blocks: PracticeBlock[], totalBalls: number) {
  const current = blocks.reduce((total, blockItem) => total + (blockItem.ballCount ?? 0), 0);
  const delta = totalBalls - current;

  if (delta === 0) {
    return blocks;
  }

  const index = blocks.findIndex((blockItem) => blockItem.type === "random");
  const targetIndex = index >= 0 ? index : blocks.length - 1;

  return blocks.map((blockItem, itemIndex) =>
    itemIndex === targetIndex
      ? { ...blockItem, ballCount: Math.max(1, (blockItem.ballCount ?? 0) + delta) }
      : blockItem,
  );
}

function warmupAllocation(totalBalls: number) {
  const wedges = Math.max(5, Math.round(totalBalls * 0.24));
  const irons = Math.max(5, Math.round(totalBalls * 0.24));
  const long = Math.max(5, Math.round(totalBalls * 0.28));

  return {
    wedges,
    irons,
    long,
    random: totalBalls - wedges - irons - long,
  };
}

function normalizeOptions(
  options: GeneratePracticePlanOptions,
  context: PracticePlannerContext,
): GeneratePracticePlanOptions {
  const ballCount =
    options.sessionType === "range" ||
    options.sessionType === "mixed" ||
    options.sessionType === "course_warmup"
      ? normalizeBallCount(options.facility?.customBalls ?? options.ballCount ?? 80)
      : options.sessionType === "speed"
        ? 10
        : null;
  const sessionType =
    options.sessionType === "speed" &&
    (context.trainingLoad.highRecentLoad ||
      options.energy === "tired" ||
      options.energy === "niggle") &&
    !options.facility?.overrideTrainingLoad
      ? "speed"
      : options.sessionType;

  return {
    ...options,
    sessionType,
    ballCount,
    timeMinutes: clamp(Math.round(options.timeMinutes || 45), 10, 120),
  };
}

function normalizeBallCount(value: number, min = 20, max = 140) {
  const number = Number.isFinite(value) ? Math.round(value) : 80;
  const nearestPreset = RANGE_BALL_OPTIONS.find((option) => Math.abs(option - number) <= 2);
  return clamp(nearestPreset ?? number, min, max);
}

function latestPracticeContext(
  comparisons: ClubDayComparison[],
  overall: {
    sessionId: string | null;
    dateLabel: string;
    straightRate: number | null;
    playableRate: number | null;
    offlineAverageYd: number | null;
  },
): PracticePlannerContext["latestPractice"] {
  const eligible = comparisons.filter((item) => item.today.shotCount >= 3);
  const best = [...eligible].sort((left, right) => right.score - left.score)[0] ?? null;
  const opportunity = [...eligible].sort((left, right) => left.score - right.score)[0] ?? null;

  return {
    sessionId: overall.sessionId,
    dateLabel: overall.dateLabel,
    bestPerformer: best?.clubType ?? null,
    biggestOpportunity: opportunity?.clubType ?? null,
    scoringIssue: opportunity
      ? `${opportunity.clubLabel}: ${opportunity.summary}`
      : "No latest practice weakness has separated yet.",
    straightRate: overall.straightRate,
    playableRate: overall.playableRate,
    offlineAverageYd: overall.offlineAverageYd,
    clubs: comparisons.map((item) => ({
      clubType: item.clubType,
      label: item.clubLabel,
      shotCount: item.today.shotCount,
      score: item.score,
      playableRate: item.today.playableRate,
      straightRate: item.today.straightRate,
      offlineAverageYd: item.today.offlineAverageYd,
      bigMissRate: item.today.bigMissRate,
    })),
  };
}

function emptyLatestPractice(): PracticePlannerContext["latestPractice"] {
  return {
    sessionId: null,
    dateLabel: "No import yet",
    bestPerformer: null,
    biggestOpportunity: null,
    scoringIssue: "Import a launch-monitor session to add latest-practice evidence.",
    straightRate: null,
    playableRate: null,
    offlineAverageYd: null,
    clubs: [],
  };
}

function buildContextWedgeMatrix(clubs: Awaited<ReturnType<typeof getProgressData>>["clubs"]) {
  const inputs: BagIntelligenceClub[] = clubs.map((club) => ({
    id: club.clubId,
    type: club.clubType,
    brandModel: club.brandModel,
    shots: [],
    stock: {
      bestStockCarryYd: club.analytics.distance.stockCarryYd,
      coursePlayCarryYd: club.analytics.decision.playNumberYd,
      latestReliableCarryYd: club.analytics.distance.latestReliableCarryYd,
      latestReliableCarryP25Yd: club.analytics.distance.latestReliableCarryP25Yd,
      latestReliableCarryP75Yd: club.analytics.distance.latestReliableCarryP75Yd,
      personalBestCarryYd: club.analytics.distance.personalBestCarryYd,
      confidenceScore: club.analytics.consistency.confidenceScore,
      sampleSize: club.analytics.sample.stockShots,
      dispersionLeftYd: null,
      dispersionRightYd: null,
      shotRoleSummaries: [],
    },
  }));

  return buildWedgeMatrix(inputs);
}

function volatilityScoreForClub(
  analytics: Awaited<ReturnType<typeof getProgressData>>["clubs"][number]["analytics"],
) {
  return (
    (analytics.accuracy.bigMissRate ?? 0) * 0.8 +
    (analytics.accuracy.shotConeWidthYd ?? 0) * 0.55 +
    (analytics.distance.carrySpreadYd ?? 0) * 0.5
  );
}

function bagIssues(summary: ProgressSummary) {
  const issues: string[] = [];

  if (summary.rankings.needsWork) {
    issues.push(`${formatClubType(summary.rankings.needsWork.clubType)} lowest trust`);
  }

  if (summary.rankings.mostVolatile) {
    issues.push(`${formatClubType(summary.rankings.mostVolatile.clubType)} volatile`);
  }

  if (summary.dataGaps[0]) {
    issues.push(`${formatClubType(summary.dataGaps[0].clubType)} needs more data`);
  }

  return issues.length > 0 ? issues : ["Bag trust is building without a single urgent gap."];
}

async function getScoringContext(userId: string) {
  const rows = await getDb()
    .select({
      category: strokesGainedShotEvents.category,
      total: sql<number | null>`sum(${strokesGainedShotEvents.strokesGained})`,
      penalties: sql<number | null>`sum(${strokesGainedShotEvents.penaltyStrokes})`,
      sampleSize: sql<number>`count(*)::int`,
    })
    .from(strokesGainedShotEvents)
    .where(eq(strokesGainedShotEvents.userId, userId))
    .groupBy(strokesGainedShotEvents.category);
  const weakest = [...rows]
    .filter((row) => Number(row.sampleSize) >= 3 && row.total !== null)
    .sort((left, right) => Number(left.total ?? 0) - Number(right.total ?? 0))[0];
  const penalty = [...rows].sort(
    (left, right) => Number(right.penalties ?? 0) - Number(left.penalties ?? 0),
  )[0];

  return {
    weakestCategory: weakest?.category ?? null,
    penaltyPattern: Number(penalty?.penalties ?? 0) > 0 ? penalty?.category : null,
  };
}

function categoryForClub(clubType: string): PracticePriorityItem["category"] {
  if (DRIVER_TYPES.has(clubType)) {
    return "driver";
  }

  if (WEDGE_TYPES.has(clubType)) {
    return "wedge";
  }

  if (LONG_GAME_TYPES.has(clubType)) {
    return "long_game";
  }

  return "long_game";
}

function priorityReason(club: PracticePlannerClub, roadmap: boolean, latestOpportunity: boolean) {
  if (roadmap && latestOpportunity) {
    return `${club.label} is both a roadmap item and the latest opportunity.`;
  }

  if (roadmap) {
    return `${club.label} is already on the progress roadmap.`;
  }

  if (latestOpportunity) {
    return `${club.label} was the latest practice opportunity.`;
  }

  if ((club.bigMissRate ?? 0) >= 25 || club.volatilityScore >= 45) {
    return `${club.label} carries volatility and big-miss risk.`;
  }

  if (club.trustIndex < 60) {
    return `${club.label} trust is still below pressure-ready.`;
  }

  return `${club.label} is useful maintenance for today's intent.`;
}

function offlineTarget(clubType: string) {
  if (DRIVER_TYPES.has(clubType)) {
    return 28;
  }

  if (LONG_GAME_TYPES.has(clubType)) {
    return 22;
  }

  if (WEDGE_TYPES.has(clubType)) {
    return 10;
  }

  return 16;
}

function selectPriority(
  priorities: PracticePriorityItem[],
  predicate: (item: PracticePriorityItem) => boolean,
) {
  return priorities.find(predicate) ?? null;
}

function fallbackPriority(context: PracticePlannerContext): PracticePriorityItem {
  const club = context.bag.clubs[0];

  return {
    key: "fallback-7i",
    clubType: club?.clubType ?? "7i",
    label: club?.label ?? "7i",
    score: 50,
    certainty: "low",
    reason: "No clear weakness has separated, so build a comparable stock-shot baseline.",
    drill: "Stock-shot start-line gate.",
    category: categoryForClub(club?.clubType ?? "7i"),
    roadmap: false,
  };
}

function fallbackSecondary(
  context: PracticePlannerContext,
  main: PracticePriorityItem,
): PracticePriorityItem {
  const club = context.bag.clubs.find((item) => item.clubType !== main.clubType);

  return {
    key: `fallback-secondary-${club?.clubType ?? "8i"}`,
    clubType: club?.clubType ?? "8i",
    label: club?.label ?? "8i",
    score: 40,
    certainty: "low",
    reason: "Secondary block keeps the session from becoming one-club repetition.",
    drill: "Stock-shot target corridor.",
    category: categoryForClub(club?.clubType ?? "8i"),
    roadmap: false,
  };
}

function wedgeFallback(context: PracticePlannerContext): PracticePriorityItem {
  const wedge = context.bag.clubs.find((club) => WEDGE_TYPES.has(club.clubType));

  return {
    key: `wedge-${wedge?.clubType ?? "sw"}`,
    clubType: wedge?.clubType ?? "sw",
    label: wedge?.label ?? "SW",
    score: 46,
    certainty: wedge && wedge.sampleSize >= 8 ? "medium" : "low",
    reason: wedge
      ? `${wedge.label} is the scoring-zone calibration club.`
      : "Wedge control protects scoring.",
    drill: "Wedge carry ladder.",
    category: "wedge",
    roadmap: false,
  };
}

function driverFallback(context: PracticePlannerContext): PracticePriorityItem {
  const driver = context.bag.clubs.find((club) => club.clubType === "driver");

  return {
    key: "driver-maintenance",
    clubType: "driver",
    label: "Driver",
    score: driver ? 42 : 20,
    certainty: driver && driver.sampleSize >= 8 ? "medium" : "low",
    reason: driver
      ? "Driver maintenance keeps penalty risk visible."
      : "Driver baseline needs data.",
    drill: "Driver delivery window.",
    category: "driver",
    roadmap: false,
  };
}

function buildTransferSequence(priorities: PracticePriorityItem[], count: number) {
  const clubs = uniqueClubs(
    priorities
      .flatMap((priority) => [priority.clubType])
      .filter((item): item is string => Boolean(item)),
  );
  const fallback = ["driver", "sw", "7i", "5w", "pw", "gw", "9i"];
  const pool = uniqueClubs([...clubs, ...fallback]);

  return Array.from({ length: Math.max(1, count) }, (_, index) => pool[index % pool.length]);
}

function compactFocus(items: Array<PracticePriorityItem | null>) {
  return uniqueClubs(
    items
      .flatMap((item) => (item?.clubType ? [formatClubType(item.clubType)] : []))
      .filter(Boolean),
  ).slice(0, 4);
}

function planWhy(
  context: PracticePlannerContext,
  main: PracticePriorityItem,
  secondary: PracticePriorityItem | null,
) {
  return [
    main.reason,
    secondary ? secondary.reason : context.latestPractice.scoringIssue,
    context.trainingLoad.advice,
    context.trainingLoad.highRecentLoad
      ? "Recent load trims intensity and removes speed-chasing."
      : "Training status allows a specific, structured practice session.",
  ];
}

function confidenceLabel(
  why: string[],
  context: PracticePlannerContext,
): PracticePlan["confidenceLabel"] {
  if (context.bag.clubs.length === 0) {
    return "Low";
  }

  if (
    why.some((line) => line.includes("latest") || line.includes("roadmap")) &&
    context.bag.clubs.some((club) => club.sampleSize >= 10)
  ) {
    return "High";
  }

  return "Medium";
}

function blockDecision(
  blockItem: PracticeBlock,
  summary:
    | { shotCount: number; playableRate: number | null; offlineAverageYd: number | null }
    | undefined,
): PracticeComparison["decisions"][number]["decision"] {
  if (!summary || summary.shotCount === 0) {
    return "keep_priority";
  }

  if (blockItem.ballCount !== null && summary.shotCount < blockItem.ballCount) {
    return summary.shotCount >= Math.ceil(blockItem.ballCount * 0.65)
      ? "repeat_once"
      : "keep_priority";
  }

  if (summary.playableRate !== null && summary.playableRate >= 75) {
    return blockItem.type === "technical" ? "move_down" : "maintain";
  }

  if (summary.playableRate !== null && summary.playableRate >= 60) {
    return "repeat_once";
  }

  return "keep_priority";
}

function aggregateBlockShotSummary(
  blockItem: PracticeBlock,
  summaries: Array<{
    clubType: string;
    shotCount: number;
    playableRate: number | null;
    offlineAverageYd: number | null;
    carryAverageYd: number | null;
  }>,
) {
  if (summaries.length === 0) {
    return undefined;
  }

  const shotCount = summaries.reduce((total, summary) => total + summary.shotCount, 0);

  if (shotCount === 0) {
    return undefined;
  }

  const weightedPlayable = weightedAverage(
    summaries.map((summary) => ({ value: summary.playableRate, weight: summary.shotCount })),
  );
  const weightedOffline = weightedAverage(
    summaries.map((summary) => ({ value: summary.offlineAverageYd, weight: summary.shotCount })),
  );

  return {
    clubType: blockItem.clubs[0] ?? "mixed",
    shotCount,
    playableRate: weightedPlayable === null ? null : Math.round(weightedPlayable),
    offlineAverageYd: weightedOffline === null ? null : roundOne(weightedOffline),
    carryAverageYd: null,
  };
}

function weightedAverage(values: Array<{ value: number | null; weight: number }>) {
  const valid = values.filter((item) => item.value !== null && item.weight > 0);
  const weight = valid.reduce((total, item) => total + item.weight, 0);

  if (weight === 0) {
    return null;
  }

  return valid.reduce((total, item) => total + Number(item.value) * item.weight, 0) / weight;
}

export function scorePracticePlanSessionMatch(
  plan: SavedPracticePlan,
  session: ImportedPracticeSessionSummary,
): PracticePlanMatchScore {
  const plannedClubs = uniqueClubs(plan.blocks.flatMap((blockItem) => blockItem.clubs));
  const sessionClubs = new Set(session.clubTypes.map((club) => club.toLowerCase()));
  const overlap = plannedClubs.filter((club) => sessionClubs.has(club)).length;
  const focusClubs = plan.focusClubs.map((club) => club.toLowerCase());
  const focusOverlap = focusClubs.filter((club) => sessionClubs.has(club)).length;
  const clubMixScore =
    plannedClubs.length > 0 ? Math.round((overlap / plannedClubs.length) * 20) : 10;
  const focusClubScore =
    focusClubs.length > 0 ? Math.round((focusOverlap / focusClubs.length) * 20) : 10;
  const ballCountScore =
    plan.totalBalls && plan.totalBalls > 0
      ? Math.max(
          0,
          20 - Math.round((Math.abs(session.shotCount - plan.totalBalls) / plan.totalBalls) * 20),
        )
      : 12;
  const sessionTypeScore = sessionMatchesPlanType(plan.sessionType, session.sessionType) ? 10 : 0;
  const plannedTime = Date.parse(plan.plannedAt);
  const sessionTime = session.sessionDate.getTime();
  const hoursApart = Number.isFinite(plannedTime)
    ? Math.abs(sessionTime - plannedTime) / (60 * 60 * 1000)
    : 999;
  const dateScore = hoursApart <= 18 ? 20 : hoursApart <= 36 ? 14 : hoursApart <= 168 ? 6 : 0;
  const sourceTypeScore = launchMonitorSourceScore(session.sourceType);
  const breakdown = {
    dateScore,
    sessionTypeScore,
    ballCountScore,
    focusClubScore,
    clubMixScore,
    sourceTypeScore,
  };
  const score = clamp(
    dateScore + sessionTypeScore + ballCountScore + focusClubScore + clubMixScore + sourceTypeScore,
    0,
    100,
  );
  const reason = [
    sessionTypeScore > 0 ? "session type matched" : "session type was different",
    sourceTypeScore > 0
      ? `${session.sourceType} source matched`
      : `${session.sourceType} source was weaker evidence`,
    `${focusOverlap}/${focusClubs.length || 1} focus clubs appeared`,
    `${overlap}/${plannedClubs.length || 1} planned club groups appeared`,
    plan.totalBalls
      ? `${session.shotCount}/${plan.totalBalls} planned shots imported`
      : `${session.shotCount} shots imported`,
  ].join("; ");

  return { score, reason, breakdown };
}

export function canImportedSessionReviewPracticePlan(
  plan: Pick<SavedPracticePlan, "plannedAt">,
  session: Pick<ImportedPracticeSessionSummary, "uploadedAt" | "sessionDate">,
) {
  const plannedAt = Date.parse(plan.plannedAt);

  if (!Number.isFinite(plannedAt)) {
    return true;
  }

  const uploadedAt = session.uploadedAt.getTime();
  const fallbackSessionTime = session.sessionDate.getTime();
  const comparableTime = Number.isFinite(uploadedAt) ? uploadedAt : fallbackSessionTime;
  return comparableTime > plannedAt;
}

export function shouldAutoLinkPracticePlanMatch(score: number, hasPartialEvidence = false) {
  return score >= 75 || (hasPartialEvidence && score >= 35);
}

function hasPartialPracticeEvidence(
  plan: SavedPracticePlan,
  session: ImportedPracticeSessionSummary,
) {
  const plannedClubs = new Set(plan.blocks.flatMap((blockItem) => blockItem.clubs));
  const focusClubs = new Set(plan.focusClubs.map((club) => club.toLowerCase()));
  const importedClubCounts = new Map(
    session.clubSummaries.map((summary) => [summary.clubType.toLowerCase(), summary.shotCount]),
  );
  const hasPlannedClubShots = [...plannedClubs].some(
    (club) => (importedClubCounts.get(club) ?? 0) > 0,
  );
  const hasFocusClubShots = [...focusClubs].some((club) => (importedClubCounts.get(club) ?? 0) > 0);
  const samePracticeWindow =
    Math.abs(session.sessionDate.getTime() - Date.parse(plan.plannedAt)) <= 7 * 24 * 60 * 60 * 1000;

  return samePracticeWindow && (hasFocusClubShots || hasPlannedClubShots);
}

function launchMonitorSourceScore(sourceType: string) {
  const source = sourceType.toLowerCase();

  if (source.includes("rapsodo") || source.includes("trackman") || source.includes("flightscope")) {
    return 10;
  }

  if (source.includes("launch") || source.includes("simulator") || source.includes("csv")) {
    return 8;
  }

  return 0;
}

function sessionMatchesPlanType(planType: PracticeSessionType, sessionType: string) {
  if (planType === "range") {
    return sessionType === "range" || sessionType === "simulator";
  }

  if (planType === "course_warmup") {
    return sessionType === "range" || sessionType === "round" || sessionType === "simulated_course";
  }

  if (planType === "mixed") {
    return (
      sessionType === "range" || sessionType === "simulator" || sessionType === "simulated_course"
    );
  }

  if (planType === "speed") {
    return sessionType === "range" || sessionType === "simulator";
  }

  return sessionType === "range" || sessionType === "simulator";
}

function buildPracticeResultFromImport(
  plan: PracticePlan,
  session: ImportedPracticeSessionSummary,
  comparison: PracticeComparison,
): PracticeResultInput {
  const decisions = new Map(comparison.decisions.map((decision) => [decision.blockId, decision]));
  const ballCompletion =
    plan.totalBalls && plan.totalBalls > 0 ? session.shotCount / plan.totalBalls : 1;

  return {
    completionStatus: ballCompletion >= 0.65 ? "complete" : "partial",
    actualBalls: session.shotCount,
    actualMinutes: plan.estimatedTimeMinutes,
    sourceSessionId: session.id,
    notes: "Completed automatically from the uploaded launch-monitor session.",
    blockResults: plan.blocks.map((blockItem) => {
      const decision = decisions.get(blockItem.id);
      const actualBalls = decision?.actualBalls ?? 0;
      const score = importedDecisionScore(blockItem, decision?.decision);

      return {
        blockId: blockItem.id,
        completionStatus: decision?.matchedPlannedVolume
          ? "complete"
          : actualBalls > 0 || blockItem.ballCount === null
            ? "partial"
            : "missed",
        actualBalls: blockItem.ballCount === null ? null : actualBalls,
        actualMinutes: blockItem.timeMinutes,
        score,
        passed: decision?.decision === "maintain" || decision?.decision === "move_down",
        result: decision?.result ?? "insufficient_data",
        summary: decision?.summary ?? null,
        linkedShotIds: decision?.linkedShotIds ?? [],
        metrics: decision?.metrics ?? {},
        notes: decision
          ? `Imported result: ${decision.actual}. Decision: ${decision.decision.replace("_", " ")}.`
          : "No direct imported block comparison; treated as support work.",
      };
    }),
  };
}

function importedDecisionScore(
  blockItem: PracticeBlock,
  decision: PracticeComparison["decisions"][number]["decision"] | undefined,
) {
  if (!decision) {
    return blockItem.scoringRules.target;
  }

  if (decision === "maintain" || decision === "move_down") {
    return blockItem.scoringRules.target;
  }

  if (decision === "repeat_once") {
    return Math.max(1, Math.round(blockItem.scoringRules.target * 0.85));
  }

  return Math.max(0, Math.round(blockItem.scoringRules.target * 0.55));
}

function dbBlockToView(
  blockRow: typeof practiceBlocks.$inferSelect & { dbId?: string },
): PracticeBlock & { dbId: string } {
  return {
    id: slug(`${blockRow.blockOrder}-${blockRow.title}`),
    dbId: blockRow.id,
    order: blockRow.blockOrder,
    type: blockRow.blockType as PracticeBlockType,
    title: blockRow.title,
    clubs: uniqueClubs(blockRow.clubsJson),
    ballCount: blockRow.ballCount,
    timeMinutes: blockRow.timeMinutes,
    purpose: blockRow.goal,
    drill: blockRow.drill,
    successTarget: blockRow.successCriteria,
    recordPrompt: blockRow.recordPrompt,
    scoringRules: {
      metric: String(blockRow.scoringRulesJson.metric ?? "completion"),
      target: asNumber(blockRow.scoringRulesJson.target) ?? 1,
      maxBigMisses: asNumber(blockRow.scoringRulesJson.maxBigMisses) ?? undefined,
      unit:
        typeof blockRow.scoringRulesJson.unit === "string"
          ? blockRow.scoringRulesJson.unit
          : undefined,
    },
  };
}

export function savedPracticePlanToPracticePlan(
  saved: SavedPracticePlan,
  context: PracticePlannerContext = emptyContext(),
): PracticePlan {
  return {
    id: saved.id,
    status: saved.status,
    sessionType: saved.sessionType,
    title: saved.title,
    summary: saved.summary,
    totalBalls: saved.totalBalls,
    estimatedTimeMinutes: saved.timeMinutes,
    energy: "normal",
    intent: "latest_weakness",
    focusClubs: uniqueClubs(saved.focusClubs),
    confidenceLabel: "Medium",
    trainingStatus: saved.status === "analysed" ? "Imported session matched" : "Saved plan",
    why: [saved.summary],
    blocks: saved.blocks,
    postSessionRules: [],
    sourceContext: {
      ...context,
      generatedAt: saved.plannedAt,
    },
    generation: saved.generation,
    createdAt: saved.plannedAt,
  };
}

function savedPlanToPracticePlan(saved: SavedPracticePlan): PracticePlan {
  return savedPracticePlanToPracticePlan(saved);
}

function transientSavedPlanForMatch(plan: PracticePlan): SavedPracticePlan {
  const plannedAt = plan.createdAt || plan.sourceContext.generatedAt || new Date().toISOString();

  return {
    id: plan.id ?? "transient-practice-plan",
    title: plan.title,
    sessionType: plan.sessionType,
    status: plan.status ?? "planned",
    totalBalls: plan.totalBalls,
    timeMinutes: plan.estimatedTimeMinutes,
    focusClubs: plan.focusClubs,
    plannedAt,
    completedAt: null,
    score: null,
    matchConfidence: null,
    matchReason: null,
    summary: plan.summary,
    generation: plan.generation,
    sourceSessionId: null,
    blocks: plan.blocks.map((blockItem) => ({
      ...blockItem,
      dbId: `${blockItem.id}-transient`,
    })),
    result: null,
  };
}

function parsePlanGeneration(value: unknown): PracticePlanGeneration {
  if (!isRecord(value)) {
    return rulesGeneration("Saved deterministic plan.");
  }

  const source = value.source === "openai" ? "openai" : "rules";

  return {
    source,
    label:
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : source === "openai"
          ? "OpenAI coach copy"
          : "Rules engine",
    model: typeof value.model === "string" && value.model.trim() ? value.model.trim() : null,
    cached: value.cached === true,
    creditsCharged:
      typeof value.creditsCharged === "number" ? Math.max(0, value.creditsCharged) : 0,
    creditsRemaining:
      typeof value.creditsRemaining === "number" ? Math.max(0, value.creditsRemaining) : null,
    note: typeof value.note === "string" && value.note.trim() ? value.note.trim() : null,
  };
}

function parsePracticeComparison(value: unknown): PracticeComparison | null {
  if (!isRecord(value) || !Array.isArray(value.decisions)) {
    return null;
  }

  const scoringMode = value.scoringMode === "ordered" ? "ordered" : "aggregate";
  const importedSession = isRecord(value.importedSession)
    ? {
        shotCount: asNumber(value.importedSession.shotCount) ?? 0,
        sessionType:
          typeof value.importedSession.sessionType === "string"
            ? value.importedSession.sessionType
            : "range",
        dateLabel:
          typeof value.importedSession.dateLabel === "string"
            ? value.importedSession.dateLabel
            : "Imported session",
        clubTypes: parseStringArray(value.importedSession.clubTypes),
      }
    : null;
  const planVsActual = isRecord(value.planVsActual)
    ? {
        plannedBalls: asNumber(value.planVsActual.plannedBalls),
        actualShots: asNumber(value.planVsActual.actualShots) ?? importedSession?.shotCount ?? 0,
        plannedClubs: parseStringArray(value.planVsActual.plannedClubs),
        actualClubs: parseStringArray(value.planVsActual.actualClubs),
      }
    : {
        plannedBalls: null,
        actualShots: importedSession?.shotCount ?? 0,
        plannedClubs: [],
        actualClubs: importedSession?.clubTypes ?? [],
      };

  return {
    sourceSessionId:
      typeof value.sourceSessionId === "string" && value.sourceSessionId.trim()
        ? value.sourceSessionId
        : null,
    scoringMode,
    matchConfidence: asNumber(value.matchConfidence),
    importedSession,
    planVsActual,
    whatWorked: parseStringArray(value.whatWorked),
    needsWork: parseStringArray(value.needsWork),
    nextRecommendation:
      typeof value.nextRecommendation === "string"
        ? value.nextRecommendation
        : "Review the imported block results before the next plan.",
    summary: typeof value.summary === "string" ? value.summary : "Practice comparison saved.",
    decisions: value.decisions
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }

        const decision = String(item.decision ?? "");

        if (!["maintain", "repeat_once", "keep_priority", "move_down"].includes(decision)) {
          return null;
        }

        return {
          blockId:
            typeof item.blockId === "string" ? item.blockId : slug(String(item.title ?? "block")),
          title: typeof item.title === "string" ? item.title : "Practice block",
          target: typeof item.target === "string" ? item.target : "Target saved",
          actual: typeof item.actual === "string" ? item.actual : "Imported data saved",
          plannedBalls: asNumber(item.plannedBalls),
          actualBalls: asNumber(item.actualBalls) ?? 0,
          matchedPlannedVolume: item.matchedPlannedVolume === true,
          result: parseBlockEvaluationResult(item.result),
          confidence: parseBlockEvaluationConfidence(item.confidence),
          scoringMode: item.scoringMode === "ordered" ? "ordered" : scoringMode,
          linkedShotIds: parseStringArray(item.linkedShotIds),
          metrics: isRecord(item.metrics) ? item.metrics : {},
          summary: typeof item.summary === "string" ? item.summary : "Imported block result saved.",
          decision: decision as PracticeComparison["decisions"][number]["decision"],
        };
      })
      .filter((item): item is PracticeComparison["decisions"][number] => Boolean(item)),
  };
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseBlockEvaluationResult(value: unknown): PracticeBlockEvaluationResult {
  return value === "passed" ||
    value === "mixed" ||
    value === "failed" ||
    value === "insufficient_data"
    ? value
    : "insufficient_data";
}

function parseBlockEvaluationConfidence(value: unknown): PracticeBlockEvaluationConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function rulesGeneration(note: string): PracticePlanGeneration {
  return {
    source: "rules",
    label: "Rules engine",
    model: null,
    cached: false,
    creditsCharged: 0,
    creditsRemaining: null,
    note,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function plannerContextSnapshot(context: PracticePlannerContext) {
  return {
    generatedAt: context.generatedAt,
    latestPractice: context.latestPractice,
    progress: context.progress,
    bag: {
      issues: context.bag.issues,
      clubs: context.bag.clubs.map((club) => ({
        clubType: club.clubType,
        stockCarryYd: club.stockCarryYd,
        trustIndex: club.trustIndex,
        confidenceScore: club.confidenceScore,
        sampleSize: club.sampleSize,
      })),
      wedgeMatrix: context.bag.wedgeMatrix,
    },
    trainingLoad: context.trainingLoad,
    speed: context.speed,
    scoring: context.scoring,
  };
}

type PracticePlannerAchievementAwardContext = {
  blockResults?: PracticeBlockResultInput[];
  comparison?: PracticeComparison;
  planBlockCount?: number;
  sourceSessionId?: string | null;
};

type PracticePlannerAchievementStats = {
  wonDrills: number;
  scoredDrills: number;
  planBlocks: number;
};

export function practicePlannerAchievementCandidateIds(input: {
  event: "created" | "completed";
  planCount: number;
  completedCount: number;
  score?: PracticeScore;
  blockResults?: PracticeBlockResultInput[];
  comparison?: PracticeComparison;
  planBlockCount?: number;
}) {
  const stats = practicePlannerAchievementStats(
    input.blockResults ?? [],
    input.comparison,
    input.planBlockCount,
  );

  return [
    input.event === "created" && input.planCount >= 1 ? "practice_planner_first_plan" : null,
    input.event === "completed" && input.completedCount >= 1
      ? "practice_planner_first_completed"
      : null,
    input.event === "completed" && input.completedCount >= 5
      ? "practice_planner_five_completed"
      : null,
    input.event === "completed" && (input.score?.score ?? 0) >= 80
      ? "practice_planner_target_beaten"
      : null,
    input.event === "completed" && input.score?.mainPriority === "improved"
      ? "practice_planner_priority_fixed"
      : null,
    input.event === "completed" && stats.wonDrills >= 1 ? "practice_planner_drill_winner" : null,
    input.event === "completed" && stats.wonDrills >= 3
      ? "practice_planner_three_drills_won"
      : null,
    input.event === "completed" && stats.wonDrills >= 5 ? "practice_planner_five_drills_won" : null,
    input.event === "completed" &&
    stats.planBlocks >= 3 &&
    stats.scoredDrills >= stats.planBlocks &&
    stats.wonDrills === stats.planBlocks
      ? "practice_planner_clean_card"
      : null,
  ].filter((item): item is string => Boolean(item));
}

function practicePlannerAchievementStats(
  blockResults: PracticeBlockResultInput[],
  comparison: PracticeComparison | undefined,
  planBlockCount: number | undefined,
): PracticePlannerAchievementStats {
  const decisionsByBlockId = new Map(
    (comparison?.decisions ?? []).map((decision) => [decision.blockId, decision]),
  );
  const blockIds = new Set([
    ...blockResults.map((blockResult) => blockResult.blockId),
    ...decisionsByBlockId.keys(),
  ]);
  let wonDrills = 0;
  let scoredDrills = 0;

  for (const blockId of blockIds) {
    const blockResult = blockResults.find((item) => item.blockId === blockId);
    const decision = decisionsByBlockId.get(blockId);
    const actualBalls = blockResult?.actualBalls ?? decision?.actualBalls ?? 0;
    const result = blockResult?.result ?? decision?.result;

    if (actualBalls > 0 || result === "passed" || result === "mixed" || result === "failed") {
      scoredDrills += 1;
    }

    if (blockResult?.passed || result === "passed") {
      wonDrills += 1;
    }
  }

  return {
    wonDrills,
    scoredDrills,
    planBlocks: planBlockCount ?? Math.max(blockResults.length, comparison?.decisions.length ?? 0),
  };
}

async function awardPracticePlannerAchievements(
  userId: string,
  event: "created" | "completed",
  score?: PracticeScore,
  context: PracticePlannerAchievementAwardContext = {},
) {
  const db = getDb();
  const now = new Date();
  const [planCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(practicePlans)
    .where(eq(practicePlans.userId, userId));
  const [completedCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(practiceResults)
    .where(
      and(
        eq(practiceResults.userId, userId),
        eq(practiceResults.completionStatus, "complete"),
        sql`${practiceResults.sourceSessionId} is not null`,
      ),
    );
  const stats = practicePlannerAchievementStats(
    context.blockResults ?? [],
    context.comparison,
    context.planBlockCount,
  );
  const sourceSessionId = context.sourceSessionId ?? context.comparison?.sourceSessionId ?? null;
  const candidates = practicePlannerAchievementCandidateIds({
    event,
    planCount: Number(planCountRow?.count ?? 0),
    completedCount: Number(completedCountRow?.count ?? 0),
    score,
    blockResults: context.blockResults,
    comparison: context.comparison,
    planBlockCount: context.planBlockCount,
  });

  for (const achievementId of candidates) {
    const [existing] = await db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(
        and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)),
      )
      .limit(1);

    if (existing) {
      continue;
    }

    const achievement = getAchievement(achievementId);

    if (!achievement) {
      continue;
    }

    const metadata = {
      source: "practice_planner",
      event,
      practiceScore: score?.score ?? null,
      wonDrills: stats.wonDrills,
      scoredDrills: stats.scoredDrills,
      planBlocks: stats.planBlocks,
    };
    const xp = xpForAchievement(achievement.xp, false);
    await db.insert(userAchievements).values({
      userId,
      achievementId,
      firstUnlockedAt: now,
      lastUnlockedAt: now,
      unlockCount: 1,
      sourceSessionId,
      xpAwarded: xp,
      metadataJson: metadata,
      createdAt: now,
      updatedAt: now,
    });
    await db
      .insert(xpLedger)
      .values({
        userId,
        amount: xp,
        reason: "achievement",
        achievementId,
        sessionId: sourceSessionId,
        dedupeKey: `achievement:${achievementId}`,
        metadataJson: {
          achievementName: achievement.name,
          ...metadata,
        },
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [xpLedger.userId, xpLedger.dedupeKey],
      });
  }
}

const STATIC_PRACTICE_TEMPLATES: PracticeTemplateView[] = [
  {
    id: "template-30-ball-tune-up",
    title: "30-ball quick tune-up",
    description: "Warm-up, one priority, and a short transfer finish.",
    sessionType: "range",
    ballCount: 30,
    timeMinutes: 30,
    intent: "latest_weakness",
  },
  {
    id: "template-50-scoring",
    title: "50-ball scoring session",
    description: "A compact range plan weighted toward wedges and transfer.",
    sessionType: "range",
    ballCount: 50,
    timeMinutes: 45,
    intent: "scoring",
  },
  {
    id: "template-80-range",
    title: "80-ball range session",
    description:
      "Full structured range session with main, secondary, scoring, and randomised finish.",
    sessionType: "range",
    ballCount: 80,
    timeMinutes: 45,
    intent: "latest_weakness",
  },
  {
    id: "template-wedge-ladder",
    title: "20-minute wedge ladder",
    description: "Short-game scoring block for wedge distance control.",
    sessionType: "short_game",
    ballCount: null,
    timeMinutes: 20,
    intent: "scoring",
  },
  {
    id: "template-driver-neutral",
    title: "Driver neutralising session",
    description: "Delivery and start-line work without distance chasing.",
    sessionType: "range",
    ballCount: 50,
    timeMinutes: 45,
    intent: "confidence",
  },
];

function emptyContext(): PracticePlannerContext {
  return {
    generatedAt: new Date().toISOString(),
    latestPractice: emptyLatestPractice(),
    progress: {
      priorities: [],
      trustLadder: [],
      mostVolatile: null,
      weakestSignal: null,
      currentForm: null,
    },
    bag: { clubs: [], issues: [], wedgeMatrix: [] },
    trainingLoad: {
      statusKey: "balanced",
      statusLabel: "Good",
      advice: "Build a normal practice session.",
      recentLoad: 0,
      golfForm: 0,
      recommendation: "Technical practice recommended",
      highRecentLoad: false,
    },
    speed: {
      currentSpeedMph: null,
      targetSpeedMph: null,
      recommendation: "Build speed baseline first.",
      priority: "Medium",
    },
    scoring: { weakestCategory: null, penaltyPattern: null },
  };
}

function parseIntent(value: string): PracticeIntent {
  return [
    "scoring",
    "confidence",
    "latest_weakness",
    "round_preparation",
    "distance_mapping",
    "speed",
  ].includes(value)
    ? (value as PracticeIntent)
    : "latest_weakness";
}

function formatSessionType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function resequence(blocks: PracticeBlock[]) {
  return blocks.map((blockItem, index) => ({
    ...blockItem,
    id: slug(`${index + 1}-${blockItem.title}`),
    order: index + 1,
  }));
}

function minutesPart(total: number, ratio: number) {
  return Math.max(3, Math.round(total * ratio));
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueClubs(clubs: string[]) {
  return [
    ...new Set(clubs.map((club) => (club.trim() ? normalizeClubType(club) : "")).filter(Boolean)),
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatRate(value: number | null) {
  return value === null ? "No data" : `${Math.round(value)}%`;
}

function formatYards(value: number | null) {
  return value === null ? "No data" : `${roundOne(value)} yd`;
}

function formatSpeedValue(value: number | null) {
  return value === null ? "No data" : `${roundOne(value)} mph`;
}
