import "server-only";

import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  golfTrainingDailyLoad,
  golfTrainingSessions,
  practiceSessions,
  sessions,
  shots,
  speedTrainingSessions,
} from "@/db/schema";
import {
  calculateFitnessFreshnessSeries,
  sliceTrainingSeries,
  toDateKey,
  type DailyFormAdjustment,
  type FitnessFreshnessPoint,
} from "@/lib/training/fitnessFreshness";
import { getTrainingStatus, getTrainingTrend } from "@/lib/training/trainingStatus";
import type { TrainingStatus, TrainingTrend } from "@/lib/training/trainingStatus";
import { calculateSessionLoad, calculateSessionVolume } from "@/lib/training/trainingLoad";
import {
  aggregateSessionFormSnapshots,
  calculateSessionFormSignal,
  neutralSessionFormSignal,
  type SessionFormSignal,
  type SessionFormSnapshot,
} from "@/lib/training/sessionForm";
import { isRoundHistorySession } from "@/lib/round-sessions";

export type TrainingRangeKey = "7d" | "4w" | "3m" | "6m" | "1y";

export type TrainingSourceType = "round" | "practice" | "manual" | "launch_monitor" | "imported";

export type TrainingSessionListItem = {
  id: string;
  sourceType: TrainingSourceType;
  sourceId: string | null;
  title: string;
  sessionDate: string;
  durationMinutes: number | null;
  holesPlayed: number | null;
  totalSwings: number | null;
  fullSwings: number | null;
  shortGameSwings: number | null;
  puttingSwings: number | null;
  walked: boolean | null;
  usedCart: boolean | null;
  competition: boolean;
  rpe: number;
  mentalPressure: number | null;
  physicalDemand: number | null;
  sessionLoad: number;
  notes: string | null;
};

export type TrainingSourceSuggestion = {
  key: string;
  sourceType: TrainingSourceType;
  sourceId: string;
  title: string;
  sessionDate: string;
  durationMinutes: number | null;
  holesPlayed: number | null;
  totalSwings: number | null;
  fullSwings: number | null;
  shortGameSwings: number | null;
  puttingSwings: number | null;
  walked: boolean | null;
  usedCart: boolean | null;
  competition: boolean;
  suggestedRpe: number;
  mentalPressure: number | null;
  physicalDemand: number | null;
  volumeLabel: string;
  detail: string;
};

export type TrainingSummaryMetric = {
  value: number;
  previousWeekValue: number;
  change: number;
};

export type TrainingConfidence = {
  score: number;
  label: string;
  detail: string;
};

export type TrainingSessionMarker = {
  date: string;
  sessionCount: number;
  totalLoad: number;
  title: string;
};

export type TrainingOverTimeData = {
  rangeKey: TrainingRangeKey;
  rangeDays: number;
  conditioningDays: number;
  chartStartDate: string;
  today: string;
  series: FitnessFreshnessPoint[];
  latest: FitnessFreshnessPoint | null;
  previousWeek: FitnessFreshnessPoint | null;
  summary: {
    fitness: TrainingSummaryMetric;
    fatigue: TrainingSummaryMetric;
    form: TrainingSummaryMetric;
  };
  status: TrainingStatus;
  trend: TrainingTrend;
  sessionFormSignal: SessionFormSignal;
  sessionMarkers: TrainingSessionMarker[];
  recentSessions: TrainingSessionListItem[];
  suggestions: TrainingSourceSuggestion[];
  hasTrainingData: boolean;
  averageTrainingLoad: number;
  confidence: TrainingConfidence;
  efficiencyCards: Array<{
    title: string;
    detail: string;
    metric: string;
  }>;
};

type TrainingSessionDbRow = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  sessionDate: string | Date;
  durationMinutes: number | null;
  holesPlayed: number | null;
  totalSwings: number | null;
  fullSwings: number | null;
  shortGameSwings: number | null;
  puttingSwings: number | null;
  walked: boolean | null;
  usedCart: boolean | null;
  competition: boolean;
  rpe: number;
  mentalPressure: number | null;
  physicalDemand: number | null;
  sessionLoad: string | number;
  notes: string | null;
};

type SessionSnapshotRow = {
  session: TrainingSessionListItem;
  snapshot: SessionFormSnapshot;
};

type SessionSnapshotGroup = {
  date: string;
  kind: SessionFormSnapshot["kind"];
  snapshot: SessionFormSnapshot;
};

const RANGE_DAYS: Record<TrainingRangeKey, number> = {
  "7d": 7,
  "4w": 28,
  "3m": 90,
  "6m": 183,
  "1y": 365,
};

const WARMUP_DAYS = 90;
const CONDITIONING_DAYS = 84;
const SUGGESTION_LOOKBACK_DAYS = 45;
const CONFIDENCE_LOOKBACK_DAYS = 28;

export function normalizeTrainingRange(value: string | string[] | undefined): TrainingRangeKey {
  const key = Array.isArray(value) ? value[0] : value;
  return key === "7d" || key === "4w" || key === "3m" || key === "6m" || key === "1y" ? key : "3m";
}

export function trainingRangeDays(rangeKey: TrainingRangeKey) {
  return RANGE_DAYS[rangeKey];
}

export async function getTrainingOverTimeData(
  userId: string,
  rangeKey: TrainingRangeKey,
): Promise<TrainingOverTimeData> {
  const db = getDb();
  const rangeDays = trainingRangeDays(rangeKey);
  const today = toDateKey(new Date());
  const chartStartDate = subtractDays(today, rangeDays - 1);
  const warmupStartDate = subtractDays(chartStartDate, WARMUP_DAYS);
  const suggestionStart = new Date(`${subtractDays(today, SUGGESTION_LOOKBACK_DAYS)}T00:00:00Z`);

  const [
    dailyRows,
    recentSessionRows,
    sessionMarkerRows,
    formSessionRows,
    existingLinkedRows,
    suggestions,
  ] = await Promise.all([
    db
      .select({
        date: golfTrainingDailyLoad.date,
        load: golfTrainingDailyLoad.totalSessionLoad,
      })
      .from(golfTrainingDailyLoad)
      .where(
        and(
          eq(golfTrainingDailyLoad.userId, userId),
          gte(golfTrainingDailyLoad.date, warmupStartDate),
        ),
      )
      .orderBy(golfTrainingDailyLoad.date),
    db
      .select({
        id: golfTrainingSessions.id,
        sourceType: golfTrainingSessions.sourceType,
        sourceId: golfTrainingSessions.sourceId,
        title: golfTrainingSessions.title,
        sessionDate: golfTrainingSessions.sessionDate,
        durationMinutes: golfTrainingSessions.durationMinutes,
        holesPlayed: golfTrainingSessions.holesPlayed,
        totalSwings: golfTrainingSessions.totalSwings,
        fullSwings: golfTrainingSessions.fullSwings,
        shortGameSwings: golfTrainingSessions.shortGameSwings,
        puttingSwings: golfTrainingSessions.puttingSwings,
        walked: golfTrainingSessions.walked,
        usedCart: golfTrainingSessions.usedCart,
        competition: golfTrainingSessions.competition,
        rpe: golfTrainingSessions.rpe,
        mentalPressure: golfTrainingSessions.mentalPressure,
        physicalDemand: golfTrainingSessions.physicalDemand,
        sessionLoad: golfTrainingSessions.sessionLoad,
        notes: golfTrainingSessions.notes,
      })
      .from(golfTrainingSessions)
      .where(eq(golfTrainingSessions.userId, userId))
      .orderBy(desc(golfTrainingSessions.sessionDate), desc(golfTrainingSessions.createdAt))
      .limit(8),
    db
      .select({
        title: golfTrainingSessions.title,
        sessionDate: golfTrainingSessions.sessionDate,
        sessionLoad: golfTrainingSessions.sessionLoad,
      })
      .from(golfTrainingSessions)
      .where(
        and(
          eq(golfTrainingSessions.userId, userId),
          gte(golfTrainingSessions.sessionDate, chartStartDate),
        ),
      )
      .orderBy(asc(golfTrainingSessions.sessionDate), asc(golfTrainingSessions.createdAt)),
    db
      .select({
        id: golfTrainingSessions.id,
        sourceType: golfTrainingSessions.sourceType,
        sourceId: golfTrainingSessions.sourceId,
        title: golfTrainingSessions.title,
        sessionDate: golfTrainingSessions.sessionDate,
        durationMinutes: golfTrainingSessions.durationMinutes,
        holesPlayed: golfTrainingSessions.holesPlayed,
        totalSwings: golfTrainingSessions.totalSwings,
        fullSwings: golfTrainingSessions.fullSwings,
        shortGameSwings: golfTrainingSessions.shortGameSwings,
        puttingSwings: golfTrainingSessions.puttingSwings,
        walked: golfTrainingSessions.walked,
        usedCart: golfTrainingSessions.usedCart,
        competition: golfTrainingSessions.competition,
        rpe: golfTrainingSessions.rpe,
        mentalPressure: golfTrainingSessions.mentalPressure,
        physicalDemand: golfTrainingSessions.physicalDemand,
        sessionLoad: golfTrainingSessions.sessionLoad,
        notes: golfTrainingSessions.notes,
      })
      .from(golfTrainingSessions)
      .where(
        and(
          eq(golfTrainingSessions.userId, userId),
          gte(golfTrainingSessions.sessionDate, warmupStartDate),
        ),
      )
      .orderBy(asc(golfTrainingSessions.sessionDate), asc(golfTrainingSessions.createdAt)),
    db
      .select({
        sourceType: golfTrainingSessions.sourceType,
        sourceId: golfTrainingSessions.sourceId,
      })
      .from(golfTrainingSessions)
      .where(eq(golfTrainingSessions.userId, userId))
      .limit(250),
    buildSourceSuggestions(userId, suggestionStart),
  ]);

  const recentSessions = recentSessionRows.map(toTrainingSessionListItem);
  const formSessions = formSessionRows.map(toTrainingSessionListItem);
  const sessionMarkers = buildSessionMarkers(sessionMarkerRows);
  const sessionFormSignal = await buildLatestSessionFormSignal(userId, recentSessions);
  const formAdjustments = await buildHistoricalSessionFormAdjustments(userId, formSessions);
  const confidence = buildTrainingConfidence(formSessions, sessionFormSignal, today);
  const firstTrainingDataDate = firstDateKey([
    ...dailyRows.map((row) => toDateKey(row.date)),
    ...formSessions.map((session) => session.sessionDate),
  ]);
  const visibleStartDate = firstTrainingDataDate
    ? maxDateKey(chartStartDate, firstTrainingDataDate)
    : chartStartDate;
  const series = calculateFitnessFreshnessSeries(dailyRows, {
    startDate: warmupStartDate,
    endDate: today,
    fitnessDays: CONDITIONING_DAYS,
    minimumDays: rangeDays + WARMUP_DAYS,
    formAdjustments,
  });
  const previousWeek = series.at(Math.max(0, series.length - 8)) ?? null;
  const latest = series.at(-1) ?? null;
  const visibleSeries = sliceTrainingSeries(series, rangeDays).filter(
    (point) => point.date >= visibleStartDate,
  );
  const visibleSessionMarkers = sessionMarkers.filter((marker) => marker.date >= visibleStartDate);
  const status = latest
    ? getTrainingStatus(latest.fitness, latest.fatigue, latest.form)
    : getTrainingStatus(0, 0, 0);
  const trend = getTrainingTrend(series);
  const linkedSourceKeys = new Set(
    existingLinkedRows
      .filter((row) => row.sourceId)
      .map((row) => sourceKey(row.sourceType as TrainingSourceType, row.sourceId!)),
  );
  const filteredSuggestions = suggestions
    .filter((suggestion) => !linkedSourceKeys.has(suggestion.key))
    .slice(0, 5);
  const averageTrainingLoad =
    visibleSeries.length > 0
      ? visibleSeries.reduce((total, point) => total + point.load, 0) / visibleSeries.length
      : 0;

  return {
    rangeKey,
    rangeDays,
    conditioningDays: CONDITIONING_DAYS,
    chartStartDate: visibleStartDate,
    today,
    series: visibleSeries,
    latest,
    previousWeek,
    summary: {
      fitness: buildSummaryMetric(latest?.fitness ?? 0, previousWeek?.fitness ?? 0),
      fatigue: buildSummaryMetric(latest?.fatigue ?? 0, previousWeek?.fatigue ?? 0),
      form: buildSummaryMetric(latest?.form ?? 0, previousWeek?.form ?? 0),
    },
    status,
    trend,
    sessionFormSignal,
    sessionMarkers: visibleSessionMarkers,
    recentSessions,
    suggestions: filteredSuggestions,
    hasTrainingData: recentSessionRows.length > 0,
    averageTrainingLoad,
    confidence,
    efficiencyCards: buildEfficiencyCards(averageTrainingLoad),
  };
}

async function buildSourceSuggestions(
  userId: string,
  suggestionStart: Date,
): Promise<TrainingSourceSuggestion[]> {
  const db = getDb();
  const [sessionRows, practiceRows, speedRows] = await Promise.all([
    db
      .select({
        id: sessions.id,
        type: sessions.type,
        source: sessions.source,
        date: sessions.date,
        courseName: sessions.courseName,
        location: sessions.location,
        fileName: sessions.fileName,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.date, suggestionStart)))
      .orderBy(desc(sessions.date))
      .limit(16),
    db
      .select({
        id: practiceSessions.id,
        title: practiceSessions.title,
        focusArea: practiceSessions.focusArea,
        status: practiceSessions.status,
        plannedAt: practiceSessions.plannedAt,
        completedAt: practiceSessions.completedAt,
        targetShots: practiceSessions.targetShots,
        recordedShots: practiceSessions.recordedShots,
      })
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, userId))
      .orderBy(desc(practiceSessions.completedAt), desc(practiceSessions.plannedAt))
      .limit(10),
    db
      .select({
        id: speedTrainingSessions.id,
        source: speedTrainingSessions.source,
        sessionDate: speedTrainingSessions.sessionDate,
        title: speedTrainingSessions.title,
        swingCount: speedTrainingSessions.swingCount,
        maxSpeedMph: speedTrainingSessions.maxSpeedMph,
        avgSpeedMph: speedTrainingSessions.avgSpeedMph,
        implementLabel: speedTrainingSessions.implementLabel,
      })
      .from(speedTrainingSessions)
      .where(
        and(
          eq(speedTrainingSessions.userId, userId),
          gte(speedTrainingSessions.sessionDate, suggestionStart),
        ),
      )
      .orderBy(desc(speedTrainingSessions.sessionDate))
      .limit(10),
  ]);
  const shotCounts = await getShotCountsForSessions(
    userId,
    sessionRows.map((row) => row.id),
  );
  const suggestions: TrainingSourceSuggestion[] = [];

  for (const row of sessionRows) {
    const shotCount = shotCounts.get(row.id) ?? 0;
    const holesPlayed = row.scorecardJson?.length ?? null;
    const sourceType = sourceTypeForSession(row.source, row.type);
    const isRound = isRoundHistorySession({ type: row.type });

    if (!isRound && shotCount === 0) {
      continue;
    }

    const suggestedRpe = isRound ? 5 : shotCount >= 80 ? 5 : 4;
    const title = isRound
      ? `${holesPlayed === 9 ? "9-hole" : "18-hole"} round${row.courseName ? ` - ${row.courseName}` : ""}`
      : `${providerLabel(row.source)} practice import`;

    suggestions.push({
      key: sourceKey(sourceType, row.id),
      sourceType,
      sourceId: row.id,
      title,
      sessionDate: toDateKey(row.date),
      durationMinutes: null,
      holesPlayed: isRound ? (holesPlayed ?? 18) : null,
      totalSwings: shotCount > 0 ? shotCount : null,
      fullSwings: null,
      shortGameSwings: null,
      puttingSwings: null,
      walked: null,
      usedCart: isRound ? true : null,
      competition: false,
      suggestedRpe,
      mentalPressure: null,
      physicalDemand: null,
      volumeLabel: isRound
        ? `${holesPlayed ?? 18} holes${shotCount > 0 ? ` · ${shotCount} shots` : ""}`
        : `${shotCount} swings`,
      detail: isRound
        ? "Suggested from a saved round. Switch cart/walking in the full form if needed."
        : "Suggested from an imported launch-monitor session.",
    });
  }

  for (const row of practiceRows) {
    const date = row.completedAt ?? row.plannedAt;
    if (!date || row.status === "planned") {
      continue;
    }

    const swings = row.recordedShots > 0 ? row.recordedShots : row.targetShots;
    suggestions.push({
      key: sourceKey("practice", row.id),
      sourceType: "practice",
      sourceId: row.id,
      title: row.title,
      sessionDate: toDateKey(date),
      durationMinutes: null,
      holesPlayed: null,
      totalSwings: swings,
      fullSwings: null,
      shortGameSwings: null,
      puttingSwings: null,
      walked: null,
      usedCart: null,
      competition: false,
      suggestedRpe: row.focusArea.includes("short") || row.focusArea.includes("putt") ? 3 : 4,
      mentalPressure: null,
      physicalDemand: null,
      volumeLabel: `${swings} planned/recorded reps`,
      detail: "Suggested from a completed Fore King Hell practice session.",
    });
  }

  for (const row of speedRows) {
    const sourceType: TrainingSourceType = row.source === "manual" ? "manual" : "launch_monitor";

    suggestions.push({
      key: sourceKey(sourceType, row.id),
      sourceType,
      sourceId: row.id,
      title: row.title ?? `${row.implementLabel ?? "Speed"} session`,
      sessionDate: toDateKey(row.sessionDate),
      durationMinutes: null,
      holesPlayed: null,
      totalSwings: row.swingCount,
      fullSwings: row.swingCount,
      shortGameSwings: null,
      puttingSwings: null,
      walked: null,
      usedCart: null,
      competition: false,
      suggestedRpe:
        row.maxSpeedMph && row.avgSpeedMph && row.maxSpeedMph - row.avgSpeedMph > 8 ? 9 : 8,
      mentalPressure: null,
      physicalDemand: 8,
      volumeLabel: `${row.swingCount} speed swings`,
      detail: "Suggested from Speed Centre. Speed work starts higher on the RPE scale.",
    });
  }

  return suggestions.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}

async function getShotCountsForSessions(userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await getDb()
    .select({
      sessionId: shots.sessionId,
      shotCount: count(shots.id),
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), inArray(shots.sessionId, sessionIds)))
    .groupBy(shots.sessionId);

  return new Map(rows.map((row) => [row.sessionId, row.shotCount]));
}

function sourceTypeForSession(source: string, type: string): TrainingSourceType {
  if (isRoundHistorySession({ type })) {
    return "round";
  }

  const normalizedSource = source.toLowerCase();

  if (["rapsodo", "trackman", "square"].some((provider) => normalizedSource.includes(provider))) {
    return "launch_monitor";
  }

  return "imported";
}

function providerLabel(source: string) {
  if (source.toLowerCase().includes("rapsodo")) {
    return "Rapsodo";
  }

  if (source.toLowerCase().includes("trackman")) {
    return "TrackMan";
  }

  if (source.toLowerCase().includes("square")) {
    return "Square";
  }

  return "Launch monitor";
}

function buildSummaryMetric(value: number, previousWeekValue: number): TrainingSummaryMetric {
  return {
    value,
    previousWeekValue,
    change: value - previousWeekValue,
  };
}

function toTrainingSessionListItem(row: TrainingSessionDbRow): TrainingSessionListItem {
  return {
    ...row,
    sourceType: row.sourceType as TrainingSourceType,
    sessionDate: toDateKey(row.sessionDate),
    sessionLoad: Number(row.sessionLoad),
  };
}

function buildSessionMarkers(
  rows: Array<{
    title: string;
    sessionDate: string;
    sessionLoad: string | number;
  }>,
): TrainingSessionMarker[] {
  const markersByDate = new Map<string, TrainingSessionMarker>();

  for (const row of rows) {
    const date = toDateKey(row.sessionDate);
    const existing = markersByDate.get(date);

    if (existing) {
      existing.sessionCount += 1;
      existing.totalLoad += Number(row.sessionLoad);
      existing.title = `${existing.sessionCount} sessions`;
      continue;
    }

    markersByDate.set(date, {
      date,
      sessionCount: 1,
      totalLoad: Number(row.sessionLoad),
      title: row.title,
    });
  }

  return [...markersByDate.values()];
}

function buildTrainingConfidence(
  sessions: TrainingSessionListItem[],
  sessionFormSignal: SessionFormSignal,
  today: string,
): TrainingConfidence {
  const cutoffDate = subtractDays(today, CONFIDENCE_LOOKBACK_DAYS - 1);
  const recentSessions = sessions.filter((session) => session.sessionDate >= cutoffDate);

  if (recentSessions.length === 0) {
    return {
      score: 0,
      label: "No confidence yet",
      detail: "Log recent rounds or practice to build a confidence signal.",
    };
  }

  const totalVolume = recentSessions.reduce(
    (total, session) => total + confidenceVolume(session),
    0,
  );
  const activeDays = new Set(recentSessions.map((session) => session.sessionDate)).size;
  const sourceTypes = new Set(recentSessions.map((session) => session.sourceType)).size;
  const latestSessionDate = recentSessions.reduce(
    (latest, session) => maxDateKey(latest, session.sessionDate),
    recentSessions[0]!.sessionDate,
  );
  const daysSinceLatest = daysBetween(latestSessionDate, today);
  const volumeScore = clamp((totalVolume / 500) * 30, 0, 30);
  const frequencyScore = clamp((activeDays / 8) * 20, 0, 20);
  const recencyScore = daysSinceLatest <= 7 ? 15 : daysSinceLatest <= 14 ? 10 : 5;
  const sourceScore = clamp((sourceTypes - 1) * 4, 0, 8);
  const comparisonScore =
    sessionFormSignal.confidence === "high"
      ? 20
      : sessionFormSignal.confidence === "medium"
        ? 14
        : 7;
  const score = Math.round(
    clamp(volumeScore + frequencyScore + recencyScore + sourceScore + comparisonScore, 0, 100),
  );

  return {
    score,
    label: confidenceLabel(score),
    detail: `${recentSessions.length} recent sessions - ${Math.round(totalVolume).toLocaleString("en-GB")} sample volume - ${sessionFormSignal.confidence} comparison strength`,
  };
}

function confidenceVolume(session: TrainingSessionListItem) {
  const swingVolume =
    session.totalSwings ??
    [session.fullSwings, session.shortGameSwings, session.puttingSwings]
      .filter((value): value is number => typeof value === "number")
      .reduce((total, value) => total + value, 0);

  if (swingVolume > 0) {
    return swingVolume;
  }

  if (session.holesPlayed) {
    return session.holesPlayed * 5;
  }

  if (session.durationMinutes) {
    return session.durationMinutes;
  }

  return Math.max(1, session.sessionLoad / Math.max(1, session.rpe));
}

function confidenceLabel(score: number) {
  if (score >= 80) {
    return "High confidence";
  }

  if (score >= 65) {
    return "Good confidence";
  }

  if (score >= 45) {
    return "Building confidence";
  }

  return "Low confidence";
}

async function buildHistoricalSessionFormAdjustments(
  userId: string,
  sessions: TrainingSessionListItem[],
): Promise<DailyFormAdjustment[]> {
  if (sessions.length < 2) {
    return [];
  }

  const snapshots = await buildSessionSnapshotRows(userId, sessions);
  const snapshotGroups = buildSessionSnapshotGroups(snapshots).sort((a, b) =>
    a.date === b.date ? a.kind.localeCompare(b.kind) : a.date.localeCompare(b.date),
  );
  const previousByKind = new Map<SessionFormSnapshot["kind"], SessionFormSnapshot>();
  const adjustmentsByDate = new Map<string, number>();

  for (const group of snapshotGroups) {
    const previousSnapshot = previousByKind.get(group.kind);

    if (previousSnapshot) {
      const signal = calculateSessionFormSignal(group.snapshot, previousSnapshot);

      if (signal.adjustment !== 0 && signal.direction !== "unknown") {
        const weightedAdjustment = signal.adjustment * formAdjustmentWeight(group.snapshot);
        adjustmentsByDate.set(
          group.date,
          (adjustmentsByDate.get(group.date) ?? 0) + weightedAdjustment,
        );
      }
    }

    previousByKind.set(group.kind, group.snapshot);
  }

  return [...adjustmentsByDate.entries()].map(([date, adjustment]) => ({ date, adjustment }));
}

function formAdjustmentWeight(snapshot: SessionFormSnapshot) {
  if (snapshot.kind === "round") {
    return snapshot.sampleSize >= 18 ? 1 : 0.7;
  }

  if (snapshot.kind === "shots") {
    if (snapshot.sampleSize >= 40) {
      return 1;
    }

    if (snapshot.sampleSize >= 20) {
      return 0.6;
    }

    return 0.3;
  }

  if (snapshot.kind === "speed") {
    return 0.4;
  }

  return 0.4;
}

async function buildLatestSessionFormSignal(
  userId: string,
  recentSessions: TrainingSessionListItem[],
): Promise<SessionFormSignal> {
  const latestSession = recentSessions[0];
  if (!latestSession) {
    return neutralSessionFormSignal;
  }

  const snapshotRows = await buildSessionSnapshotRows(userId, recentSessions);
  const latestSnapshotRow = snapshotRows.find((row) => row.session.id === latestSession.id);

  if (!latestSnapshotRow) {
    return neutralSessionFormSignal;
  }

  const snapshotGroups = buildSessionSnapshotGroups(snapshotRows).sort((a, b) =>
    b.date === a.date ? b.kind.localeCompare(a.kind) : b.date.localeCompare(a.date),
  );
  const latestGroup = snapshotGroups.find(
    (group) =>
      group.date === latestSession.sessionDate && group.kind === latestSnapshotRow.snapshot.kind,
  );
  const previousGroup = snapshotGroups.find(
    (group) =>
      group.kind === latestSnapshotRow.snapshot.kind && group.date < latestSession.sessionDate,
  );

  if (!latestGroup || !previousGroup) {
    return neutralSessionFormSignal;
  }

  return calculateSessionFormSignal(latestGroup.snapshot, previousGroup.snapshot);
}

async function buildSessionSnapshotRows(
  userId: string,
  sessions: TrainingSessionListItem[],
): Promise<SessionSnapshotRow[]> {
  return Promise.all(
    sessions.map(async (session) => ({
      session,
      snapshot: (await buildSessionFormSnapshot(userId, session)) ?? loadSnapshot(session),
    })),
  );
}

function buildSessionSnapshotGroups(rows: SessionSnapshotRow[]): SessionSnapshotGroup[] {
  const rowsByKey = new Map<string, SessionSnapshotRow[]>();

  for (const row of rows) {
    const key = `${row.session.sessionDate}:${row.snapshot.kind}`;
    const existing = rowsByKey.get(key);

    if (existing) {
      existing.push(row);
    } else {
      rowsByKey.set(key, [row]);
    }
  }

  return [...rowsByKey.values()].flatMap((groupRows) => {
    const first = groupRows[0]!;
    const snapshot = aggregateSessionFormSnapshots(
      groupRows.map((row) => row.snapshot),
      `${groupRows.length} ${sessionKindLabel(first.snapshot.kind)}`,
    );

    return snapshot
      ? [
          {
            date: first.session.sessionDate,
            kind: snapshot.kind,
            snapshot,
          },
        ]
      : [];
  });
}

function sessionKindLabel(kind: SessionFormSnapshot["kind"]) {
  switch (kind) {
    case "round":
      return "rounds";
    case "shots":
      return "practice blocks";
    case "speed":
      return "speed blocks";
    default:
      return "load entries";
  }
}

async function buildSessionFormSnapshot(
  userId: string,
  session: TrainingSessionListItem,
): Promise<SessionFormSnapshot | null> {
  if (!session.sourceId) {
    return null;
  }

  if (session.sourceType === "round") {
    return buildRoundFormSnapshot(userId, session);
  }

  if (session.sourceType === "launch_monitor" || session.sourceType === "imported") {
    return (
      (await buildShotFormSnapshot(userId, session)) ??
      (await buildSpeedFormSnapshot(userId, session))
    );
  }

  if (session.sourceType === "manual") {
    return buildSpeedFormSnapshot(userId, session);
  }

  return null;
}

async function buildRoundFormSnapshot(userId: string, session: TrainingSessionListItem) {
  if (!session.sourceId) {
    return null;
  }

  const [row] = await getDb()
    .select({
      scorecardJson: sessions.scorecardJson,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.id, session.sourceId)))
    .limit(1);
  const scorecard = row?.scorecardJson ?? [];
  const scoringHoles = scorecard.filter(
    (hole) => typeof hole.score === "number" && typeof hole.par === "number",
  );

  if (scoringHoles.length === 0) {
    return null;
  }

  const score = scoringHoles.reduce((total, hole) => total + (hole.score ?? 0), 0);
  const par = scoringHoles.reduce((total, hole) => total + hole.par, 0);

  return {
    kind: "round",
    title: session.title,
    sampleSize: scoringHoles.length,
    scoreToParPer18: ((score - par) / scoringHoles.length) * 18,
    sessionLoad: session.sessionLoad,
    rpe: session.rpe,
  } satisfies SessionFormSnapshot;
}

async function buildShotFormSnapshot(userId: string, session: TrainingSessionListItem) {
  if (!session.sourceId) {
    return null;
  }

  const rows = await getDb()
    .select({
      carryYd: shots.carryYd,
      ballSpeedMph: shots.ballSpeedMph,
      sideCarryYd: shots.sideCarryYd,
      launchDirectionDeg: shots.launchDirectionDeg,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.sessionId, session.sourceId)));

  if (rows.length < 5) {
    return null;
  }

  const carryValues = numbers(rows.map((row) => row.carryYd));
  const ballSpeedValues = numbers(rows.map((row) => row.ballSpeedMph));
  const offlineValues = numbers(rows.map((row) => row.sideCarryYd)).map(Math.abs);
  const directionalRows = rows.filter(
    (row) => typeof row.sideCarryYd === "number" || typeof row.launchDirectionDeg === "number",
  );
  const playableRows = directionalRows.filter((row) => {
    const offlinePlayable =
      typeof row.sideCarryYd === "number" ? Math.abs(row.sideCarryYd) <= 30 : false;
    const startLinePlayable =
      typeof row.launchDirectionDeg === "number" ? Math.abs(row.launchDirectionDeg) <= 10 : false;
    return offlinePlayable || startLinePlayable;
  });

  return {
    kind: "shots",
    title: session.title,
    sampleSize: rows.length,
    averageOfflineYd: mean(offlineValues),
    playableRate:
      directionalRows.length > 0 ? (playableRows.length / directionalRows.length) * 100 : null,
    carryAverageYd: mean(carryValues),
    ballSpeedAverageMph: mean(ballSpeedValues),
    carryStdDevYd: stddev(carryValues),
    sessionLoad: session.sessionLoad,
    rpe: session.rpe,
  } satisfies SessionFormSnapshot;
}

async function buildSpeedFormSnapshot(userId: string, session: TrainingSessionListItem) {
  if (!session.sourceId) {
    return null;
  }

  const [row] = await getDb()
    .select({
      swingCount: speedTrainingSessions.swingCount,
      maxSpeedMph: speedTrainingSessions.maxSpeedMph,
      avgSpeedMph: speedTrainingSessions.avgSpeedMph,
    })
    .from(speedTrainingSessions)
    .where(
      and(eq(speedTrainingSessions.userId, userId), eq(speedTrainingSessions.id, session.sourceId)),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    kind: "speed",
    title: session.title,
    sampleSize: row.swingCount,
    maxSpeedMph: row.maxSpeedMph,
    averageSpeedMph: row.avgSpeedMph,
    sessionLoad: session.sessionLoad,
    rpe: session.rpe,
  } satisfies SessionFormSnapshot;
}

function loadSnapshot(session: TrainingSessionListItem): SessionFormSnapshot {
  return {
    kind: "load",
    title: session.title,
    sampleSize: 1,
    sessionLoad: session.sessionLoad,
    rpe: session.rpe,
  };
}

function buildEfficiencyCards(averageTrainingLoad: number) {
  const loadLabel =
    averageTrainingLoad > 0 ? `${Math.round(averageTrainingLoad)} avg load` : "No load yet";

  return [
    {
      title: "Are you improving while load stays stable?",
      detail: "Future overlay: scoring, handicap and strokes-gained trend against practice load.",
      metric: loadLabel,
    },
    {
      title: "Is speed increasing without higher RPE?",
      detail: "Future overlay: clubhead speed and ball speed against speed-session effort.",
      metric: "Speed overlay ready",
    },
    {
      title: "Is scoring improving without acute-load spikes?",
      detail:
        "Future overlay: scoring average, fairways, greens and dispersion alongside acute load.",
      metric: "Performance overlay ready",
    },
  ];
}

function sourceKey(sourceType: TrainingSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

function subtractDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function firstDateKey(dateKeys: string[]) {
  const sortedDateKeys = dateKeys.filter(Boolean).sort();
  return sortedDateKeys[0] ?? null;
}

function maxDateKey(a: string, b: string) {
  return a >= b ? a : b;
}

function daysBetween(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDateKey}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function numbers(values: Array<number | null>) {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);
  if (average === null) {
    return null;
  }

  const variance =
    values.reduce((total, value) => total + Math.pow(value - average, 2), 0) / values.length;

  return Math.sqrt(variance);
}

export function suggestedSessionLoad(
  suggestion: TrainingSourceSuggestion,
  rpe = suggestion.suggestedRpe,
) {
  return calculateSessionLoad({
    durationMinutes: suggestion.durationMinutes,
    holesPlayed: suggestion.holesPlayed,
    totalSwings: suggestion.totalSwings,
    fullSwings: suggestion.fullSwings,
    shortGameSwings: suggestion.shortGameSwings,
    puttingSwings: suggestion.puttingSwings,
    walked: suggestion.walked,
    competition: suggestion.competition,
    mentalPressure: suggestion.mentalPressure,
    rpe,
  });
}

export function suggestedSessionVolume(suggestion: TrainingSourceSuggestion) {
  return calculateSessionVolume({
    durationMinutes: suggestion.durationMinutes,
    holesPlayed: suggestion.holesPlayed,
    totalSwings: suggestion.totalSwings,
    fullSwings: suggestion.fullSwings,
    shortGameSwings: suggestion.shortGameSwings,
    puttingSwings: suggestion.puttingSwings,
    walked: suggestion.walked,
    competition: suggestion.competition,
    mentalPressure: suggestion.mentalPressure,
    rpe: suggestion.suggestedRpe,
  });
}
