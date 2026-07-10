import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import { formatClubType, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildShotPatternResult, type ShotPatternRawShot } from "@/lib/shot-patterns";

export type RealityHandicapConfidence = "high" | "medium" | "low" | "building";
export type RealityHandicapTone = "green" | "sky" | "amber" | "pink" | "slate";

export type RealityHandicapShot = {
  id: string;
  sessionId: string | null;
  clubId: string | null;
  clubType: string;
  shotAt: Date | string | null;
  playContext?: string | null;
  sessionType?: string | null;
  source?: string | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph?: number | null;
  launchAngleDeg?: number | null;
  launchDirectionDeg?: number | null;
  spinAxis?: number | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
};

export type RangeRealityHandicapEstimate = {
  value: number | null;
  label: string;
  expectedRangeLabel: string;
  confidenceScore: number;
  confidence: RealityHandicapConfidence;
  confidenceLabel: string;
  trend: {
    direction: "improving" | "worse" | "flat" | "building";
    delta: number | null;
    label: string;
    detail: string;
  };
  sampleSize: number;
  clubCount: number;
  sessionCount: number;
  usableShotCount: number;
  modelShotCount: number;
  latestShotAt: Date | null;
  methodLabel: string;
  disclaimer: string;
  caveats: string[];
  timeline: RealityHandicapTimelineItem[];
};

export type CostlyShotItem = {
  id: string;
  clubType: string;
  clubLabel: string;
  scoreCost: number;
  reason: string;
  detail: string;
  tone: RealityHandicapTone;
};

export type CostlyShotGroup = {
  id: string;
  clubType: string;
  clubLabel: string;
  scoreLossSharePct: number;
  potentialGain: number;
  occurrenceCount: number;
  averageOfflineYd: number | null;
  mainMisses: string[];
  detail: string;
  tone: RealityHandicapTone;
};

export type RealityHandicapTimelineItem = {
  id: string;
  label: string;
  value: number | null;
  valueLabel: string;
  confidenceScore: number;
};

export type DisasterScenario = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: RealityHandicapTone;
};

export type PracticePrescriptionItem = {
  id: string;
  title: string;
  clubType: string | null;
  detail: string;
  drill: string;
  tone: RealityHandicapTone;
};

export type RealityFlightLine = {
  id: string;
  clubType: string;
  clubLabel: string;
  carryYd: number;
  sideYd: number;
  launchDirectionDeg: number | null;
  scoreCost: number;
  isCostly: boolean;
  isDirectionalDamage: boolean;
  included: boolean;
};

export type BagTruthItem = {
  clubType: string;
  clubLabel: string;
  carryRangeLabel: string;
  sampleSize: number;
  confidenceLabel: string;
  detail: string;
  tone: RealityHandicapTone;
};

export type RangeRealityHandicapData = {
  estimate: RangeRealityHandicapEstimate;
  costlyShots: CostlyShotItem[];
  costlyShotGroups: CostlyShotGroup[];
  disasterScenarios: DisasterScenario[];
  prescriptions: PracticePrescriptionItem[];
  flightLines: RealityFlightLine[];
  bagTruth: BagTruthItem[];
};

const MAX_REALITY_SHOTS = 1000;
const RECENT_MODEL_SHOTS = 800;
const TREND_WINDOW_SHOTS = 100;
const MIN_NUMERIC_SHOTS = 20;
const MIN_NUMERIC_CLUBS = 2;
const SIDE_TARGET_YD = 18;
const BIG_MISS_SIDE_YD = 40;
const SHORT_MISS_YD = 18;
const BAD_QUALITY_TAGS = new Set(["bad-data", "bad_data", "misread", "delete", "deleted"]);
const EXCLUDED_SHOT_CATEGORIES = new Set(["chip", "pitch", "putt", "recovery", "bunker"]);
const RANGE_SESSION_TYPES = ["range"] as const;
const RANGE_PLAY_CONTEXTS = ["practice_bay", "indoor"] as const;

export async function getRangeRealityHandicapData(
  userId?: string,
): Promise<RangeRealityHandicapData> {
  userId ??= await requireCurrentUserId();
  const db = getDb();
  const rows = await db
    .select({
      id: shots.id,
      sessionId: shots.sessionId,
      clubId: shots.clubId,
      clubType: shots.clubType,
      shotAt: shots.shotAt,
      playContext: shots.playContext,
      sessionType: sessions.type,
      source: sessions.source,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      ballSpeedMph: shots.ballSpeedMph,
      launchAngleDeg: shots.launchAngleDeg,
      launchDirectionDeg: shots.launchDirectionDeg,
      spinAxis: shots.spinAxis,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
      clubActive: clubs.active,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(
      and(
        eq(shots.userId, userId),
        eq(sessions.userId, userId),
        eq(clubs.active, true),
        inArray(sessions.type, [...RANGE_SESSION_TYPES]),
      ),
    )
    .orderBy(desc(shots.shotAt), desc(shots.shotNumber))
    .limit(MAX_REALITY_SHOTS);

  return buildRangeRealityHandicapData(rows);
}

export function buildRangeRealityHandicapData(
  inputShots: RealityHandicapShot[],
): RangeRealityHandicapData {
  const usableShots = sortNewestFirst(inputShots.filter(isUsableRangeRealityShot));
  const estimate = buildRangeRealityEstimate(usableShots, inputShots);
  const costlyShots = buildCostlyShotItems(usableShots);

  return {
    estimate,
    costlyShots,
    costlyShotGroups: buildCostlyShotGroups(usableShots),
    disasterScenarios: buildDisasterScenarios(usableShots, estimate, costlyShots),
    prescriptions: buildPracticePrescriptions(usableShots, costlyShots),
    flightLines: buildRealityFlightLines(usableShots),
    bagTruth: buildBagTruthItems(usableShots),
  };
}

export function isUsableRangeRealityShot(shot: RealityHandicapShot) {
  if (!isTrackedClubType(shot.clubType)) return false;
  if (!isRangeRealitySession(shot)) return false;
  if (shot.shotCategory && EXCLUDED_SHOT_CATEGORIES.has(shot.shotCategory.toLowerCase())) {
    return false;
  }
  if (shot.qualityTag && BAD_QUALITY_TAGS.has(shot.qualityTag.toLowerCase())) {
    return false;
  }

  const distance = shot.carryYd ?? shot.totalYd;
  return isFiniteNumber(distance) && distance >= 20 && distance <= 430;
}

function isRangeRealitySession(shot: RealityHandicapShot) {
  return (
    RANGE_SESSION_TYPES.includes(shot.sessionType as (typeof RANGE_SESSION_TYPES)[number]) ||
    RANGE_PLAY_CONTEXTS.includes(shot.playContext as (typeof RANGE_PLAY_CONTEXTS)[number])
  );
}

function buildRangeRealityEstimate(
  usableShots: RealityHandicapShot[],
  allShots: RealityHandicapShot[],
): RangeRealityHandicapEstimate {
  const modelShots = usableShots.slice(0, RECENT_MODEL_SHOTS);
  const clubGroups = groupBy(modelShots, (shot) => shot.clubType);
  const sessionIds = new Set(modelShots.map((shot) => shot.sessionId).filter(Boolean));
  const clubs = [...clubGroups.keys()];
  const latestShotAt = latestDate(usableShots.map((shot) => shot.shotAt));
  const hasSide = modelShots.some((shot) => isFiniteNumber(shot.sideCarryYd));
  const hasLaunch = modelShots.some((shot) => isFiniteNumber(shot.launchAngleDeg));
  const hasBallSpeed = modelShots.some((shot) => isFiniteNumber(shot.ballSpeedMph));
  const caveats: string[] = [];

  if (modelShots.length < MIN_NUMERIC_SHOTS) {
    caveats.push(
      `Needs ${MIN_NUMERIC_SHOTS} full-swing range shots before the number is worth showing.`,
    );
  }
  if (clubs.length < MIN_NUMERIC_CLUBS) {
    caveats.push("Needs at least two clubs so one grooved club does not set the whole estimate.");
  }
  if (!hasSide) {
    caveats.push("Offline or side-carry is missing, so direction cost is not included.");
  }
  if (!hasLaunch || !hasBallSpeed) {
    caveats.push("Launch or ball speed is missing, so strike-window explanations stay limited.");
  }
  if (usableShots.length < allShots.length) {
    caveats.push("Junk, short-game and non-range rows are excluded from the estimate.");
  }
  if (usableShots.length > modelShots.length) {
    caveats.push(
      `Headline is weighted to the latest ${modelShots.length} usable shots, ahead of older history.`,
    );
  }

  if (modelShots.length < MIN_NUMERIC_SHOTS || clubs.length < MIN_NUMERIC_CLUBS) {
    return {
      value: null,
      label: "--",
      expectedRangeLabel: "--",
      confidenceScore: 0,
      confidence: "building",
      confidenceLabel: "Building",
      trend: trendFromWindows(usableShots),
      sampleSize: allShots.length,
      clubCount: clubs.length,
      sessionCount: sessionIds.size,
      usableShotCount: usableShots.length,
      modelShotCount: modelShots.length,
      latestShotAt,
      methodLabel: `Building from ${modelShots.length} recent usable range shots`,
      disclaimer: rangeDisclaimer(),
      caveats,
      timeline: buildConfidenceTimeline(usableShots),
    };
  }

  const clubScores = [...clubGroups.values()]
    .filter((shotsForClub) => shotsForClub.length >= 3)
    .map(clubRealityScore);
  const averageScore = clubScores.length > 0 ? mean(clubScores.map((score) => score.score)) : 100;
  const coverageBonus = Math.min(1.5, Math.max(0, clubs.length - 2) * 0.2);
  const value = clamp(roundOne(averageScore - coverageBonus), 0, 36);
  const confidence = estimateConfidence({
    usableShots: modelShots,
    clubCount: clubs.length,
    sessionCount: sessionIds.size,
    hasSide,
  });

  return {
    value,
    label: formatHandicapValue(value),
    expectedRangeLabel: expectedRangeLabel(value, confidence),
    confidenceScore: confidenceScore({
      usableShots: modelShots,
      clubCount: clubs.length,
      sessionCount: sessionIds.size,
      hasSide,
    }),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    trend: trendFromWindows(usableShots),
    sampleSize: allShots.length,
    clubCount: clubs.length,
    sessionCount: sessionIds.size,
    usableShotCount: usableShots.length,
    modelShotCount: modelShots.length,
    latestShotAt,
    methodLabel: `Range model from latest ${modelShots.length} shots / ${clubs.length} clubs. It blends per-club carry spread, average offline miss, big-miss rate and short-miss rate, then applies a capped club-coverage adjustment of up to 1.5 shots.`,
    disclaimer: rangeDisclaimer(),
    caveats,
    timeline: buildConfidenceTimeline(usableShots),
  };
}

function trendFromWindows(
  usableShots: RealityHandicapShot[],
): RangeRealityHandicapEstimate["trend"] {
  const latest = usableShots.slice(0, TREND_WINDOW_SHOTS);
  const previous = usableShots.slice(TREND_WINDOW_SHOTS, TREND_WINDOW_SHOTS * 2);

  if (latest.length < MIN_NUMERIC_SHOTS || previous.length < MIN_NUMERIC_SHOTS) {
    return {
      direction: "building",
      delta: null,
      label: "Trend building",
      detail: "Needs enough newer and previous range shots before calling improvement.",
    };
  }

  const latestScore = windowRealityScore(latest);
  const previousScore = windowRealityScore(previous);
  const delta = roundOne(latestScore - previousScore);

  if (delta <= -1) {
    return {
      direction: "improving",
      delta,
      label: `Improving ${Math.abs(delta).toFixed(1)}`,
      detail: "Latest range window is tighter than the previous comparable shot window.",
    };
  }

  if (delta >= 1) {
    return {
      direction: "worse",
      delta,
      label: `Drifting +${delta.toFixed(1)}`,
      detail: "Latest range window is leaking more than the previous comparable shot window.",
    };
  }

  return {
    direction: "flat",
    delta,
    label: "Holding steady",
    detail: "Latest range window is similar to the previous comparable shot window.",
  };
}

function windowRealityScore(shotsForWindow: RealityHandicapShot[]) {
  const clubScores = [...groupBy(shotsForWindow, (shot) => shot.clubType).values()]
    .filter((shotsForClub) => shotsForClub.length >= 3)
    .map(clubRealityScore);

  return clubScores.length > 0 ? mean(clubScores.map((score) => score.score)) : 100;
}

function buildConfidenceTimeline(
  usableShots: RealityHandicapShot[],
): RealityHandicapTimelineItem[] {
  const datedShots = usableShots
    .map((shot) => ({ shot, date: shotDate(shot.shotAt) }))
    .filter((item): item is { shot: RealityHandicapShot; date: Date } => item.date !== null);
  const byMonth = groupBy(datedShots, (item) => monthKey(item.date));

  return [...byMonth]
    .map(([id, items]) => {
      const monthShots = sortNewestFirst(items.map((item) => item.shot)).slice(
        0,
        TREND_WINDOW_SHOTS,
      );
      const clubs = new Set(monthShots.map((shot) => shot.clubType));
      const sessionIds = new Set(monthShots.map((shot) => shot.sessionId).filter(Boolean));
      const hasSide = monthShots.some((shot) => isFiniteNumber(shot.sideCarryYd));
      const enoughData = monthShots.length >= MIN_NUMERIC_SHOTS && clubs.size >= MIN_NUMERIC_CLUBS;
      const score = enoughData
        ? clamp(
            roundOne(
              windowRealityScore(monthShots) - Math.min(1.5, Math.max(0, clubs.size - 2) * 0.2),
            ),
            0,
            36,
          )
        : null;

      return {
        id,
        label: monthLabel(items[0]?.date ?? null),
        value: score,
        valueLabel: formatHandicapValue(score),
        confidenceScore: confidenceScore({
          usableShots: monthShots,
          clubCount: clubs.size,
          sessionCount: sessionIds.size,
          hasSide,
        }),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(-4);
}

function clubRealityScore(shotsForClub: RealityHandicapShot[]) {
  const carryValues = finiteValues(shotsForClub.map((shot) => shot.carryYd ?? shot.totalYd));
  const sideValues = finiteValues(shotsForClub.map((shot) => shot.sideCarryYd));
  const carrySpread = percentile(carryValues, 0.9) - percentile(carryValues, 0.1);
  const sideAverage = sideValues.length > 0 ? mean(sideValues.map(Math.abs)) : 18;
  const bigMissRate =
    sideValues.length > 0
      ? sideValues.filter((value) => Math.abs(value) >= BIG_MISS_SIDE_YD).length / sideValues.length
      : 0.12;
  const shortMissRate =
    carryValues.filter((value) => value <= percentile(carryValues, 0.5) - 18).length /
    carryValues.length;
  const score = 2 + carrySpread * 0.18 + sideAverage * 0.22 + bigMissRate * 18 + shortMissRate * 8;

  return { clubType: shotsForClub[0]?.clubType ?? "club", score };
}

function estimateConfidence(input: {
  usableShots: RealityHandicapShot[];
  clubCount: number;
  sessionCount: number;
  hasSide: boolean;
}): RealityHandicapConfidence {
  if (
    input.usableShots.length >= 90 &&
    input.clubCount >= 5 &&
    input.sessionCount >= 3 &&
    input.hasSide
  ) {
    return "high";
  }
  if (input.usableShots.length >= 45 && input.clubCount >= 3 && input.hasSide) {
    return "medium";
  }
  return "low";
}

function confidenceScore(input: {
  usableShots: RealityHandicapShot[];
  clubCount: number;
  sessionCount: number;
  hasSide: boolean;
}) {
  const shotScore = clamp((input.usableShots.length / RECENT_MODEL_SHOTS) * 45, 0, 45);
  const clubScore = clamp((input.clubCount / 10) * 25, 0, 25);
  const sessionScore = clamp((input.sessionCount / 8) * 20, 0, 20);
  const sideScore = input.hasSide ? 10 : 0;
  return Math.round(shotScore + clubScore + sessionScore + sideScore);
}

function expectedRangeLabel(value: number | null, confidence: RealityHandicapConfidence) {
  if (value === null) return "--";
  const margin =
    confidence === "high" ? 0.8 : confidence === "medium" ? 1.4 : confidence === "low" ? 2.2 : 3;
  return `${formatHandicapValue(clamp(value - margin, 0, 36))}-${formatHandicapValue(
    clamp(value + margin, 0, 36),
  )}`;
}

function buildCostlyShotItems(usableShots: RealityHandicapShot[]): CostlyShotItem[] {
  return buildShotCostFacts(usableShots)
    .filter((item) => item.cost >= 0.6)
    .sort((left, right) => right.cost - left.cost || left.shot.id.localeCompare(right.shot.id))
    .slice(0, 6)
    .map(({ shot, cost, side, shortBy }): CostlyShotItem => {
      const clubLabel = formatClubType(shot.clubType);
      const primary =
        side >= BIG_MISS_SIDE_YD
          ? `${clubLabel} finished ${signed(shot.sideCarryYd ?? 0)} yd offline`
          : shortBy >= SHORT_MISS_YD
            ? `${clubLabel} came up ${Math.round(shortBy)} yd short of its normal range`
            : `${clubLabel} had a costly strike or launch signal`;

      return {
        id: shot.id,
        clubType: shot.clubType,
        clubLabel,
        scoreCost: roundOne(cost),
        reason: primary,
        detail: costlyShotDetail({ side, shortBy, shot }),
        tone: cost >= 1.5 ? "pink" : cost >= 1 ? "amber" : "sky",
      };
    });
}

function buildCostlyShotGroups(usableShots: RealityHandicapShot[]): CostlyShotGroup[] {
  const costlyFacts = buildShotCostFacts(usableShots).filter((item) => item.cost >= 0.5);
  const totalCost = costlyFacts.reduce((total, item) => total + item.cost, 0);
  if (costlyFacts.length === 0 || totalCost <= 0) return [];

  return [...groupBy(costlyFacts, (item) => item.shot.clubType)]
    .map(([clubType, facts]) => {
      const clubLabel = formatClubType(clubType);
      const groupCost = facts.reduce((total, item) => total + item.cost, 0);
      const rightCount = facts.filter((item) => (item.shot.sideCarryYd ?? 0) >= 20).length;
      const leftCount = facts.filter((item) => (item.shot.sideCarryYd ?? 0) <= -20).length;
      const shortCount = facts.filter((item) => item.shortBy >= SHORT_MISS_YD).length;
      const strikeCount = facts.filter((item) => strikeCost(item.shot) > 0).length;
      const averageOffline = finiteValues(facts.map((item) => item.side));
      const tone: RealityHandicapTone =
        groupCost / totalCost >= 0.35 ? "pink" : groupCost / totalCost >= 0.18 ? "amber" : "sky";
      const missCounts = [
        { label: "Right miss", value: rightCount },
        { label: "Left miss", value: leftCount },
        { label: "Short carry", value: shortCount },
        { label: "Strike signal", value: strikeCount },
      ]
        .filter((item) => item.value > 0)
        .sort((left, right) => right.value - left.value)
        .slice(0, 3);

      return {
        id: clubType,
        clubType,
        clubLabel,
        scoreLossSharePct: Math.round((groupCost / totalCost) * 100),
        potentialGain: roundOne(Math.min(2.5, groupCost / 8)),
        occurrenceCount: facts.length,
        averageOfflineYd: averageOffline.length > 0 ? Math.round(mean(averageOffline)) : null,
        mainMisses: missCounts.length > 0 ? missCounts.map((item) => item.label) : ["Mixed miss"],
        detail: `${facts.length} scored misses in the latest usable range sample.`,
        tone,
      };
    })
    .sort((left, right) => right.scoreLossSharePct - left.scoreLossSharePct)
    .slice(0, 4);
}

function buildShotCostFacts(usableShots: RealityHandicapShot[]) {
  const byClub = groupBy(usableShots, (shot) => shot.clubType);
  const medians = new Map(
    [...byClub].map(([clubType, shotsForClub]) => [
      clubType,
      percentile(finiteValues(shotsForClub.map((shot) => shot.carryYd ?? shot.totalYd)), 0.5),
    ]),
  );

  return usableShots.map((shot) => {
    const side = isFiniteNumber(shot.sideCarryYd) ? Math.abs(shot.sideCarryYd) : 0;
    const distance = shot.carryYd ?? shot.totalYd ?? 0;
    const medianCarry = medians.get(shot.clubType) ?? distance;
    const shortBy = Math.max(0, medianCarry - distance);
    const cost = shotCost(shot, medianCarry);

    return {
      shot,
      cost,
      side,
      shortBy,
    };
  });
}

function shotCost(shot: RealityHandicapShot, medianCarry: number) {
  const side = isFiniteNumber(shot.sideCarryYd) ? Math.abs(shot.sideCarryYd) : 0;
  const distance = shot.carryYd ?? shot.totalYd ?? medianCarry;
  const shortBy = Math.max(0, medianCarry - distance);

  return roundOne(sideCost(side) + shortCost(shortBy) + strikeCost(shot));
}

function sideCost(side: number) {
  if (side >= 60) return 1.5;
  if (side >= BIG_MISS_SIDE_YD) return 1;
  if (side >= 28) return 0.5;
  return 0;
}

function shortCost(shortBy: number) {
  if (shortBy >= 35) return 1;
  if (shortBy >= SHORT_MISS_YD) return 0.55;
  return 0;
}

function strikeCost(shot: RealityHandicapShot) {
  if (shot.qualityTag && !BAD_QUALITY_TAGS.has(shot.qualityTag.toLowerCase())) {
    return 0.35;
  }
  if (
    isFiniteNumber(shot.launchAngleDeg) &&
    shot.launchAngleDeg < 3 &&
    shot.clubType !== "driver"
  ) {
    return 0.25;
  }
  return 0;
}

function costlyShotDetail({
  side,
  shortBy,
  shot,
}: {
  side: number;
  shortBy: number;
  shot: RealityHandicapShot;
}) {
  const details: string[] = [];
  if (side >= 28) details.push("direction miss");
  if (shortBy >= SHORT_MISS_YD) details.push("carry miss");
  if (isFiniteNumber(shot.launchAngleDeg) || isFiniteNumber(shot.ballSpeedMph)) {
    details.push("launch-monitor strike data available");
  }
  return details.length > 0
    ? `Flagged as ${details.join(", ")}.`
    : "Flagged by the range reality model.";
}

function buildDisasterScenarios(
  usableShots: RealityHandicapShot[],
  estimate: RangeRealityHandicapEstimate,
  costlyShots: CostlyShotItem[],
): DisasterScenario[] {
  const sideValues = finiteValues(usableShots.map((shot) => shot.sideCarryYd));
  const bigMissCount = sideValues.filter((value) => Math.abs(value) >= BIG_MISS_SIDE_YD).length;
  const bigMissRate = sideValues.length > 0 ? bigMissCount / sideValues.length : null;
  const worstCost = costlyShots[0]?.scoreCost ?? 0;

  return [
    {
      id: "penalty-risk",
      title: "Penalty-hole risk",
      value: bigMissRate === null ? "--" : `${Math.round(bigMissRate * 100)}%`,
      detail:
        bigMissRate === null
          ? "Needs offline data before estimating which range swings become reloads on course."
          : `${bigMissCount} of ${sideValues.length} measured shots finished at least ${BIG_MISS_SIDE_YD} yd offline.`,
      tone: bigMissRate === null ? "slate" : bigMissRate >= 0.18 ? "pink" : "amber",
    },
    {
      id: "worst-swing-tax",
      title: "Worst-swing tax",
      value: worstCost > 0 ? `+${roundOne(worstCost)}` : "--",
      detail:
        worstCost > 0
          ? "The biggest recent miss is treated as a likely extra-shot event, not a full scorecard prediction."
          : "No single disaster miss stands out yet.",
      tone: worstCost >= 1.5 ? "pink" : worstCost >= 1 ? "amber" : "sky",
    },
    {
      id: "range-number",
      title: "Range number",
      value: estimate.label,
      detail: estimate.disclaimer,
      tone:
        estimate.confidence === "high"
          ? "green"
          : estimate.confidence === "medium"
            ? "sky"
            : "amber",
    },
  ];
}

function buildPracticePrescriptions(
  usableShots: RealityHandicapShot[],
  costlyShots: CostlyShotItem[],
): PracticePrescriptionItem[] {
  const byClub = groupBy(usableShots, (shot) => shot.clubType);
  const clubOpportunities = [...byClub]
    .map(([clubType, shotsForClub]) => {
      const sideValues = finiteValues(shotsForClub.map((shot) => shot.sideCarryYd));
      const carryValues = finiteValues(shotsForClub.map((shot) => shot.carryYd ?? shot.totalYd));
      const sideAverage = sideValues.length ? mean(sideValues.map(Math.abs)) : 0;
      const carrySpread =
        carryValues.length >= 2 ? percentile(carryValues, 0.9) - percentile(carryValues, 0.1) : 0;

      return {
        clubType,
        score: sideAverage + carrySpread * 0.35,
        sideAverage,
        carrySpread,
        sampleSize: shotsForClub.length,
      };
    })
    .filter((item) => item.sampleSize >= 3)
    .sort((left, right) => right.score - left.score);

  const primary = clubOpportunities[0];
  const secondary = clubOpportunities[1];
  const prescriptions: PracticePrescriptionItem[] = [];

  if (primary) {
    prescriptions.push({
      id: "primary-club",
      title: `${formatClubType(primary.clubType)} start-line block`,
      clubType: primary.clubType,
      detail: `${primary.sampleSize} recent range shots show the biggest handicap-style leak.`,
      drill: `Hit 12 balls with ${formatClubType(primary.clubType)}. Score one point for start line inside ${SIDE_TARGET_YD} yd and one point for playable carry.`,
      tone: primary.sideAverage >= 28 ? "pink" : "amber",
    });
  }

  if (secondary) {
    prescriptions.push({
      id: "secondary-club",
      title: `${formatClubType(secondary.clubType)} carry window`,
      clubType: secondary.clubType,
      detail: `Carry spread is ${Math.round(secondary.carrySpread)} yd across the usable range sample.`,
      drill:
        "Hit three sets of five balls. Keep every ball inside the trusted carry window before changing target.",
      tone: "sky",
    });
  }

  prescriptions.push({
    id: "transfer",
    title: "Nine-ball course transfer",
    clubType: costlyShots[0]?.clubType ?? primary?.clubType ?? null,
    detail: "Finish with one-ball reps so the range number is not just a grooved-session score.",
    drill: "Pick a target, call the club and miss-side before every ball, then reset completely.",
    tone: "green",
  });

  return prescriptions.slice(0, 3);
}

function buildRealityFlightLines(usableShots: RealityHandicapShot[]): RealityFlightLine[] {
  return [...groupBy(usableShots, (shot) => shot.clubType)]
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 4)
    .flatMap(([clubType, shotsForClub]) => {
      const medianCarry = percentile(
        finiteValues(shotsForClub.map((shot) => shot.carryYd ?? shot.totalYd)),
        0.5,
      );
      const shotById = new Map(shotsForClub.map((shot) => [shot.id, shot]));
      const pattern = buildShotPatternResult({
        rawShots: shotsForClub.slice(0, 50).map(toShotPatternRawShot),
        clubId: null,
        clubType,
        clubLabel: formatClubType(clubType),
        mode: "carry",
        outlierMode: "best90",
      });

      return balancedFlightLineSample(
        pattern.points.map((point) => {
          const sourceShot = shotById.get(point.id) ?? null;
          const scoreCost = sourceShot ? shotCost(sourceShot, medianCarry) : 0;
          const sideYd = sourceShot?.sideCarryYd ?? point.sideYd;

          return {
            id: point.id,
            clubType,
            clubLabel: pattern.clubLabel,
            carryYd: point.forwardYd,
            sideYd: point.sideYd,
            launchDirectionDeg: sourceShot?.launchDirectionDeg ?? null,
            scoreCost,
            isCostly: scoreCost >= 0.6,
            isDirectionalDamage: Math.abs(sideYd) >= 20,
            included: point.included,
          };
        }),
        36,
      );
    });
}

function balancedFlightLineSample(lines: RealityFlightLine[], limit: number) {
  const buckets = [
    lines.filter((line) => Math.abs(line.sideYd) <= 10),
    lines.filter((line) => line.sideYd <= -20),
    lines.filter((line) => line.sideYd >= 20),
    lines.filter((line) => line.isCostly && !line.isDirectionalDamage),
    lines,
  ];
  const selected: RealityFlightLine[] = [];
  const selectedIds = new Set<string>();

  for (let index = 0; selected.length < limit; index += 1) {
    let addedInPass = false;
    for (const bucket of buckets) {
      const line = bucket[index];
      if (!line || selectedIds.has(line.id)) continue;
      selected.push(line);
      selectedIds.add(line.id);
      addedInPass = true;
      if (selected.length >= limit) break;
    }
    if (!addedInPass) break;
  }

  return selected.sort((left, right) => left.carryYd - right.carryYd || left.sideYd - right.sideYd);
}

function toShotPatternRawShot(shot: RealityHandicapShot): ShotPatternRawShot {
  return {
    id: shot.id,
    clubId: shot.clubId,
    clubType: shot.clubType,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    shotAt: shot.shotAt instanceof Date ? shot.shotAt : shot.shotAt ? new Date(shot.shotAt) : null,
    shotCategory: shot.shotCategory ?? null,
    qualityTag: shot.qualityTag ?? null,
    sessionType: shot.sessionType ?? null,
  };
}

function buildBagTruthItems(usableShots: RealityHandicapShot[]): BagTruthItem[] {
  return [...groupBy(usableShots, (shot) => shot.clubType)]
    .map(([clubType, shotsForClub]) => {
      const carryValues = finiteValues(shotsForClub.map((shot) => shot.carryYd ?? shot.totalYd));
      const p25 = percentile(carryValues, 0.25);
      const p75 = percentile(carryValues, 0.75);
      const confidence =
        shotsForClub.length >= 20 ? "High" : shotsForClub.length >= 10 ? "Medium" : "Building";

      const tone: RealityHandicapTone =
        confidence === "High" ? "green" : confidence === "Medium" ? "sky" : "amber";

      return {
        clubType,
        clubLabel: formatClubType(clubType),
        carryRangeLabel: carryValues.length > 0 ? `${Math.round(p25)}-${Math.round(p75)} yd` : "--",
        sampleSize: shotsForClub.length,
        confidenceLabel: confidence,
        detail:
          confidence === "High"
            ? "Reliable enough to use as a range-session truth window."
            : "Useful signal, but needs more shots before it becomes a trusted carry.",
        tone,
      };
    })
    .sort((left, right) => right.sampleSize - left.sampleSize)
    .slice(0, 5);
}

function confidenceLabel(confidence: RealityHandicapConfidence) {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
    default:
      return "Building";
  }
}

function rangeDisclaimer() {
  return "Range reality is a launch-monitor estimate for practice benchmarking, not an official Handicap Index.";
}

function formatHandicapValue(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

function latestDate(values: Array<Date | string | null>) {
  const times = values
    .map((value) => (value instanceof Date ? value : value ? new Date(value) : null))
    .filter((value): value is Date => value !== null && Number.isFinite(value.getTime()))
    .map((value) => value.getTime());
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

function shotDate(value: Date | string | null) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: Date | null) {
  if (!value) return "Range";
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(value);
}

function sortNewestFirst(shotsToSort: RealityHandicapShot[]) {
  return [...shotsToSort].sort(
    (left, right) =>
      shotTime(right.shotAt) - shotTime(left.shotAt) || left.id.localeCompare(right.id),
  );
}

function shotTime(value: Date | string | null) {
  if (value instanceof Date) return value.getTime();
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupBy<T, K>(items: T[], keyForItem: (item: T) => K) {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function finiteValues(values: Array<number | null | undefined>) {
  return values.filter(isFiniteNumber);
}

function percentile(values: number[], ratio: number) {
  const sorted = values.filter(isFiniteNumber).sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function mean(values: number[]) {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function signed(value: number) {
  return value > 0 ? `right ${Math.round(value)}` : `left ${Math.round(Math.abs(value))}`;
}
