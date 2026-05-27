import "server-only";

import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  clubs,
  importRows,
  rapsodoSyncSessions,
  sessions,
  shots,
  teeSets,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import {
  formatSignedNumber,
  formatSignedYards,
  integerFormatter,
  numberFormatter,
} from "@/app/dashboard/dashboard-formatters";
import { buildCoachSummary } from "@/lib/coach";
import { buildCourseDecisionAdvice, getClubDecisionLabel } from "@/lib/course-decision-advice";
import {
  clubSortValue,
  formatClubType,
  isShortGameTouchClubType,
  isTrackedClubType,
} from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import { calculateHandicapSummary, calculateRoundDifferential } from "@/lib/round-handicap";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import { calculateStockYardage } from "@/lib/stock-yardage";
import { dashboardPinOptions, type DashboardPin } from "@/lib/user-settings";

export async function getDashboardData() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [
    [shotCount],
    [rawRowCount],
    [sessionCount],
    [profile],
    recentSessionRows,
    roundRows,
    allClubRows,
    shotCountsByClub,
    recentStockShots,
    [pendingRapsodoCount],
    pendingRapsodoRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
    db.select({ value: count() }).from(importRows).where(eq(importRows.userId, userId)),
    db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
    db
      .select({ dashboardPins: users.dashboardPins })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date), asc(sessions.fileName))
      .limit(5),
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
        scorecardJson: sessions.scorecardJson,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes])))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        clubId: shots.clubId,
        count: count(),
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.clubId),
    db
      .select({
        id: shots.id,
        clubId: shots.clubId,
        shotAt: shots.shotAt,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        courseHoleNumber: shots.courseHoleNumber,
        sessionType: sessions.type,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(eq(shots.userId, userId))
      .orderBy(desc(shots.shotAt))
      .limit(500),
    db
      .select({ value: count() })
      .from(rapsodoSyncSessions)
      .where(
        and(eq(rapsodoSyncSessions.userId, userId), isNull(rapsodoSyncSessions.importedSessionId)),
      ),
    db
      .select({
        id: rapsodoSyncSessions.id,
        title: rapsodoSyncSessions.title,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
        sessionDate: rapsodoSyncSessions.sessionDate,
        rawMetadataJson: rapsodoSyncSessions.rawMetadataJson,
        lastSeenAt: rapsodoSyncSessions.lastSeenAt,
      })
      .from(rapsodoSyncSessions)
      .where(
        and(eq(rapsodoSyncSessions.userId, userId), isNull(rapsodoSyncSessions.importedSessionId)),
      )
      .orderBy(desc(rapsodoSyncSessions.lastSeenAt), desc(rapsodoSyncSessions.sessionDate))
      .limit(5),
  ]);
  const clubRows = allClubRows.filter((club) => isTrackedClubType(club.type));

  const recentSessionIds = recentSessionRows.map((session) => session.id);
  const [shotCountsBySession, rawCountsBySession] =
    recentSessionIds.length > 0
      ? await Promise.all([
          db
            .select({
              sessionId: shots.sessionId,
              count: count(),
            })
            .from(shots)
            .where(and(eq(shots.userId, userId), inArray(shots.sessionId, recentSessionIds)))
            .groupBy(shots.sessionId),
          db
            .select({
              sessionId: importRows.sessionId,
              count: count(),
            })
            .from(importRows)
            .where(
              and(eq(importRows.userId, userId), inArray(importRows.sessionId, recentSessionIds)),
            )
            .groupBy(importRows.sessionId),
        ])
      : [[], []];

  const shotCountBySessionId = new Map(
    shotCountsBySession.map((row) => [row.sessionId, row.count]),
  );
  const rawCountBySessionId = new Map(rawCountsBySession.map((row) => [row.sessionId, row.count]));
  const shotCountByClubId = new Map(shotCountsByClub.map((row) => [row.clubId, row.count]));
  const stockShotsByClubId = new Map<string, typeof recentStockShots>();

  for (const shot of recentStockShots) {
    const clubShots = stockShotsByClubId.get(shot.clubId) ?? [];
    clubShots.push(shot);
    stockShotsByClubId.set(shot.clubId, clubShots);
  }

  const recentSessions = recentSessionRows.map((session) => ({
    ...session,
    shotCount: shotCountBySessionId.get(session.id) ?? 0,
    rawRowCount: rawCountBySessionId.get(session.id) ?? 0,
  }));

  const bag = clubRows
    .map((club) => {
      const clubShots = stockShotsByClubId.get(club.id) ?? [];
      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";
      const stock = calculateStockYardage(clubShots, 50, {
        clubType: club.type,
      });
      const touch = calculateShortGameTouchSummary(clubShots, 80, {
        clubType: club.type,
      });
      const isShortGameTouch = isShortGameTouchClubType(club.type);
      const decisionLabel = getClubDecisionLabel({
        isShortGameTouch,
        stockLabel: stock.label,
      });

      return {
        ...club,
        brandModel,
        isShortGameTouch,
        decisionLabel,
        shotCount: shotCountByClubId.get(club.id) ?? 0,
        stock,
        touch,
      };
    })
    .sort((left, right) => {
      const shotCountDifference = right.shotCount - left.shotCount;
      return shotCountDifference || clubSortValue(left.type) - clubSortValue(right.type);
    });
  const bagPreview = bag.slice(0, 5);
  const courseAdvice = buildCourseDecisionAdvice(bag);
  const roundSummaries = roundRows.filter(isRoundHistorySession).map(summarizeRound);
  const latestRound = roundSummaries[0] ?? null;
  const realHandicap = calculateHandicapSummary(
    roundSummaries
      .filter((round) => round.type === "real_round")
      .map((round) => round.handicapDifferential),
  );
  const simHandicap = calculateHandicapSummary(
    roundSummaries
      .filter((round) => round.type !== "real_round")
      .map((round) => round.handicapDifferential),
  );
  const combinedHandicap = calculateHandicapSummary(
    roundSummaries.map((round) => round.handicapDifferential),
  );
  const whatChanged = buildWhatChangedInsights({
    clubRows,
    stockShots: recentStockShots,
    bagPreview,
    latestRound,
  });
  const coachData = await getProgressData();
  const coachCard = buildCoachSummary(coachData.clubs).clubCards[0] ?? null;
  const pendingRapsodoSessions = pendingRapsodoRows.map((session) => ({
    ...session,
    title: session.title ?? "Rapsodo session",
    shotCount: numberFromMetadata(session.rawMetadataJson, [
      "shotCount",
      "shotcount",
      "shotsCount",
      "totalShots",
      "numberOfShots",
    ]),
  }));

  return {
    dashboardPins: normalizeDashboardPins(profile?.dashboardPins),
    stats: {
      shotCount: shotCount?.value ?? 0,
      rawRowCount: rawRowCount?.value ?? 0,
      sessionCount: sessionCount?.value ?? 0,
      clubCount: clubRows.length,
      roundCount: roundSummaries.length,
      realHandicap,
      simHandicap,
      combinedHandicap,
    },
    recentSessions,
    rapsodoInbox: {
      pendingCount: pendingRapsodoCount?.value ?? pendingRapsodoSessions.length,
      latest: pendingRapsodoSessions[0] ?? null,
    },
    latestRound,
    bagPreview,
    courseAdvice,
    whatChanged,
    coachPreview: coachCard
      ? {
          clubId: coachCard.clubId,
          clubName: coachCard.clubName,
          issueLabel: coachCard.issueLabel,
          reason: coachCard.reason,
          drill: coachCard.drill,
          tone: coachCard.tone,
          trustIndex: coachCard.trustIndex,
        }
      : null,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
export type DashboardInsight = ReturnType<typeof buildWhatChangedInsights>[number];

function normalizeDashboardPins(value: string[] | null | undefined): DashboardPin[] {
  const allowedPins = new Set<string>(dashboardPinOptions);
  const pins = (value ?? []).filter((pin): pin is DashboardPin => allowedPins.has(pin));

  return pins.length > 0 ? pins : [...dashboardPinOptions];
}

type InsightTone = "green" | "sky" | "amber" | "slate";

function buildWhatChangedInsights({
  clubRows,
  stockShots,
  bagPreview,
  latestRound,
}: {
  clubRows: Array<{ id: string; type: string }>;
  stockShots: Array<{
    clubId: string;
    shotAt: Date;
    carryYd: number | null;
    sideCarryYd: number | null;
    ballSpeedMph: number | null;
  }>;
  bagPreview: Array<{
    type: string;
    shotCount: number;
    stock: {
      confidenceScore: number;
      carryMedianYd: number | null;
      label: string;
    };
  }>;
  latestRound: ReturnType<typeof summarizeRound> | null;
}) {
  const clubTypeById = new Map(clubRows.map((club) => [club.id, club.type]));
  const now = new Date();
  const currentStart = daysBefore(now, 30);
  const previousStart = daysBefore(now, 60);
  const shotsByClub = new Map<string, typeof stockShots>();

  for (const shot of stockShots) {
    if (!clubTypeById.has(shot.clubId)) {
      continue;
    }

    const clubShots = shotsByClub.get(shot.clubId) ?? [];
    clubShots.push(shot);
    shotsByClub.set(shot.clubId, clubShots);
  }

  const clubChanges = [...shotsByClub.entries()]
    .map(([clubId, clubShots]) => {
      const currentShots = clubShots.filter((shot) => {
        const shotDate = new Date(shot.shotAt);
        return shotDate >= currentStart && shotDate <= now;
      });
      const previousShots = clubShots.filter((shot) => {
        const shotDate = new Date(shot.shotAt);
        return shotDate >= previousStart && shotDate < currentStart;
      });

      const currentCarry = median(currentShots.map((shot) => shot.carryYd).filter(isNumber));
      const previousCarry = median(previousShots.map((shot) => shot.carryYd).filter(isNumber));
      const currentMiss = averageNumber(
        currentShots
          .map((shot) => shot.sideCarryYd)
          .filter(isNumber)
          .map(Math.abs),
      );
      const previousMiss = averageNumber(
        previousShots
          .map((shot) => shot.sideCarryYd)
          .filter(isNumber)
          .map(Math.abs),
      );
      const currentBallSpeed = averageNumber(
        currentShots.map((shot) => shot.ballSpeedMph).filter(isNumber),
      );
      const previousBallSpeed = averageNumber(
        previousShots.map((shot) => shot.ballSpeedMph).filter(isNumber),
      );

      return {
        clubId,
        clubType: clubTypeById.get(clubId) ?? "club",
        currentCount: currentShots.length,
        previousCount: previousShots.length,
        carryDelta:
          currentCarry !== null && previousCarry !== null ? currentCarry - previousCarry : null,
        missDelta:
          currentMiss !== null && previousMiss !== null ? currentMiss - previousMiss : null,
        ballSpeedDelta:
          currentBallSpeed !== null && previousBallSpeed !== null
            ? currentBallSpeed - previousBallSpeed
            : null,
      };
    })
    .filter((change) => change.currentCount >= 3 && change.previousCount >= 3);

  const insights: Array<{
    label: string;
    value: string;
    detail: string;
    tone: InsightTone;
  }> = [];

  const strongestCarryChange = clubChanges
    .filter((change) => change.carryDelta !== null)
    .sort((left, right) => Math.abs(right.carryDelta ?? 0) - Math.abs(left.carryDelta ?? 0))[0];

  if (strongestCarryChange?.carryDelta !== null && strongestCarryChange?.carryDelta !== undefined) {
    insights.push({
      label: `${formatClubType(strongestCarryChange.clubType)} carry`,
      value: `${formatSignedYards(strongestCarryChange.carryDelta)} vs previous 30`,
      detail: `${strongestCarryChange.currentCount} recent shots compared with ${strongestCarryChange.previousCount} older shots.`,
      tone: strongestCarryChange.carryDelta >= 0 ? "green" : "amber",
    });
  }

  const strongestMissChange = clubChanges
    .filter((change) => change.missDelta !== null)
    .sort((left, right) => Math.abs(right.missDelta ?? 0) - Math.abs(left.missDelta ?? 0))[0];

  if (strongestMissChange?.missDelta !== null && strongestMissChange?.missDelta !== undefined) {
    const tighter = strongestMissChange.missDelta < 0;
    insights.push({
      label: `${formatClubType(strongestMissChange.clubType)} dispersion`,
      value: `${numberFormatter.format(Math.abs(strongestMissChange.missDelta))} yd ${tighter ? "tighter" : "wider"}`,
      detail: "Average left/right miss compared with the previous 30-day window.",
      tone: tighter ? "green" : "amber",
    });
  }

  const strongestSpeedChange = clubChanges
    .filter((change) => change.ballSpeedDelta !== null)
    .sort(
      (left, right) => Math.abs(right.ballSpeedDelta ?? 0) - Math.abs(left.ballSpeedDelta ?? 0),
    )[0];

  if (
    strongestSpeedChange?.ballSpeedDelta !== null &&
    strongestSpeedChange?.ballSpeedDelta !== undefined
  ) {
    insights.push({
      label: `${formatClubType(strongestSpeedChange.clubType)} speed`,
      value: `${formatSignedNumber(strongestSpeedChange.ballSpeedDelta)} mph`,
      detail: "Ball speed movement against the previous 30-day window.",
      tone: strongestSpeedChange.ballSpeedDelta >= 0 ? "sky" : "slate",
    });
  }

  if (latestRound && latestRound.totalScore !== null && latestRound.totalPar !== null) {
    const versusPar = latestRound.totalScore - latestRound.totalPar;
    insights.push({
      label: "Latest round",
      value: `${latestRound.totalScore} (${versusPar >= 0 ? "+" : ""}${versusPar})`,
      detail: "Review this round to keep recent form accurate.",
      tone: versusPar <= 10 ? "green" : "amber",
    });
  }

  const bestConfidenceClub = [...bagPreview].sort(
    (left, right) => right.stock.confidenceScore - left.stock.confidenceScore,
  )[0];

  if (bestConfidenceClub) {
    insights.push({
      label: "Most trusted club",
      value: `${formatClubType(bestConfidenceClub.type)} / ${Math.round(bestConfidenceClub.stock.confidenceScore)}%`,
      detail: `Reliable with ${integerFormatter.format(bestConfidenceClub.shotCount)} saved shots.`,
      tone: "green",
    });
  }

  const fillerOptions: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "slate";
  }> = [
    {
      label: "Data depth",
      value:
        bagPreview.length > 0
          ? `${integerFormatter.format(bagPreview.length)} clubs mapped`
          : "Import needed",
      detail:
        bagPreview.length > 0
          ? "Keep adding shots to unlock stronger trend comparisons."
          : "Upload a Rapsodo CSV to start building the personal baseline.",
      tone: "slate",
    },
    {
      label: "Next step",
      value: "Log a session",
      detail: "More recent shots produce sharper insight cards on this dashboard.",
      tone: "slate",
    },
    {
      label: "Coverage",
      value: bagPreview.length > 0 ? "Bag mapped" : "Bag not mapped",
      detail:
        bagPreview.length > 0
          ? "Refresh stock yardages from the bag page after each range session."
          : "Map every club so on-course distances become trustworthy.",
      tone: "slate",
    },
  ];

  let fillerIndex = 0;
  while (insights.length < 3 && fillerIndex < fillerOptions.length) {
    insights.push(fillerOptions[fillerIndex]);
    fillerIndex += 1;
  }

  return insights.slice(0, 3);
}

function summarizeRound(round: {
  id: string;
  fileName: string | null;
  type: string;
  courseName: string | null;
  date: Date;
  courseRating?: number | null;
  slopeRating?: number | null;
  scorecardJson: Array<{
    par: number;
    score?: number | null;
    putts?: number | null;
  }> | null;
}) {
  const scorecard = round.scorecardJson ?? [];
  const totalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
  const totalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
  const totalPar =
    scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
  const handicapDifferential = calculateRoundDifferential({
    totalScore,
    totalPar,
    courseRating: round.courseRating ?? null,
    slopeRating: round.slopeRating ?? null,
    holesPlayed: scorecard.length,
  });

  return {
    ...round,
    totalScore,
    totalPutts,
    totalPar,
    handicapDifferential,
  };
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function daysBefore(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() - days);
  return date;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function averageNumber(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function numberFromMetadata(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
