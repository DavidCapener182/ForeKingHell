import { clubSortValue, formatClubType, isShortGameTouchClubType } from "@/lib/club-format";
import { calculateStockYardage, selectStockYardageShots } from "@/lib/stock-yardage";

export type ClubAnalyticsShot = {
  id: string;
  sessionId?: string | null;
  clubType: string;
  shotNumber?: number | null;
  shotAt: Date | string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate?: number | null;
  spinAxis?: number | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
  clubDataEstType?: string | null;
  courseHoleNumber?: number | null;
  sessionType?: string | null;
};

export type BagClubAnalyticsContext = {
  clubId: string;
  clubType: string;
  stockCarryYd: number | null;
  confidenceScore: number;
  sampleSize: number;
};

export type ClubAnalytics = {
  clubType: string;
  sample: {
    totalShots: number;
    cleanShots: number;
    stockShots: number;
    latestShotAt: Date | null;
  };
  distance: {
    stockCarryYd: number | null;
    meanCarryYd: number | null;
    safeCarryYd: number | null;
    aggressiveCarryYd: number | null;
    p90CarryYd: number | null;
    bestCarryYd: number | null;
    mishitFloorYd: number | null;
    totalMedianYd: number | null;
    carrySpreadYd: number | null;
    stockPlayNumberYd: number | null;
    doNotForceOverYd: number | null;
  };
  accuracy: {
    averageSideCarryYd: number | null;
    absoluteOfflineAverageYd: number | null;
    leftMissRate: number | null;
    rightMissRate: number | null;
    bigMissRate: number | null;
    playableShotRate: number | null;
    shotConeWidthYd: number | null;
    startLineAverageDeg: number | null;
    startLineStdDevDeg: number | null;
    primaryMiss: "Left" | "Right" | "Balanced" | "Unknown";
    primaryShape: ShotShape;
    shapeCounts: Record<ShotShape, number>;
  };
  launch: {
    launchAverageDeg: number | null;
    launchSpreadDeg: number | null;
    launchWindow: { low: number; high: number };
    launchWindowScore: number | null;
    apexAverageFt: number | null;
    apexSpreadFt: number | null;
    descentAverageDeg: number | null;
    stoppingPowerScore: number | null;
    lowFlightRate: number | null;
    balloonRate: number | null;
  };
  strike: {
    ballSpeedAverageMph: number | null;
    ballSpeedSpreadMph: number | null;
    clubSpeedAverageMph: number | null;
    clubSpeedSpreadMph: number | null;
    smashAverage: number | null;
    smashSpread: number | null;
    highSmashRate: number | null;
    lowSmashRate: number | null;
    speedLeakageRate: number | null;
  };
  delivery: {
    clubPathAverageDeg: number | null;
    clubPathSpreadDeg: number | null;
    pathSpikeRate: number | null;
    attackAngleAverageDeg: number | null;
    attackAngleSpreadDeg: number | null;
    facePathProxyAverageDeg: number | null;
    hookRiskScore: number | null;
    blockRiskScore: number | null;
    clubDataAvailableRate: number | null;
    clubDataEstimatedRate: number | null;
    dataWarning: string | null;
  };
  consistency: {
    carryConsistencyScore: number;
    directionConsistencyScore: number;
    strikeConsistencyScore: number;
    flightConsistencyScore: number;
    clubTrustIndex: number;
    confidenceScore: number;
    confidenceLabel: "Not enough data" | "Unstable" | "Developing" | "Reliable" | "Trusted club";
  };
  decision: {
    role: string;
    trustVerdict: "Needs data" | "Avoid under pressure" | "Developing" | "Playable" | "Trusted";
    recommendedUse: string;
    pressureUse: string;
    playNumberYd: number | null;
    rangeStockYd: number | null;
    maxNumberYd: number | null;
    doNotForceOverYd: number | null;
  };
  diagnosis: {
    title: string;
    likelyCause: string;
    evidence: string;
    practiceFocus: string;
    severity: "low" | "medium" | "high";
  };
  gapping: {
    previousClubType: string | null;
    previousGapYd: number | null;
    nextClubType: string | null;
    nextGapYd: number | null;
    status: "Healthy" | "Overlap" | "Watch" | "Needs data";
    note: string;
  };
  progress: {
    baseline: ProgressSnapshot | null;
    current: ProgressSnapshot | null;
    previousSession: ProgressSnapshot | null;
    latestSession: ProgressSnapshot | null;
    baselineDelta: ProgressDelta | null;
    lastSessionDelta: ProgressDelta | null;
    monthlyDelta: ProgressDelta | null;
    personalBestCarryYd: number | null;
  };
  insights: ClubInsight[];
  practice: {
    title: string;
    goal: string;
    drill: string;
  };
};

export type ShotShape =
  | "straight"
  | "push"
  | "pull"
  | "draw"
  | "fade"
  | "hook"
  | "slice"
  | "block"
  | "pull hook"
  | "mixed"
  | "unknown";

export type ProgressSnapshot = {
  label: string;
  shotCount: number;
  carryMedianYd: number | null;
  ballSpeedAverageMph: number | null;
  launchAverageDeg: number | null;
  absoluteOfflineAverageYd: number | null;
  clubPathAverageDeg: number | null;
};

export type ProgressDelta = {
  label: string;
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  launchDeltaDeg: number | null;
  offlineDeltaYd: number | null;
  clubPathDeltaDeg: number | null;
};

export type ClubInsight = {
  title: string;
  body: string;
  tone: "green" | "sky" | "amber" | "pink" | "slate";
};

const BIG_MISS_LIMIT_BY_FAMILY = {
  driver: 35,
  wood: 30,
  hybrid: 26,
  iron: 22,
  wedge: 16,
};

const PLAYABLE_LIMIT_BY_FAMILY = {
  driver: 45,
  wood: 36,
  hybrid: 32,
  iron: 26,
  wedge: 18,
};

const LAUNCH_WINDOWS: Record<string, { low: number; high: number }> = {
  driver: { low: 12, high: 17 },
  "3w": { low: 10, high: 16 },
  "5w": { low: 11, high: 17 },
  "7w": { low: 12, high: 19 },
  "3h": { low: 12, high: 19 },
  "4h": { low: 13, high: 20 },
  "5h": { low: 14, high: 21 },
  "4i": { low: 12, high: 19 },
  "5i": { low: 14, high: 21 },
  "6i": { low: 16, high: 24 },
  "7i": { low: 18, high: 26 },
  "8i": { low: 20, high: 28 },
  "9i": { low: 22, high: 30 },
  pw: { low: 24, high: 34 },
  gw: { low: 25, high: 36 },
  aw: { low: 25, high: 36 },
  sw: { low: 26, high: 40 },
  lw: { low: 28, high: 44 },
};

export function calculateClubAnalytics({
  clubType,
  shots,
  bagContext = [],
}: {
  clubType: string;
  shots: ClubAnalyticsShot[];
  bagContext?: BagClubAnalyticsContext[];
}): ClubAnalytics {
  const orderedShots = [...shots].sort(
    (left, right) => dateValue(left.shotAt) - dateValue(right.shotAt),
  );
  const latestShotAt =
    orderedShots.length > 0
      ? new Date(dateValue(orderedShots[orderedShots.length - 1].shotAt))
      : null;
  const allSample = selectStockYardageShots(orderedShots, orderedShots.length, { clubType });
  const trendShots = [...allSample.filteredShots].sort(
    (left, right) => dateValue(left.shotAt) - dateValue(right.shotAt),
  );
  const stockSample = selectStockYardageShots(orderedShots, 50, { clubType });
  const cleanShots = stockSample.cleanShots;
  const stockShots = stockSample.filteredShots;
  const carryValues = stockShots.map((shot) => shot.carryYd).filter(isNumber);
  const sideValues = stockShots.map((shot) => shot.sideCarryYd).filter(isNumber);
  const launchDirectionValues = stockShots.map((shot) => shot.launchDirectionDeg).filter(isNumber);
  const launchValues = stockShots.map((shot) => shot.launchAngleDeg).filter(isNumber);
  const apexValues = stockShots.map((shot) => shot.apexFt).filter(isNumber);
  const descentValues = stockShots.map((shot) => shot.descentAngleDeg).filter(isNumber);
  const ballSpeedValues = stockShots.map((shot) => shot.ballSpeedMph).filter(isNumber);
  const clubSpeedValues = stockShots.map((shot) => shot.clubSpeedMph).filter(isNumber);
  const smashValues = stockShots.map((shot) => shot.smashFactor).filter(isNumber);
  const pathValues = stockShots.map((shot) => shot.clubPathDeg).filter(isNumber);
  const attackValues = stockShots.map((shot) => shot.attackAngleDeg).filter(isNumber);
  const stock = calculateStockYardage(orderedShots, 50, { clubType });
  const family = clubFamily(clubType);
  const bigMissLimit = BIG_MISS_LIMIT_BY_FAMILY[family];
  const playableLimit = PLAYABLE_LIMIT_BY_FAMILY[family];
  const launchWindow = launchWindowForClub(clubType);
  const shapeCounts = countShotShapes(stockShots);
  const primaryShape = primaryShotShape(shapeCounts);
  const clubDataShots = stockShots.filter(
    (shot) => isNumber(shot.clubPathDeg) || isNumber(shot.attackAngleDeg),
  );
  const estimatedClubDataShots = clubDataShots.filter((shot) =>
    isEstimatedClubData(shot.clubDataEstType),
  );
  const facePathProxyValues = stockShots
    .map((shot) =>
      isNumber(shot.launchDirectionDeg) && isNumber(shot.clubPathDeg)
        ? shot.launchDirectionDeg - shot.clubPathDeg
        : null,
    )
    .filter(isNumber);
  const baseline = snapshot("First 30 clean shots", trendShots.slice(0, 30));
  const current = snapshot("Latest 30 clean shots", trendShots.slice(-30));
  const sessionComparison = compareLastTwoSessions(trendShots);
  const monthlyDelta = windowDelta(trendShots, "This month vs last month", 30, 60);
  const gapping = buildGappingProfile(clubType, stock.carryMedianYd, bagContext);
  const distance = {
    stockCarryYd: stock.carryMedianYd,
    meanCarryYd: stock.carryMeanYd,
    safeCarryYd: roundOne(percentile(carryValues, 0.25)),
    aggressiveCarryYd: roundOne(percentile(carryValues, 0.75)),
    p90CarryYd: roundOne(percentile(carryValues, 0.9)),
    bestCarryYd: roundOne(percentile(carryValues, 0.95) ?? max(carryValues)),
    mishitFloorYd: roundOne(percentile(carryValues, 0.1)),
    totalMedianYd: stock.totalMedianYd,
    carrySpreadYd: roundOne(interquartileRange(carryValues)),
    stockPlayNumberYd: stock.recommendedPlayNumberYd,
    doNotForceOverYd: roundOne(percentile(carryValues, 0.75)),
  };
  const accuracy = {
    averageSideCarryYd: roundOne(meanOrNull(sideValues)),
    absoluteOfflineAverageYd: roundOne(meanOrNull(sideValues.map(Math.abs))),
    leftMissRate: rate(stockShots, (shot) => isNumber(shot.sideCarryYd) && shot.sideCarryYd < -5),
    rightMissRate: rate(stockShots, (shot) => isNumber(shot.sideCarryYd) && shot.sideCarryYd > 5),
    bigMissRate: rate(
      stockShots,
      (shot) => isNumber(shot.sideCarryYd) && Math.abs(shot.sideCarryYd) > bigMissLimit,
    ),
    playableShotRate: rate(
      stockShots,
      (shot) =>
        isNumber(shot.sideCarryYd) &&
        Math.abs(shot.sideCarryYd) <= playableLimit &&
        (distance.stockCarryYd === null || (shot.carryYd ?? 0) >= distance.stockCarryYd * 0.85),
    ),
    shotConeWidthYd: roundOne(
      percentile(sideValues, 0.9) !== null && percentile(sideValues, 0.1) !== null
        ? (percentile(sideValues, 0.9) ?? 0) - (percentile(sideValues, 0.1) ?? 0)
        : null,
    ),
    startLineAverageDeg: roundOne(meanOrNull(launchDirectionValues)),
    startLineStdDevDeg: roundOne(standardDeviationOrNull(launchDirectionValues)),
    primaryMiss: primaryMiss(sideValues),
    primaryShape,
    shapeCounts,
  };
  const launch = {
    launchAverageDeg: roundOne(meanOrNull(launchValues)),
    launchSpreadDeg: roundOne(standardDeviationOrNull(launchValues)),
    launchWindow,
    launchWindowScore: rate(
      stockShots,
      (shot) =>
        isNumber(shot.launchAngleDeg) &&
        shot.launchAngleDeg >= launchWindow.low &&
        shot.launchAngleDeg <= launchWindow.high,
    ),
    apexAverageFt: roundOne(meanOrNull(apexValues)),
    apexSpreadFt: roundOne(standardDeviationOrNull(apexValues)),
    descentAverageDeg: roundOne(meanOrNull(descentValues)),
    stoppingPowerScore: stoppingPowerScore(clubType, descentValues),
    lowFlightRate: rate(stockShots, (shot) => isLowFlight(clubType, shot)),
    balloonRate: rate(
      stockShots,
      (shot) => isNumber(shot.launchAngleDeg) && shot.launchAngleDeg > launchWindow.high + 4,
    ),
  };
  const strike = {
    ballSpeedAverageMph: roundOne(meanOrNull(ballSpeedValues)),
    ballSpeedSpreadMph: roundOne(standardDeviationOrNull(ballSpeedValues)),
    clubSpeedAverageMph: roundOne(meanOrNull(clubSpeedValues)),
    clubSpeedSpreadMph: roundOne(standardDeviationOrNull(clubSpeedValues)),
    smashAverage: roundTwo(meanOrNull(smashValues)),
    smashSpread: roundTwo(standardDeviationOrNull(smashValues)),
    highSmashRate: rate(
      stockShots,
      (shot) => isNumber(shot.smashFactor) && shot.smashFactor >= highSmashThreshold(clubType),
    ),
    lowSmashRate: rate(
      stockShots,
      (shot) => isNumber(shot.smashFactor) && shot.smashFactor <= lowSmashThreshold(clubType),
    ),
    speedLeakageRate: speedLeakageRate(stockShots),
  };
  const delivery = {
    clubPathAverageDeg: roundOne(meanOrNull(pathValues)),
    clubPathSpreadDeg: roundOne(standardDeviationOrNull(pathValues)),
    pathSpikeRate: rate(
      stockShots,
      (shot) => isNumber(shot.clubPathDeg) && Math.abs(shot.clubPathDeg) > 8,
    ),
    attackAngleAverageDeg: roundOne(meanOrNull(attackValues)),
    attackAngleSpreadDeg: roundOne(standardDeviationOrNull(attackValues)),
    facePathProxyAverageDeg: roundOne(meanOrNull(facePathProxyValues)),
    hookRiskScore: riskScore(stockShots, "hook"),
    blockRiskScore: riskScore(stockShots, "block"),
    clubDataAvailableRate: percent(clubDataShots.length, stockShots.length),
    clubDataEstimatedRate: percent(estimatedClubDataShots.length, clubDataShots.length),
    dataWarning: clubDataWarning(
      clubDataShots.length,
      estimatedClubDataShots.length,
      stockShots.length,
    ),
  };
  const consistency = buildConsistency({
    stock,
    carryValues,
    sideValues,
    launchDirectionValues,
    launchValues,
    apexValues,
    smashValues,
    ballSpeedValues,
  });
  const decision = buildDecision({
    clubType,
    distance,
    accuracy,
    launch,
    consistency,
  });
  const diagnosis = buildDiagnosis({
    clubType,
    distance,
    accuracy,
    launch,
    strike,
    delivery,
    consistency,
  });
  const progress = {
    baseline,
    current,
    previousSession: sessionComparison.previous,
    latestSession: sessionComparison.latest,
    baselineDelta: baseline && current ? delta("Latest 30 vs first 30", baseline, current) : null,
    lastSessionDelta: sessionComparison.delta,
    monthlyDelta,
    personalBestCarryYd: roundOne(max(carryValues)),
  };
  const insights = buildInsights({
    clubType,
    distance,
    accuracy,
    launch,
    strike,
    delivery,
    consistency,
    progress,
    gapping,
  });

  return {
    clubType,
    sample: {
      totalShots: orderedShots.length,
      cleanShots: cleanShots.length,
      stockShots: stockShots.length,
      latestShotAt,
    },
    distance,
    accuracy,
    launch,
    strike,
    delivery,
    consistency,
    decision,
    diagnosis,
    gapping,
    progress,
    insights,
    practice: practiceRecommendation(clubType, insights, accuracy, launch, strike, delivery),
  };
}

export function classifyShotShape({
  launchDirectionDeg,
  sideCarryYd,
}: {
  launchDirectionDeg: number | null;
  sideCarryYd: number | null;
}): ShotShape {
  if (!isNumber(launchDirectionDeg) || !isNumber(sideCarryYd)) {
    return "unknown";
  }

  if (Math.abs(launchDirectionDeg) <= 3 && Math.abs(sideCarryYd) <= 10) {
    return "straight";
  }

  if (launchDirectionDeg > 3 && sideCarryYd < -25) {
    return "hook";
  }

  if (launchDirectionDeg < -3 && sideCarryYd > 25) {
    return "slice";
  }

  if (launchDirectionDeg > 3 && sideCarryYd < -10) {
    return "draw";
  }

  if (launchDirectionDeg < -3 && sideCarryYd > 10) {
    return "fade";
  }

  if (launchDirectionDeg > 3 && sideCarryYd > 10) {
    return sideCarryYd > 25 ? "block" : "push";
  }

  if (launchDirectionDeg < -3 && sideCarryYd < -10) {
    return sideCarryYd < -25 ? "pull hook" : "pull";
  }

  if (sideCarryYd < -25) {
    return "hook";
  }

  if (sideCarryYd > 25) {
    return "slice";
  }

  return "mixed";
}

export function likelyMishitTags({
  clubType,
  shot,
  stockCarryYd,
}: {
  clubType: string;
  shot: ClubAnalyticsShot;
  stockCarryYd: number | null;
}) {
  const tags: string[] = [];
  const family = clubFamily(clubType);

  if (isNumber(stockCarryYd) && isNumber(shot.carryYd) && shot.carryYd < stockCarryYd * 0.65) {
    tags.push("mishit floor");
  }

  if (
    isNumber(shot.launchAngleDeg) &&
    isNumber(shot.apexFt) &&
    shot.launchAngleDeg < 8 &&
    shot.apexFt < 35
  ) {
    tags.push(family === "driver" || family === "wood" ? "low bullet" : "thin/top");
  }

  if (isNumber(shot.smashFactor) && shot.smashFactor <= lowSmashThreshold(clubType)) {
    tags.push("dead strike");
  }

  if (isNumber(shot.clubSpeedMph) && isNumber(shot.ballSpeedMph) && isNumber(shot.smashFactor)) {
    const fastEnough = shot.clubSpeedMph >= (family === "driver" ? 85 : 70);
    if (fastEnough && shot.smashFactor <= lowSmashThreshold(clubType)) {
      tags.push("speed leakage");
    }
  }

  if (isNumber(shot.sideCarryYd) && shot.sideCarryYd < -BIG_MISS_LIMIT_BY_FAMILY[family]) {
    tags.push("overdraw/hook");
  }

  if (
    isNumber(shot.launchDirectionDeg) &&
    isNumber(shot.sideCarryYd) &&
    shot.launchDirectionDeg > 3 &&
    shot.sideCarryYd > BIG_MISS_LIMIT_BY_FAMILY[family]
  ) {
    tags.push("block");
  }

  return [...new Set(tags)];
}

function countShotShapes(shots: ClubAnalyticsShot[]) {
  const counts = emptyShapeCounts();

  for (const shot of shots) {
    counts[classifyShotShape(shot)] += 1;
  }

  return counts;
}

function emptyShapeCounts(): Record<ShotShape, number> {
  return {
    straight: 0,
    push: 0,
    pull: 0,
    draw: 0,
    fade: 0,
    hook: 0,
    slice: 0,
    block: 0,
    "pull hook": 0,
    mixed: 0,
    unknown: 0,
  };
}

function primaryShotShape(shapeCounts: Record<ShotShape, number>): ShotShape {
  const entries = Object.entries(shapeCounts).filter(([shape]) => shape !== "unknown") as Array<
    [ShotShape, number]
  >;
  const [shape, count] = entries.sort((left, right) => right[1] - left[1])[0] ?? ["unknown", 0];
  return count > 0 ? shape : "unknown";
}

function buildDecision(input: {
  clubType: string;
  distance: ClubAnalytics["distance"];
  accuracy: ClubAnalytics["accuracy"];
  launch: ClubAnalytics["launch"];
  consistency: ClubAnalytics["consistency"];
}): ClubAnalytics["decision"] {
  const family = clubFamily(input.clubType);
  const trust = input.consistency.clubTrustIndex;
  const sampleEnough = input.consistency.confidenceLabel !== "Not enough data";
  const playableRate = input.accuracy.playableShotRate ?? 0;
  const trustVerdict: ClubAnalytics["decision"]["trustVerdict"] = !sampleEnough
    ? "Needs data"
    : trust >= 82 && playableRate >= 70
      ? "Trusted"
      : trust >= 66 && playableRate >= 55
        ? "Playable"
        : trust >= 48
          ? "Developing"
          : "Avoid under pressure";

  const role = clubRole(input.clubType);
  const missText =
    input.accuracy.primaryMiss === "Unknown" || input.accuracy.primaryMiss === "Balanced"
      ? "neutral miss pattern"
      : `${input.accuracy.primaryMiss.toLowerCase()} miss`;
  const recommendedUse = decisionUseText({
    family,
    role,
    trustVerdict,
    missText,
    launchWindowScore: input.launch.launchWindowScore,
  });
  const pressureUse =
    trustVerdict === "Trusted"
      ? `Use it normally under pressure. Play ${formatNullableYards(input.distance.stockPlayNumberYd)} as the course number.`
      : trustVerdict === "Playable"
        ? `Use it when the ${missText} is safe. Club up instead of forcing more than ${formatNullableYards(input.distance.doNotForceOverYd)}.`
        : trustVerdict === "Developing"
          ? "Use it only when the miss pattern has room. Treat the stock number as a range, not a promise."
          : "Do not make this a pressure club yet. Build cleaner full-shot samples first.";

  return {
    role,
    trustVerdict,
    recommendedUse,
    pressureUse,
    playNumberYd: input.distance.stockPlayNumberYd,
    rangeStockYd: input.distance.stockCarryYd,
    maxNumberYd: input.distance.p90CarryYd,
    doNotForceOverYd: input.distance.doNotForceOverYd,
  };
}

function buildDiagnosis(input: {
  clubType: string;
  distance: ClubAnalytics["distance"];
  accuracy: ClubAnalytics["accuracy"];
  launch: ClubAnalytics["launch"];
  strike: ClubAnalytics["strike"];
  delivery: ClubAnalytics["delivery"];
  consistency: ClubAnalytics["consistency"];
}): ClubAnalytics["diagnosis"] {
  const clubName = formatClubType(input.clubType);

  if (input.consistency.confidenceLabel === "Not enough data") {
    return {
      title: "Build the sample first",
      likelyCause: "There are not enough clean stock shots to separate a real pattern from noise.",
      evidence: `${input.consistency.confidenceScore}% confidence with limited clean data.`,
      practiceFocus: `Hit 12 normal ${clubName} stock shots and keep chips, punches, and recovery shots out of this sample.`,
      severity: "medium",
    };
  }

  if ((input.accuracy.bigMissRate ?? 0) >= 30 || (input.accuracy.playableShotRate ?? 100) < 55) {
    return {
      title: "Direction is costing trust",
      likelyCause:
        input.delivery.clubPathAverageDeg !== null &&
        Math.abs(input.delivery.clubPathAverageDeg) >= 6
          ? "Delivery path is far enough from neutral that face control has to work too hard."
          : "Start line and face control are moving more than the distance pattern.",
      evidence: `${formatNullableRate(input.accuracy.playableShotRate)} playable rate, ${formatNullableRate(input.accuracy.bigMissRate)} big-miss rate, ${input.accuracy.primaryMiss.toLowerCase()} bias.`,
      practiceFocus: `Use a ${input.accuracy.primaryMiss.toLowerCase()} guardrail and count only shots that finish inside the playable window.`,
      severity: "high",
    };
  }

  if ((input.launch.launchWindowScore ?? 100) < 60 || (input.launch.lowFlightRate ?? 0) >= 25) {
    return {
      title: "Launch window is the limiter",
      likelyCause:
        "The strike or delivered loft is changing enough to move the flight out of its useful window.",
      evidence: `${formatNullableRate(input.launch.launchWindowScore)} launch-window score against ${input.launch.launchWindow.low}-${input.launch.launchWindow.high} degrees.`,
      practiceFocus: `Hit 12 stock shots and make the first pass/fail goal launch between ${input.launch.launchWindow.low} and ${input.launch.launchWindow.high} degrees.`,
      severity: "medium",
    };
  }

  if ((input.strike.lowSmashRate ?? 0) >= 25 || (input.strike.speedLeakageRate ?? 0) >= 20) {
    return {
      title: "Strike efficiency is leaking speed",
      likelyCause: "Club speed is not consistently turning into ball speed.",
      evidence: `${formatNullableRate(input.strike.lowSmashRate)} low-smash rate and ${formatNullableRate(input.strike.speedLeakageRate)} speed-leakage rate.`,
      practiceFocus:
        "Hit 12 balls at 80% speed and only add speed when ball speed and smash stay stable.",
      severity: "medium",
    };
  }

  if ((input.distance.carrySpreadYd ?? 0) >= 18 || input.consistency.carryConsistencyScore < 62) {
    return {
      title: "Distance reliability needs tightening",
      likelyCause:
        "The middle of the carry window is still too wide to make one number feel automatic.",
      evidence: `${formatNullableYards(input.distance.carrySpreadYd)} carry spread with ${input.consistency.carryConsistencyScore}% distance reliability.`,
      practiceFocus:
        "Hit two five-ball stock sets and compare whether both sets land in the same carry window.",
      severity: "medium",
    };
  }

  return {
    title: "The pattern is playable",
    likelyCause: "Distance, launch, strike, and direction are balanced enough for normal use.",
    evidence: `${input.consistency.clubTrustIndex}% trust with ${formatNullableRate(input.accuracy.playableShotRate)} playable shots.`,
    practiceFocus:
      "Maintain the current stock routine and only push max carry when the miss is safe.",
    severity: "low",
  };
}

function clubRole(clubType: string) {
  const family = clubFamily(clubType);

  if (family === "driver") {
    return "Distance tee club";
  }

  if (family === "wood") {
    return "Safe tee or long approach option";
  }

  if (family === "hybrid") {
    return "Long approach control club";
  }

  if (family === "wedge") {
    return isShortGameTouchClubType(clubType) ? "Short-game distance ladder" : "Scoring wedge";
  }

  if (["8i", "9i"].includes(clubType)) {
    return "Scoring iron";
  }

  return "Stock approach club";
}

function decisionUseText(input: {
  family: keyof typeof BIG_MISS_LIMIT_BY_FAMILY;
  role: string;
  trustVerdict: ClubAnalytics["decision"]["trustVerdict"];
  missText: string;
  launchWindowScore: number | null;
}) {
  if (input.trustVerdict === "Needs data") {
    return `Treat this as ${input.role.toLowerCase()} in testing only until the sample grows.`;
  }

  if (input.family === "driver") {
    return input.trustVerdict === "Trusted" || input.trustVerdict === "Playable"
      ? `Use as the main tee club when the ${input.missText} has room. Distance is useful enough; protect direction.`
      : `Use only on wide tee shots until the miss pattern tightens.`;
  }

  if (input.family === "wood" || input.family === "hybrid") {
    return input.launchWindowScore !== null && input.launchWindowScore < 60
      ? `Use mainly as a safe tee option for now. The flight window needs work before attacking long greens.`
      : `Use as a long approach or position club when the ${input.missText} is acceptable.`;
  }

  if (input.family === "wedge") {
    return "Use for distance-window work. Separate full swings from touch shots so the stock number stays honest.";
  }

  return input.trustVerdict === "Trusted"
    ? "Use as a normal stock approach club."
    : `Use as an approach club when the ${input.missText} is safe; club up rather than forcing the top number.`;
}

function buildGappingProfile(
  clubType: string,
  stockCarryYd: number | null,
  bagContext: BagClubAnalyticsContext[],
): ClubAnalytics["gapping"] {
  const orderedClubs = [...bagContext]
    .filter((club) => isNumber(club.stockCarryYd))
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
  const index = orderedClubs.findIndex((club) => club.clubType === clubType);
  const previous = index > 0 ? orderedClubs[index - 1] : null;
  const next = index >= 0 && index < orderedClubs.length - 1 ? orderedClubs[index + 1] : null;
  const previousGapYd =
    previous && isNumber(stockCarryYd) && isNumber(previous.stockCarryYd)
      ? previous.stockCarryYd - stockCarryYd
      : null;
  const nextGapYd =
    next && isNumber(stockCarryYd) && isNumber(next.stockCarryYd)
      ? stockCarryYd - next.stockCarryYd
      : null;
  const gaps = [previousGapYd, nextGapYd].filter(isNumber);

  if (!isNumber(stockCarryYd) || gaps.length === 0) {
    return {
      previousClubType: previous?.clubType ?? null,
      previousGapYd,
      nextClubType: next?.clubType ?? null,
      nextGapYd,
      status: "Needs data",
      note: "Need adjacent stock numbers before making gapping calls.",
    };
  }

  const hasOverlap = gaps.some((gap) => gap <= 4);
  const hasWatchGap = gaps.some((gap) => gap < 8 || gap > 28);

  return {
    previousClubType: previous?.clubType ?? null,
    previousGapYd: roundOne(previousGapYd),
    nextClubType: next?.clubType ?? null,
    nextGapYd: roundOne(nextGapYd),
    status: hasOverlap ? "Overlap" : hasWatchGap ? "Watch" : "Healthy",
    note: hasOverlap
      ? "One adjacent club overlaps this stock carry. Check more than one session before changing equipment."
      : hasWatchGap
        ? "One adjacent gap is outside the usual window, so this club deserves a gapping check."
        : "Adjacent stock carries sit in a playable gap window.",
  };
}

function buildConsistency(input: {
  stock: ReturnType<typeof calculateStockYardage>;
  carryValues: number[];
  sideValues: number[];
  launchDirectionValues: number[];
  launchValues: number[];
  apexValues: number[];
  smashValues: number[];
  ballSpeedValues: number[];
}): ClubAnalytics["consistency"] {
  const carryIqr = interquartileRange(input.carryValues);
  const carryMedian = median(input.carryValues);
  const carryConsistencyScore =
    carryIqr === null || carryMedian === null
      ? 0
      : scoreFromRatio(carryIqr / Math.max(1, carryMedian), 0.22);
  const sideStdDev = standardDeviationOrNull(input.sideValues);
  const startStdDev = standardDeviationOrNull(input.launchDirectionValues);
  const directionConsistencyScore = scoreFromRaw((sideStdDev ?? 45) + (startStdDev ?? 8) * 3, 70);
  const smashStdDev = standardDeviationOrNull(input.smashValues);
  const ballSpeedStdDev = standardDeviationOrNull(input.ballSpeedValues);
  const strikeConsistencyScore = scoreFromRaw(
    (smashStdDev ?? 0.12) * 260 + (ballSpeedStdDev ?? 12),
    42,
  );
  const launchStdDev = standardDeviationOrNull(input.launchValues);
  const apexStdDev = standardDeviationOrNull(input.apexValues);
  const flightConsistencyScore = scoreFromRaw(
    (launchStdDev ?? 8) * 4 + (apexStdDev ?? 40) * 0.45,
    58,
  );
  const sampleSizeScore = clamp(input.stock.sampleSize / 30, 0, 1) * 100;
  const clubTrustIndex = Math.round(
    carryConsistencyScore * 0.35 +
      directionConsistencyScore * 0.3 +
      strikeConsistencyScore * 0.2 +
      sampleSizeScore * 0.15,
  );
  const confidenceScore = Math.round(input.stock.confidenceScore * 0.55 + clubTrustIndex * 0.45);

  return {
    carryConsistencyScore,
    directionConsistencyScore,
    strikeConsistencyScore,
    flightConsistencyScore,
    clubTrustIndex,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore, input.stock.sampleSize),
  };
}

function buildInsights(input: {
  clubType: string;
  distance: ClubAnalytics["distance"];
  accuracy: ClubAnalytics["accuracy"];
  launch: ClubAnalytics["launch"];
  strike: ClubAnalytics["strike"];
  delivery: ClubAnalytics["delivery"];
  consistency: ClubAnalytics["consistency"];
  progress: ClubAnalytics["progress"];
  gapping: ClubAnalytics["gapping"];
}): ClubInsight[] {
  const clubName = formatClubType(input.clubType);
  const insights: ClubInsight[] = [];

  if (
    input.progress.baselineDelta?.carryDeltaYd !== null &&
    input.progress.baselineDelta?.carryDeltaYd !== undefined
  ) {
    const delta = input.progress.baselineDelta.carryDeltaYd;
    insights.push({
      title: `${clubName} distance trend`,
      body:
        delta >= 0
          ? `Carry is up ${formatAbs(delta)} yd versus the first clean baseline.`
          : `Carry is down ${formatAbs(delta)} yd versus the first clean baseline, so check strike before chasing more speed.`,
      tone: delta >= 0 ? "green" : "amber",
    });
  }

  if (input.accuracy.primaryMiss !== "Unknown") {
    insights.push({
      title: "Usual miss",
      body: `${clubName} is ${input.accuracy.primaryMiss.toLowerCase()}-biased with ${formatNullableRate(input.accuracy.playableShotRate)} playable shots in the current clean sample.`,
      tone:
        input.accuracy.playableShotRate !== null && input.accuracy.playableShotRate >= 65
          ? "green"
          : "pink",
    });
  }

  if (
    input.delivery.clubPathAverageDeg !== null &&
    Math.abs(input.delivery.clubPathAverageDeg) >= 6
  ) {
    insights.push({
      title: "Delivery pattern",
      body: `Club path averages ${formatSigned(input.delivery.clubPathAverageDeg)} degrees. That is enough to create a repeatable curve pattern if face control is off.`,
      tone: "amber",
    });
  }

  if (input.launch.launchWindowScore !== null) {
    insights.push({
      title: "Launch window",
      body: `${formatNullableRate(input.launch.launchWindowScore)} of clean shots launch inside the ${input.launch.launchWindow.low}-${input.launch.launchWindow.high} degree window.`,
      tone: input.launch.launchWindowScore >= 70 ? "green" : "sky",
    });
  }

  if (input.strike.lowSmashRate !== null && input.strike.lowSmashRate >= 25) {
    insights.push({
      title: "Strike efficiency",
      body: `${formatNullableRate(input.strike.lowSmashRate)} of shots show low smash for this club. That points at strike quality before swing speed.`,
      tone: "amber",
    });
  }

  if (input.gapping.status !== "Needs data") {
    insights.push({
      title: "Gapping",
      body: input.gapping.note,
      tone:
        input.gapping.status === "Healthy"
          ? "green"
          : input.gapping.status === "Overlap"
            ? "pink"
            : "amber",
    });
  }

  if (input.delivery.dataWarning) {
    insights.push({
      title: "Data confidence",
      body: input.delivery.dataWarning,
      tone: "slate",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Needs more data",
      body: `Add more clean full ${clubName} shots before making strong distance, direction, or delivery conclusions.`,
      tone: "slate",
    });
  }

  return insights.slice(0, 5);
}

function practiceRecommendation(
  clubType: string,
  insights: ClubInsight[],
  accuracy: ClubAnalytics["accuracy"],
  launch: ClubAnalytics["launch"],
  strike: ClubAnalytics["strike"],
  delivery: ClubAnalytics["delivery"],
): ClubAnalytics["practice"] {
  const family = clubFamily(clubType);

  if (
    (family === "driver" || family === "wood") &&
    delivery.hookRiskScore !== null &&
    delivery.hookRiskScore >= 35
  ) {
    return {
      title: "No-left control block",
      drill: "Hit 10 balls where the only goal is no finish more than 20 yd left.",
      goal: "Keep path controlled and finish pattern inside the left boundary.",
    };
  }

  if (
    (family === "wood" || family === "hybrid") &&
    launch.lowFlightRate !== null &&
    launch.lowFlightRate >= 25
  ) {
    return {
      title: "Sweep-the-grass strike ladder",
      drill: "Hit 15 balls from a brushed lie. Count only shots with usable height.",
      goal: "10 shots over the stock carry floor with apex above the low-flight threshold.",
    };
  }

  if (family === "wedge") {
    return {
      title: "Wedge distance ladder",
      drill: "Hit 20/30/40/50 yd windows with three balls at each target.",
      goal: "Build separate full-shot and touch-shot windows instead of mixing them.",
    };
  }

  if (strike.lowSmashRate !== null && strike.lowSmashRate >= 25) {
    return {
      title: "Centred strike set",
      drill: "Hit 12 balls at 80% speed, keeping smash and ball speed stable.",
      goal: "Reduce low-smash shots before adding speed.",
    };
  }

  if (accuracy.primaryMiss !== "Balanced" && accuracy.primaryMiss !== "Unknown") {
    return {
      title: `${accuracy.primaryMiss} miss guardrail`,
      drill: `Hit 10 balls with a hard ${accuracy.primaryMiss.toLowerCase()} boundary.`,
      goal: "Improve playable shot rate without chasing a perfect straight ball.",
    };
  }

  return {
    title: insights[0]?.title ?? "Stock-shot maintenance",
    drill: "Hit two sets of five normal stock shots and track carry plus start line.",
    goal: "Keep the current stock number stable while protecting dispersion.",
  };
}

function compareLastTwoSessions(shots: ClubAnalyticsShot[]) {
  const groups = groupBySession(shots);
  const latest = groups[groups.length - 1];
  const previous = groups[groups.length - 2];

  if (!latest || !previous || latest.shots.length < 3 || previous.shots.length < 3) {
    return {
      previous: previous ? snapshot("Previous session", previous.shots) : null,
      latest: latest ? snapshot("Latest session", latest.shots) : null,
      delta: null,
    };
  }

  const previousSnapshot = snapshot("Previous session", previous.shots);
  const latestSnapshot = snapshot("Latest session", latest.shots);

  return {
    previous: previousSnapshot,
    latest: latestSnapshot,
    delta: delta("Last session vs previous", previousSnapshot, latestSnapshot),
  };
}

function groupBySession(shots: ClubAnalyticsShot[]) {
  const groups = new Map<string, ClubAnalyticsShot[]>();

  for (const shot of shots) {
    const key = shot.sessionId ?? new Date(dateValue(shot.shotAt)).toISOString().slice(0, 10);
    const group = groups.get(key) ?? [];
    group.push(shot);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, groupShots]) => ({
      key,
      shots: groupShots.sort((left, right) => dateValue(left.shotAt) - dateValue(right.shotAt)),
      dateValue: Math.max(...groupShots.map((shot) => dateValue(shot.shotAt))),
    }))
    .sort((left, right) => left.dateValue - right.dateValue);
}

function windowDelta(
  shots: ClubAnalyticsShot[],
  label: string,
  currentDays: number,
  previousDays: number,
) {
  const now = Date.now();
  const currentStart = now - currentDays * 86_400_000;
  const previousStart = now - previousDays * 86_400_000;
  const currentShots = shots.filter((shot) => dateValue(shot.shotAt) >= currentStart);
  const previousShots = shots.filter((shot) => {
    const value = dateValue(shot.shotAt);
    return value >= previousStart && value < currentStart;
  });

  if (currentShots.length < 3 || previousShots.length < 3) {
    return null;
  }

  return delta(
    label,
    snapshot("Previous window", previousShots),
    snapshot("Current window", currentShots),
  );
}

function snapshot(label: string, shots: ClubAnalyticsShot[]): ProgressSnapshot | null {
  if (shots.length === 0) {
    return null;
  }

  return {
    label,
    shotCount: shots.length,
    carryMedianYd: roundOne(median(shots.map((shot) => shot.carryYd).filter(isNumber))),
    ballSpeedAverageMph: roundOne(
      meanOrNull(shots.map((shot) => shot.ballSpeedMph).filter(isNumber)),
    ),
    launchAverageDeg: roundOne(
      meanOrNull(shots.map((shot) => shot.launchAngleDeg).filter(isNumber)),
    ),
    absoluteOfflineAverageYd: roundOne(
      meanOrNull(
        shots
          .map((shot) => shot.sideCarryYd)
          .filter(isNumber)
          .map(Math.abs),
      ),
    ),
    clubPathAverageDeg: roundOne(
      meanOrNull(shots.map((shot) => shot.clubPathDeg).filter(isNumber)),
    ),
  };
}

function delta(
  label: string,
  baseline: ProgressSnapshot | null,
  current: ProgressSnapshot | null,
): ProgressDelta | null {
  if (!baseline || !current) {
    return null;
  }

  return {
    label,
    carryDeltaYd: nullableDelta(current.carryMedianYd, baseline.carryMedianYd),
    ballSpeedDeltaMph: nullableDelta(current.ballSpeedAverageMph, baseline.ballSpeedAverageMph),
    launchDeltaDeg: nullableDelta(current.launchAverageDeg, baseline.launchAverageDeg),
    offlineDeltaYd: nullableDelta(
      current.absoluteOfflineAverageYd,
      baseline.absoluteOfflineAverageYd,
    ),
    clubPathDeltaDeg: nullableDelta(current.clubPathAverageDeg, baseline.clubPathAverageDeg),
  };
}

function nullableDelta(current: number | null, baseline: number | null) {
  return current === null || baseline === null ? null : roundOne(current - baseline);
}

function clubDataWarning(
  clubDataShotCount: number,
  estimatedClubDataShotCount: number,
  stockShotCount: number,
) {
  if (stockShotCount === 0) {
    return null;
  }

  const availableRate = percent(clubDataShotCount, stockShotCount) ?? 0;
  const estimatedRate = percent(estimatedClubDataShotCount, clubDataShotCount) ?? 0;

  if (availableRate < 40) {
    return `Club delivery data exists on only ${Math.round(availableRate)}% of clean shots, so path and attack insights should be treated cautiously.`;
  }

  if (estimatedRate > 50) {
    return `${Math.round(estimatedRate)}% of club delivery rows are estimated, so use delivery trends as directional rather than exact.`;
  }

  return null;
}

function stoppingPowerScore(clubType: string, descentValues: number[]) {
  const averageDescent = meanOrNull(descentValues);

  if (averageDescent === null) {
    return null;
  }

  const family = clubFamily(clubType);
  const target =
    family === "driver"
      ? 30
      : family === "wood" || family === "hybrid"
        ? 36
        : family === "wedge"
          ? 45
          : 42;
  return Math.round(clamp((averageDescent / target) * 100, 0, 100));
}

function isLowFlight(clubType: string, shot: ClubAnalyticsShot) {
  const family = clubFamily(clubType);
  const apexThreshold =
    family === "driver" || family === "wood" ? 45 : family === "wedge" ? 50 : 55;
  const launchThreshold = launchWindowForClub(clubType).low - 4;
  return (
    (isNumber(shot.apexFt) && shot.apexFt < apexThreshold) ||
    (isNumber(shot.launchAngleDeg) && shot.launchAngleDeg < launchThreshold)
  );
}

function riskScore(shots: ClubAnalyticsShot[], type: "hook" | "block") {
  const usableShots = shots.filter(
    (shot) => isNumber(shot.clubPathDeg) && isNumber(shot.sideCarryYd),
  );

  if (usableShots.length === 0) {
    return null;
  }

  const riskCount = usableShots.filter((shot) => {
    if (type === "hook") {
      return (shot.clubPathDeg ?? 0) > 4 && (shot.sideCarryYd ?? 0) < -20;
    }

    return (
      (shot.clubPathDeg ?? 0) > 4 &&
      (shot.launchDirectionDeg ?? 0) > 3 &&
      (shot.sideCarryYd ?? 0) > 15
    );
  }).length;

  return Math.round((riskCount / usableShots.length) * 100);
}

function speedLeakageRate(shots: ClubAnalyticsShot[]) {
  const clubSpeeds = shots.map((shot) => shot.clubSpeedMph).filter(isNumber);
  const smashValues = shots.map((shot) => shot.smashFactor).filter(isNumber);

  if (clubSpeeds.length < 5 || smashValues.length < 5) {
    return null;
  }

  const fastThreshold = percentile(clubSpeeds, 0.7) ?? 0;
  const lowSmashThresholdValue = percentile(smashValues, 0.3) ?? 0;
  return rate(
    shots,
    (shot) =>
      isNumber(shot.clubSpeedMph) &&
      isNumber(shot.smashFactor) &&
      shot.clubSpeedMph >= fastThreshold &&
      shot.smashFactor <= lowSmashThresholdValue,
  );
}

function highSmashThreshold(clubType: string) {
  const family = clubFamily(clubType);
  if (family === "driver" || family === "wood") {
    return 1.46;
  }

  if (family === "wedge") {
    return 1.22;
  }

  return 1.33;
}

function lowSmashThreshold(clubType: string) {
  const family = clubFamily(clubType);
  if (family === "driver" || family === "wood") {
    return 1.38;
  }

  if (family === "wedge") {
    return 1.05;
  }

  return 1.22;
}

function primaryMiss(sideValues: number[]): ClubAnalytics["accuracy"]["primaryMiss"] {
  if (sideValues.length === 0) {
    return "Unknown";
  }

  const leftRate = sideValues.filter((value) => value < -5).length / sideValues.length;
  const rightRate = sideValues.filter((value) => value > 5).length / sideValues.length;

  if (leftRate - rightRate > 0.15) {
    return "Left";
  }

  if (rightRate - leftRate > 0.15) {
    return "Right";
  }

  return "Balanced";
}

function confidenceLabel(
  score: number,
  sampleSize: number,
): ClubAnalytics["consistency"]["confidenceLabel"] {
  if (sampleSize < 5 || score <= 30) {
    return "Not enough data";
  }

  if (score <= 50) {
    return "Unstable";
  }

  if (score <= 70) {
    return "Developing";
  }

  if (score <= 85) {
    return "Reliable";
  }

  return "Trusted club";
}

function launchWindowForClub(clubType: string) {
  return (
    LAUNCH_WINDOWS[clubType] ??
    (isShortGameTouchClubType(clubType) ? LAUNCH_WINDOWS.sw : { low: 16, high: 28 })
  );
}

function clubFamily(clubType: string): keyof typeof BIG_MISS_LIMIT_BY_FAMILY {
  if (clubType === "driver") {
    return "driver";
  }

  if (clubType.endsWith("w")) {
    return "wood";
  }

  if (clubType.endsWith("h")) {
    return "hybrid";
  }

  if (["pw", "gw", "aw", "sw", "lw"].includes(clubType)) {
    return "wedge";
  }

  return "iron";
}

function isEstimatedClubData(value: string | null | undefined) {
  return value?.toLowerCase().includes("est") ?? false;
}

function rate(shots: ClubAnalyticsShot[], predicate: (shot: ClubAnalyticsShot) => boolean) {
  if (shots.length === 0) {
    return null;
  }

  return Math.round((shots.filter(predicate).length / shots.length) * 100);
}

function percent(count: number, total: number) {
  return total <= 0 ? null : Math.round((count / total) * 100);
}

function scoreFromRatio(value: number, maxUsefulValue: number) {
  return Math.round(clamp(1 - value / maxUsefulValue, 0, 1) * 100);
}

function scoreFromRaw(value: number, maxUsefulValue: number) {
  return Math.round(clamp(1 - value / maxUsefulValue, 0, 1) * 100);
}

function formatNullableRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatNullableYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatAbs(value: number) {
  return numberFormatter.format(Math.abs(value));
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function meanOrNull(values: number[]) {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  return percentile(values, 0.5);
}

function max(values: number[]) {
  return values.length === 0 ? null : Math.max(...values);
}

function interquartileRange(values: number[]) {
  const p75 = percentile(values, 0.75);
  const p25 = percentile(values, 0.25);
  return p75 === null || p25 === null ? null : p75 - p25;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function standardDeviationOrNull(values: number[]) {
  if (values.length < 2) {
    return values.length === 1 ? 0 : null;
  }

  const average = meanOrNull(values) ?? 0;
  const variance = meanOrNull(values.map((value) => (value - average) ** 2)) ?? 0;
  return Math.sqrt(variance);
}

function dateValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function roundTwo(value: number | null) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function isNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
