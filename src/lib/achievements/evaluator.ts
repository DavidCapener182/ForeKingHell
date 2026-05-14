import { compareClubCarryToBenchmark } from "@/lib/club-benchmarks";
import { formatClubType, isShortGameTouchClubType, isTrackedClubType } from "@/lib/club-format";

import {
  ACHIEVEMENTS,
  GENERATED_CLUB_BENCHMARKS_BY_CLUB,
  GENERATED_CLUB_MASTERY_BY_CLUB,
  GENERATED_CLUB_MILEAGE_BY_CLUB,
  GENERATED_CLUB_METRICS_BY_CLUB,
  GENERATED_CLUB_PERSONAL_BEST_BY_CLUB,
  GENERATED_CLUB_VOLUME_BY_CLUB,
  GENERATED_HIDDEN_SHOTS_BY_CLUB,
  YARDS_PER_MILE,
  type GeneratedClubBenchmarkAchievement,
  type GeneratedClubMasteryMetric,
  type GeneratedClubMetric,
  type GeneratedHiddenShotAchievement,
  getAchievement,
} from "./registry";
import type {
  AchievementClub,
  AchievementEvaluationResult,
  AchievementProgressCandidate,
  AchievementSession,
  AchievementShot,
  AchievementStockYardage,
  AchievementUnlockCandidate,
  RoundScorecardHole,
} from "./types";

export type AchievementEvaluationContext = {
  sessions: AchievementSession[];
  shots: AchievementShot[];
  clubs: AchievementClub[];
  stockYardages: AchievementStockYardage[];
};

const IRON_PATTERN = /^[4-9]i$/;
const WEDGE_TYPES = new Set(["pw", "gw", "aw", "sw", "lw", "wedge"]);
const WOOD_TYPES = new Set(["3w", "4w", "5w", "7w"]);
const HIDDEN_FULL_SHOT_EXCLUDED_CATEGORIES = new Set(["chip", "pitch", "recovery", "bunker"]);
const SINGLE_BENCHMARK_ACHIEVEMENTS = [
  { id: "benchmark_first_average", label: "Average", targetLevelIndex: 1 },
  { id: "benchmark_first_good", label: "Good", targetLevelIndex: 2 },
  { id: "benchmark_first_advanced", label: "Advanced", targetLevelIndex: 3 },
  { id: "benchmark_first_tour", label: "Tour", targetLevelIndex: 4 },
] as const;
const BAG_BENCHMARK_ACHIEVEMENTS = [
  { id: "benchmark_bag_average", label: "Average", targetLevelIndex: 1 },
  { id: "benchmark_bag_good", label: "Good", targetLevelIndex: 2 },
  { id: "benchmark_bag_advanced", label: "Advanced", targetLevelIndex: 3 },
] as const;

export function evaluateAllAchievementCandidates(
  context: AchievementEvaluationContext,
): AchievementEvaluationResult {
  const collector = createCollector();
  const trackedShots = context.shots.filter((shot) => isTrackedClubType(shot.clubType));
  const trackedStocks = context.stockYardages.filter((stock) => isTrackedClubType(stock.clubType));
  const shotsBySessionId = groupBy(trackedShots, (shot) => shot.sessionId);
  const shotCountByClubId = groupBy(trackedShots, (shot) => shot.clubId ?? shot.clubType);
  const shotsByClubType = groupBy(trackedShots, (shot) => shot.clubType);
  const latestStockByClubId = latestStocks(trackedStocks);
  const maxBallSpeed = maxNumber(trackedShots.map((shot) => shot.ballSpeedMph));
  const maxApex = maxNumber(trackedShots.map((shot) => shot.apexFt));

  addDataProgress(collector, context.sessions, shotsBySessionId);

  for (const shot of sortShots(trackedShots)) {
    evaluateSingleShot(collector, shot, { maxBallSpeed, maxApex });
  }

  for (const session of context.sessions) {
    const sessionShots = sortShots(shotsBySessionId.get(session.id) ?? []);
    evaluateSession(collector, session, sessionShots);
    evaluateRoundScorecard(collector, session);
  }

  evaluateRollingSamples(collector, shotCountByClubId);
  evaluateGeneratedClubVolumeSamples(collector, shotsByClubType);
  evaluateGeneratedClubMileageSamples(collector, shotsByClubType);
  evaluateGeneratedClubPersonalBests(collector, shotsByClubType);
  evaluateStockAndGapping(collector, context.clubs, latestStockByClubId);
  evaluateProgress(collector, trackedShots, trackedStocks);

  return {
    unlocks: dedupeUnlockCandidates(collector.unlocks),
    progress: dedupeProgressCandidates(collector.progress),
  };
}

export function evaluateRoundScorecardAchievements(
  session: AchievementSession,
): AchievementEvaluationResult {
  const collector = createCollector();
  evaluateRoundScorecard(collector, session);
  return {
    unlocks: dedupeUnlockCandidates(collector.unlocks),
    progress: dedupeProgressCandidates(collector.progress),
  };
}

export function evaluateRapsodoSessionAchievements(
  session: AchievementSession,
  sessionShots: AchievementShot[],
): AchievementEvaluationResult {
  const collector = createCollector();

  for (const shot of sortShots(sessionShots)) {
    evaluateSingleShot(collector, shot, { maxBallSpeed: null, maxApex: null });
  }

  evaluateSession(collector, session, sortShots(sessionShots));
  evaluateGeneratedClubVolumeSamples(collector, groupBy(sessionShots, (shot) => shot.clubType));
  evaluateGeneratedClubMileageSamples(collector, groupBy(sessionShots, (shot) => shot.clubType));

  return {
    unlocks: dedupeUnlockCandidates(collector.unlocks),
    progress: dedupeProgressCandidates(collector.progress),
  };
}

export function dedupeUnlockCandidates(candidates: AchievementUnlockCandidate[]) {
  const byAchievement = new Map<string, AchievementUnlockCandidate>();

  for (const candidate of candidates) {
    const existing = byAchievement.get(candidate.achievementId);
    const existingTime = existing?.unlockedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const candidateTime = candidate.unlockedAt?.getTime() ?? Number.POSITIVE_INFINITY;

    if (!existing || candidateTime < existingTime) {
      byAchievement.set(candidate.achievementId, candidate);
    }
  }

  return [...byAchievement.values()].sort(
    (left, right) => (left.unlockedAt?.getTime() ?? 0) - (right.unlockedAt?.getTime() ?? 0),
  );
}

function addDataProgress(
  collector: Collector,
  sessions: AchievementSession[],
  shotsBySessionId: Map<string, AchievementShot[]>,
) {
  const importedSessions = sessions.filter((session) => session.source === "rapsodo");
  const maxSessionShots = Math.max(0, ...importedSessions.map((session) => shotsBySessionId.get(session.id)?.length ?? 0));

  collector.progressCandidate("first_import", Math.min(importedSessions.length, 1), 1);
  collector.progressCandidate("data_golfer", Math.min(importedSessions.length, 5), 5);
  collector.progressCandidate("range_rat", Math.min(importedSessions.length, 10), 10);
  collector.progressCandidate("first_10_shot_session", Math.min(maxSessionShots, 10), 10);
  collector.progressCandidate("first_25_shot_session", Math.min(maxSessionShots, 25), 25);
  collector.progressCandidate("first_50_shot_session", Math.min(maxSessionShots, 50), 50);

  if (importedSessions.length >= 1) {
    collector.unlock("first_import", { sourceSessionId: importedSessions[0]?.id, unlockedAt: importedSessions[0]?.date });
  }

  if (importedSessions.length >= 5) {
    collector.unlock("data_golfer", { sourceSessionId: importedSessions[4]?.id, unlockedAt: importedSessions[4]?.date });
  }

  if (importedSessions.length >= 10) {
    collector.unlock("range_rat", { sourceSessionId: importedSessions[9]?.id, unlockedAt: importedSessions[9]?.date });
  }
}

function evaluateSingleShot(
  collector: Collector,
  shot: AchievementShot,
  context: { maxBallSpeed: number | null; maxApex: number | null },
) {
  const source = {
    sourceSessionId: shot.sessionId,
    sourceShotId: shot.id,
    unlockedAt: shot.shotAt,
  };
  const offline = shot.sideCarryYd;
  const absOffline = absNumber(offline);
  const apexYd = shot.apexFt === null ? null : shot.apexFt / 3;

  evaluateGeneratedShotAchievements(collector, shot);
  evaluateGeneratedHiddenShotAchievements(collector, shot, source);

  if (shot.clubType === "driver") {
    thresholdShot(collector, shot, "driver_total_200", shot.totalYd, 200);
    thresholdShot(collector, shot, "driver_total_210", shot.totalYd, 210);
    thresholdShot(collector, shot, "driver_total_220", shot.totalYd, 220);
    thresholdShot(collector, shot, "driver_total_230", shot.totalYd, 230);
    thresholdShot(collector, shot, "driver_total_240", shot.totalYd, 240);
    thresholdShot(collector, shot, "driver_total_250", shot.totalYd, 250);
    thresholdShot(collector, shot, "driver_carry_190", shot.carryYd, 190);
    thresholdShot(collector, shot, "driver_carry_200", shot.carryYd, 200);
    thresholdShot(collector, shot, "driver_carry_210", shot.carryYd, 210);
    thresholdShot(collector, shot, "driver_carry_220", shot.carryYd, 220);
    thresholdShot(collector, shot, "driver_ball_speed_130", shot.ballSpeedMph, 130);
    thresholdShot(collector, shot, "driver_ball_speed_135", shot.ballSpeedMph, 135);
    thresholdShot(collector, shot, "driver_ball_speed_140", shot.ballSpeedMph, 140);
    thresholdShot(collector, shot, "driver_club_speed_90", shot.clubSpeedMph, 90);
    thresholdShot(collector, shot, "driver_club_speed_95", shot.clubSpeedMph, 95);
    thresholdShot(collector, shot, "driver_club_speed_100", shot.clubSpeedMph, 100);
    thresholdShot(collector, shot, "driver_smash_145", shot.smashFactor, 1.45);
    thresholdShot(collector, shot, "driver_smash_148", shot.smashFactor, 1.48);
    thresholdShot(collector, shot, "driver_smash_150", shot.smashFactor, 1.5);
    thresholdShot(collector, shot, "driver_apex_20", apexYd, 20);
    thresholdShot(collector, shot, "driver_apex_30", apexYd, 30);

    if (between(shot.launchAngleDeg, 13, 17)) {
      collector.unlock("driver_launch_window_single", source);
    }

    if (between(shot.launchAngleDeg, 12, 15) && (shot.carryYd ?? 0) >= 200) {
      collector.unlock("driver_penetrating_flight", source);
    }

    if ((shot.totalYd ?? 0) >= 220 && absOffline !== null && absOffline <= 10) {
      collector.unlock("driver_bomb_straight", { ...source, metadata: { totalYd: shot.totalYd, offlineYd: offline } });
    }

    if (absOffline !== null && absOffline <= 20) {
      collector.unlock("driver_offline_20", { ...source, metadata: { offlineYd: offline } });
    }

    if (absOffline !== null && absOffline <= 10) {
      collector.unlock("driver_offline_10", { ...source, metadata: { offlineYd: offline } });
    }

    if (absOffline !== null && absOffline <= 5) {
      collector.unlock("driver_offline_5", { ...source, metadata: { offlineYd: offline } });
    }

    if (shot.attackAngleDeg !== null && shot.attackAngleDeg >= 2) {
      collector.unlock("driver_upward_attack", { ...source, metadata: { attackAngleDeg: shot.attackAngleDeg } });
    }

    if (between(shot.clubPathDeg, -1, 4)) {
      collector.unlock("driver_path_neutral", { ...source, metadata: { clubPathDeg: shot.clubPathDeg } });
    }
  }

  if (shot.clubType === "5w") {
    collector.unlock("fivewood_unlocked", source);
    thresholdShot(collector, shot, "fivewood_carry_150", shot.carryYd, 150);
    thresholdShot(collector, shot, "fivewood_carry_160", shot.carryYd, 160);
    thresholdShot(collector, shot, "fivewood_carry_170", shot.carryYd, 170);
    thresholdShot(collector, shot, "fivewood_carry_180", shot.carryYd, 180);
    thresholdShot(collector, shot, "fivewood_total_190", shot.totalYd, 190);
    thresholdShot(collector, shot, "fivewood_total_200", shot.totalYd, 200);

    if (between(shot.launchAngleDeg, 11, 16)) {
      collector.unlock("fivewood_launch_window", source);
    }

    if ((shot.launchAngleDeg ?? 0) >= 12 && (shot.carryYd ?? 0) >= 160) {
      collector.unlock("fivewood_sweep_grass", source);
    }

    if (absOffline !== null && absOffline <= 10) {
      collector.unlock("fivewood_laser", { ...source, metadata: { offlineYd: offline } });
    }
  }

  if ((shot.clubType === "driver" || shot.clubType === "5w") && (shot.launchAngleDeg ?? 99) < 5) {
    collector.unlock("worm_burner", source);
  }

  if (shot.clubType === "driver" && (shot.launchAngleDeg ?? 0) > 22) {
    collector.unlock("moon_ball", source);
  }

  if ((shot.apexFt ?? Number.POSITIVE_INFINITY) < 15) {
    collector.unlock("floor_is_lava", source);
  }

  if (isFullShotClub(shot.clubType) && (shot.carryYd ?? Number.POSITIVE_INFINITY) < 10) {
    collector.unlock("was_that_practice", source);
  }

  if (offline !== null && offline < -40) {
    collector.unlock("left_field", { ...source, metadata: { sideCarryYd: offline } });
  }

  if (offline !== null && offline > 40) {
    collector.unlock("right_field", { ...source, metadata: { sideCarryYd: offline } });
  }

  if ((shot.smashFactor ?? 0) >= smashTarget(shot.clubType) && absOffline !== null && absOffline >= 40) {
    collector.unlock("efficient_but_ugly", source);
  }

  if (context.maxBallSpeed !== null && shot.ballSpeedMph === context.maxBallSpeed) {
    collector.unlock("absolute_rocket", { ...source, metadata: { ballSpeedMph: shot.ballSpeedMph } });
  }

  if (context.maxApex !== null && shot.apexFt === context.maxApex) {
    collector.unlock("satellite_launch", { ...source, metadata: { apexFt: shot.apexFt } });
  }
}

function evaluateGeneratedHiddenShotAchievements(
  collector: Collector,
  shot: AchievementShot,
  source: Omit<AchievementUnlockCandidate, "achievementId">,
) {
  const generatedAchievements = GENERATED_HIDDEN_SHOTS_BY_CLUB.get(shot.clubType) ?? [];

  for (const generated of generatedAchievements) {
    const value = generatedHiddenShotValue(generated, shot);

    if (value === null || !generatedHiddenShotUnlocked(generated, value)) {
      continue;
    }

    collector.unlock(generated.id, {
      ...source,
      metadata: metadataForGeneratedHiddenShot(generated, shot, value),
    });
  }
}

function generatedHiddenShotValue(generated: GeneratedHiddenShotAchievement, shot: AchievementShot) {
  const offline = shot.sideCarryYd;
  const absOffline = absNumber(offline);

  if (generated.kind === "offlineLeftYd") {
    return offline !== null && offline < 0 ? Math.abs(offline) : null;
  }

  if (generated.kind === "offlineRightYd") {
    return offline !== null && offline > 0 ? offline : null;
  }

  if (generated.kind === "straightOfflineYd") {
    return absOffline;
  }

  if (generated.kind === "lowCarryYd") {
    return isHiddenFullShotCandidate(shot) ? shot.carryYd : null;
  }

  if (generated.kind === "lowLaunchDeg" || generated.kind === "highLaunchDeg") {
    return isHiddenFullShotCandidate(shot) ? shot.launchAngleDeg : null;
  }

  if (generated.kind === "lowApexFt" || generated.kind === "highApexFt") {
    return shot.apexFt;
  }

  if (generated.kind === "pureWild") {
    return isHiddenFullShotCandidate(shot) && (shot.smashFactor ?? 0) >= smashTarget(shot.clubType)
      ? absOffline
      : null;
  }

  return null;
}

function generatedHiddenShotUnlocked(generated: GeneratedHiddenShotAchievement, value: number) {
  if (
    generated.kind === "lowCarryYd" ||
    generated.kind === "lowLaunchDeg" ||
    generated.kind === "lowApexFt" ||
    generated.kind === "straightOfflineYd"
  ) {
    return value <= generated.threshold;
  }

  return value >= generated.threshold;
}

function metadataForGeneratedHiddenShot(
  generated: GeneratedHiddenShotAchievement,
  shot: AchievementShot,
  value: number,
) {
  return {
    clubName: formatClubType(generated.clubType),
    clubType: generated.clubType,
    value: roundOne(value),
    targetValue: generated.threshold,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    launchAngleDeg: shot.launchAngleDeg,
    apexFt: shot.apexFt,
    smashFactor: shot.smashFactor,
  };
}

function isHiddenFullShotCandidate(shot: AchievementShot) {
  if (isShortGameTouchClubType(shot.clubType)) {
    return false;
  }

  const category = shot.shotCategory?.trim().toLowerCase();
  return !category || !HIDDEN_FULL_SHOT_EXCLUDED_CATEGORIES.has(category);
}

function evaluateGeneratedShotAchievements(collector: Collector, shot: AchievementShot) {
  if (isShortGameTouchClubType(shot.clubType) && shot.courseHoleNumber !== null && shot.courseHoleNumber !== undefined) {
    return;
  }

  const generatedAchievements = GENERATED_CLUB_METRICS_BY_CLUB.get(shot.clubType) ?? [];

  for (const generated of generatedAchievements) {
    const value = generatedShotMetricValue(generated.metric, shot);

    if (value === null) {
      continue;
    }

    const unlocked =
      generated.operator === ">="
        ? value >= generated.threshold
        : value <= generated.threshold;

    collector.progressCandidate(
      generated.id,
      generated.operator === ">="
        ? Math.min(Math.max(0, value), generated.threshold)
        : Math.max(0, generated.threshold - value),
      generated.operator === ">=" ? generated.threshold : generated.threshold,
      {
        value: roundOne(value),
        clubType: shot.clubType,
        ...metadataForGeneratedShotMetric(generated.metric, value),
      },
    );

    if (unlocked) {
      collector.unlock(generated.id, {
        sourceSessionId: shot.sessionId,
        sourceShotId: shot.id,
        unlockedAt: shot.shotAt,
        metadata: {
          value: roundOne(value),
          clubType: shot.clubType,
          ...metadataForGeneratedShotMetric(generated.metric, value),
        },
      });
    }
  }
}

function generatedShotMetricValue(metric: GeneratedClubMetric, shot: AchievementShot) {
  if (metric === "offlineYd") {
    return absNumber(shot.sideCarryYd);
  }

  if (metric === "carryYd") {
    return shot.carryYd;
  }

  return shot.totalYd;
}

function metadataForGeneratedShotMetric(metric: GeneratedClubMetric, value: number) {
  const rounded = roundOne(value);

  if (metric === "offlineYd") {
    return { offlineYd: rounded };
  }

  if (metric === "carryYd") {
    return { carryYd: rounded };
  }

  return { totalYd: rounded };
}

function evaluateSession(collector: Collector, session: AchievementSession, sessionShots: AchievementShot[]) {
  if (sessionShots.length >= 10) {
    collector.unlock("first_10_shot_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sessionShots.length >= 25) {
    collector.unlock("first_25_shot_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sessionShots.length >= 50) {
    collector.unlock("first_50_shot_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }

  const byClub = groupBy(sessionShots, (shot) => shot.clubType);
  const driverShots = byClub.get("driver") ?? [];
  const fiveWoodShots = byClub.get("5w") ?? [];
  const ironShots = sessionShots.filter((shot) => IRON_PATTERN.test(shot.clubType));
  const wedgeShots = sessionShots.filter((shot) => WEDGE_TYPES.has(shot.clubType));

  if (driverShots.length >= 20) {
    collector.unlock("driver_day", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (fiveWoodShots.length >= 10) {
    collector.unlock("fivewood_day", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (ironShots.length >= 30) {
    collector.unlock("iron_day", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (wedgeShots.length >= 30) {
    collector.unlock("wedge_day", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (byClub.size >= 5) {
    collector.unlock("bag_test", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if ([...byClub.values()].some((clubShots) => clubShots.length >= 20)) {
    collector.unlock("focused_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }

  evaluateDriverSession(collector, session, driverShots);
  evaluateFiveWoodSession(collector, session, fiveWoodShots);
  evaluateShortGameSession(collector, session, byClub);
  evaluateConsistencySession(collector, session, byClub);
  evaluateGeneratedClubMasterySession(collector, session, byClub);
  evaluateSessionHidden(collector, session, sessionShots);
}

function evaluateDriverSession(collector: Collector, session: AchievementSession, driverShots: AchievementShot[]) {
  const launchValues = driverShots.map((shot) => shot.launchAngleDeg).filter(isNumber);
  const pathValues = driverShots.map((shot) => shot.clubPathDeg).filter(isNumber);
  const sideValues = driverShots.map((shot) => shot.sideCarryYd).filter(isNumber);

  if (launchValues.length >= 5 && between(mean(launchValues), 13, 17)) {
    collector.unlock("driver_launch_locked_5", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (launchValues.length >= 10 && between(mean(launchValues), 13, 17)) {
    collector.unlock("driver_launch_locked_10", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (launchValues.length >= 10 && launchValues.every((value) => value >= 10)) {
    collector.unlock("driver_no_low_bullets", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (launchValues.length >= 10 && launchValues.every((value) => value <= 21)) {
    collector.unlock("driver_no_moon_balls", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sideValues.length >= 10 && sideValues.every((value) => value >= -20)) {
    collector.unlock("driver_no_left_10", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sideValues.length >= 10 && sideValues.every((value) => value <= 20)) {
    collector.unlock("driver_no_right_10", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sideValues.length >= 10 && spread(sideValues) <= 30) {
    collector.unlock("driver_tight_pattern_10", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sideValues.length >= 20 && between(mean(sideValues), -5, 5)) {
    collector.unlock("driver_neutral_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (pathValues.length >= 10 && between(mean(pathValues), 1, 4)) {
    collector.unlock("driver_path_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (hasConsecutive(driverShots, (shot) => (shot.smashFactor ?? 0) >= 1.45, 5)) {
    collector.unlock("driver_smash_streak", { sourceSessionId: session.id, unlockedAt: session.date });
  }
}

function evaluateFiveWoodSession(collector: Collector, session: AchievementSession, fiveWoodShots: AchievementShot[]) {
  const carryValues = fiveWoodShots.map((shot) => shot.carryYd).filter(isNumber);

  if (carryValues.length >= 10 && carryValues.every((value) => value >= 120)) {
    collector.unlock("fivewood_no_top_zone", { sourceSessionId: session.id, unlockedAt: session.date });
  }

  if (carryValues.length >= 20 && mean(carryValues) >= 165 && spread(carryValues) <= 20) {
    collector.unlock("fivewood_stock_built", { sourceSessionId: session.id, unlockedAt: session.date });
  }
}

function evaluateShortGameSession(
  collector: Collector,
  session: AchievementSession,
  byClub: Map<string, AchievementShot[]>,
) {
  const swShots = byClub.get("sw") ?? [];
  const lwShots = byClub.get("lw") ?? [];

  if (countCarryWindow(swShots, 45, 55) >= 5) {
    collector.unlock("sw_dialled_50", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (countCarryWindow(swShots, 65, 75) >= 5) {
    collector.unlock("sw_dialled_70", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if ([
    countCarryWindow(swShots, 25, 35),
    countCarryWindow(swShots, 45, 55),
    countCarryWindow(swShots, 65, 75),
  ].every((count) => count > 0)) {
    collector.unlock("sw_wedge_ladder_i", { sourceSessionId: session.id, unlockedAt: session.date });
  }

  if (countCarryWindow(lwShots, 25, 35) >= 5) {
    collector.unlock("lw_30_yard_touch", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (countCarryWindow(lwShots, 35, 45) >= 5) {
    collector.unlock("lw_40_yard_touch", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if ([
    countCarryWindow(lwShots, 15, 25),
    countCarryWindow(lwShots, 25, 35),
    countCarryWindow(lwShots, 35, 45),
    countCarryWindow(lwShots, 45, 55),
  ].every((count) => count > 0)) {
    collector.unlock("lw_lob_ladder", { sourceSessionId: session.id, unlockedAt: session.date });
  }
}

function countCarryWindow(shots: AchievementShot[], minYd: number, maxYd: number) {
  return shots.filter((shot) => between(shot.carryYd, minYd, maxYd)).length;
}

function evaluateConsistencySession(
  collector: Collector,
  session: AchievementSession,
  byClub: Map<string, AchievementShot[]>,
) {
  for (const clubShots of byClub.values()) {
    const carryValues = clubShots.map((shot) => shot.carryYd).filter(isNumber);
    const totalValues = clubShots.map((shot) => shot.totalYd).filter(isNumber);
    const launchValues = clubShots.map((shot) => shot.launchAngleDeg).filter(isNumber);
    const directionValues = clubShots.map((shot) => shot.launchDirectionDeg).filter(isNumber);
    const apexValues = clubShots.map((shot) => shot.apexFt).filter(isNumber);

    if (carryValues.length >= 10 && spread(carryValues) <= 10) {
      collector.unlock("carry_consistency", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (totalValues.length >= 10 && spread(totalValues) <= 15) {
      collector.unlock("total_consistency", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (launchValues.length >= 10 && spread(launchValues) <= 4) {
      collector.unlock("launch_consistency", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (directionValues.length >= 10 && spread(directionValues) <= 5) {
      collector.unlock("direction_consistency", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (apexValues.length >= 10 && spread(apexValues) <= 30) {
      collector.unlock("apex_consistency", { sourceSessionId: session.id, unlockedAt: session.date });
    }
  }

  if (
    [...byClub.values()].some((clubShots) => {
      if (clubShots.length < 20) {
        return false;
      }

      return clubShots.every((shot) => (shot.carryYd ?? 0) >= 20 && absNumber(shot.sideCarryYd) !== null && absNumber(shot.sideCarryYd)! <= 80);
    })
  ) {
    collector.unlock("no_outlier_session", { sourceSessionId: session.id, unlockedAt: session.date });
  }
}

function evaluateSessionHidden(
  collector: Collector,
  session: AchievementSession,
  sessionShots: AchievementShot[],
) {
  if (sessionShots.length === 0) {
    return;
  }

  const scoredShots = sessionShots
    .map((shot) => ({ shot, score: shotQualityScore(shot) }))
    .filter((entry) => Number.isFinite(entry.score));
  const worst = minBy(scoredShots, (entry) => entry.score);
  const best = maxBy(scoredShots, (entry) => entry.score);

  if (worst) {
    collector.unlock("delete_this_one", {
      sourceSessionId: session.id,
      sourceShotId: worst.shot.id,
      unlockedAt: session.date,
      metadata: { score: roundOne(worst.score), shotNumber: worst.shot.shotNumber },
    });
  }

  if (best) {
    collector.unlock("highlight_reel", {
      sourceSessionId: session.id,
      sourceShotId: best.shot.id,
      unlockedAt: session.date,
      metadata: { score: roundOne(best.score), shotNumber: best.shot.shotNumber },
    });
  }
}

function evaluateRollingSamples(
  collector: Collector,
  shotCountByClubId: Map<string, AchievementShot[]>,
) {
  const maxCount = Math.max(0, ...[...shotCountByClubId.values()].map((clubShots) => clubShots.length));
  collector.progressCandidate("ten_shot_sample", Math.min(maxCount, 10), 10);
  collector.progressCandidate("twenty_shot_sample", Math.min(maxCount, 20), 20);
  collector.progressCandidate("fifty_shot_sample", Math.min(maxCount, 50), 50);

  if (maxCount >= 10) {
    collector.unlock("ten_shot_sample");
  }
  if (maxCount >= 20) {
    collector.unlock("twenty_shot_sample");
  }
  if (maxCount >= 50) {
    collector.unlock("fifty_shot_sample");
  }
}

function evaluateGeneratedClubVolumeSamples(
  collector: Collector,
  shotsByClubType: Map<string, AchievementShot[]>,
) {
  for (const [clubType, clubShots] of shotsByClubType.entries()) {
    const generatedAchievements = GENERATED_CLUB_VOLUME_BY_CLUB.get(clubType) ?? [];

    if (generatedAchievements.length === 0) {
      continue;
    }

    const sortedClubShots = sortShots(clubShots);
    const shotCount = sortedClubShots.length;

    for (const generated of generatedAchievements) {
      collector.progressCandidate(
        generated.id,
        Math.min(shotCount, generated.shotCount),
        generated.shotCount,
        { clubType, shotCount },
      );

      if (shotCount < generated.shotCount) {
        continue;
      }

      const thresholdShot = sortedClubShots[generated.shotCount - 1] ?? sortedClubShots[sortedClubShots.length - 1];

      collector.unlock(generated.id, {
        sourceSessionId: thresholdShot?.sessionId,
        sourceShotId: thresholdShot?.id,
        unlockedAt: thresholdShot?.shotAt,
        metadata: {
          clubType,
          shotCount,
          targetShots: generated.shotCount,
        },
      });
    }
  }
}

function evaluateGeneratedClubMileageSamples(
  collector: Collector,
  shotsByClubType: Map<string, AchievementShot[]>,
) {
  for (const [clubType, clubShots] of shotsByClubType.entries()) {
    const generatedAchievements = GENERATED_CLUB_MILEAGE_BY_CLUB.get(clubType) ?? [];

    if (generatedAchievements.length === 0) {
      continue;
    }

    let totalYards = 0;
    const cumulativeShots: Array<{ shot: AchievementShot; cumulativeYards: number }> = [];

    for (const shot of sortShots(clubShots)) {
      const distanceYards = shotDistanceYards(shot);

      if (distanceYards === null) {
        continue;
      }

      totalYards += distanceYards;
      cumulativeShots.push({ shot, cumulativeYards: totalYards });
    }

    const totalMiles = totalYards / YARDS_PER_MILE;

    for (const generated of generatedAchievements) {
      collector.progressCandidate(
        generated.id,
        Math.min(totalMiles, generated.miles),
        generated.miles,
        {
          clubType,
          targetMiles: generated.miles,
          totalMiles: roundMetricValue(totalMiles),
          totalYards: roundOne(totalYards),
        },
      );

      if (totalYards < generated.targetYards) {
        continue;
      }

      const thresholdShot =
        cumulativeShots.find((entry) => entry.cumulativeYards >= generated.targetYards) ??
        cumulativeShots[cumulativeShots.length - 1];

      collector.unlock(generated.id, {
        sourceSessionId: thresholdShot?.shot.sessionId,
        sourceShotId: thresholdShot?.shot.id,
        unlockedAt: thresholdShot?.shot.shotAt,
        metadata: {
          clubType,
          targetMiles: generated.miles,
          totalMiles: roundMetricValue((thresholdShot?.cumulativeYards ?? totalYards) / YARDS_PER_MILE),
          totalYards: roundOne(thresholdShot?.cumulativeYards ?? totalYards),
        },
      });
    }
  }
}

function evaluateGeneratedClubPersonalBests(
  collector: Collector,
  shotsByClubType: Map<string, AchievementShot[]>,
) {
  for (const [clubType, clubShots] of shotsByClubType.entries()) {
    const generatedAchievements = GENERATED_CLUB_PERSONAL_BEST_BY_CLUB.get(clubType) ?? [];

    if (generatedAchievements.length === 0) {
      continue;
    }

    const carryAchievement = generatedAchievements.find((achievement) => achievement.metric === "carryYd");
    const totalAchievement = generatedAchievements.find((achievement) => achievement.metric === "totalYd");
    const controlAchievement = generatedAchievements.find((achievement) => achievement.metric === "withControl");
    let bestCarry: number | null = null;
    let bestTotal: number | null = null;

    for (const shot of sortShots(clubShots)) {
      const carryPb = isNewPersonalBest(shot.carryYd, bestCarry);
      const totalPb = isNewPersonalBest(shot.totalYd, bestTotal);
      const absOffline = absNumber(shot.sideCarryYd);

      if (carryPb && carryAchievement) {
        collector.unlock(carryAchievement.id, {
          sourceSessionId: shot.sessionId,
          sourceShotId: shot.id,
          unlockedAt: shot.shotAt,
          metadata: { clubType, previousBest: bestCarry, value: shot.carryYd },
        });
      }

      if (totalPb && totalAchievement) {
        collector.unlock(totalAchievement.id, {
          sourceSessionId: shot.sessionId,
          sourceShotId: shot.id,
          unlockedAt: shot.shotAt,
          metadata: { clubType, previousBest: bestTotal, value: shot.totalYd },
        });
      }

      if ((carryPb || totalPb) && controlAchievement && absOffline !== null && absOffline <= 15) {
        collector.unlock(controlAchievement.id, {
          sourceSessionId: shot.sessionId,
          sourceShotId: shot.id,
          unlockedAt: shot.shotAt,
          metadata: { clubType, carryYd: shot.carryYd, totalYd: shot.totalYd, offlineYd: shot.sideCarryYd },
        });
      }

      if (shot.carryYd !== null && (bestCarry === null || shot.carryYd > bestCarry)) {
        bestCarry = shot.carryYd;
      }
      if (shot.totalYd !== null && (bestTotal === null || shot.totalYd > bestTotal)) {
        bestTotal = shot.totalYd;
      }
    }
  }
}

function isNewPersonalBest(value: number | null, previousBest: number | null) {
  return value !== null && previousBest !== null && value > previousBest;
}

function evaluateGeneratedClubMasterySession(
  collector: Collector,
  session: AchievementSession,
  byClub: Map<string, AchievementShot[]>,
) {
  for (const [clubType, clubShots] of byClub.entries()) {
    const generatedAchievements = GENERATED_CLUB_MASTERY_BY_CLUB.get(clubType) ?? [];

    if (generatedAchievements.length === 0) {
      continue;
    }

    for (const generated of generatedAchievements) {
      const metricValue = clubMasteryMetricValue(generated.metric, clubShots);

      if (!metricValue || metricValue.sampleSize < generated.minShots) {
        continue;
      }

      const unlocked =
        generated.operator === ">="
          ? metricValue.value >= generated.threshold
          : metricValue.value <= generated.threshold;

      collector.progressCandidate(
        generated.id,
        generated.operator === ">="
          ? Math.min(Math.max(0, metricValue.value), generated.threshold)
          : Math.max(0, generated.threshold - metricValue.value),
        generated.threshold,
        {
          value: roundMetricValue(metricValue.value),
          clubType,
          sampleSize: metricValue.sampleSize,
        },
      );

      if (!unlocked) {
        continue;
      }

      collector.unlock(generated.id, {
        sourceSessionId: session.id,
        unlockedAt: session.date,
        metadata: {
          ...metadataForMasteryMetric(generated.metric, metricValue.value),
          clubType,
          sampleSize: metricValue.sampleSize,
          targetValue: generated.threshold,
        },
      });
    }
  }
}

function clubMasteryMetricValue(
  metric: GeneratedClubMasteryMetric,
  clubShots: AchievementShot[],
) {
  if (metric === "carrySpreadYd") {
    return spreadMetric(clubShots.map((shot) => shot.carryYd));
  }

  if (metric === "totalSpreadYd") {
    return spreadMetric(clubShots.map((shot) => shot.totalYd));
  }

  if (metric === "offlineAverageYd") {
    const values = clubShots.map((shot) => absNumber(shot.sideCarryYd)).filter(isNumber);
    return values.length > 0 ? { value: mean(values), sampleSize: values.length } : null;
  }

  if (metric === "launchSpreadDeg") {
    return spreadMetric(clubShots.map((shot) => shot.launchAngleDeg));
  }

  const values = clubShots.map((shot) => shot.smashFactor).filter(isNumber);
  return values.length > 0 ? { value: mean(values), sampleSize: values.length } : null;
}

function spreadMetric(values: Array<number | null | undefined>) {
  const present = values.filter(isNumber);
  return present.length > 0 ? { value: spread(present), sampleSize: present.length } : null;
}

function metadataForMasteryMetric(metric: GeneratedClubMasteryMetric, value: number) {
  const rounded = roundMetricValue(value);

  if (metric === "carrySpreadYd") {
    return { carrySpreadYd: rounded, value: rounded };
  }

  if (metric === "totalSpreadYd") {
    return { totalSpreadYd: rounded, value: rounded };
  }

  if (metric === "offlineAverageYd") {
    return { offlineAverageYd: rounded, value: rounded };
  }

  if (metric === "launchSpreadDeg") {
    return { launchSpreadDeg: rounded, value: rounded };
  }

  return { smashAverage: rounded, value: rounded };
}

function evaluateStockAndGapping(
  collector: Collector,
  clubs: AchievementClub[],
  latestStockByClubId: Map<string, AchievementStockYardage>,
) {
  const activeClubs = clubs.filter(
    (club) => club.active && isTrackedClubType(club.type) && !isShortGameTouchClubType(club.type),
  );
  const reliableStocks = [...latestStockByClubId.values()].filter(
    (stock) =>
      isTrackedClubType(stock.clubType) && !isShortGameTouchClubType(stock.clubType) && isReliableStock(stock),
  );
  const reliableByType = new Map(reliableStocks.map((stock) => [stock.clubType, stock]));
  const activeClubIds = new Set(activeClubs.map((club) => club.id));

  collector.progressCandidate("first_stock_number", Math.min(reliableStocks.length, 1), 1);
  collector.progressCandidate("full_bag_started", Math.min(reliableStocks.length, 5), 5);

  if (reliableStocks.length >= 1) {
    collector.unlock("first_stock_number", { metadata: { stockCount: reliableStocks.length } });
  }
  if (reliableByType.has("driver")) {
    collector.unlock("driver_stocked");
  }
  if (reliableByType.has("5w")) {
    collector.unlock("fivewood_stocked");
  }
  if ([...reliableByType.keys()].some((type) => IRON_PATTERN.test(type))) {
    collector.unlock("iron_stocked");
  }
  if (reliableStocks.length >= 5) {
    collector.unlock("full_bag_started", { metadata: { stockCount: reliableStocks.length } });
  }
  if (activeClubs.length >= 5 && activeClubs.every((club) => latestStockByClubId.has(club.id))) {
    collector.unlock("full_bag_mapped", { metadata: { activeClubCount: activeClubs.length } });
  }
  if (activeClubs.length >= 5 && activeClubs.every((club) => (latestStockByClubId.get(club.id)?.confidenceScore ?? 0) >= 70)) {
    collector.unlock("reliable_bag", { metadata: { activeClubCount: activeClubs.length } });
  }

  evaluateBenchmarkLevels(
    collector,
    reliableStocks.filter((stock) => activeClubIds.has(stock.clubId)),
  );

  const driver = reliableByType.get("driver");
  const fiveWood = reliableByType.get("5w");
  const fiveIron = reliableByType.get("5i");
  if (driver?.carryMedianYd && fiveWood?.carryMedianYd && fiveIron?.carryMedianYd) {
    const driverGap = driver.carryMedianYd - fiveWood.carryMedianYd;
    const fiveWoodGap = fiveWood.carryMedianYd - fiveIron.carryMedianYd;
    if (driverGap >= 15 && fiveWoodGap >= 15) {
      collector.unlock("top_end_fixed", { metadata: { driverGap: roundOne(driverGap), fiveWoodGap: roundOne(fiveWoodGap) } });
    }
  }

  const eightIron = reliableByType.get("8i");
  const nineIron = reliableByType.get("9i");
  const pitchingWedge = reliableByType.get("pw");
  if (eightIron?.carryMedianYd && nineIron?.carryMedianYd) {
    const gap = eightIron.carryMedianYd - nineIron.carryMedianYd;
    if (gap >= 8 && gap <= 12) {
      collector.unlock("eight_nine_gap_healthy", { metadata: { gapYd: roundOne(gap) } });
    }
    if (pitchingWedge?.carryMedianYd && gap >= 8 && nineIron.carryMedianYd - pitchingWedge.carryMedianYd >= 8) {
      collector.unlock("scoring_gap_fixed");
    }
  }
}

function evaluateBenchmarkLevels(collector: Collector, reliableStocks: AchievementStockYardage[]) {
  const benchmarkedStocks = reliableStocks
    .map((stock) => {
      const comparison = compareClubCarryToBenchmark(stock.clubType, stock.carryMedianYd);

      if (!comparison || stock.carryMedianYd === null) {
        return null;
      }

      return {
        stock,
        comparison,
        score: comparison.levelIndex ?? 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const bestStock = benchmarkedStocks.reduce<(typeof benchmarkedStocks)[number] | null>((best, item) => {
    if (!best || item.score > best.score) {
      return item;
    }

    if (item.score === best.score && item.comparison.progressPercent > best.comparison.progressPercent) {
      return item;
    }

    return best;
  }, null);

  for (const achievement of SINGLE_BENCHMARK_ACHIEVEMENTS) {
    collector.progressCandidate(
      achievement.id,
      Math.min(bestStock?.score ?? 0, achievement.targetLevelIndex),
      achievement.targetLevelIndex,
      bestStock
        ? metadataForBenchmarkStock(bestStock.stock, achievement.label, bestStock.comparison.levelLabel)
        : { benchmarkLevel: achievement.label },
    );

    if (bestStock && bestStock.score >= achievement.targetLevelIndex) {
      collector.unlock(achievement.id, {
        metadata: metadataForBenchmarkStock(bestStock.stock, achievement.label, bestStock.comparison.levelLabel),
      });
    }
  }

  for (const { stock } of benchmarkedStocks) {
    const generatedAchievements = GENERATED_CLUB_BENCHMARKS_BY_CLUB.get(stock.clubType) ?? [];

    for (const generated of generatedAchievements) {
      if (stock.carryMedianYd === null) {
        continue;
      }

      const progressValue = Math.min(Math.max(0, stock.carryMedianYd), generated.targetYards);
      const metadata = metadataForClubBenchmarkStock(stock, generated);

      collector.progressCandidate(generated.id, progressValue, generated.targetYards, metadata);

      if (stock.carryMedianYd >= generated.targetYards) {
        collector.unlock(generated.id, { metadata });
      }
    }
  }

  const benchmarkClubCount = benchmarkedStocks.length;
  const benchmarkAverageLevel = benchmarkClubCount === 0 ? 0 : mean(benchmarkedStocks.map((item) => item.score));
  const sampleProgressMultiplier = Math.min(benchmarkClubCount / 5, 1);

  for (const achievement of BAG_BENCHMARK_ACHIEVEMENTS) {
    collector.progressCandidate(
      achievement.id,
      Math.min(benchmarkAverageLevel * sampleProgressMultiplier, achievement.targetLevelIndex),
      achievement.targetLevelIndex,
      metadataForBenchmarkBag(achievement.label, benchmarkClubCount, benchmarkAverageLevel),
    );

    if (benchmarkClubCount >= 5 && benchmarkAverageLevel >= achievement.targetLevelIndex) {
      collector.unlock(achievement.id, {
        metadata: metadataForBenchmarkBag(achievement.label, benchmarkClubCount, benchmarkAverageLevel),
      });
    }
  }
}

function metadataForClubBenchmarkStock(
  stock: AchievementStockYardage,
  generated: GeneratedClubBenchmarkAchievement,
) {
  return {
    clubName: formatClubType(stock.clubType),
    clubType: stock.clubType,
    benchmarkLevel: generated.levelLabel,
    targetYd: generated.targetYards,
    carryYd: stock.carryMedianYd === null ? null : roundOne(stock.carryMedianYd),
    sampleSize: stock.sampleSize,
    confidenceScore: stock.confidenceScore,
  };
}

function metadataForBenchmarkStock(
  stock: AchievementStockYardage,
  benchmarkLevel: string,
  actualLevel = benchmarkLevel,
) {
  return {
    clubName: formatClubType(stock.clubType),
    clubType: stock.clubType,
    benchmarkLevel,
    actualLevel,
    carryYd: stock.carryMedianYd === null ? null : roundOne(stock.carryMedianYd),
    sampleSize: stock.sampleSize,
    confidenceScore: stock.confidenceScore,
  };
}

function metadataForBenchmarkBag(
  benchmarkLevel: string,
  benchmarkClubCount: number,
  benchmarkAverageLevel: number,
) {
  return {
    benchmarkLevel,
    benchmarkClubCount,
    benchmarkAverageLevel: roundMetricValue(benchmarkAverageLevel),
  };
}

function evaluateProgress(
  collector: Collector,
  shots: AchievementShot[],
  stockYardages: AchievementStockYardage[],
) {
  const driverStocks = stockYardages
    .filter((stock) => stock.clubType === "driver" && isNumber(stock.carryMedianYd))
    .sort((left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime());
  const firstDriverStock = driverStocks[0];
  const latestDriverStock = driverStocks[driverStocks.length - 1];

  if (firstDriverStock?.carryMedianYd && latestDriverStock?.carryMedianYd && driverStocks.length >= 2) {
    const gain = latestDriverStock.carryMedianYd - firstDriverStock.carryMedianYd;
    collector.progressCandidate("distance_up_5", Math.min(Math.max(0, gain), 5), 5, { gainYd: roundOne(gain) });
    collector.progressCandidate("distance_up_10", Math.min(Math.max(0, gain), 10), 10, { gainYd: roundOne(gain) });
    if (gain >= 5) {
      collector.unlock("distance_up_5", { metadata: { gainYd: roundOne(gain) } });
    }
    if (gain >= 10) {
      collector.unlock("distance_up_10", { metadata: { gainYd: roundOne(gain) } });
    }
  }

  const driverShots = sortShots(shots.filter((shot) => shot.clubType === "driver"));
  const earlyDriver = driverShots.slice(0, 20);
  const recentDriver = driverShots.slice(-20);
  const earlyBallSpeed = averageMetric(earlyDriver, (shot) => shot.ballSpeedMph);
  const recentBallSpeed = averageMetric(recentDriver, (shot) => shot.ballSpeedMph);
  const earlyLaunch = averageMetric(earlyDriver, (shot) => shot.launchAngleDeg);
  const recentLaunch = averageMetric(recentDriver, (shot) => shot.launchAngleDeg);

  if (earlyBallSpeed !== null && recentBallSpeed !== null && recentDriver.length >= 5) {
    const gain = recentBallSpeed - earlyBallSpeed;
    collector.progressCandidate("ball_speed_gain", Math.min(Math.max(0, gain), 5), 5, { gainMph: roundOne(gain) });
    if (gain >= 5) {
      collector.unlock("ball_speed_gain", { metadata: { gainMph: roundOne(gain) } });
    }
  }

  if (earlyLaunch !== null && recentLaunch !== null && !between(earlyLaunch, 13, 17) && between(recentLaunch, 13, 17)) {
    collector.unlock("launch_fixed", { metadata: { earlyLaunch: roundOne(earlyLaunch), recentLaunch: roundOne(recentLaunch) } });
  }

  maybeUnlockImprovement(collector, "path_improved", earlyDriver, recentDriver, (shot) => absNumber(shot.clubPathDeg), 30);
  maybeUnlockImprovement(collector, "side_carry_improved", earlyDriver, recentDriver, (shot) => absNumber(shot.sideCarryYd), 25);
  maybeUnlockLeftMissImprovement(collector, earlyDriver, recentDriver);
}

function evaluateRoundScorecard(collector: Collector, session: AchievementSession) {
  const holes = [...(session.scorecardJson ?? [])].sort((left, right) => left.holeNumber - right.holeNumber);

  if (holes.length === 0) {
    return;
  }

  const scoredHoles = holes.filter((hole) => isNumber(hole.score));
  const puttHoles = holes.filter((hole) => isNumber(hole.putts));
  const fullScoreRound = holes.length >= 18 && holes.slice(0, 18).every((hole) => isNumber(hole.score));
  const fullPuttRound = holes.length >= 18 && holes.slice(0, 18).every((hole) => isNumber(hole.putts));
  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9, 18);
  const completeNines = [frontNine, backNine].filter((nine) => nine.length === 9 && nine.every((hole) => isNumber(hole.score)));
  const completePuttNines = [frontNine, backNine].filter((nine) => nine.length === 9 && nine.every((hole) => isNumber(hole.putts)));

  collector.progressCandidate("break_100", Math.min(scoredHoles.length, 18), 18);
  collector.progressCandidate("no_3_putt_round", Math.min(puttHoles.length, 18), 18);

  if (fullScoreRound) {
    const fullHoles = holes.slice(0, 18);
    const score = sumNumbers(fullHoles.map((hole) => hole.score));
    thresholdLowRoundScore(collector, session, score, "break_100", 100);
    thresholdLowRoundScore(collector, session, score, "break_95", 95);
    thresholdLowRoundScore(collector, session, score, "break_90", 90);
    thresholdLowRoundScore(collector, session, score, "break_85", 85);
    thresholdLowRoundScore(collector, session, score, "break_80", 80);

    if (fullHoles.every((hole) => scoreVsPar(hole) < 2)) {
      collector.unlock("no_doubles_round", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (fullHoles.every((hole) => scoreVsPar(hole) < 3)) {
      collector.unlock("clean_card", { sourceSessionId: session.id, unlockedAt: session.date });
    }

    const finalThree = fullHoles.slice(15, 18);
    if (sumNumbers(finalThree.map(scoreVsPar)) <= 1) {
      collector.unlock("hot_finish", { sourceSessionId: session.id, unlockedAt: session.date });
    }
  }

  for (const nine of completeNines) {
    const nineScore = sumNumbers(nine.map((hole) => hole.score));
    if (nineScore <= 39) {
      collector.unlock("sub_40_nine", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { score: nineScore } });
    }
    if (nine.every((hole) => scoreVsPar(hole) < 3)) {
      collector.unlock("clean_nine", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (nine.every((hole) => scoreVsPar(hole) < 2)) {
      collector.unlock("no_doubles_nine", { sourceSessionId: session.id, unlockedAt: session.date });
    }
  }

  const birdies = scoredHoles.filter((hole) => scoreVsPar(hole) <= -1);
  const eagles = scoredHoles.filter((hole) => scoreVsPar(hole) <= -2);
  if (birdies.length >= 1) {
    collector.unlock("birdie_hunter", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { holeNumber: birdies[0]?.holeNumber } });
  }
  if (birdies.length >= 2) {
    collector.unlock("two_birdie_round", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { birdies: birdies.length } });
  }
  if (eagles.length >= 1) {
    collector.unlock("eagle_landed", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { holeNumber: eagles[0]?.holeNumber } });
  }
  if (hasBounceBack(scoredHoles)) {
    collector.unlock("bounce_back", { sourceSessionId: session.id, unlockedAt: session.date });
  }

  if (puttHoles.some((hole) => hole.putts === 1)) {
    collector.unlock("first_one_putt", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  for (const nine of completePuttNines) {
    const putts = sumNumbers(nine.map((hole) => hole.putts));
    if (nine.every((hole) => (hole.putts ?? 99) <= 2)) {
      collector.unlock("no_3_putt_nine", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (putts <= 15) {
      collector.unlock("fifteen_putt_nine", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { putts } });
    }
  }
  if (fullPuttRound) {
    const fullHoles = holes.slice(0, 18);
    const putts = sumNumbers(fullHoles.map((hole) => hole.putts));
    if (fullHoles.every((hole) => (hole.putts ?? 99) <= 2)) {
      collector.unlock("no_3_putt_round", { sourceSessionId: session.id, unlockedAt: session.date });
    }
    if (putts <= 30) {
      collector.unlock("thirty_putt_round", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { putts } });
    }
    if (putts <= 27) {
      collector.unlock("flatstick_god_mode", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { putts } });
    }
    if (fullHoles[17]?.putts === 1) {
      collector.unlock("clutch_finish", { sourceSessionId: session.id, unlockedAt: session.date });
    }
  }

  evaluateRoundStats(collector, session, holes);
}

function evaluateRoundStats(collector: Collector, session: AchievementSession, holes: RoundScorecardHole[]) {
  const fairwayHoles = holes.filter((hole) => hole.fairwayHit !== null && hole.fairwayHit !== undefined);
  const fairways = fairwayHoles.filter((hole) => hole.fairwayHit === true).length;
  const girHoles = holes.filter((hole) => hole.gir !== null && hole.gir !== undefined);
  const gir = girHoles.filter((hole) => hole.gir === true).length;

  if (fairways >= 4) {
    collector.unlock("fairway_starter", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { fairways } });
  }
  if (fairways >= 7) {
    collector.unlock("fairway_finder_round", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { fairways } });
  }
  if (fairwayHoles.length >= 7 && fairways / fairwayHoles.length >= 0.4) {
    collector.unlock("driver_trust", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { fairwayRate: fairways / fairwayHoles.length } });
  }
  if (fairwayHoles.length >= 7 && fairways / fairwayHoles.length >= 0.5) {
    collector.unlock("tee_box_control", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { fairwayRate: fairways / fairwayHoles.length } });
  }

  if (gir >= 4) {
    collector.unlock("gir_starter", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { gir } });
  }
  if (gir >= 8) {
    collector.unlock("gir_machine", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { gir } });
  }
  if (gir >= 10) {
    collector.unlock("ball_striking_day", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { gir } });
  }
  if (girHoles.length >= 9 && gir / girHoles.length >= 0.5) {
    collector.unlock("ball_striker_mode", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { girRate: gir / girHoles.length } });
  }

  const missedGirScored = holes.filter((hole) => hole.gir === false && isNumber(hole.score));
  const saves = missedGirScored.filter((hole) => (hole.score ?? 99) <= hole.par).length;
  if (missedGirScored.length >= 3) {
    const scrambleRate = saves / missedGirScored.length;
    if (scrambleRate >= 0.2) {
      collector.unlock("scramble_upgrade", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { scrambleRate } });
    }
    if (scrambleRate >= 0.35) {
      collector.unlock("short_game_sharp", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { scrambleRate } });
    }
  }

  const sandHoles = holes.filter((hole) => (hole.greensideSandShots ?? 0) > 0);
  if (sandHoles.length > 0) {
    collector.unlock("bunker_tool", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (sandHoles.some((hole) => (hole.putts ?? 99) <= 1 && isNumber(hole.score) && (hole.score ?? 99) <= hole.par)) {
    collector.unlock("sand_save", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (missedGirScored.some((hole) => (hole.putts ?? 99) <= 1 && (hole.score ?? 99) <= hole.par)) {
    collector.unlock("up_and_down", { sourceSessionId: session.id, unlockedAt: session.date });
  }
  if (saves >= 3) {
    collector.unlock("scramble_day", { sourceSessionId: session.id, unlockedAt: session.date, metadata: { saves } });
  }

  const penaltyHoles = holes.slice(0, 18).filter((hole) => isNumber(hole.penalties));
  if (holes.length >= 18 && penaltyHoles.length >= 18 && penaltyHoles.every((hole) => hole.penalties === 0)) {
    collector.unlock("penalty_free", { sourceSessionId: session.id, unlockedAt: session.date });
  }
}

function thresholdShot(
  collector: Collector,
  shot: AchievementShot,
  achievementId: string,
  value: number | null,
  threshold: number,
) {
  collector.progressCandidate(achievementId, Math.min(Math.max(value ?? 0, 0), threshold), threshold, {
    bestValue: value,
  });

  if (value !== null && value >= threshold) {
    collector.unlock(achievementId, {
      sourceSessionId: shot.sessionId,
      sourceShotId: shot.id,
      unlockedAt: shot.shotAt,
      metadata: { value },
    });
  }
}

function thresholdLowRoundScore(
  collector: Collector,
  session: AchievementSession,
  score: number,
  achievementId: string,
  targetExclusive: number,
) {
  if (score < targetExclusive) {
    collector.unlock(achievementId, {
      sourceSessionId: session.id,
      unlockedAt: session.date,
      metadata: { score },
    });
  }
}

function shotDistanceYards(shot: AchievementShot) {
  const value = shot.totalYd ?? shot.carryYd;

  if (!isNumber(value) || value <= 0) {
    return null;
  }

  return value;
}

function maybeUnlockImprovement(
  collector: Collector,
  achievementId: string,
  earlyShots: AchievementShot[],
  recentShots: AchievementShot[],
  selector: (shot: AchievementShot) => number | null,
  targetPercent: number,
) {
  const early = averageMetric(earlyShots, selector);
  const recent = averageMetric(recentShots, selector);

  if (early === null || recent === null || early <= 0 || recentShots.length < 5) {
    return;
  }

  const improvement = ((early - recent) / early) * 100;
  collector.progressCandidate(achievementId, Math.min(Math.max(0, improvement), targetPercent), targetPercent, {
    improvementPercent: roundOne(improvement),
  });

  if (improvement >= targetPercent) {
    collector.unlock(achievementId, { metadata: { improvementPercent: roundOne(improvement) } });
  }
}

function maybeUnlockLeftMissImprovement(
  collector: Collector,
  earlyShots: AchievementShot[],
  recentShots: AchievementShot[],
) {
  const earlyLeft = averageMetric(earlyShots, (shot) => (shot.sideCarryYd !== null && shot.sideCarryYd < 0 ? Math.abs(shot.sideCarryYd) : null));
  const recentLeft = averageMetric(recentShots, (shot) => (shot.sideCarryYd !== null && shot.sideCarryYd < 0 ? Math.abs(shot.sideCarryYd) : null));

  if (earlyLeft === null || recentLeft === null || earlyLeft <= 0 || recentShots.length < 5) {
    return;
  }

  const improvement = ((earlyLeft - recentLeft) / earlyLeft) * 100;
  collector.progressCandidate("hook_reduced", Math.min(Math.max(0, improvement), 25), 25, {
    improvementPercent: roundOne(improvement),
  });
  collector.progressCandidate("hook_exorcist", Math.min(Math.max(0, improvement), 50), 50, {
    improvementPercent: roundOne(improvement),
  });

  if (improvement >= 25) {
    collector.unlock("hook_reduced", { metadata: { improvementPercent: roundOne(improvement) } });
  }
  if (improvement >= 50) {
    collector.unlock("hook_exorcist", { metadata: { improvementPercent: roundOne(improvement) } });
  }
}

function createCollector() {
  const unlocks: AchievementUnlockCandidate[] = [];
  const progress: AchievementProgressCandidate[] = [];

  return {
    unlocks,
    progress,
    unlock(achievementId: string, candidate: Omit<AchievementUnlockCandidate, "achievementId"> = {}) {
      if (!getAchievement(achievementId)) {
        return;
      }

      unlocks.push({
        achievementId,
        ...candidate,
      });
    },
    progressCandidate(
      achievementId: string,
      progressValue: number,
      targetValue: number,
      metadata?: Record<string, unknown>,
    ) {
      if (!getAchievement(achievementId)) {
        return;
      }

      progress.push({
        achievementId,
        progressValue: Math.max(0, progressValue),
        targetValue: Math.max(1, targetValue),
        metadata,
      });
    },
  };
}

type Collector = ReturnType<typeof createCollector>;

function dedupeProgressCandidates(candidates: AchievementProgressCandidate[]) {
  const byAchievement = new Map<string, AchievementProgressCandidate>();

  for (const candidate of candidates) {
    const existing = byAchievement.get(candidate.achievementId);
    const candidateRatio = candidate.progressValue / candidate.targetValue;
    const existingRatio = existing ? existing.progressValue / existing.targetValue : -1;

    if (!existing || candidateRatio >= existingRatio) {
      byAchievement.set(candidate.achievementId, candidate);
    }
  }

  return [...byAchievement.values()];
}

function latestStocks(stocks: AchievementStockYardage[]) {
  const latest = new Map<string, AchievementStockYardage>();

  for (const stock of stocks) {
    const existing = latest.get(stock.clubId);

    if (!existing || stock.calculatedAt > existing.calculatedAt) {
      latest.set(stock.clubId, stock);
    }
  }

  return latest;
}

function isReliableStock(stock: AchievementStockYardage) {
  return (stock.confidenceScore ?? 0) >= 50 && stock.carryMedianYd !== null && stock.sampleSize >= 5;
}

function shotQualityScore(shot: AchievementShot) {
  const distance = shot.totalYd ?? shot.carryYd ?? 0;
  const offline = absNumber(shot.sideCarryYd) ?? 80;
  const smash = shot.smashFactor ?? 1;
  const launchBonus = between(shot.launchAngleDeg, 10, 18) ? 10 : 0;

  return distance * 0.4 + Math.max(0, 40 - offline) + smash * 20 + launchBonus;
}

function scoreVsPar(hole: RoundScorecardHole) {
  return (hole.score ?? hole.par + 10) - hole.par;
}

function hasBounceBack(holes: RoundScorecardHole[]) {
  for (let index = 0; index < holes.length - 1; index += 1) {
    if (scoreVsPar(holes[index]) >= 2 && scoreVsPar(holes[index + 1]) <= 0) {
      return true;
    }
  }

  return false;
}

function averageMetric<T>(items: T[], selector: (item: T) => number | null) {
  const values = items.map(selector).filter(isNumber);
  return values.length === 0 ? null : mean(values);
}

function hasConsecutive<T>(items: T[], predicate: (item: T) => boolean, target: number) {
  let count = 0;

  for (const item of items) {
    count = predicate(item) ? count + 1 : 0;

    if (count >= target) {
      return true;
    }
  }

  return false;
}

function isFullShotClub(clubType: string) {
  return clubType === "driver" || WOOD_TYPES.has(clubType) || IRON_PATTERN.test(clubType) || clubType === "pw";
}

function smashTarget(clubType: string) {
  if (clubType === "driver") {
    return 1.45;
  }
  if (IRON_PATTERN.test(clubType)) {
    return 1.3;
  }
  return 1.25;
}

function groupBy<T>(items: T[], selector: (item: T) => string | null | undefined) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = selector(item);

    if (!key) {
      continue;
    }

    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  return groups;
}

function sortShots(shots: AchievementShot[]) {
  return [...shots].sort((left, right) => {
    const leftNumber = left.shotNumber ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.shotNumber ?? Number.MAX_SAFE_INTEGER;

    if (left.shotAt.getTime() !== right.shotAt.getTime()) {
      return left.shotAt.getTime() - right.shotAt.getTime();
    }

    return leftNumber - rightNumber;
  });
}

function between(value: number | null, min: number, max: number) {
  return value !== null && value >= min && value <= max;
}

function spread(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values) - Math.min(...values);
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function maxNumber(values: Array<number | null>) {
  const present = values.filter(isNumber);
  return present.length === 0 ? null : Math.max(...present);
}

function minBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce<T | null>((best, item) => {
    if (!best || selector(item) < selector(best)) {
      return item;
    }

    return best;
  }, null);
}

function maxBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce<T | null>((best, item) => {
    if (!best || selector(item) > selector(best)) {
      return item;
    }

    return best;
  }, null);
}

function sumNumbers(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function absNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : Math.abs(value);
}

function isNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundMetricValue(value: number) {
  return Math.round(value * 100) / 100;
}

export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((achievement) => achievement.id);
