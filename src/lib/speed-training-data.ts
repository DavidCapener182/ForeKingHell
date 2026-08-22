import "server-only";

import { and, asc, desc, eq, gte, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  clubs,
  sessions as practiceSessions,
  shots,
  speedTrainingGoals,
  speedTrainingSessions,
  speedTrainingSwings,
  stockYardages,
} from "@/db/schema";
import { formatClubModelName, formatClubType, isTrackedClubType } from "@/lib/club-format";
import {
  average,
  buildSpeedPrescription,
  calculateSpeedIndex,
  evaluateFiveShotTransferPlayability,
  summarizePhasedSpeedSession,
  selectTrainingPeakReadings,
  summarizeRepeatedSpeedPeak,
  summarizeSessionSwings,
  type FiveShotTransferPlayability,
  type PhasedSpeedSessionSummary,
  type RepeatedSpeedPeakSummary,
  type SpeedPrescription,
  type SpeedSessionSwingSummary,
  type SpeedTrainingPhase,
} from "@/lib/speed-training";
import {
  RapsodoCloudClient,
  RapsodoCloudError,
  type RapsodoSpeedSession,
} from "@/lib/rapsodo/cloud-client";
import { clearStoredRapsodoToken, getStoredRapsodoToken } from "@/lib/rapsodo/token-cookie";
import { getClubSpeedBenchmarkTarget, type ClubSpeedBenchmarkTarget } from "@/lib/club-benchmarks";
import { getCompanionTrainingLoad } from "@/lib/companion-training-load";
import { buildSpeedDevelopment, type SpeedDevelopmentSummary } from "@/lib/speed-development";
import type { ShotReviewStatus } from "@/lib/shot-review";
import {
  buildPersonalDriverCorridor,
  readSpeedTransferMetadata,
  type SpeedTransferCorridor,
  type SpeedTransferTestMetadata,
} from "@/lib/speed-transfer-test";

export type SpeedClubOption = {
  id: string;
  type: string;
  label: string;
};

export type SpeedCentreSession = {
  id: string;
  source: string;
  sessionDateIso: string;
  title: string | null;
  clubId: string | null;
  implementKind: string;
  implementLabel: string;
  speedSystem: string | null;
  handedness: string;
  swingCount: number;
  minSpeedMph: number | null;
  avgSpeedMph: number | null;
  maxSpeedMph: number | null;
  targetSpeedMph: number | null;
  notes: string | null;
  transferTest?: SpeedTransferTestMetadata | null;
};

export type SpeedShotSession = {
  id: string;
  sessionId: string;
  sessionDateIso: string;
  source: string;
  sessionType: string;
  fileName: string | null;
  clubId: string;
  clubType: string;
  clubLabel: string;
  shotCount: number;
  minSpeedMph: number | null;
  avgSpeedMph: number | null;
  maxSpeedMph: number | null;
  latestShotAtIso: string | null;
};

export type SpeedTrendPoint = {
  label: string;
  value: number;
};

export type SpeedCarryProjection = {
  currentCarryYd: number | null;
  targetCarryYd: number | null;
  carryGainYd: number | null;
  yardsPerMph: number;
  basis: string;
};

type DriverCarryBasis = {
  currentCarryYd: number;
  basis: string;
};

export type DriverEfficiencySummary = {
  clubSpeedMph: number | null;
  smashFactor: number | null;
  carryYd: number | null;
  verdict: string;
  focus: string;
};

export type ShotSpeedSummary = {
  recentDriverAvgMph: number | null;
  last20DriverAvgMph: number | null;
  thirtyDayDriverAvgMph: number | null;
  personalBestDriverMph: number | null;
  personalBestEvidence: SpeedPersonalBestEvidence;
  latestShotAtIso: string | null;
  sampleSize: number;
};

export type SpeedForecastSummary = {
  status: "ready" | "needs_more_sessions" | "flat";
  progressThisMonthMph: number | null;
  monthlyGainMph: number | null;
  forecastSpeedMph: number | null;
  forecastDateIso: string | null;
  targetEtaIso: string | null;
  confidenceLabel: string;
};

export type SpeedSideSummary = {
  dominantAvgMph: number | null;
  dominantMaxMph: number | null;
  nonDominantAvgMph: number | null;
  nonDominantMaxMph: number | null;
  sideBalancePercent: number | null;
  overspeedAvgMph: number | null;
  overspeedMaxMph: number | null;
  overspeedRatio: number | null;
};

export type FutureBagProjectionRow = {
  clubId: string;
  clubType: string;
  clubLabel: string;
  currentCarryYd: number;
  currentClubSpeedMph: number | null;
  clubSpeedDeltaFactor: number;
  confidenceScore: number | null;
  carryGainPerMph: number;
};

export type SpeedGoal = {
  id: string;
  goalKey: string;
  clubId: string | null;
  targetSpeedMph: number;
  targetDateIso: string | null;
  notes: string | null;
};

export type ClubSpeedRow = {
  clubId: string | null;
  clubType: string;
  clubLabel: string;
  benchmarkTarget: ClubSpeedBenchmarkTarget | null;
  trainingAvgMph: number | null;
  trainingPbMph: number | null;
  trainingPbEvidence: RepeatedSpeedPeakSummary;
  trainingLastSessionIso: string | null;
  trainingSessionCount: number;
  trainingSwingCount: number;
  shotLast20AvgMph: number | null;
  shotThirtyDayAvgMph: number | null;
  shotPbMph: number | null;
  shotPbEvidence: SpeedPersonalBestEvidence;
  latestShotSessionAvgMph: number | null;
  latestShotSessionGapToPbMph: number | null;
  shotSampleSize: number;
  latestShotAtIso: string | null;
  transferGapMph: number | null;
  transferRatioPercent: number | null;
  transferStatus: string;
};

export type SpeedUnverifiedPeakReason = "one_off" | "estimated_club_data" | "unknown_club_data";

export type SpeedPersonalBestEvidence = {
  trustedPbMph: number | null;
  trustedEvidenceCount: number;
  independentReadingCount: number;
  ignoredDuplicateCount: number;
  unverifiedPeak: {
    mph: number;
    reason: SpeedUnverifiedPeakReason;
    independentEvidenceCount: number;
    duplicateImportCount: number;
  } | null;
};

export type SpeedPbReading = {
  id: string;
  sessionId: string;
  shotAt: Date;
  clubSpeedMph: number | null;
  clubDataEstType: string | null;
  sourceRawJson: Record<string, string> | null;
};

export type SpeedCentreSummary = {
  currentSpeedMph: number | null;
  currentSpeedSource: "with_ball" | "training" | "none";
  trainingCurrentSpeedMph: number | null;
  trainingPbEvidence: RepeatedSpeedPeakSummary;
  personalBestMph: number | null;
  last20AvgMph: number | null;
  thirtyDayAvgMph: number | null;
  sevenDayAvgMph: number | null;
  targetSpeedMph: number | null;
  targetDateIso: string | null;
  speedIndex: ReturnType<typeof calculateSpeedIndex>;
  sessionsLast7Days: number;
  prescription: SpeedPrescription;
  carryProjection: SpeedCarryProjection;
  driverEfficiency: DriverEfficiencySummary;
  shotSpeed: ShotSpeedSummary;
  forecast: SpeedForecastSummary;
  sideSummary: SpeedSideSummary;
  transferInsight: SpeedTransferInsight;
};

export type SpeedTransferInsight = {
  gapMph: number | null;
  ratioPercent: number | null;
  status: string;
  coachMessage: string;
};

export type SpeedRollingSummary = {
  sevenDayAvgMph: number | null;
  thirtyDayAvgMph: number | null;
  speedGainPercent: number | null;
  monthlyPoints: SpeedMonthPoint[];
};

export type SpeedMonthPoint = {
  label: string;
  avgSpeedMph: number | null;
  pbSpeedMph: number | null;
  sessionCount: number;
  swingCount: number;
};

export type RapsodoSpeedInboxItem = RapsodoSpeedSession & {
  detailStatus: "available" | "empty" | "not_checked";
  detailSwingCount: number | null;
};

export type RapsodoSpeedInbox = {
  connected: boolean;
  error: string | null;
  items: RapsodoSpeedInboxItem[];
};

export type SpeedCentrePageData = {
  clubOptions: SpeedClubOption[];
  goals: SpeedGoal[];
  sessions: SpeedCentreSession[];
  shotSessions: SpeedShotSession[];
  clubSpeedRows: ClubSpeedRow[];
  trend: SpeedTrendPoint[];
  rolling: SpeedRollingSummary;
  futureBag: FutureBagProjectionRow[];
  summary: SpeedCentreSummary;
  development: SpeedDevelopmentSummary;
  rapsodo: RapsodoSpeedInbox;
};

export type SpeedSessionDetailPageData = {
  clubOptions: SpeedClubOption[];
  session: SpeedCentreSession;
  swings: Array<{
    id: string;
    swingNumber: number;
    clubSpeedMph: number;
    swingSide: string | null;
    phase: SpeedTrainingPhase | null;
  }>;
  swingSummary: SpeedSessionSwingSummary;
  peakSwingSummary: SpeedSessionSwingSummary;
  phasedSummary: PhasedSpeedSessionSummary;
  transferCandidates: Array<{
    sessionId: string;
    sessionDateIso: string;
    label: string;
    eligibleShotCount: number;
    shots: Array<{
      id: string;
      shotNumber: number | null;
      shotAtIso: string;
      clubSpeedMph: number | null;
      sideCarryYd: number | null;
    }>;
  }>;
  transferTest: null | {
    metadata: SpeedTransferTestMetadata;
    corridor: SpeedTransferCorridor;
    playability: FiveShotTransferPlayability;
    shots: Array<{
      id: string;
      shotNumber: number | null;
      shotAtIso: string;
      clubSpeedMph: number | null;
      ballSpeedMph: number | null;
      sideCarryYd: number | null;
    }>;
  };
  canLinkTransferTest: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_YARDS_PER_MPH = 2.4;
const FORECAST_HORIZON_DAYS = 90;
const MIN_FORECAST_SESSIONS = 3;

export async function getSpeedCentrePageData(userId: string): Promise<SpeedCentrePageData> {
  const db = getDb();
  const [
    clubRows,
    goalRows,
    sessionRows,
    recentSwingRows,
    recentDriverShots,
    allClubShotRows,
    stockRows,
    rapsodo,
    trainingLoad,
  ] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type), asc(clubs.brand), asc(clubs.model)),
    db
      .select({
        id: speedTrainingGoals.id,
        goalKey: speedTrainingGoals.goalKey,
        clubId: speedTrainingGoals.clubId,
        targetSpeedMph: speedTrainingGoals.targetSpeedMph,
        targetDate: speedTrainingGoals.targetDate,
        notes: speedTrainingGoals.notes,
      })
      .from(speedTrainingGoals)
      .where(eq(speedTrainingGoals.userId, userId))
      .orderBy(asc(speedTrainingGoals.goalKey)),
    db
      .select({
        id: speedTrainingSessions.id,
        source: speedTrainingSessions.source,
        sessionDate: speedTrainingSessions.sessionDate,
        title: speedTrainingSessions.title,
        clubId: speedTrainingSessions.clubId,
        implementKind: speedTrainingSessions.implementKind,
        implementLabel: speedTrainingSessions.implementLabel,
        speedSystem: speedTrainingSessions.speedSystem,
        handedness: speedTrainingSessions.handedness,
        swingCount: speedTrainingSessions.swingCount,
        minSpeedMph: speedTrainingSessions.minSpeedMph,
        avgSpeedMph: speedTrainingSessions.avgSpeedMph,
        maxSpeedMph: speedTrainingSessions.maxSpeedMph,
        targetSpeedMph: speedTrainingSessions.targetSpeedMph,
        notes: speedTrainingSessions.notes,
        rawMetadataJson: speedTrainingSessions.rawMetadataJson,
      })
      .from(speedTrainingSessions)
      .where(eq(speedTrainingSessions.userId, userId))
      .orderBy(desc(speedTrainingSessions.sessionDate))
      .limit(60),
    db
      .select({
        sessionId: speedTrainingSwings.speedSessionId,
        swingNumber: speedTrainingSwings.swingNumber,
        clubSpeedMph: speedTrainingSwings.clubSpeedMph,
        sourceRawJson: speedTrainingSwings.sourceRawJson,
      })
      .from(speedTrainingSwings)
      .innerJoin(
        speedTrainingSessions,
        eq(speedTrainingSwings.speedSessionId, speedTrainingSessions.id),
      )
      .where(eq(speedTrainingSwings.userId, userId))
      .orderBy(desc(speedTrainingSessions.sessionDate), desc(speedTrainingSwings.swingNumber))
      .limit(500),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        clubId: shots.clubId,
        shotAt: shots.shotAt,
        playContext: shots.playContext,
        reviewStatus: shots.reviewStatus,
        clubSpeedMph: shots.clubSpeedMph,
        ballSpeedMph: shots.ballSpeedMph,
        smashFactor: shots.smashFactor,
        carryYd: shots.carryYd,
        launchAngleDeg: shots.launchAngleDeg,
        sideCarryYd: shots.sideCarryYd,
        qualityTag: shots.qualityTag,
        clubDataEstType: shots.clubDataEstType,
        sourceRawJson: shots.sourceRawJson,
      })
      .from(shots)
      .where(
        and(eq(shots.userId, userId), eq(shots.clubType, "driver"), shotEvidenceSqlPredicate()),
      )
      .orderBy(desc(shots.shotAt))
      .limit(500),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        sessionDate: practiceSessions.date,
        sessionType: practiceSessions.type,
        sessionSource: practiceSessions.source,
        fileName: practiceSessions.fileName,
        clubId: shots.clubId,
        clubType: shots.clubType,
        brand: clubs.brand,
        model: clubs.model,
        shotAt: shots.shotAt,
        clubSpeedMph: shots.clubSpeedMph,
        clubDataEstType: shots.clubDataEstType,
        sourceRawJson: shots.sourceRawJson,
      })
      .from(shots)
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .innerJoin(practiceSessions, eq(shots.sessionId, practiceSessions.id))
      .where(
        and(
          eq(shots.userId, userId),
          eq(practiceSessions.userId, userId),
          eq(clubs.active, true),
          shotEvidenceSqlPredicate(),
          isNotNull(shots.clubSpeedMph),
        ),
      )
      .orderBy(desc(shots.shotAt))
      .limit(2_000),
    db
      .select({
        clubId: stockYardages.clubId,
        clubType: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
        sampleSize: stockYardages.sampleSize,
        carryMedianYd: stockYardages.carryMedianYd,
        recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
        confidenceScore: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
      .where(and(eq(stockYardages.userId, userId), eq(clubs.active, true)))
      .orderBy(desc(stockYardages.calculatedAt))
      .limit(120),
    getRapsodoSpeedInbox(),
    getCompanionTrainingLoad(userId).catch(() => null),
  ]);

  const trackedClubRows = clubRows.filter((club) => isTrackedClubType(club.type));
  const trackedClubIds = new Set(trackedClubRows.map((club) => club.id));
  const trackedAllClubShotRows = allClubShotRows.filter(
    (shot) => trackedClubIds.has(shot.clubId) && isTrackedClubType(shot.clubType),
  );
  const trackedStockRows = stockRows.filter(
    (row) => trackedClubIds.has(row.clubId) && isTrackedClubType(row.clubType),
  );

  const clubOptions = trackedClubRows.map((club) => ({
    id: club.id,
    type: club.type,
    label: `${formatClubType(club.type)} - ${formatClubModelName(club)}`,
  }));
  const clubLabelById = new Map(clubOptions.map((club) => [club.id, club.label]));
  const goals = goalRows.map((goal) => ({
    id: goal.id,
    goalKey: goal.goalKey,
    clubId: goal.clubId,
    targetSpeedMph: goal.targetSpeedMph,
    targetDateIso: goal.targetDate ? String(goal.targetDate).slice(0, 10) : null,
    notes: goal.notes,
  }));
  const sessions = sessionRows.map((session) => ({
    id: session.id,
    source: session.source,
    sessionDateIso: session.sessionDate.toISOString(),
    title: session.title,
    clubId: session.clubId,
    implementKind: session.implementKind,
    implementLabel: session.clubId
      ? (clubLabelById.get(session.clubId) ?? session.implementLabel ?? "Club")
      : (session.implementLabel ?? labelForImplementKind(session.implementKind)),
    speedSystem: session.speedSystem,
    handedness: session.handedness,
    swingCount: session.swingCount,
    minSpeedMph: session.minSpeedMph,
    avgSpeedMph: session.avgSpeedMph,
    maxSpeedMph: session.maxSpeedMph,
    targetSpeedMph: session.targetSpeedMph,
    notes: session.notes,
    transferTest: readSpeedTransferMetadata(session.rawMetadataJson),
  }));

  const driverClubIds = new Set(
    trackedClubRows.filter((club) => club.type === "driver").map((club) => club.id),
  );
  const driverClubId =
    sessions.find((session) => session.clubId && driverClubIds.has(session.clubId))?.clubId ??
    trackedClubRows.find((club) => club.type === "driver")?.id ??
    null;
  const driverSessions = sessions.filter((session) =>
    isComparableDriverSpeedSession(session, driverClubId),
  );
  const driverSessionIds = new Set(driverSessions.map((session) => session.id));
  const driverSwings = recentSwingRows.filter((swing) => driverSessionIds.has(swing.sessionId));
  const scopedDriverShots = recentDriverShots.filter(
    (shot) => driverClubId === null || shot.clubId === driverClubId,
  );
  const driverCarryBasis = buildDriverCarryBasis(trackedStockRows);
  const summary = buildSpeedCentreSummary(driverSessions, driverSwings, scopedDriverShots, goals, {
    driverClubId,
    driverCarryBasis,
  });
  const development = buildDriverSpeedDevelopmentSummary({
    sessions,
    swings: recentSwingRows,
    driverShots: scopedDriverShots,
    driverClubId,
    targetSpeedMph: summary.targetSpeedMph,
    currentCarryYd: summary.carryProjection.currentCarryYd,
    currentCarrySource: summary.carryProjection.basis,
    trainingLoad,
  });

  return {
    clubOptions,
    goals,
    sessions,
    shotSessions: buildShotSpeedSessions(trackedAllClubShotRows),
    clubSpeedRows: buildClubSpeedRows(
      trackedClubRows,
      sessions,
      trackedAllClubShotRows,
      recentSwingRows,
    ),
    trend: buildTrendPoints(sessions),
    rolling: buildRollingSummary(sessions),
    futureBag: buildFutureBagRows(trackedStockRows, trackedAllClubShotRows),
    summary,
    development,
    rapsodo,
  };
}

export async function getSpeedCoachCardData(userId: string) {
  const db = getDb();
  const [
    clubRows,
    goalRows,
    sessionRows,
    recentSwingRows,
    recentDriverShots,
    stockRows,
    trainingLoad,
  ] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        id: speedTrainingGoals.id,
        goalKey: speedTrainingGoals.goalKey,
        clubId: speedTrainingGoals.clubId,
        targetSpeedMph: speedTrainingGoals.targetSpeedMph,
        targetDate: speedTrainingGoals.targetDate,
        notes: speedTrainingGoals.notes,
      })
      .from(speedTrainingGoals)
      .where(eq(speedTrainingGoals.userId, userId))
      .orderBy(asc(speedTrainingGoals.goalKey)),
    db
      .select({
        id: speedTrainingSessions.id,
        source: speedTrainingSessions.source,
        sessionDate: speedTrainingSessions.sessionDate,
        title: speedTrainingSessions.title,
        clubId: speedTrainingSessions.clubId,
        implementKind: speedTrainingSessions.implementKind,
        implementLabel: speedTrainingSessions.implementLabel,
        speedSystem: speedTrainingSessions.speedSystem,
        handedness: speedTrainingSessions.handedness,
        swingCount: speedTrainingSessions.swingCount,
        minSpeedMph: speedTrainingSessions.minSpeedMph,
        avgSpeedMph: speedTrainingSessions.avgSpeedMph,
        maxSpeedMph: speedTrainingSessions.maxSpeedMph,
        targetSpeedMph: speedTrainingSessions.targetSpeedMph,
        notes: speedTrainingSessions.notes,
        rawMetadataJson: speedTrainingSessions.rawMetadataJson,
      })
      .from(speedTrainingSessions)
      .where(eq(speedTrainingSessions.userId, userId))
      .orderBy(desc(speedTrainingSessions.sessionDate))
      .limit(60),
    db
      .select({
        sessionId: speedTrainingSwings.speedSessionId,
        swingNumber: speedTrainingSwings.swingNumber,
        clubSpeedMph: speedTrainingSwings.clubSpeedMph,
        sourceRawJson: speedTrainingSwings.sourceRawJson,
      })
      .from(speedTrainingSwings)
      .innerJoin(
        speedTrainingSessions,
        eq(speedTrainingSwings.speedSessionId, speedTrainingSessions.id),
      )
      .where(eq(speedTrainingSwings.userId, userId))
      .orderBy(desc(speedTrainingSessions.sessionDate), desc(speedTrainingSwings.swingNumber))
      .limit(300),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        clubId: shots.clubId,
        shotAt: shots.shotAt,
        playContext: shots.playContext,
        reviewStatus: shots.reviewStatus,
        clubSpeedMph: shots.clubSpeedMph,
        ballSpeedMph: shots.ballSpeedMph,
        smashFactor: shots.smashFactor,
        carryYd: shots.carryYd,
        launchAngleDeg: shots.launchAngleDeg,
        sideCarryYd: shots.sideCarryYd,
        qualityTag: shots.qualityTag,
        clubDataEstType: shots.clubDataEstType,
        sourceRawJson: shots.sourceRawJson,
      })
      .from(shots)
      .where(
        and(eq(shots.userId, userId), eq(shots.clubType, "driver"), shotEvidenceSqlPredicate()),
      )
      .orderBy(desc(shots.shotAt))
      .limit(300),
    db
      .select({
        clubType: clubs.type,
        sampleSize: stockYardages.sampleSize,
        carryMedianYd: stockYardages.carryMedianYd,
        recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
        confidenceScore: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
      .where(and(eq(stockYardages.userId, userId), eq(clubs.active, true)))
      .orderBy(desc(stockYardages.calculatedAt))
      .limit(120),
    getCompanionTrainingLoad(userId).catch(() => null),
  ]);
  const sessions = sessionRows.map((session) => ({
    id: session.id,
    source: session.source,
    sessionDateIso: session.sessionDate.toISOString(),
    title: session.title,
    clubId: session.clubId,
    implementKind: session.implementKind,
    implementLabel: session.implementLabel ?? labelForImplementKind(session.implementKind),
    speedSystem: session.speedSystem,
    handedness: session.handedness,
    swingCount: session.swingCount,
    minSpeedMph: session.minSpeedMph,
    avgSpeedMph: session.avgSpeedMph,
    maxSpeedMph: session.maxSpeedMph,
    targetSpeedMph: session.targetSpeedMph,
    notes: session.notes,
    transferTest: readSpeedTransferMetadata(session.rawMetadataJson),
  }));

  const goals = goalRows.map((goal) => ({
    id: goal.id,
    goalKey: goal.goalKey,
    clubId: goal.clubId,
    targetSpeedMph: goal.targetSpeedMph,
    targetDateIso: goal.targetDate ? String(goal.targetDate).slice(0, 10) : null,
    notes: goal.notes,
  }));
  const driverClubIds = new Set(
    clubRows
      .filter((club) => isTrackedClubType(club.type) && club.type === "driver")
      .map((club) => club.id),
  );
  const driverClubId =
    sessions.find((session) => session.clubId && driverClubIds.has(session.clubId))?.clubId ??
    clubRows.find((club) => isTrackedClubType(club.type) && club.type === "driver")?.id ??
    null;
  const driverSessions = sessions.filter((session) =>
    isComparableDriverSpeedSession(session, driverClubId),
  );
  const driverSessionIds = new Set(driverSessions.map((session) => session.id));
  const driverSwings = recentSwingRows.filter((swing) => driverSessionIds.has(swing.sessionId));
  const scopedDriverShots = recentDriverShots.filter(
    (shot) => driverClubId === null || shot.clubId === driverClubId,
  );
  const summary = buildSpeedCentreSummary(driverSessions, driverSwings, scopedDriverShots, goals, {
    driverClubId,
    driverCarryBasis: buildDriverCarryBasis(
      stockRows.filter((row) => isTrackedClubType(row.clubType)),
    ),
  });

  return {
    summary,
    development: buildDriverSpeedDevelopmentSummary({
      sessions: driverSessions,
      swings: driverSwings,
      driverShots: scopedDriverShots,
      driverClubId,
      targetSpeedMph: summary.targetSpeedMph,
      currentCarryYd: summary.carryProjection.currentCarryYd,
      currentCarrySource: summary.carryProjection.basis,
      trainingLoad,
    }),
  };
}

export async function getLatestSpeedCoachContext(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: speedTrainingSessions.id,
      sessionDate: speedTrainingSessions.sessionDate,
      implementKind: speedTrainingSessions.implementKind,
      implementLabel: speedTrainingSessions.implementLabel,
      swingCount: speedTrainingSessions.swingCount,
      avgSpeedMph: speedTrainingSessions.avgSpeedMph,
      maxSpeedMph: speedTrainingSessions.maxSpeedMph,
      targetSpeedMph: speedTrainingSessions.targetSpeedMph,
    })
    .from(speedTrainingSessions)
    .where(
      and(
        eq(speedTrainingSessions.userId, userId),
        gte(speedTrainingSessions.sessionDate, new Date(Date.now() - 90 * DAY_MS)),
      ),
    )
    .orderBy(desc(speedTrainingSessions.sessionDate))
    .limit(8);

  return rows.map((row) => ({
    id: row.id,
    sessionDateIso: row.sessionDate.toISOString(),
    implementLabel: row.implementLabel ?? labelForImplementKind(row.implementKind),
    swingCount: row.swingCount,
    avgSpeedMph: row.avgSpeedMph,
    maxSpeedMph: row.maxSpeedMph,
    targetSpeedMph: row.targetSpeedMph,
  }));
}

export async function getSpeedSessionDetailPageData(
  userId: string,
  sessionId: string,
): Promise<SpeedSessionDetailPageData | null> {
  const db = getDb();
  const [clubRows, sessionRows, swingRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type), asc(clubs.brand), asc(clubs.model)),
    db
      .select({
        id: speedTrainingSessions.id,
        source: speedTrainingSessions.source,
        sessionDate: speedTrainingSessions.sessionDate,
        title: speedTrainingSessions.title,
        clubId: speedTrainingSessions.clubId,
        implementKind: speedTrainingSessions.implementKind,
        implementLabel: speedTrainingSessions.implementLabel,
        speedSystem: speedTrainingSessions.speedSystem,
        handedness: speedTrainingSessions.handedness,
        swingCount: speedTrainingSessions.swingCount,
        minSpeedMph: speedTrainingSessions.minSpeedMph,
        avgSpeedMph: speedTrainingSessions.avgSpeedMph,
        maxSpeedMph: speedTrainingSessions.maxSpeedMph,
        targetSpeedMph: speedTrainingSessions.targetSpeedMph,
        notes: speedTrainingSessions.notes,
        rawMetadataJson: speedTrainingSessions.rawMetadataJson,
      })
      .from(speedTrainingSessions)
      .where(and(eq(speedTrainingSessions.userId, userId), eq(speedTrainingSessions.id, sessionId)))
      .limit(1),
    db
      .select({
        id: speedTrainingSwings.id,
        swingNumber: speedTrainingSwings.swingNumber,
        clubSpeedMph: speedTrainingSwings.clubSpeedMph,
        swingSide: speedTrainingSwings.swingSide,
        sourceRawJson: speedTrainingSwings.sourceRawJson,
      })
      .from(speedTrainingSwings)
      .where(
        and(
          eq(speedTrainingSwings.userId, userId),
          eq(speedTrainingSwings.speedSessionId, sessionId),
        ),
      )
      .orderBy(asc(speedTrainingSwings.swingNumber)),
  ]);
  const session = sessionRows[0] ?? null;

  if (!session) {
    return null;
  }

  const trackedClubRows = clubRows.filter((club) => isTrackedClubType(club.type));
  const clubOptions = trackedClubRows.map((club) => ({
    id: club.id,
    type: club.type,
    label: `${formatClubType(club.type)} - ${formatClubModelName(club)}`,
  }));
  const clubLabelById = new Map(clubOptions.map((club) => [club.id, club.label]));
  const sessionClub = trackedClubRows.find((club) => club.id === session.clubId) ?? null;
  const canLinkTransferTest = sessionClub?.type === "driver";
  const transferMetadata = readSpeedTransferMetadata(session.rawMetadataJson);
  const mappedSwings: SpeedSessionDetailPageData["swings"] = swingRows.map((swing) => ({
    id: swing.id,
    swingNumber: swing.swingNumber,
    clubSpeedMph: swing.clubSpeedMph,
    swingSide: swing.swingSide,
    phase: storedSpeedTrainingPhase(swing.sourceRawJson),
  }));
  let transferCandidates: SpeedSessionDetailPageData["transferCandidates"] = [];
  let transferTest: SpeedSessionDetailPageData["transferTest"] = null;

  if (canLinkTransferTest && session.clubId) {
    const candidateStart = new Date(session.sessionDate.getTime() - DAY_MS);
    const candidateEnd = new Date(session.sessionDate.getTime() + 7 * DAY_MS);
    const [candidateRows, linkedRows] = await Promise.all([
      db
        .select({
          sessionId: practiceSessions.id,
          sessionDate: practiceSessions.date,
          source: practiceSessions.source,
          fileName: practiceSessions.fileName,
          shotId: shots.id,
          shotNumber: shots.shotNumber,
          shotAt: shots.shotAt,
          clubSpeedMph: shots.clubSpeedMph,
          sideCarryYd: shots.sideCarryYd,
        })
        .from(shots)
        .innerJoin(practiceSessions, eq(shots.sessionId, practiceSessions.id))
        .where(
          and(
            eq(shots.userId, userId),
            eq(practiceSessions.userId, userId),
            eq(shots.clubId, session.clubId),
            gte(practiceSessions.date, candidateStart),
            lte(practiceSessions.date, candidateEnd),
            isNotNull(shots.sideCarryYd),
            shotEvidenceSqlPredicate(),
          ),
        )
        .orderBy(desc(practiceSessions.date), desc(shots.shotAt))
        .limit(300),
      transferMetadata
        ? db
            .select({
              id: shots.id,
              shotNumber: shots.shotNumber,
              shotAt: shots.shotAt,
              clubSpeedMph: shots.clubSpeedMph,
              ballSpeedMph: shots.ballSpeedMph,
              sideCarryYd: shots.sideCarryYd,
            })
            .from(shots)
            .where(
              and(
                eq(shots.userId, userId),
                eq(shots.clubId, session.clubId),
                eq(shots.sessionId, transferMetadata.shotSessionId),
                inArray(shots.id, transferMetadata.shotIds),
                shotEvidenceSqlPredicate(),
              ),
            )
        : Promise.resolve([]),
    ]);

    transferCandidates = [...groupByKey(candidateRows, (row) => row.sessionId).values()]
      .map((rows) => {
        const first = rows[0]!;
        const orderedShots = [...rows].sort((left, right) => {
          if (left.shotNumber !== null && right.shotNumber !== null) {
            return left.shotNumber - right.shotNumber;
          }
          return left.shotAt.getTime() - right.shotAt.getTime();
        });

        return {
          sessionId: first.sessionId,
          sessionDateIso: first.sessionDate.toISOString(),
          label: first.fileName ?? first.source ?? "Driver session",
          eligibleShotCount: orderedShots.length,
          shots: orderedShots.map((row) => ({
            id: row.shotId,
            shotNumber: row.shotNumber,
            shotAtIso: row.shotAt.toISOString(),
            clubSpeedMph: row.clubSpeedMph,
            sideCarryYd: row.sideCarryYd,
          })),
        };
      })
      .filter((candidate) => candidate.eligibleShotCount >= 5)
      .sort(
        (left, right) =>
          new Date(right.sessionDateIso).getTime() - new Date(left.sessionDateIso).getTime(),
      )
      .slice(0, 8);

    if (transferMetadata) {
      const linkedById = new Map(linkedRows.map((row) => [row.id, row]));
      const orderedLinkedRows = transferMetadata.shotIds.flatMap((shotId) => {
        const row = linkedById.get(shotId);
        return row ? [row] : [];
      });
      const earliestLinkedShotAt = orderedLinkedRows.reduce<Date | null>(
        (earliest, shot) => (earliest === null || shot.shotAt < earliest ? shot.shotAt : earliest),
        null,
      );
      const legacyCorridorRows =
        transferMetadata.corridor === undefined
          ? await db
              .select({ sideCarryYd: shots.sideCarryYd })
              .from(shots)
              .where(
                and(
                  eq(shots.userId, userId),
                  eq(shots.clubId, session.clubId),
                  lt(shots.shotAt, earliestLinkedShotAt ?? new Date(transferMetadata.linkedAtIso)),
                  isNotNull(shots.sideCarryYd),
                  shotEvidenceSqlPredicate(),
                ),
              )
              .orderBy(desc(shots.shotAt))
              .limit(80)
          : [];
      const corridor =
        transferMetadata.corridor ??
        buildPersonalDriverCorridor(legacyCorridorRows.map((row) => row.sideCarryYd));
      const playability = evaluateFiveShotTransferPlayability({
        speedSessionId: session.id,
        transferSessionId: transferMetadata.shotSessionId,
        personalCorridor: corridor,
        shots: orderedLinkedRows.map((shot) => ({
          shotId: shot.id,
          phase: "transfer",
          sideCarryYd: shot.sideCarryYd,
          clubSpeedMph: shot.clubSpeedMph,
        })),
      });

      transferTest = {
        metadata: transferMetadata,
        corridor,
        playability,
        shots: orderedLinkedRows.map((shot) => ({
          id: shot.id,
          shotNumber: shot.shotNumber,
          shotAtIso: shot.shotAt.toISOString(),
          clubSpeedMph: shot.clubSpeedMph,
          ballSpeedMph: shot.ballSpeedMph,
          sideCarryYd: shot.sideCarryYd,
        })),
      };
    }
  }

  return {
    clubOptions,
    session: {
      id: session.id,
      source: session.source,
      sessionDateIso: session.sessionDate.toISOString(),
      title: session.title,
      clubId: session.clubId,
      implementKind: session.implementKind,
      implementLabel: session.clubId
        ? (clubLabelById.get(session.clubId) ?? session.implementLabel ?? "Club")
        : (session.implementLabel ?? labelForImplementKind(session.implementKind)),
      speedSystem: session.speedSystem,
      handedness: session.handedness,
      swingCount: session.swingCount,
      minSpeedMph: session.minSpeedMph,
      avgSpeedMph: session.avgSpeedMph,
      maxSpeedMph: session.maxSpeedMph,
      targetSpeedMph: session.targetSpeedMph,
      notes: session.notes,
      transferTest: transferMetadata,
    },
    swings: mappedSwings,
    swingSummary: summarizeSessionSwings(mappedSwings.map((swing) => swing.clubSpeedMph)),
    peakSwingSummary: summarizeSessionSwings(
      mappedSwings
        .filter((swing) => swing.phase === null || swing.phase === "max_speed")
        .map((swing) => swing.clubSpeedMph),
    ),
    phasedSummary: summarizePhasedSpeedSession(
      mappedSwings.map((swing) => ({
        clubSpeedMph: swing.clubSpeedMph,
        phase: swing.phase ?? "max_speed",
      })),
    ),
    transferCandidates,
    transferTest,
    canLinkTransferTest,
  };
}

async function getRapsodoSpeedInbox(): Promise<RapsodoSpeedInbox> {
  const stored = await getStoredRapsodoToken();

  if (!stored) {
    return {
      connected: false,
      error: null,
      items: [],
    };
  }

  try {
    const client = new RapsodoCloudClient();
    const sessions = await client.listSpeedSessions(stored.token, { take: 8 });
    const detailResults = await Promise.allSettled(
      sessions
        .slice(0, 3)
        .map((session) => client.listSpeedSessionSwings(stored.token, session.providerSessionId)),
    );

    return {
      connected: true,
      error: null,
      items: sessions.map((session, index) => {
        const detailResult = detailResults[index];
        const detailSwingCount =
          detailResult?.status === "fulfilled" ? detailResult.value.length : null;

        return {
          ...session,
          detailStatus:
            detailResult?.status === "fulfilled"
              ? detailResult.value.length > 0
                ? "available"
                : "empty"
              : detailResult
                ? "not_checked"
                : "not_checked",
          detailSwingCount,
        };
      }),
    };
  } catch (error) {
    if (error instanceof RapsodoCloudError && (error.status === 401 || error.status === 403)) {
      await clearStoredRapsodoToken();
    }

    return {
      connected: true,
      error:
        error instanceof Error
          ? error.message
          : "R-Cloud speed sessions could not be loaded right now.",
      items: [],
    };
  }
}

function buildDriverSpeedDevelopmentSummary(input: {
  sessions: SpeedCentreSession[];
  swings: Array<{
    sessionId: string;
    swingNumber: number;
    clubSpeedMph: number;
    sourceRawJson: Record<string, unknown>;
  }>;
  driverShots: Array<{
    id: string;
    sessionId: string;
    shotAt: Date;
    playContext: string;
    reviewStatus: ShotReviewStatus;
    clubSpeedMph: number | null;
    ballSpeedMph: number | null;
    smashFactor: number | null;
    carryYd: number | null;
    launchAngleDeg: number | null;
    sideCarryYd: number | null;
    qualityTag: string | null;
    clubDataEstType: string | null;
    sourceRawJson: Record<string, string>;
  }>;
  driverClubId: string | null;
  targetSpeedMph: number | null;
  currentCarryYd: number | null;
  currentCarrySource: string;
  trainingLoad: Awaited<ReturnType<typeof getCompanionTrainingLoad>> | null;
}) {
  const trustedDriverShots = selectIndependentMeasuredSpeedReadings(input.driverShots).sort(
    (left, right) => right.shotAt.getTime() - left.shotAt.getTime(),
  );

  return buildSpeedDevelopment({
    sessions: input.sessions.map((session) => ({
      id: session.id,
      sessionDateIso: session.sessionDateIso,
      avgSpeedMph: session.avgSpeedMph,
      maxSpeedMph: session.maxSpeedMph,
      swingCount: session.swingCount,
      transferShotIds: session.transferTest?.shotIds ?? [],
      transferCorridor: session.transferTest?.corridor,
      comparableToDriver:
        session.handedness === "dominant" &&
        session.implementKind === "club" &&
        (input.driverClubId
          ? session.clubId === input.driverClubId ||
            (session.clubId === null &&
              /driver/i.test(`${session.title ?? ""} ${session.implementLabel}`))
          : /driver/i.test(`${session.title ?? ""} ${session.implementLabel}`)),
    })),
    swings: input.swings,
    driverShots: trustedDriverShots.map((shot) => ({
      id: shot.id,
      sessionId: shot.sessionId,
      shotAtIso: shot.shotAt.toISOString(),
      playContext: shot.playContext,
      reviewStatus: shot.reviewStatus,
      clubSpeedMph: shot.clubSpeedMph,
      ballSpeedMph: shot.ballSpeedMph,
      smashFactor: shot.smashFactor,
      carryYd: shot.carryYd,
      launchAngleDeg: shot.launchAngleDeg,
      sideCarryYd: shot.sideCarryYd,
      qualityTag: shot.qualityTag,
      clubDataEstType: shot.clubDataEstType,
    })),
    transferDriverShots: input.driverShots.map((shot) => ({
      id: shot.id,
      sessionId: shot.sessionId,
      shotAtIso: shot.shotAt.toISOString(),
      playContext: shot.playContext,
      reviewStatus: shot.reviewStatus,
      clubSpeedMph: shot.clubSpeedMph,
      ballSpeedMph: shot.ballSpeedMph,
      smashFactor: shot.smashFactor,
      carryYd: shot.carryYd,
      launchAngleDeg: shot.launchAngleDeg,
      sideCarryYd: shot.sideCarryYd,
      qualityTag: shot.qualityTag,
      clubDataEstType: shot.clubDataEstType,
    })),
    targetSpeedMph: input.targetSpeedMph,
    currentCarryYd: input.currentCarryYd,
    currentCarrySource: input.currentCarrySource,
    trainingLoad: input.trainingLoad
      ? {
          fitness: input.trainingLoad.latest?.fitness ?? null,
          fatigue: input.trainingLoad.latest?.fatigue ?? null,
          form: input.trainingLoad.latest?.form ?? null,
          statusKey: input.trainingLoad.status.key,
          trendKey: input.trainingLoad.trend.key,
        }
      : null,
  });
}

function buildSpeedCentreSummary(
  sessions: SpeedCentreSession[],
  recentSwings: Array<{
    sessionId: string;
    clubSpeedMph: number;
    sourceRawJson: Record<string, unknown>;
  }>,
  driverShots: Array<{
    id: string;
    sessionId: string;
    shotAt: Date;
    clubSpeedMph: number | null;
    smashFactor: number | null;
    carryYd: number | null;
    clubDataEstType: string | null;
    sourceRawJson?: Record<string, string>;
  }>,
  goals: SpeedGoal[],
  options: {
    driverClubId: string | null;
    driverCarryBasis: DriverCarryBasis | null;
  },
): SpeedCentreSummary {
  const latestSession = sessions[0] ?? null;
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * DAY_MS;
  const sevenDaysAgo = now - 7 * DAY_MS;
  const thirtyDaySessions = sessions.filter(
    (session) => new Date(session.sessionDateIso).getTime() >= thirtyDaysAgo,
  );
  const sevenDaySessions = sessions.filter(
    (session) => new Date(session.sessionDateIso).getTime() >= sevenDaysAgo,
  );
  const thirtyDayAvgMph = average(
    thirtyDaySessions
      .map((session) => session.avgSpeedMph)
      .filter((value): value is number => value !== null),
  );
  const sevenDayAvgMph = average(
    sevenDaySessions
      .map((session) => session.avgSpeedMph)
      .filter((value): value is number => value !== null),
  );
  const sessionsLast7Days = sessions.filter(
    (session) => new Date(session.sessionDateIso).getTime() >= sevenDaysAgo,
  ).length;
  const trustedDriverShots = selectIndependentMeasuredSpeedReadings(
    driverShots.map((shot) => ({
      ...shot,
      sourceRawJson: shot.sourceRawJson ?? null,
    })),
  ).sort((left, right) => right.shotAt.getTime() - left.shotAt.getTime());
  const driverEfficiency = buildDriverEfficiency(trustedDriverShots);
  const shotSpeed = buildShotSpeedSummary(driverShots, thirtyDaysAgo);
  const trainingCurrentSpeedMph = latestSession?.avgSpeedMph ?? null;
  const withBallCurrentSpeedMph = shotSpeed.last20DriverAvgMph ?? shotSpeed.recentDriverAvgMph;
  const currentSpeedMph = withBallCurrentSpeedMph ?? trainingCurrentSpeedMph;
  const currentSpeedSource =
    withBallCurrentSpeedMph !== null
      ? "with_ball"
      : trainingCurrentSpeedMph !== null
        ? "training"
        : "none";
  const targetGoal = resolveDriverSpeedGoal(goals, options.driverClubId);
  const benchmarkTarget = getClubSpeedBenchmarkTarget("driver", currentSpeedMph);
  const sessionTargetSpeedMph =
    latestSession?.targetSpeedMph ??
    sessions.find((session) => session.targetSpeedMph !== null)?.targetSpeedMph ??
    null;
  const targetSpeedMph =
    targetGoal?.targetSpeedMph ?? benchmarkTarget?.targetSpeedMph ?? sessionTargetSpeedMph;
  const trainingPbEvidence = summarizeRepeatedSpeedPeak(
    trainingPeakReadings(sessions, recentSwings),
  );

  return {
    currentSpeedMph,
    currentSpeedSource,
    trainingCurrentSpeedMph,
    trainingPbEvidence,
    personalBestMph: maxOrNull(
      [trainingPbEvidence.trustedPeakMph, shotSpeed.personalBestDriverMph].filter(
        (value): value is number => value !== null,
      ),
    ),
    last20AvgMph: average(
      recentSwings
        .filter(isTrainingPeakSwing)
        .slice(0, 20)
        .map((swing) => swing.clubSpeedMph),
    ),
    thirtyDayAvgMph,
    sevenDayAvgMph,
    targetSpeedMph,
    targetDateIso: targetGoal?.targetDateIso ?? null,
    speedIndex: calculateSpeedIndex(currentSpeedMph, targetSpeedMph),
    sessionsLast7Days,
    prescription: buildSpeedPrescription({
      currentSpeedMph,
      targetSpeedMph,
      thirtyDayAvgMph,
      sessionsLast7Days,
    }),
    carryProjection: buildCarryProjection({
      currentSpeedMph,
      targetSpeedMph,
      driverSpeedMph: driverEfficiency.clubSpeedMph,
      driverCarryYd: driverEfficiency.carryYd,
      driverCarryBasis: options.driverCarryBasis,
    }),
    driverEfficiency,
    shotSpeed,
    forecast: buildSpeedForecast(sessions, currentSpeedMph, targetSpeedMph, now),
    sideSummary: buildSpeedSideSummary(sessions, shotSpeed),
    transferInsight: buildTransferInsight(trainingCurrentSpeedMph, shotSpeed.last20DriverAvgMph),
  };
}

function buildTrendPoints(sessions: SpeedCentreSession[]): SpeedTrendPoint[] {
  const points = [...sessions]
    .filter((session): session is SpeedCentreSession & { avgSpeedMph: number } => {
      return session.avgSpeedMph !== null;
    })
    .slice(0, 12)
    .reverse();

  return points.map((session) => ({
    label: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
      new Date(session.sessionDateIso),
    ),
    value: session.avgSpeedMph,
  }));
}

function buildRollingSummary(sessions: SpeedCentreSession[]): SpeedRollingSummary {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;
  const thirtyDaysAgo = now - 30 * DAY_MS;
  const avgSessions = sessions.filter(
    (session): session is SpeedCentreSession & { avgSpeedMph: number } =>
      session.avgSpeedMph !== null,
  );
  const sorted = [...avgSessions].sort(
    (left, right) =>
      new Date(left.sessionDateIso).getTime() - new Date(right.sessionDateIso).getTime(),
  );
  const first = sorted[0] ?? null;
  const last = sorted.at(-1) ?? null;
  const monthlyMap = new Map<string, SpeedCentreSession[]>();

  for (const session of sessions) {
    const date = new Date(session.sessionDateIso);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, [...(monthlyMap.get(key) ?? []), session]);
  }

  return {
    sevenDayAvgMph: average(
      avgSessions
        .filter((session) => new Date(session.sessionDateIso).getTime() >= sevenDaysAgo)
        .map((session) => session.avgSpeedMph),
    ),
    thirtyDayAvgMph: average(
      avgSessions
        .filter((session) => new Date(session.sessionDateIso).getTime() >= thirtyDaysAgo)
        .map((session) => session.avgSpeedMph),
    ),
    speedGainPercent:
      first && last && first.avgSpeedMph > 0
        ? roundOneDecimal(((last.avgSpeedMph - first.avgSpeedMph) / first.avgSpeedMph) * 100)
        : null,
    monthlyPoints: [...monthlyMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([key, monthSessions]) => {
        const [year, month] = key.split("-");
        const avgSpeeds = monthSessions
          .map((session) => session.avgSpeedMph)
          .filter((value): value is number => value !== null);
        const maxSpeeds = monthSessions
          .map((session) => session.maxSpeedMph)
          .filter((value): value is number => value !== null);

        return {
          label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
            new Date(Number(year), Number(month) - 1, 1),
          ),
          avgSpeedMph: average(avgSpeeds),
          pbSpeedMph: maxOrNull(maxSpeeds),
          sessionCount: monthSessions.length,
          swingCount: monthSessions.reduce((total, session) => total + session.swingCount, 0),
        };
      }),
  };
}

function buildTransferInsight(
  trainingSpeedMph: number | null,
  shotSpeedMph: number | null,
): SpeedTransferInsight {
  if (trainingSpeedMph === null || shotSpeedMph === null) {
    return {
      gapMph: null,
      ratioPercent: null,
      status: "Need both",
      coachMessage:
        "Log both a no-ball speed session and driver shots to separate training speed from playing speed.",
    };
  }

  const gapMph = roundOneDecimal(trainingSpeedMph - shotSpeedMph);
  const ratioPercent = roundOneDecimal((shotSpeedMph / trainingSpeedMph) * 100);
  const status = transferStatus(gapMph);

  return {
    gapMph,
    ratioPercent,
    status,
    coachMessage: transferCoachMessage(gapMph),
  };
}

function buildDriverCarryBasis(
  rows: Array<{
    clubType: string;
    sampleSize: number;
    carryMedianYd: number | null;
    recommendedPlayNumberYd: number | null;
    confidenceScore: number | null;
    calculatedAt: Date;
  }>,
): DriverCarryBasis | null {
  const row = rows.find(
    (stockRow) =>
      stockRow.clubType === "driver" &&
      (stockRow.carryMedianYd ?? stockRow.recommendedPlayNumberYd) !== null,
  );

  if (!row) {
    return null;
  }

  return {
    currentCarryYd: row.carryMedianYd ?? row.recommendedPlayNumberYd ?? 0,
    basis: row.carryMedianYd !== null ? "Driver stock carry" : "Driver recommended play number",
  };
}

function resolveDriverSpeedGoal(goals: SpeedGoal[], driverClubId: string | null) {
  return (
    goals.find((goal) => goal.goalKey === "driver_global") ??
    (driverClubId ? goals.find((goal) => goal.goalKey === clubGoalKey(driverClubId)) : null) ??
    null
  );
}

function buildCarryProjection(input: {
  currentSpeedMph: number | null;
  targetSpeedMph: number | null;
  driverSpeedMph: number | null;
  driverCarryYd: number | null;
  driverCarryBasis: DriverCarryBasis | null;
}): SpeedCarryProjection {
  const carryBasisYd = input.driverCarryBasis?.currentCarryYd ?? input.driverCarryYd;
  const actualYardsPerMph =
    input.currentSpeedMph && carryBasisYd ? carryBasisYd / input.currentSpeedMph : null;
  const yardsPerMph =
    actualYardsPerMph && actualYardsPerMph > 1.5 ? actualYardsPerMph : DEFAULT_YARDS_PER_MPH;

  if (!input.currentSpeedMph || !input.targetSpeedMph || !carryBasisYd) {
    return {
      currentCarryYd: carryBasisYd ? Math.round(carryBasisYd) : null,
      targetCarryYd: null,
      carryGainYd: null,
      yardsPerMph,
      basis:
        input.driverCarryBasis?.basis ??
        (actualYardsPerMph ? "Recent driver shots" : "Rule-of-thumb estimate"),
    };
  }

  const currentCarryYd = Math.round(carryBasisYd);
  const targetCarryYd = Math.round(input.targetSpeedMph * yardsPerMph);

  return {
    currentCarryYd,
    targetCarryYd,
    carryGainYd: targetCarryYd - currentCarryYd,
    yardsPerMph,
    basis:
      input.driverCarryBasis?.basis ??
      (actualYardsPerMph ? "Recent driver shots" : "Rule-of-thumb estimate"),
  };
}

function buildSpeedForecast(
  sessions: SpeedCentreSession[],
  currentSpeedMph: number | null,
  targetSpeedMph: number | null,
  now: number,
): SpeedForecastSummary {
  const points = [...sessions]
    .filter((session): session is SpeedCentreSession & { avgSpeedMph: number } => {
      return session.avgSpeedMph !== null;
    })
    .reverse();
  const current = currentSpeedMph ?? points.at(-1)?.avgSpeedMph ?? null;
  const first = points[0] ?? null;
  const last = points.at(-1) ?? null;
  const thirtyDaysAgo = now - 30 * DAY_MS;
  const monthStart =
    points.find((point) => new Date(point.sessionDateIso).getTime() >= thirtyDaysAgo) ?? first;
  const progressThisMonthMph =
    current !== null && monthStart
      ? Math.round((current - monthStart.avgSpeedMph) * 10) / 10
      : null;

  if (points.length < MIN_FORECAST_SESSIONS || !first || !last || current === null) {
    return {
      status: "needs_more_sessions",
      progressThisMonthMph,
      monthlyGainMph: null,
      forecastSpeedMph: current,
      forecastDateIso: null,
      targetEtaIso: null,
      confidenceLabel: "Needs 3-session trend",
    };
  }

  const firstTime = new Date(first.sessionDateIso).getTime();
  const lastTime = new Date(last.sessionDateIso).getTime();
  const elapsedDays = Math.max(1, (lastTime - firstTime) / DAY_MS);
  const monthlyGainMph =
    Math.round(((last.avgSpeedMph - first.avgSpeedMph) / elapsedDays) * 30 * 10) / 10;
  const forecastDate = new Date(now + FORECAST_HORIZON_DAYS * DAY_MS);
  const forecastSpeedMph =
    Math.round((current + (monthlyGainMph / 30) * FORECAST_HORIZON_DAYS) * 10) / 10;
  const targetGap = targetSpeedMph && current ? targetSpeedMph - current : null;
  const targetEtaIso =
    targetGap !== null && targetGap > 0 && monthlyGainMph > 0
      ? new Date(now + Math.min(730, (targetGap / monthlyGainMph) * 30) * DAY_MS).toISOString()
      : null;

  return {
    status: monthlyGainMph > 0 ? "ready" : "flat",
    progressThisMonthMph,
    monthlyGainMph,
    forecastSpeedMph,
    forecastDateIso: forecastDate.toISOString(),
    targetEtaIso,
    confidenceLabel: points.length >= 4 ? "Medium" : "Early",
  };
}

function buildSpeedSideSummary(
  sessions: SpeedCentreSession[],
  shotSpeed: ShotSpeedSummary,
): SpeedSideSummary {
  const dominant = sessions.filter(
    (session) => session.handedness === "dominant" || session.handedness === "both",
  );
  const nonDominant = sessions.filter(
    (session) => session.handedness === "non_dominant" || session.handedness === "both",
  );
  const overspeed = sessions.filter((session) => session.implementKind !== "club");
  const dominantAvgMph = average(avgSpeeds(dominant));
  const nonDominantAvgMph = average(avgSpeeds(nonDominant));
  const dominantMaxMph = maxOrNull(maxSpeeds(dominant));
  const nonDominantMaxMph = maxOrNull(maxSpeeds(nonDominant));
  const overspeedAvgMph = average(avgSpeeds(overspeed));
  const overspeedMaxMph = maxOrNull(maxSpeeds(overspeed));
  const gamerMaxMph =
    shotSpeed.personalBestDriverMph ??
    maxOrNull(maxSpeeds(sessions.filter((session) => session.implementKind === "club")));

  return {
    dominantAvgMph,
    dominantMaxMph,
    nonDominantAvgMph,
    nonDominantMaxMph,
    sideBalancePercent:
      dominantAvgMph && nonDominantAvgMph
        ? Math.round((nonDominantAvgMph / dominantAvgMph) * 100)
        : null,
    overspeedAvgMph,
    overspeedMaxMph,
    overspeedRatio:
      overspeedMaxMph && gamerMaxMph
        ? Math.round((overspeedMaxMph / gamerMaxMph) * 100) / 100
        : null,
  };
}

function avgSpeeds(sessions: SpeedCentreSession[]) {
  return sessions
    .map((session) => session.avgSpeedMph)
    .filter((value): value is number => value !== null);
}

function maxSpeeds(sessions: SpeedCentreSession[]) {
  return sessions
    .map((session) => session.maxSpeedMph)
    .filter((value): value is number => value !== null);
}

function trainingPeakReadings(
  sessions: SpeedCentreSession[],
  swings: Array<{
    sessionId: string;
    clubSpeedMph: number;
    sourceRawJson: Record<string, unknown>;
  }>,
) {
  return selectTrainingPeakReadings(
    sessions,
    swings.map((swing) => ({
      sessionId: swing.sessionId,
      clubSpeedMph: swing.clubSpeedMph,
      phase: storedSpeedTrainingPhase(swing.sourceRawJson),
    })),
  );
}

function isTrainingPeakSwing(swing: { sourceRawJson: Record<string, unknown> }) {
  const phase = storedSpeedTrainingPhase(swing.sourceRawJson);
  return phase === null || phase === "max_speed";
}

function isComparableDriverSpeedSession(session: SpeedCentreSession, driverClubId: string | null) {
  if (session.handedness !== "dominant" || session.implementKind !== "club") {
    return false;
  }

  if (driverClubId !== null && session.clubId === driverClubId) {
    return true;
  }

  return (
    session.clubId === null && /driver/i.test(`${session.title ?? ""} ${session.implementLabel}`)
  );
}

function buildFutureBagRows(
  rows: Array<{
    clubId: string;
    clubType: string;
    brand: string | null;
    model: string | null;
    sampleSize: number;
    carryMedianYd: number | null;
    recommendedPlayNumberYd: number | null;
    confidenceScore: number | null;
    calculatedAt: Date;
  }>,
  shotRows: Array<{
    id: string;
    sessionId: string;
    clubId: string;
    shotAt: Date;
    clubSpeedMph: number | null;
    clubDataEstType: string | null;
    sourceRawJson: Record<string, string>;
  }>,
): FutureBagProjectionRow[] {
  const latestByClub = new Map<string, (typeof rows)[number]>();
  const shotsByClub = groupByKey(shotRows, (shot) => shot.clubId);

  for (const row of rows) {
    if (
      !latestByClub.has(row.clubId) &&
      (row.recommendedPlayNumberYd ?? row.carryMedianYd) !== null
    ) {
      latestByClub.set(row.clubId, row);
    }
  }

  return [...latestByClub.values()]
    .sort((left, right) => clubSort(left.clubType) - clubSort(right.clubType))
    .slice(0, 12)
    .map((row) => {
      const clubShotSpeeds = selectIndependentMeasuredSpeedReadings(
        shotsByClub.get(row.clubId) ?? [],
      )
        .sort((left, right) => right.shotAt.getTime() - left.shotAt.getTime())
        .map((shot) => shot.clubSpeedMph);

      return {
        clubId: row.clubId,
        clubType: row.clubType,
        clubLabel: `${formatClubType(row.clubType)} - ${formatClubModelName({
          type: row.clubType,
          brand: row.brand,
          model: row.model,
        })}`,
        currentCarryYd: Math.round(row.recommendedPlayNumberYd ?? row.carryMedianYd ?? 0),
        currentClubSpeedMph: average(clubShotSpeeds.slice(0, 20)),
        clubSpeedDeltaFactor: clubSpeedDeltaFactor(row.clubType),
        confidenceScore: row.confidenceScore,
        carryGainPerMph: carryGainPerMph(row.clubType),
      };
    });
}

function carryGainPerMph(clubType: string) {
  if (clubType === "driver") {
    return 2.4;
  }

  if (/^[2-7][wh]$/.test(clubType)) {
    return 1.9;
  }

  if (/^[3-9]i$/.test(clubType)) {
    return 1.25;
  }

  return 0.75;
}

function clubSpeedDeltaFactor(clubType: string) {
  if (clubType === "driver") {
    return 1;
  }

  if (/^[2-7][wh]$/.test(clubType)) {
    return 0.85;
  }

  if (/^[3-9]i$/.test(clubType)) {
    return 0.6;
  }

  return 0.35;
}

function clubSort(clubType: string) {
  if (clubType === "driver") {
    return 0;
  }

  const woodOrHybrid = clubType.match(/^([1-9])[wh]$/);
  if (woodOrHybrid) {
    return 10 + Number(woodOrHybrid[1]);
  }

  const iron = clubType.match(/^([1-9])i$/);
  if (iron) {
    return 30 + Number(iron[1]);
  }

  const wedgeOrder: Record<string, number> = {
    pw: 50,
    gw: 51,
    aw: 52,
    sw: 53,
    lw: 54,
  };

  return wedgeOrder[clubType] ?? 99;
}

function buildDriverEfficiency(
  driverShots: Array<{
    shotAt: Date;
    clubSpeedMph: number | null;
    smashFactor: number | null;
    carryYd: number | null;
  }>,
): DriverEfficiencySummary {
  const recentDriverShots = driverShots.slice(0, 20);
  const clubSpeedMph = average(
    recentDriverShots
      .map((shot) => shot.clubSpeedMph)
      .filter((value): value is number => value !== null),
  );
  const smashFactor = average(
    recentDriverShots
      .map((shot) => shot.smashFactor)
      .filter((value): value is number => value !== null),
  );
  const carryYd = average(
    recentDriverShots
      .map((shot) => shot.carryYd)
      .filter((value): value is number => value !== null),
  );

  if (!smashFactor) {
    return {
      clubSpeedMph,
      smashFactor,
      carryYd,
      verdict: "Needs shot data",
      focus: "Log driver shots with club speed and smash to separate speed from strike.",
    };
  }

  if (smashFactor >= 1.47) {
    return {
      clubSpeedMph,
      smashFactor,
      carryYd,
      verdict: "Efficient",
      focus: "Strike is good enough that extra speed should convert into distance.",
    };
  }

  if (smashFactor >= 1.42) {
    return {
      clubSpeedMph,
      smashFactor,
      carryYd,
      verdict: "Playable",
      focus: "Blend speed work with centered driver strike.",
    };
  }

  return {
    clubSpeedMph,
    smashFactor,
    carryYd,
    verdict: "Strike first",
    focus: "Improve driver efficiency before chasing maximum club speed.",
  };
}

function buildShotSpeedSummary(
  driverShots: Array<{
    id: string;
    sessionId: string;
    shotAt: Date;
    clubSpeedMph: number | null;
    clubDataEstType: string | null;
    sourceRawJson?: Record<string, string>;
  }>,
  thirtyDaysAgo: number,
): ShotSpeedSummary {
  const normalizedRows = driverShots.map((shot) => ({
    ...shot,
    sourceRawJson: shot.sourceRawJson ?? null,
  }));
  const speedRows = selectIndependentMeasuredSpeedReadings(normalizedRows).sort(
    (left, right) => right.shotAt.getTime() - left.shotAt.getTime(),
  );
  const speeds = speedRows.map((shot) => shot.clubSpeedMph);
  const thirtyDaySpeeds = speedRows
    .filter((shot) => shot.shotAt.getTime() >= thirtyDaysAgo)
    .map((shot) => shot.clubSpeedMph);
  const personalBestEvidence = summarizeTrustedSpeedPb(normalizedRows);

  return {
    recentDriverAvgMph: average(speeds),
    last20DriverAvgMph: average(speeds.slice(0, 20)),
    thirtyDayDriverAvgMph: average(thirtyDaySpeeds),
    personalBestDriverMph: personalBestEvidence.trustedPbMph,
    personalBestEvidence,
    latestShotAtIso: speedRows[0]?.shotAt.toISOString() ?? null,
    sampleSize: speedRows.length,
  };
}

function buildShotSpeedSessions(
  shotRows: Array<{
    sessionId: string;
    sessionDate: Date;
    sessionType: string;
    sessionSource: string;
    fileName: string | null;
    clubId: string;
    clubType: string;
    brand: string | null;
    model: string | null;
    shotAt: Date;
    clubSpeedMph: number | null;
  }>,
): SpeedShotSession[] {
  const grouped = groupByKey(shotRows, (shot) => `${shot.sessionId}:${shot.clubId}`);

  return [...grouped.values()]
    .map((rows) => {
      const first = rows[0];
      const speeds = rows
        .map((shot) => shot.clubSpeedMph)
        .filter((value): value is number => value !== null);
      const latestShotAt = rows.reduce<Date | null>((latest, shot) => {
        return !latest || shot.shotAt.getTime() > latest.getTime() ? shot.shotAt : latest;
      }, null);

      return {
        id: `${first.sessionId}:${first.clubId}`,
        sessionId: first.sessionId,
        sessionDateIso: first.sessionDate.toISOString(),
        source: first.sessionSource,
        sessionType: first.sessionType,
        fileName: first.fileName,
        clubId: first.clubId,
        clubType: first.clubType,
        clubLabel: `${formatClubType(first.clubType)} - ${formatClubModelName({
          type: first.clubType,
          brand: first.brand,
          model: first.model,
        })}`,
        shotCount: speeds.length,
        minSpeedMph: speeds.length > 0 ? Math.min(...speeds) : null,
        avgSpeedMph: average(speeds),
        maxSpeedMph: maxOrNull(speeds),
        latestShotAtIso: latestShotAt?.toISOString() ?? null,
      };
    })
    .filter((session) => session.shotCount > 0)
    .sort(
      (left, right) =>
        new Date(right.sessionDateIso).getTime() - new Date(left.sessionDateIso).getTime(),
    );
}

function buildClubSpeedRows(
  clubRows: Array<{
    id: string;
    type: string;
    brand: string | null;
    model: string | null;
  }>,
  sessions: SpeedCentreSession[],
  shotRows: Array<{
    id: string;
    sessionId: string;
    clubId: string;
    clubType: string;
    brand: string | null;
    model: string | null;
    shotAt: Date;
    clubSpeedMph: number | null;
    clubDataEstType: string | null;
    sourceRawJson: Record<string, string>;
  }>,
  trainingSwings: Array<{
    sessionId: string;
    clubSpeedMph: number;
    sourceRawJson: Record<string, unknown>;
  }>,
): ClubSpeedRow[] {
  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  const sessionsByClub = groupByKey(sessions, (session) => session.clubId ?? "__unassigned");
  const shotsByClub = groupByKey(shotRows, (shot) => shot.clubId);
  const rows = clubRows
    .map((club) => {
      const clubSessions = sessionsByClub.get(club.id) ?? [];
      const clubShots = shotsByClub.get(club.id) ?? [];

      return buildClubSpeedRow({
        clubId: club.id,
        clubType: club.type,
        clubLabel: `${formatClubType(club.type)} - ${formatClubModelName(club)}`,
        sessions: clubSessions,
        trainingReadings: trainingPeakReadings(clubSessions, trainingSwings),
        shots: clubShots,
        thirtyDaysAgo,
      });
    })
    .sort((left, right) => clubSort(left.clubType) - clubSort(right.clubType));

  const unassignedSessions = sessionsByClub.get("__unassigned") ?? [];

  if (unassignedSessions.length > 0) {
    rows.unshift(
      buildClubSpeedRow({
        clubId: null,
        clubType: "unassigned",
        clubLabel: "Unassigned speed sessions",
        sessions: unassignedSessions,
        trainingReadings: trainingPeakReadings(unassignedSessions, trainingSwings),
        shots: [],
        thirtyDaysAgo,
      }),
    );
  }

  return rows;
}

function buildClubSpeedRow(input: {
  clubId: string | null;
  clubType: string;
  clubLabel: string;
  sessions: SpeedCentreSession[];
  trainingReadings: number[];
  shots: SpeedPbReading[];
  thirtyDaysAgo: number;
}): ClubSpeedRow {
  const sortedSessions = [...input.sessions].sort(
    (left, right) =>
      new Date(right.sessionDateIso).getTime() - new Date(left.sessionDateIso).getTime(),
  );
  const allSortedShots = [...input.shots].sort(
    (left, right) => right.shotAt.getTime() - left.shotAt.getTime(),
  );
  const sortedShots = selectIndependentMeasuredSpeedReadings(allSortedShots).sort(
    (left, right) => right.shotAt.getTime() - left.shotAt.getTime(),
  );
  const shotSpeeds = sortedShots
    .map((shot) => shot.clubSpeedMph)
    .filter((value): value is number => value !== null);
  const thirtyDayShotSpeeds = sortedShots
    .filter((shot) => shot.shotAt.getTime() >= input.thirtyDaysAgo)
    .map((shot) => shot.clubSpeedMph)
    .filter((value): value is number => value !== null);
  const latestShotSessionId = sortedShots[0]?.sessionId ?? null;
  const latestShotSessionSpeeds =
    latestShotSessionId === null
      ? []
      : sortedShots
          .filter((shot) => shot.sessionId === latestShotSessionId)
          .map((shot) => shot.clubSpeedMph)
          .filter((value): value is number => value !== null);
  const trainingAvgMph = sortedSessions[0]?.avgSpeedMph ?? null;
  const trainingPbEvidence = summarizeRepeatedSpeedPeak(input.trainingReadings);
  const shotLast20AvgMph = average(shotSpeeds.slice(0, 20));
  const shotPbEvidence = summarizeTrustedSpeedPb(allSortedShots);
  const shotPbMph = shotPbEvidence.trustedPbMph;
  const latestShotSessionAvgMph = average(latestShotSessionSpeeds);
  const benchmarkTarget = getClubSpeedBenchmarkTarget(
    input.clubType,
    shotLast20AvgMph ?? trainingAvgMph,
  );
  const transferGapMph =
    trainingAvgMph !== null && shotLast20AvgMph !== null
      ? roundOneDecimal(trainingAvgMph - shotLast20AvgMph)
      : null;
  const transferRatioPercent =
    trainingAvgMph !== null && trainingAvgMph > 0 && shotLast20AvgMph !== null
      ? roundOneDecimal((shotLast20AvgMph / trainingAvgMph) * 100)
      : null;

  return {
    clubId: input.clubId,
    clubType: input.clubType,
    clubLabel: input.clubLabel,
    benchmarkTarget,
    trainingAvgMph,
    trainingPbMph: trainingPbEvidence.trustedPeakMph,
    trainingPbEvidence,
    trainingLastSessionIso: sortedSessions[0]?.sessionDateIso ?? null,
    trainingSessionCount: sortedSessions.length,
    trainingSwingCount: sortedSessions.reduce((total, session) => total + session.swingCount, 0),
    shotLast20AvgMph,
    shotThirtyDayAvgMph: average(thirtyDayShotSpeeds),
    shotPbMph,
    shotPbEvidence,
    latestShotSessionAvgMph,
    latestShotSessionGapToPbMph:
      latestShotSessionAvgMph !== null && shotPbMph !== null
        ? roundOneDecimal(latestShotSessionAvgMph - shotPbMph)
        : null,
    shotSampleSize: shotSpeeds.length,
    latestShotAtIso: sortedShots[0]?.shotAt.toISOString() ?? null,
    transferGapMph,
    transferRatioPercent,
    transferStatus: transferStatus(transferGapMph),
  };
}

// One whole-mph band allows ordinary device/display variation; copied imports are collapsed first.
const SPEED_PB_REPEAT_WINDOW_MPH = 1;

type ClubSpeedMeasurementTrust = "measured" | "estimated" | "unknown";

type IndependentSpeedReading<T extends SpeedPbReading = SpeedPbReading> = {
  mph: number;
  measurementTrust: ClubSpeedMeasurementTrust;
  duplicateImportCount: number;
  reading: T & { clubSpeedMph: number };
};

export function summarizeTrustedSpeedPb(readings: SpeedPbReading[]): SpeedPersonalBestEvidence {
  const physicalReadings = deduplicateSpeedReadings(readings).sort(
    (left, right) => right.mph - left.mph,
  );
  const measuredReadings = physicalReadings.filter(
    (reading) => reading.measurementTrust === "measured",
  );
  const trustedCandidate = measuredReadings.find(
    (candidate) => corroboratingReadings(candidate, measuredReadings).length >= 2,
  );
  const trustedEvidenceCount = trustedCandidate
    ? corroboratingReadings(trustedCandidate, measuredReadings).length
    : 0;
  const observedPeak = physicalReadings[0] ?? null;
  const observedPeakIsTrusted =
    observedPeak !== null &&
    trustedCandidate !== undefined &&
    observedPeak.mph <= trustedCandidate.mph;

  return {
    trustedPbMph: trustedCandidate?.mph ?? null,
    trustedEvidenceCount,
    independentReadingCount: physicalReadings.length,
    ignoredDuplicateCount: physicalReadings.reduce(
      (total, reading) => total + reading.duplicateImportCount,
      0,
    ),
    unverifiedPeak:
      observedPeak && !observedPeakIsTrusted
        ? {
            mph: observedPeak.mph,
            reason: unverifiedPeakReason(observedPeak.measurementTrust),
            independentEvidenceCount: corroboratingReadings(
              observedPeak,
              physicalReadings.filter(
                (reading) => reading.measurementTrust === observedPeak.measurementTrust,
              ),
            ).length,
            duplicateImportCount: observedPeak.duplicateImportCount,
          }
        : null,
  };
}

export function selectIndependentMeasuredSpeedReadings<T extends SpeedPbReading>(
  readings: T[],
): Array<T & { clubSpeedMph: number }> {
  return deduplicateSpeedReadings(readings)
    .filter((reading) => reading.measurementTrust === "measured")
    .map((reading) => reading.reading);
}

function deduplicateSpeedReadings<T extends SpeedPbReading>(
  readings: T[],
): Array<IndependentSpeedReading<T>> {
  const grouped = groupByKey(
    readings.filter(
      (reading): reading is T & { clubSpeedMph: number } =>
        typeof reading.clubSpeedMph === "number" &&
        Number.isFinite(reading.clubSpeedMph) &&
        reading.clubSpeedMph > 0,
    ),
    speedReadingFingerprint,
  );

  return [...grouped.values()].map((duplicates) => {
    const measuredDuplicates = duplicates.filter(
      (reading) => clubSpeedMeasurementTrust(reading.clubDataEstType) === "measured",
    );
    const representativePool = measuredDuplicates.length > 0 ? measuredDuplicates : duplicates;
    const representative = representativePool.reduce((fastest, reading) =>
      reading.clubSpeedMph > fastest.clubSpeedMph ? reading : fastest,
    );
    const trustLevels = duplicates.map((reading) =>
      clubSpeedMeasurementTrust(reading.clubDataEstType),
    );

    return {
      mph: representative.clubSpeedMph,
      measurementTrust: trustLevels.includes("measured")
        ? "measured"
        : trustLevels.includes("estimated")
          ? "estimated"
          : "unknown",
      duplicateImportCount: duplicates.length - 1,
      reading: representative,
    };
  });
}

function speedReadingFingerprint(reading: SpeedPbReading) {
  const sourceEntries = Object.entries(reading.sourceRawJson ?? {})
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 || value.length > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  return sourceEntries.length > 0
    ? `raw:${JSON.stringify(sourceEntries)}`
    : `shot:${reading.shotAt.toISOString()}:${reading.id}`;
}

function clubSpeedMeasurementTrust(value: string | null): ClubSpeedMeasurementTrust {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (
    value === null ||
    /^0(?:\.0+)?$/.test(normalized) ||
    ["false", "measured", "direct"].includes(normalized)
  ) {
    return "measured";
  }

  if (
    /^1(?:\.0+)?$/.test(normalized) ||
    normalized === "true" ||
    normalized.includes("est") ||
    normalized.includes("model")
  ) {
    return "estimated";
  }

  return "unknown";
}

function corroboratingReadings(
  candidate: IndependentSpeedReading,
  readings: IndependentSpeedReading[],
) {
  return readings.filter(
    (reading) => Math.abs(candidate.mph - reading.mph) <= SPEED_PB_REPEAT_WINDOW_MPH,
  );
}

function unverifiedPeakReason(
  measurementTrust: ClubSpeedMeasurementTrust,
): SpeedUnverifiedPeakReason {
  if (measurementTrust === "estimated") {
    return "estimated_club_data";
  }

  if (measurementTrust === "unknown") {
    return "unknown_club_data";
  }

  return "one_off";
}

function groupByKey<T>(rows: T[], keyFn: (row: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const key = keyFn(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return grouped;
}

function maxOrNull(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function transferStatus(gapMph: number | null) {
  if (gapMph === null) {
    return "Need both";
  }

  if (gapMph < -2) {
    return "Ball faster";
  }

  if (Math.abs(gapMph) <= 3) {
    return "Matched";
  }

  if (gapMph <= 7) {
    return "Normal dry gap";
  }

  return "Large dry gap";
}

function transferCoachMessage(gapMph: number) {
  if (gapMph < -2) {
    return "Your with-ball driver speed is currently faster than the no-ball speed session, so treat that R-Speed entry as a baseline session rather than your playing-speed ceiling.";
  }

  if (Math.abs(gapMph) <= 3) {
    return "No-ball speed and with-ball driver speed are matched closely enough that speed work is transferring well.";
  }

  if (gapMph <= 7) {
    return "No-ball speed is ahead of with-ball driver speed, which can be normal when strike, target, or ball focus holds speed back.";
  }

  return "No-ball speed is well ahead of with-ball driver speed, so the next gain is likely transferring speed into centered driver strikes.";
}

function clubGoalKey(clubId: string) {
  return `club:${clubId}`;
}

function labelForImplementKind(kind: string) {
  switch (kind) {
    case "speed_stick":
      return "Speed stick";
    case "weighted_club":
      return "Weighted club";
    case "club":
      return "Golf club";
    default:
      return "Other implement";
  }
}

function shotEvidenceSqlPredicate() {
  return and(
    inArray(shots.reviewStatus, ["included", "restored"]),
    or(
      eq(shots.reviewStatus, "restored"),
      and(
        eq(shots.reviewStatus, "included"),
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in ('exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top')`,
        sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in ('warm-up', 'warmup', 'warm_up')`,
      ),
    ),
  )!;
}

function storedSpeedTrainingPhase(value: Record<string, unknown>) {
  const phase = value.phase;
  return phase === "warm_up" || phase === "max_speed" || phase === "transfer" ? phase : null;
}
