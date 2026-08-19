import { normalizePlayContext, playContextLabel } from "@/lib/play-context";
import { isRestorableShotReviewStatus, type ShotReviewStatus } from "@/lib/shot-review";

export const SPEED_LADDER_LEVELS = [90, 92, 95, 97, 100] as const;

const HOUR_MS = 60 * 60 * 1000;
const PLAYABLE_OFFLINE_YD = 30;
const FATIGUE_DROP_FRACTION = 0.04;
const TRANSFER_WINDOW_MS = 7 * 24 * HOUR_MS;
const EXCLUDED_EVIDENCE_TAGS = new Set([
  "bad-data",
  "bad_data",
  "misread",
  "delete",
  "deleted",
  "excluded",
  "modelled",
  "modeled",
]);

export type SpeedDevelopmentSessionInput = {
  id: string;
  sessionDateIso: string;
  avgSpeedMph: number | null;
  maxSpeedMph: number | null;
  swingCount: number;
  comparableToDriver?: boolean;
};

export type SpeedDevelopmentSwingInput = {
  sessionId: string;
  swingNumber: number;
  clubSpeedMph: number;
};

export type SpeedDevelopmentDriverShotInput = {
  sessionId: string;
  shotAtIso: string;
  playContext: string;
  reviewStatus: ShotReviewStatus;
  clubSpeedMph: number | null;
  ballSpeedMph: number | null;
  smashFactor: number | null;
  carryYd: number | null;
  launchAngleDeg: number | null;
  sideCarryYd: number | null;
  qualityTag?: string | null;
  clubDataEstType?: string | null;
};

export type SpeedDevelopmentTrainingLoadInput = {
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  statusKey: string | null;
  trendKey: string | null;
};

export type BuildSpeedDevelopmentInput = {
  nowIso?: string;
  sessions: SpeedDevelopmentSessionInput[];
  swings: SpeedDevelopmentSwingInput[];
  driverShots: SpeedDevelopmentDriverShotInput[];
  targetSpeedMph: number | null;
  currentCarryYd?: number | null;
  currentCarrySource?: string | null;
  carryTargetYd?: number | null;
  trainingLoad?: SpeedDevelopmentTrainingLoadInput | null;
};

export type SpeedDevelopmentFunnelStage = {
  key: "ceiling" | "transfer" | "playing" | "course";
  label: string;
  question: string;
  valueMph: number | null;
  sampleSize: number;
  source: string;
  lossFromPreviousMph: number | null;
};

export type SpeedDevelopmentMetric = {
  key: "playing_speed" | "ball_speed" | "smash" | "best_carry" | "launch";
  label: string;
  current: string;
  nextTarget: string;
  longTerm: string;
  status: "on_track" | "needs_work" | "unmeasured";
  detail: string;
};

export type SpeedDevelopmentReadiness = {
  score: number;
  status: "ready" | "build" | "recover";
  label: string;
  tone: "green" | "sky" | "amber";
  recommendation: string;
  nextRecommendedDateIso: string | null;
  reasons: Array<{
    label: string;
    detail: string;
    state: "positive" | "caution" | "missing";
  }>;
};

export type SpeedDevelopmentSummary = {
  generatedAtIso: string;
  project: {
    label: string;
    targetCarryYd: number;
    currentBestCarryYd: number | null;
    carrySource: string;
    carrySampleSize: number;
    gapYd: number | null;
    progressPercent: number;
    limitingFactor: string;
    coachMessage: string;
    ingredients: Array<{
      key: "speed" | "ball_speed" | "smash" | "launch" | "control";
      label: string;
      current: string;
      target: string;
      status: "on_track" | "needs_work" | "unmeasured";
    }>;
  };
  readiness: SpeedDevelopmentReadiness;
  funnel: SpeedDevelopmentFunnelStage[];
  chaos: {
    status: "successful" | "not_transferred" | "no_gain" | "need_evidence";
    label: string;
    tone: "green" | "amber" | "slate";
    comparisonLabel: string;
    speedGainMph: number | null;
    ballSpeedGainMph: number | null;
    offlineChangeYd: number | null;
    playableRateChangePct: number | null;
    nextAction: string;
  };
  plan: {
    title: string;
    durationMinutes: number;
    mode: "speed" | "transfer" | "technical";
    blocks: Array<{
      key: string;
      label: string;
      reps: number | null;
      balls: number | null;
      target: string;
      instruction: string;
    }>;
  };
  ladder: {
    rollingThreeAvgMph: number | null;
    bestMph: number | null;
    currentLevelMph: number | null;
    nextLevelMph: number | null;
    levels: Array<{
      speedMph: number;
      state: "unlocked" | "current" | "locked";
      qualifyingSessions: number;
      progressPercent: number;
    }>;
  };
  verdict: null | {
    sessionId: string;
    grade: string;
    label: string;
    tone: "green" | "amber" | "slate";
    peakSpeedMph: number | null;
    peakDeltaMph: number | null;
    playingSpeedMph: number | null;
    ballSpeedMph: number | null;
    transferEfficiencyPct: number | null;
    dispersionChangeYd: number | null;
    nextAction: string;
  };
  metrics: SpeedDevelopmentMetric[];
};

export type SpeedFatigueAnalysis = {
  peakSpeedMph: number | null;
  peakSwingNumber: number | null;
  thresholdMph: number | null;
  consecutiveBelowPeak: number;
  stopRecommended: boolean;
  stopAfterSwingNumber: number | null;
  dropFromPeakPercent: number | null;
};

type ShotWindowSummary = {
  sessionId: string;
  latestShotAtIso: string;
  playContext: string;
  shotCount: number;
  ballSpeedSamples: number;
  lateralSamples: number;
  clubSpeedMph: number | null;
  ballSpeedMph: number | null;
  offlineYd: number | null;
  playableRate: number | null;
};

export function buildSpeedDevelopment(input: BuildSpeedDevelopmentInput): SpeedDevelopmentSummary {
  const now = validDate(input.nowIso) ?? new Date();
  const generatedAtIso = now.toISOString();
  const sessions = [...input.sessions]
    .sort((left, right) => Date.parse(right.sessionDateIso) - Date.parse(left.sessionDateIso))
    .filter((session) => validDate(session.sessionDateIso));
  const driverComparableSessions = sessions.filter(
    (session) => session.comparableToDriver !== false,
  );
  const cleanDriverShots = input.driverShots
    .filter(isUsableDriverEvidence)
    .filter((shot) => validDate(shot.shotAtIso))
    .map(sanitizeDriverEvidence);
  const shots = [...cleanDriverShots]
    .filter(
      (shot) =>
        !isEstimatedClubData(shot.clubDataEstType) && validMetric(shot.clubSpeedMph, 40, 150),
    )
    .sort((left, right) => Date.parse(right.shotAtIso) - Date.parse(left.shotAtIso));
  const eligiblePracticeShots = shots.filter((shot) => isPracticeContext(shot.playContext));
  const practiceContext = eligiblePracticeShots[0]
    ? normalizePlayContext(eligiblePracticeShots[0].playContext)
    : null;
  const rangeShots = practiceContext
    ? eligiblePracticeShots.filter(
        (shot) => normalizePlayContext(shot.playContext) === practiceContext,
      )
    : [];
  const courseShots = shots.filter((shot) => isCourseContext(shot.playContext));
  const recentRangeShots = rangeShots.slice(0, 20);
  const lateralRangeShots = recentRangeShots.filter((shot) => isNumber(shot.sideCarryYd));
  const playableRangeShots = recentRangeShots.filter(isPlayableShot);
  const playingShots =
    playableRangeShots.length >= 3
      ? playableRangeShots
      : lateralRangeShots.length >= 3
        ? []
        : recentRangeShots;
  const transferShots = [...recentRangeShots]
    .sort((left, right) => Number(right.clubSpeedMph) - Number(left.clubSpeedMph))
    .slice(0, 5);
  const recentCourseShots = courseShots.slice(0, 20);
  const ceilingMph = max(
    driverComparableSessions
      .slice(0, 12)
      .map((session) => session.maxSpeedMph)
      .filter(isNumber),
  );
  const transferMph = mean(transferShots.map((shot) => shot.clubSpeedMph).filter(isNumber));
  const playingMph = mean(playingShots.map((shot) => shot.clubSpeedMph).filter(isNumber));
  const courseMph = mean(recentCourseShots.map((shot) => shot.clubSpeedMph).filter(isNumber));
  const funnel = buildFunnel({
    ceilingMph,
    ceilingSamples: Math.min(12, driverComparableSessions.length),
    transferMph,
    transferSamples: transferShots.length,
    playingMph,
    playingSamples: playingShots.length,
    playingUsesProxy: lateralRangeShots.length < 3 && recentRangeShots.length > 0,
    playingUnavailableDueControl: lateralRangeShots.length >= 3 && playableRangeShots.length < 3,
    practiceContextLabel: practiceContext ? playContextLabel(practiceContext) : null,
    courseMph,
    courseSamples: recentCourseShots.length,
  });
  const currentBallSpeedMph = mean(playingShots.map((shot) => shot.ballSpeedMph).filter(isNumber));
  const currentSmash = mean(playingShots.map((shot) => shot.smashFactor).filter(isNumber));
  const currentLaunch = mean(playingShots.map((shot) => shot.launchAngleDeg).filter(isNumber));
  const ballSpeedSamples = playingShots.filter((shot) => isNumber(shot.ballSpeedMph)).length;
  const smashSamples = playingShots.filter((shot) => isNumber(shot.smashFactor)).length;
  const launchSamples = playingShots.filter((shot) => isNumber(shot.launchAngleDeg)).length;
  const measuredCarries = cleanDriverShots
    .map((shot) => shot.carryYd)
    .filter((value): value is number => validMetric(value, 50, 400));
  const bestMeasuredCarry = max(measuredCarries);
  const suppliedCarry = validMetric(input.currentCarryYd ?? null, 50, 400)
    ? input.currentCarryYd!
    : null;
  const currentBestCarryYd = max([bestMeasuredCarry, suppliedCarry].filter(isNumber));
  const carryUsesMeasuredShot =
    bestMeasuredCarry !== null && (suppliedCarry === null || bestMeasuredCarry >= suppliedCarry);
  const carrySource = carryUsesMeasuredShot
    ? "Best clean measured Driver carry"
    : (input.currentCarrySource ?? "Current Driver carry basis");
  const targetSpeedMph = resolveNextSpeedTarget(playingMph, input.targetSpeedMph);
  const longTermSpeedMph = Math.max(95, targetSpeedMph + 3);
  const targetCarryYd = resolveCarryTarget(currentBestCarryYd, input.carryTargetYd ?? null);
  const currentOfflineYd = mean(
    lateralRangeShots.map((shot) => absoluteOrNull(shot.sideCarryYd)).filter(isNumber),
  );
  const metrics = buildHeadlineMetrics({
    playingMph,
    targetSpeedMph,
    longTermSpeedMph,
    ballSpeedMph: currentBallSpeedMph,
    smash: currentSmash,
    bestCarryYd: currentBestCarryYd,
    targetCarryYd,
    launchDeg: currentLaunch,
    shotCount: playingShots.length,
    ballSpeedSamples,
    smashSamples,
    launchSamples,
    carrySamples: measuredCarries.length,
  });
  const practiceWindows = buildShotSessionWindows(rangeShots).filter(
    (window) => window.shotCount >= 3,
  );
  const chaos = buildSpeedWithoutChaos(practiceWindows);
  const latestSession = driverComparableSessions[0] ?? null;
  const latestSessionSwings = latestSession
    ? input.swings
        .filter((swing) => swing.sessionId === latestSession.id)
        .sort((left, right) => left.swingNumber - right.swingNumber)
    : [];
  const fatigue = analyseSpeedFatigueSwings(latestSessionSwings);
  const readiness = buildSpeedReadiness({
    now,
    latestSession,
    sessionCount: driverComparableSessions.length,
    trainingLoad: input.trainingLoad ?? null,
    chaos,
    fatigue: latestSessionSwings.length >= 3 ? fatigue : null,
  });
  const plan = buildGuidedSpeedPlan(readiness, chaos, targetSpeedMph);
  const ladder = buildSpeedLadder(driverComparableSessions);
  const project = buildCarryProject({
    targetCarryYd,
    currentBestCarryYd,
    playingMph,
    targetSpeedMph,
    ballSpeedMph: currentBallSpeedMph,
    smash: currentSmash,
    launchDeg: currentLaunch,
    offlineYd: currentOfflineYd,
    carrySource,
    carrySampleSize: measuredCarries.length,
  });

  return {
    generatedAtIso,
    project,
    readiness,
    funnel,
    chaos,
    plan,
    ladder,
    verdict: buildLatestVerdict({
      latestSession,
      previousSession: driverComparableSessions[1] ?? null,
      chaos,
      targetSpeedMph,
      transferWindow: latestSession
        ? (practiceWindows.find((window) => isTransferWindowForSession(window, latestSession)) ??
          null)
        : null,
    }),
    metrics,
  };
}

export function analyseSpeedFatigue(
  readings: number[],
  dropFraction = FATIGUE_DROP_FRACTION,
): SpeedFatigueAnalysis {
  return analyseSpeedFatigueSwings(
    readings.map((clubSpeedMph, index) => ({
      clubSpeedMph,
      swingNumber: index + 1,
    })),
    dropFraction,
  );
}

export function analyseSpeedFatigueSwings(
  swings: Array<Pick<SpeedDevelopmentSwingInput, "clubSpeedMph" | "swingNumber">>,
  dropFraction = FATIGUE_DROP_FRACTION,
): SpeedFatigueAnalysis {
  const validSwings = swings.filter(
    (swing) =>
      Number.isInteger(swing.swingNumber) &&
      swing.swingNumber > 0 &&
      validMetric(swing.clubSpeedMph, 20, 180),
  );

  if (validSwings.length === 0) {
    return {
      peakSpeedMph: null,
      peakSwingNumber: null,
      thresholdMph: null,
      consecutiveBelowPeak: 0,
      stopRecommended: false,
      stopAfterSwingNumber: null,
      dropFromPeakPercent: null,
    };
  }

  let peakSpeedMph = validSwings[0]!.clubSpeedMph;
  let peakSwingNumber = validSwings[0]!.swingNumber;
  let consecutiveBelowPeak = 0;
  let stopAfterSwingNumber: number | null = null;

  validSwings.forEach((swing) => {
    const speed = swing.clubSpeedMph;
    if (speed > peakSpeedMph) {
      peakSpeedMph = speed;
      peakSwingNumber = swing.swingNumber;
      consecutiveBelowPeak = 0;
      return;
    }

    const threshold = peakSpeedMph * (1 - dropFraction);
    consecutiveBelowPeak = speed <= threshold ? consecutiveBelowPeak + 1 : 0;

    if (consecutiveBelowPeak >= 2 && stopAfterSwingNumber === null) {
      stopAfterSwingNumber = swing.swingNumber;
    }
  });

  const latestSpeed = validSwings.at(-1)!.clubSpeedMph;

  return {
    peakSpeedMph: roundOne(peakSpeedMph),
    peakSwingNumber,
    thresholdMph: roundOne(peakSpeedMph * (1 - dropFraction)),
    consecutiveBelowPeak,
    stopRecommended: stopAfterSwingNumber !== null,
    stopAfterSwingNumber,
    dropFromPeakPercent: roundOne(((peakSpeedMph - latestSpeed) / peakSpeedMph) * 100),
  };
}

function buildFunnel(input: {
  ceilingMph: number | null;
  ceilingSamples: number;
  transferMph: number | null;
  transferSamples: number;
  playingMph: number | null;
  playingSamples: number;
  playingUsesProxy: boolean;
  playingUnavailableDueControl: boolean;
  practiceContextLabel: string | null;
  courseMph: number | null;
  courseSamples: number;
}): SpeedDevelopmentFunnelStage[] {
  const stages: Array<Omit<SpeedDevelopmentFunnelStage, "lossFromPreviousMph">> = [
    {
      key: "ceiling",
      label: "Speed ceiling",
      question: "How fast can I move the club?",
      valueMph: input.ceilingMph,
      sampleSize: input.ceilingSamples,
      source: "Peak from the latest 12 no-ball sessions",
    },
    {
      key: "transfer",
      label: "Ball transfer",
      question: "Can I bring the speed to a golf ball?",
      valueMph: input.transferMph,
      sampleSize: input.transferSamples,
      source: input.practiceContextLabel
        ? `Fastest five of the latest 20 ${input.practiceContextLabel.toLowerCase()} Driver shots`
        : "No eligible practice context measured",
    },
    {
      key: "playing",
      label: "Playing speed",
      question: "Can I keep it while hitting a playable drive?",
      valueMph: input.playingMph,
      sampleSize: input.playingSamples,
      source: input.playingUnavailableDueControl
        ? "No playable baseline: fewer than three measured drives finished within 30 yd of centre"
        : input.playingUsesProxy
          ? "Recent practice drivers; lateral playability was not measured on enough shots"
          : input.practiceContextLabel
            ? `Latest 20 ${input.practiceContextLabel.toLowerCase()} Driver shots finishing within 30 yd of centre`
            : "No eligible practice context measured",
    },
    {
      key: "course",
      label: "Course speed",
      question: "Does the speed survive on the course?",
      valueMph: input.courseMph,
      sampleSize: input.courseSamples,
      source: "Latest 20 on-course driver shots",
    },
  ];

  return stages.map((stage, index) => {
    const previous = stages[index - 1];
    return {
      ...stage,
      lossFromPreviousMph:
        previous && previous.valueMph !== null && stage.valueMph !== null
          ? roundOne(previous.valueMph - stage.valueMph)
          : null,
    };
  });
}

function buildHeadlineMetrics(input: {
  playingMph: number | null;
  targetSpeedMph: number;
  longTermSpeedMph: number;
  ballSpeedMph: number | null;
  smash: number | null;
  bestCarryYd: number | null;
  targetCarryYd: number;
  launchDeg: number | null;
  shotCount: number;
  ballSpeedSamples: number;
  smashSamples: number;
  launchSamples: number;
  carrySamples: number;
}): SpeedDevelopmentMetric[] {
  const launchOnTrack = input.launchDeg !== null && input.launchDeg >= 12 && input.launchDeg <= 16;
  const nextBallSpeed = input.targetSpeedMph * 1.45;

  return [
    {
      key: "playing_speed",
      label: "Playing club speed",
      current: formatMph(input.playingMph),
      nextTarget: formatMph(input.targetSpeedMph),
      longTerm: `${formatMph(input.longTermSpeedMph)}+`,
      status: metricStatus(input.playingMph, input.targetSpeedMph),
      detail: `${input.shotCount} recent with-ball driver shots`,
    },
    {
      key: "ball_speed",
      label: "Ball speed",
      current: formatMph(input.ballSpeedMph),
      nextTarget: `${formatMph(nextBallSpeed)}+`,
      longTerm: `${formatMph(input.longTermSpeedMph * 1.47)}+`,
      status: metricStatus(input.ballSpeedMph, nextBallSpeed),
      detail: `${input.ballSpeedSamples} measured in the same Driver window`,
    },
    {
      key: "smash",
      label: "Smash",
      current: formatDecimal(input.smash, 2),
      nextTarget: "1.45+",
      longTerm: "1.47+",
      status: metricStatus(input.smash, 1.45),
      detail: `${input.smashSamples} measured · ball speed divided by club speed`,
    },
    {
      key: "best_carry",
      label: "Best carry",
      current: formatYards(input.bestCarryYd),
      nextTarget: formatYards(input.targetCarryYd),
      longTerm: formatYards(input.targetCarryYd + 10),
      status: metricStatus(input.bestCarryYd, input.targetCarryYd),
      detail: `${input.carrySamples} clean measured · Outcome measure, not the swing-by-swing target`,
    },
    {
      key: "launch",
      label: "Launch",
      current: input.launchDeg === null ? "Not measured" : `${roundOne(input.launchDeg)}°`,
      nextTarget: launchOnTrack ? "Maintain" : "12–16°",
      longTerm: "Maintain",
      status: input.launchDeg === null ? "unmeasured" : launchOnTrack ? "on_track" : "needs_work",
      detail: `${input.launchSamples} measured · practical Driver launch window`,
    },
  ];
}

function buildSpeedWithoutChaos(windows: ShotWindowSummary[]): SpeedDevelopmentSummary["chaos"] {
  const current = windows[0];
  const previous = windows[1];

  if (!current || !previous) {
    return {
      status: "need_evidence",
      label: "Need two driver sessions",
      tone: "slate",
      comparisonLabel: "Latest driver session versus the previous comparable session",
      speedGainMph: null,
      ballSpeedGainMph: null,
      offlineChangeYd: null,
      playableRateChangePct: null,
      nextAction: "Import two Driver sessions with club speed, ball speed and lateral result.",
    };
  }

  const hasComparableTransferEvidence =
    current.ballSpeedSamples >= 3 &&
    previous.ballSpeedSamples >= 3 &&
    current.lateralSamples >= 3 &&
    previous.lateralSamples >= 3;

  if (!hasComparableTransferEvidence) {
    return {
      status: "need_evidence",
      label: "Transfer evidence incomplete",
      tone: "slate",
      comparisonLabel: "Latest Driver session versus previous Driver session",
      speedGainMph: difference(current.clubSpeedMph, previous.clubSpeedMph),
      ballSpeedGainMph: null,
      offlineChangeYd: null,
      playableRateChangePct: null,
      nextAction:
        "Capture at least three shots with ball speed and lateral result in each Driver session.",
    };
  }

  const speedGainMph = difference(current.clubSpeedMph, previous.clubSpeedMph);
  const ballSpeedGainMph = difference(current.ballSpeedMph, previous.ballSpeedMph);
  const offlineChangeYd = difference(current.offlineYd, previous.offlineYd);
  const playableRateChangePct = difference(current.playableRate, previous.playableRate);
  const materiallyWider =
    (offlineChangeYd !== null && offlineChangeYd > Math.max(5, (previous.offlineYd ?? 0) * 0.25)) ||
    (playableRateChangePct !== null && playableRateChangePct < -10);
  const gainedSpeed = speedGainMph !== null && speedGainMph >= 0.8;
  const transferredBallSpeed = ballSpeedGainMph !== null && ballSpeedGainMph >= 0.5;

  if (gainedSpeed && (materiallyWider || !transferredBallSpeed)) {
    return {
      status: "not_transferred",
      label: "Speed gained — not transferred yet",
      tone: "amber",
      comparisonLabel: "Latest driver session versus previous driver session",
      speedGainMph,
      ballSpeedGainMph,
      offlineChangeYd,
      playableRateChangePct,
      nextAction: "Run a 10-ball transfer block before chasing another speed PB.",
    };
  }

  if (gainedSpeed && transferredBallSpeed) {
    return {
      status: "successful",
      label: "Successful speed gain",
      tone: "green",
      comparisonLabel: "Latest driver session versus previous driver session",
      speedGainMph,
      ballSpeedGainMph,
      offlineChangeYd,
      playableRateChangePct,
      nextAction: "Keep the speed and finish with normal course swings. No speed chasing.",
    };
  }

  return {
    status: "no_gain",
    label: "Speed held — keep building",
    tone: "slate",
    comparisonLabel: "Latest driver session versus previous driver session",
    speedGainMph,
    ballSpeedGainMph,
    offlineChangeYd,
    playableRateChangePct,
    nextAction: materiallyWider
      ? "Stabilise driver start line before adding more maximum-speed work."
      : "Repeat a short speed block after full recovery.",
  };
}

function buildSpeedReadiness(input: {
  now: Date;
  latestSession: SpeedDevelopmentSessionInput | null;
  sessionCount: number;
  trainingLoad: SpeedDevelopmentTrainingLoadInput | null;
  chaos: SpeedDevelopmentSummary["chaos"];
  fatigue: SpeedFatigueAnalysis | null;
}): SpeedDevelopmentReadiness {
  let score = 50;
  const reasons: SpeedDevelopmentReadiness["reasons"] = [];
  const hoursSinceSpeed = input.latestSession
    ? Math.max(0, (input.now.getTime() - Date.parse(input.latestSession.sessionDateIso)) / HOUR_MS)
    : null;
  const highLoad =
    input.trainingLoad?.statusKey === "load_high" ||
    input.trainingLoad?.trendKey === "acute_load_spike" ||
    input.trainingLoad?.trendKey === "overloaded" ||
    (input.trainingLoad?.fatigue ?? 0) >= 120;

  if (!input.trainingLoad || input.trainingLoad.fatigue === null) {
    reasons.push({
      label: "Recent load",
      detail: "Not enough Training Load evidence to score this signal.",
      state: "missing",
    });
  } else if (highLoad) {
    score -= 25;
    reasons.push({
      label: "Recent load",
      detail: "Training Load is elevated, so maximum-speed volume should wait.",
      state: "caution",
    });
  } else {
    score += 10;
    reasons.push({
      label: "Recent load",
      detail: "Recent golf load is manageable for a short, sharp session.",
      state: "positive",
    });
  }

  if (hoursSinceSpeed === null) {
    score += 5;
    reasons.push({
      label: "Speed recovery",
      detail: "No previous speed session is stored; start with a conservative baseline.",
      state: "missing",
    });
  } else if (hoursSinceSpeed >= 48) {
    score += 15;
    reasons.push({
      label: "Speed recovery",
      detail: `${Math.floor(hoursSinceSpeed)} hours since the last speed session.`,
      state: "positive",
    });
  } else {
    score -= 20;
    reasons.push({
      label: "Speed recovery",
      detail: `Only ${Math.floor(hoursSinceSpeed)} hours since the last speed session; wait for the 48-hour recovery mark.`,
      state: "caution",
    });
  }

  if (input.chaos.status === "successful") {
    score += 10;
    reasons.push({
      label: "Driver control",
      detail: "The latest speed gain transferred without a material control penalty.",
      state: "positive",
    });
  } else if (input.chaos.status === "not_transferred") {
    score -= 15;
    reasons.push({
      label: "Driver control",
      detail: "The latest gain widened dispersion; transfer work comes before more speed.",
      state: "caution",
    });
  } else if (input.chaos.status === "need_evidence") {
    reasons.push({
      label: "Driver control",
      detail: "Two comparable driver sessions are needed to judge transfer.",
      state: "missing",
    });
  } else {
    score += 5;
    reasons.push({
      label: "Driver control",
      detail: "Recent driver control has not shown a material speed-related deterioration.",
      state: "positive",
    });
  }

  if (!input.fatigue) {
    reasons.push({
      label: "Speed fatigue",
      detail: "Ordered swing readings are needed to check within-session fatigue.",
      state: "missing",
    });
  } else if (input.fatigue.stopRecommended) {
    score -= 15;
    reasons.push({
      label: "Speed fatigue",
      detail: `The last block crossed the 4% stop line by swing ${input.fatigue.stopAfterSwingNumber}.`,
      state: "caution",
    });
  } else {
    score += 10;
    reasons.push({
      label: "Speed fatigue",
      detail: "The last measured block did not trigger the two-swing fatigue stop rule.",
      state: "positive",
    });
  }

  if (input.sessionCount >= 3) {
    score += 5;
  }

  score = clamp(Math.round(score), 0, 100);
  const recoveryBlocked = hoursSinceSpeed !== null && hoursSinceSpeed < 48;
  const fatigueBlocked = input.fatigue?.stopRecommended === true;
  const loadEvidenceMissing = !input.trainingLoad || input.trainingLoad.fatigue === null;
  const criticalEvidenceMissing =
    input.chaos.status === "need_evidence" || !input.fatigue || loadEvidenceMissing;
  const status: SpeedDevelopmentReadiness["status"] =
    highLoad || recoveryBlocked || fatigueBlocked || score < 50
      ? "recover"
      : score >= 70 && !criticalEvidenceMissing
        ? "ready"
        : "build";
  const nextRecommendedDate =
    highLoad || fatigueBlocked
      ? null
      : recoveryBlocked && input.latestSession
        ? new Date(Date.parse(input.latestSession.sessionDateIso) + 48 * HOUR_MS)
        : input.now;
  const recommendation =
    status === "recover"
      ? "Technical Driver only — no maximum-speed work today."
      : input.chaos.status === "not_transferred"
        ? "Transfer session — keep the speed, rebuild playable dispersion."
        : status === "ready"
          ? "Speed session — short maximum blocks with full rest."
          : "Build the baseline with one controlled speed block and transfer shots.";

  return {
    score,
    status,
    label: status === "ready" ? "READY" : status === "recover" ? "RECOVER" : "BUILD",
    tone: status === "ready" ? "green" : status === "build" ? "sky" : "amber",
    recommendation,
    nextRecommendedDateIso: nextRecommendedDate?.toISOString() ?? null,
    reasons,
  };
}

function buildGuidedSpeedPlan(
  readiness: SpeedDevelopmentReadiness,
  chaos: SpeedDevelopmentSummary["chaos"],
  targetSpeedMph: number,
): SpeedDevelopmentSummary["plan"] {
  if (readiness.status === "recover") {
    return {
      title: "Technical Driver — speed-safe day",
      durationMinutes: 20,
      mode: "technical",
      blocks: [
        {
          key: "warmup",
          label: "Warm-up",
          reps: 6,
          balls: null,
          target: "70 → 80%",
          instruction: "Progressive rehearsals only. No maximum effort.",
        },
        {
          key: "technical",
          label: "Delivery window",
          reps: null,
          balls: 10,
          target: "7 of 10 playable",
          instruction: "Stock driver at 80%. Keep start line and strike stable.",
        },
        {
          key: "finish",
          label: "Normal finish",
          reps: null,
          balls: 3,
          target: "Course routine",
          instruction: "Three normal course swings. No speed chasing.",
        },
      ],
    };
  }

  if (readiness.status === "build" || chaos.status === "not_transferred") {
    return {
      title: "Speed transfer session",
      durationMinutes: 20,
      mode: "transfer",
      blocks: [
        {
          key: "warmup",
          label: "Warm-up",
          reps: 6,
          balls: null,
          target: "70 → 80 → 90%",
          instruction: "Progress until movement feels fast, never forced.",
        },
        {
          key: "speed",
          label: "Speed touch",
          reps: 5,
          balls: null,
          target: `Controlled build toward ${roundOne(targetSpeedMph)} mph`,
          instruction: "Five measured swings at 90–95% with full rest. Do not force a maximum.",
        },
        {
          key: "transfer",
          label: "Driver transfer",
          reps: null,
          balls: 10,
          target: "Speed plus playable",
          instruction: "Full target routine. Keep the new speed inside the playable window.",
        },
        {
          key: "finish",
          label: "Normal finish",
          reps: null,
          balls: 3,
          target: "Course routine",
          instruction: "Three normal course swings. No speed chasing.",
        },
      ],
    };
  }

  return {
    title: "Today’s Speed Session",
    durationMinutes: 20,
    mode: "speed",
    blocks: [
      {
        key: "warmup",
        label: "Warm-up",
        reps: 6,
        balls: null,
        target: "70 → 80 → 90%",
        instruction: "Six progressive swings before any maximum effort.",
      },
      {
        key: "speed-1",
        label: "Speed Block 1",
        reps: 5,
        balls: null,
        target: `${roundOne(targetSpeedMph)} mph intent`,
        instruction: "Five maximum swings with full recovery between each.",
      },
      {
        key: "speed-2",
        label: "Speed Block 2",
        reps: 5,
        balls: null,
        target: "Beat Block 1 peak",
        instruction: "Rest 60–90 seconds first. Stop after two swings 4% below today’s peak.",
      },
      {
        key: "transfer",
        label: "Driver transfer",
        reps: null,
        balls: 5,
        target: "Speed + strike + playable",
        instruction: "Bring the new speed to the ball without widening the pattern.",
      },
      {
        key: "finish",
        label: "Normal finish",
        reps: null,
        balls: 3,
        target: "Course routine",
        instruction: "Three normal course swings. No speed chasing.",
      },
    ],
  };
}

function buildSpeedLadder(
  sessions: SpeedDevelopmentSessionInput[],
): SpeedDevelopmentSummary["ladder"] {
  const averages = sessions.map((session) => session.avgSpeedMph).filter(isNumber);
  const latestThree = averages.slice(0, 3);
  const rollingThreeAvgMph = latestThree.length === 3 ? mean(latestThree) : null;
  const bestMph = max(
    sessions.map((session) => session.maxSpeedMph ?? session.avgSpeedMph).filter(isNumber),
  );
  const unlockedLevels = SPEED_LADDER_LEVELS.filter(
    (speedMph) => latestThree.length === 3 && latestThree.every((average) => average >= speedMph),
  );
  const currentLevelMph = unlockedLevels.at(-1) ?? null;
  const nextLevelMph =
    SPEED_LADDER_LEVELS.find(
      (speedMph) => currentLevelMph === null || speedMph > currentLevelMph,
    ) ?? null;

  return {
    rollingThreeAvgMph,
    bestMph,
    currentLevelMph,
    nextLevelMph,
    levels: SPEED_LADDER_LEVELS.map((speedMph) => {
      const qualifyingSessions = latestThree.filter((average) => average >= speedMph).length;
      const unlocked = latestThree.length === 3 && qualifyingSessions === 3;
      const isCurrent = nextLevelMph === speedMph;
      const progressPercent = (qualifyingSessions / 3) * 100;

      return {
        speedMph,
        state: unlocked ? "unlocked" : isCurrent ? "current" : "locked",
        qualifyingSessions,
        progressPercent: clamp(Math.round(progressPercent), 0, 100),
      };
    }),
  };
}

function buildCarryProject(input: {
  targetCarryYd: number;
  currentBestCarryYd: number | null;
  playingMph: number | null;
  targetSpeedMph: number;
  ballSpeedMph: number | null;
  smash: number | null;
  launchDeg: number | null;
  offlineYd: number | null;
  carrySource: string;
  carrySampleSize: number;
}): SpeedDevelopmentSummary["project"] {
  const targetBallSpeed = input.targetSpeedMph * 1.45;
  const launchOnTrack = input.launchDeg !== null && input.launchDeg >= 12 && input.launchDeg <= 16;
  const controlOnTrack = input.offlineYd !== null && input.offlineYd <= PLAYABLE_OFFLINE_YD;
  const ingredients: SpeedDevelopmentSummary["project"]["ingredients"] = [
    {
      key: "speed",
      label: "Playing speed",
      current: formatMph(input.playingMph),
      target: formatMph(input.targetSpeedMph),
      status: metricStatus(input.playingMph, input.targetSpeedMph),
    },
    {
      key: "ball_speed",
      label: "Ball speed",
      current: formatMph(input.ballSpeedMph),
      target: `${formatMph(targetBallSpeed)}+`,
      status: metricStatus(input.ballSpeedMph, targetBallSpeed),
    },
    {
      key: "smash",
      label: "Smash",
      current: formatDecimal(input.smash, 2),
      target: "1.45+",
      status: metricStatus(input.smash, 1.45),
    },
    {
      key: "launch",
      label: "Launch",
      current: input.launchDeg === null ? "Not measured" : `${roundOne(input.launchDeg)}°`,
      target: "12–16°",
      status: input.launchDeg === null ? "unmeasured" : launchOnTrack ? "on_track" : "needs_work",
    },
    {
      key: "control",
      label: "Control",
      current: input.offlineYd === null ? "Not measured" : `${roundOne(input.offlineYd)} yd`,
      target: `≤${PLAYABLE_OFFLINE_YD} yd average`,
      status: input.offlineYd === null ? "unmeasured" : controlOnTrack ? "on_track" : "needs_work",
    },
  ];
  const limiting = chooseLimitingIngredient({
    playingMph: input.playingMph,
    targetSpeedMph: input.targetSpeedMph,
    ballSpeedMph: input.ballSpeedMph,
    targetBallSpeed,
    smash: input.smash,
    launchDeg: input.launchDeg,
    offlineYd: input.offlineYd,
    launchOnTrack,
    controlOnTrack,
  });
  const coachMessage =
    limiting.key === "ball_speed" && launchOnTrack
      ? `You’re not missing ${input.targetCarryYd} because of launch. The biggest remaining opportunity is producing ${Math.round(targetBallSpeed)}+ mph ball speed more often.`
      : limiting.message;
  const gapYd =
    input.currentBestCarryYd === null
      ? null
      : roundOne(Math.max(0, input.targetCarryYd - input.currentBestCarryYd));

  return {
    label: `Project ${input.targetCarryYd}`,
    targetCarryYd: input.targetCarryYd,
    currentBestCarryYd: input.currentBestCarryYd,
    carrySource: input.carrySource,
    carrySampleSize: input.carrySampleSize,
    gapYd,
    progressPercent:
      input.currentBestCarryYd === null
        ? 0
        : clamp(Math.round((input.currentBestCarryYd / input.targetCarryYd) * 100), 0, 100),
    limitingFactor: limiting.label,
    coachMessage,
    ingredients,
  };
}

function buildLatestVerdict(input: {
  latestSession: SpeedDevelopmentSessionInput | null;
  previousSession: SpeedDevelopmentSessionInput | null;
  chaos: SpeedDevelopmentSummary["chaos"];
  targetSpeedMph: number;
  transferWindow: ShotWindowSummary | null;
}): SpeedDevelopmentSummary["verdict"] {
  if (!input.latestSession) {
    return null;
  }

  const peakDeltaMph = difference(
    input.latestSession.maxSpeedMph,
    input.previousSession?.maxSpeedMph ?? null,
  );
  if (!input.transferWindow) {
    return {
      sessionId: input.latestSession.id,
      grade: "Pending",
      label: "Awaiting a post-session Driver transfer block",
      tone: "slate",
      peakSpeedMph: input.latestSession.maxSpeedMph,
      peakDeltaMph,
      playingSpeedMph: null,
      ballSpeedMph: null,
      transferEfficiencyPct: null,
      dispersionChangeYd: null,
      nextAction:
        "Complete or import a Driver transfer block within seven days of this speed session.",
    };
  }
  const transferEfficiencyPct =
    input.transferWindow.clubSpeedMph !== null &&
    input.latestSession.maxSpeedMph !== null &&
    input.latestSession.maxSpeedMph > 0
      ? roundOne((input.transferWindow.clubSpeedMph / input.latestSession.maxSpeedMph) * 100)
      : null;
  const grade =
    input.chaos.status === "successful"
      ? (peakDeltaMph ?? 0) > 0.5
        ? "A-"
        : "B+"
      : input.chaos.status === "not_transferred"
        ? "C+"
        : input.chaos.status === "need_evidence"
          ? "Pending"
          : "B";

  return {
    sessionId: input.latestSession.id,
    grade,
    label:
      input.chaos.status === "need_evidence"
        ? "Transfer verdict awaiting another driver session"
        : input.chaos.label,
    tone: input.chaos.tone,
    peakSpeedMph: input.latestSession.maxSpeedMph,
    peakDeltaMph,
    playingSpeedMph: input.transferWindow.clubSpeedMph,
    ballSpeedMph: input.transferWindow.ballSpeedMph,
    transferEfficiencyPct,
    dispersionChangeYd: input.chaos.offlineChangeYd,
    nextAction:
      input.chaos.status === "successful"
        ? `Next session: attempt ${roundOne(input.targetSpeedMph)} mph while keeping the Driver playable.`
        : input.chaos.nextAction,
  };
}

function buildShotSessionWindows(shots: SpeedDevelopmentDriverShotInput[]): ShotWindowSummary[] {
  const groups = new Map<string, SpeedDevelopmentDriverShotInput[]>();

  for (const shot of shots) {
    groups.set(shot.sessionId, [...(groups.get(shot.sessionId) ?? []), shot]);
  }

  return [...groups.entries()]
    .map(([sessionId, sessionShots]) => {
      const ordered = [...sessionShots].sort(
        (left, right) => Date.parse(right.shotAtIso) - Date.parse(left.shotAtIso),
      );
      const lateralShots = ordered.filter((shot) => isNumber(shot.sideCarryYd));
      const playableShots = lateralShots.filter(isPlayableShot);

      return {
        sessionId,
        latestShotAtIso: ordered[0]?.shotAtIso ?? "",
        playContext: normalizePlayContext(ordered[0]?.playContext),
        shotCount: ordered.length,
        ballSpeedSamples: ordered.filter((shot) => isNumber(shot.ballSpeedMph)).length,
        lateralSamples: lateralShots.length,
        clubSpeedMph: mean(ordered.map((shot) => shot.clubSpeedMph).filter(isNumber)),
        ballSpeedMph: mean(ordered.map((shot) => shot.ballSpeedMph).filter(isNumber)),
        offlineYd: mean(
          lateralShots.map((shot) => absoluteOrNull(shot.sideCarryYd)).filter(isNumber),
        ),
        playableRate:
          lateralShots.length > 0
            ? roundOne((playableShots.length / lateralShots.length) * 100)
            : null,
      };
    })
    .sort((left, right) => Date.parse(right.latestShotAtIso) - Date.parse(left.latestShotAtIso));
}

function isTransferWindowForSession(
  window: ShotWindowSummary,
  session: SpeedDevelopmentSessionInput,
) {
  const transferAt = Date.parse(window.latestShotAtIso);
  const speedAt = Date.parse(session.sessionDateIso);
  const elapsed = transferAt - speedAt;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= TRANSFER_WINDOW_MS;
}

function chooseLimitingIngredient(input: {
  playingMph: number | null;
  targetSpeedMph: number;
  ballSpeedMph: number | null;
  targetBallSpeed: number;
  smash: number | null;
  launchDeg: number | null;
  offlineYd: number | null;
  launchOnTrack: boolean;
  controlOnTrack: boolean;
}) {
  const candidates = [
    input.playingMph === null || input.playingMph >= input.targetSpeedMph
      ? null
      : {
          key: "speed",
          label: "Playing speed",
          score: Math.max(0, input.targetSpeedMph - input.playingMph) / 8,
          message: `Build repeatable playing speed toward ${roundOne(input.targetSpeedMph)} mph before moving the carry goal.`,
        },
    input.ballSpeedMph === null || input.ballSpeedMph >= input.targetBallSpeed
      ? null
      : {
          key: "ball_speed",
          label: "Ball-speed frequency",
          score: Math.max(0, input.targetBallSpeed - input.ballSpeedMph) / 12,
          message: `Produce ${Math.round(input.targetBallSpeed)}+ mph ball speed more often without widening dispersion.`,
        },
    input.smash === null || input.smash >= 1.45
      ? null
      : {
          key: "smash",
          label: "Strike efficiency",
          score: Math.max(0, 1.45 - input.smash) * 8,
          message: "Improve strike efficiency before asking for more maximum club speed.",
        },
    input.launchDeg === null || input.launchOnTrack
      ? null
      : {
          key: "launch",
          label: "Launch window",
          score: input.launchOnTrack ? 0 : 0.7,
          message: "Move launch into the 12–16° window so the available speed becomes carry.",
        },
    input.offlineYd === null || input.controlOnTrack
      ? null
      : {
          key: "control",
          label: "Playable control",
          score: input.controlOnTrack ? 0 : 0.8,
          message: "Keep the new speed inside the playable window before chasing the next level.",
        },
  ].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  if (candidates.length === 0) {
    const missingEvidence =
      input.playingMph === null ||
      input.ballSpeedMph === null ||
      input.smash === null ||
      input.launchDeg === null ||
      input.offlineYd === null;

    return {
      key: missingEvidence ? "evidence" : "validation",
      label: missingEvidence ? "Need Driver evidence" : "Carry validation",
      message: missingEvidence
        ? "Import measured Driver shots with club speed, ball speed, carry, launch and lateral result to identify the next ingredient."
        : "The measured ingredients are on track. Confirm the gain with repeatable carry and playable dispersion.",
    };
  }

  return [...candidates].sort((left, right) => right.score - left.score)[0]!;
}

function resolveNextSpeedTarget(currentMph: number | null, savedTargetMph: number | null) {
  if (savedTargetMph !== null && savedTargetMph > (currentMph ?? 0)) {
    return roundOne(savedTargetMph);
  }

  return SPEED_LADDER_LEVELS.find((level) => currentMph === null || level > currentMph) ?? 100;
}

function resolveCarryTarget(currentBestCarryYd: number | null, savedTargetYd: number | null) {
  if (savedTargetYd !== null && savedTargetYd > (currentBestCarryYd ?? 0)) {
    return Math.round(savedTargetYd);
  }

  if (currentBestCarryYd === null || currentBestCarryYd < 220) {
    return 220;
  }

  return Math.ceil((currentBestCarryYd + 0.1) / 10) * 10;
}

function metricStatus(current: number | null, target: number): SpeedDevelopmentMetric["status"] {
  if (current === null) return "unmeasured";
  return current >= target ? "on_track" : "needs_work";
}

function isCourseContext(value: string) {
  return normalizePlayContext(value) === "on_course";
}

function isPracticeContext(value: string) {
  const context = normalizePlayContext(value);
  return context === "practice_bay" || context === "indoor" || context === "simulator";
}

function isPlayableShot(shot: SpeedDevelopmentDriverShotInput) {
  return isNumber(shot.sideCarryYd) && Math.abs(shot.sideCarryYd) <= PLAYABLE_OFFLINE_YD;
}

function sanitizeDriverEvidence(
  shot: SpeedDevelopmentDriverShotInput,
): SpeedDevelopmentDriverShotInput {
  return {
    ...shot,
    clubSpeedMph: metricOrNull(shot.clubSpeedMph, 40, 150),
    ballSpeedMph: metricOrNull(shot.ballSpeedMph, 50, 230),
    smashFactor: metricOrNull(shot.smashFactor, 0.8, 1.6),
    carryYd: metricOrNull(shot.carryYd, 50, 400),
    launchAngleDeg: metricOrNull(shot.launchAngleDeg, -10, 45),
    sideCarryYd: metricOrNull(shot.sideCarryYd, -200, 200),
  };
}

function isUsableDriverEvidence(shot: SpeedDevelopmentDriverShotInput) {
  const qualityTag = shot.qualityTag?.trim().toLowerCase() ?? "";
  return (
    !isRestorableShotReviewStatus(shot.reviewStatus) &&
    !EXCLUDED_EVIDENCE_TAGS.has(qualityTag) &&
    !qualityTag.startsWith("exclude")
  );
}

function isEstimatedClubData(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "1" || normalized === "true" || normalized.includes("est");
}

function metricOrNull(value: number | null, minValue: number, maxValue: number) {
  return validMetric(value, minValue, maxValue) ? value : null;
}

function validDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function validMetric(value: number | null, minValue: number, maxValue: number): value is number {
  return isNumber(value) && value >= minValue && value <= maxValue;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return roundOne(values.reduce((total, value) => total + value, 0) / values.length);
}

function max(values: number[]) {
  return values.length > 0 ? roundOne(Math.max(...values)) : null;
}

function difference(current: number | null, previous: number | null) {
  return current === null || previous === null ? null : roundOne(current - previous);
}

function absoluteOrNull(value: number | null) {
  return isNumber(value) ? Math.abs(value) : null;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function formatMph(value: number | null) {
  return value === null ? "Not measured" : `${roundOne(value).toFixed(1)} mph`;
}

function formatYards(value: number | null) {
  return value === null ? "Not measured" : `${roundOne(value)} yd`;
}

function formatDecimal(value: number | null, decimals: number) {
  return value === null ? "Not measured" : value.toFixed(decimals);
}
