import { and, desc, eq, isNotNull } from "drizzle-orm";

import {
  clubs,
  sessions,
  shots,
  speedTrainingSessions,
  stockYardages,
  strokesGainedShotEvents,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { formatClubType } from "@/lib/club-format";
import { summarizeStrokesGainedByCategory } from "@/lib/strokes-gained";

export type CoachSqlCitation = {
  id: string;
  label: string;
  detail: string;
  href: string | null;
};

export type CoachSqlContext = {
  question: string;
  contextText: string;
  citations: CoachSqlCitation[];
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export async function buildCoachSqlContext(
  userId: string,
  question: string,
): Promise<CoachSqlContext> {
  const db = getDb();
  const [
    clubRows,
    stockRows,
    recentShotRows,
    roundRows,
    strokesGainedRows,
    speedRows,
    driverSpeedRows,
  ] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
    db
      .select({
        clubId: stockYardages.clubId,
        sampleSize: stockYardages.sampleSize,
        carryMedianYd: stockYardages.carryMedianYd,
        recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
        dispersionLeftYd: stockYardages.dispersionLeftYd,
        dispersionRightYd: stockYardages.dispersionRightYd,
        confidenceScore: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt))
      .limit(24),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        shotAt: shots.shotAt,
        clubType: shots.clubType,
        shotNumber: shots.shotNumber,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        launchAngleDeg: shots.launchAngleDeg,
        clubSpeedMph: shots.clubSpeedMph,
        ballSpeedMph: shots.ballSpeedMph,
        shotCategory: shots.shotCategory,
        fileName: sessions.fileName,
        courseName: sessions.courseName,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(and(eq(shots.userId, userId), eq(sessions.userId, userId)))
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber))
      .limit(40),
    db
      .select({
        id: sessions.id,
        date: sessions.date,
        type: sessions.type,
        courseName: sessions.courseName,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.scorecardJson)))
      .orderBy(desc(sessions.date))
      .limit(8),
    db
      .select({
        id: strokesGainedShotEvents.id,
        sessionId: strokesGainedShotEvents.sessionId,
        category: strokesGainedShotEvents.category,
        startLie: strokesGainedShotEvents.startLie,
        endLie: strokesGainedShotEvents.endLie,
        startDistanceYd: strokesGainedShotEvents.startDistanceYd,
        endDistanceYd: strokesGainedShotEvents.endDistanceYd,
        strokesGained: strokesGainedShotEvents.strokesGained,
      })
      .from(strokesGainedShotEvents)
      .where(eq(strokesGainedShotEvents.userId, userId))
      .orderBy(desc(strokesGainedShotEvents.createdAt))
      .limit(80),
    db
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
      .where(eq(speedTrainingSessions.userId, userId))
      .orderBy(desc(speedTrainingSessions.sessionDate))
      .limit(8),
    db
      .select({
        shotAt: shots.shotAt,
        clubSpeedMph: shots.clubSpeedMph,
      })
      .from(shots)
      .where(
        and(eq(shots.userId, userId), eq(shots.clubType, "driver"), isNotNull(shots.clubSpeedMph)),
      )
      .orderBy(desc(shots.shotAt))
      .limit(200),
  ]);
  const clubLabelById = new Map(
    clubRows.map((club) => [
      club.id,
      [formatClubType(club.type), club.brand, club.model].filter(Boolean).join(" - "),
    ]),
  );
  const citations: CoachSqlCitation[] = [];
  const stockLines = stockRows.slice(0, 12).map((row, index) => {
    const label = clubLabelById.get(row.clubId) ?? "Unknown club";
    citations.push({
      id: `stock-${row.clubId}`,
      label: `${label} stock yardage`,
      detail: `${row.sampleSize} shots, ${formatNumber(row.confidenceScore)}% confidence`,
      href: `/bag/${row.clubId}`,
    });
    return `${index + 1}. ${label}: play ${formatNumber(row.recommendedPlayNumberYd)} yd, median carry ${formatNumber(row.carryMedianYd)} yd, left/right dispersion ${formatNumber(row.dispersionLeftYd)}/${formatNumber(row.dispersionRightYd)} yd, confidence ${formatNumber(row.confidenceScore)}%.`;
  });
  const shotLines = recentShotRows.slice(0, 20).map((shot, index) => {
    citations.push({
      id: `shot-${shot.id}`,
      label: `${formatClubType(shot.clubType)} shot ${shot.shotNumber ?? index + 1}`,
      detail: `${formatNumber(shot.carryYd)} carry, ${formatNumber(shot.sideCarryYd)} side`,
      href: `/shots?sessionId=${shot.sessionId}`,
    });
    return `${index + 1}. ${formatClubType(shot.clubType)} ${shot.shotCategory}: ${formatNumber(shot.carryYd)} carry, ${formatNumber(shot.totalYd)} total, ${formatNumber(shot.sideCarryYd)} side, ${formatNumber(shot.launchAngleDeg)} launch, ${formatNumber(shot.clubSpeedMph)} club mph, ${formatNumber(shot.ballSpeedMph)} ball mph (${shot.courseName ?? shot.fileName ?? "session"}).`;
  });
  const roundLines = roundRows.map((round, index) => {
    const totalScore =
      round.scorecardJson?.reduce((total, hole) => total + (hole.score ?? 0), 0) ?? 0;
    const totalPar = round.scorecardJson?.reduce((total, hole) => total + (hole.par ?? 0), 0) ?? 0;
    citations.push({
      id: `round-${round.id}`,
      label: round.courseName ?? `Round ${index + 1}`,
      detail: `${totalScore || "--"} on par ${totalPar || "--"}`,
      href: `/rounds/${round.id}`,
    });
    return `${index + 1}. ${round.courseName ?? round.type}: ${totalScore || "unknown"} on par ${totalPar || "unknown"} from ${round.scorecardJson?.length ?? 0} holes.`;
  });
  const strokesGainedLines = summarizeStrokesGainedByCategory(strokesGainedRows).map(
    (summary, index) => {
      citations.push({
        id: `sg-${summary.category}`,
        label: `${summary.category} strokes gained`,
        detail: `${summary.sampleSize} events, ${formatNumber(summary.total)} total`,
        href: "/strokes-gained",
      });
      return `${index + 1}. ${summary.category}: ${formatNumber(summary.total)} total, ${formatNumber(summary.average)} average, ${summary.sampleSize} events.`;
    },
  );
  const speedLines = speedRows.map((row, index) => {
    const label = row.implementLabel ?? labelForSpeedImplement(row.implementKind);
    citations.push({
      id: `speed-${row.id}`,
      label: `${label} speed session`,
      detail: `${formatNumber(row.avgSpeedMph)} avg, ${formatNumber(row.maxSpeedMph)} max`,
      href: "/speed",
    });
    return `${index + 1}. ${label}: ${formatNumber(row.avgSpeedMph)} mph average, ${formatNumber(row.maxSpeedMph)} mph max, ${row.swingCount} swings, target ${formatNumber(row.targetSpeedMph)} mph.`;
  });
  const driverSpeeds = driverSpeedRows
    .map((row) => row.clubSpeedMph)
    .filter((value): value is number => value !== null);
  const driverLast20AvgMph = average(driverSpeeds.slice(0, 20));
  const driverPbMph = driverSpeeds.length > 0 ? Math.max(...driverSpeeds) : null;
  const latestDrySpeedMph = speedRows[0]?.avgSpeedMph ?? null;
  const dryVsBallGapMph =
    latestDrySpeedMph !== null && driverLast20AvgMph !== null
      ? latestDrySpeedMph - driverLast20AvgMph
      : null;

  if (driverLast20AvgMph !== null || latestDrySpeedMph !== null) {
    citations.push({
      id: "speed-driver-current",
      label: "Driver speed context",
      detail: `${formatNumber(driverLast20AvgMph)} with-ball avg, ${formatNumber(latestDrySpeedMph)} dry avg`,
      href: "/speed",
    });
  }

  return {
    question,
    citations: dedupeCitations(citations).slice(0, 12),
    contextText: [
      "LM World Tour SQL context. Use only these cited personal-data facts. If the data is insufficient, say exactly what is missing.",
      `Question: ${question}`,
      stockLines.length
        ? `Stock yardages:\n${stockLines.join("\n")}`
        : "Stock yardages: none available.",
      shotLines.length ? `Recent shots:\n${shotLines.join("\n")}` : "Recent shots: none available.",
      roundLines.length
        ? `Recent rounds:\n${roundLines.join("\n")}`
        : "Recent rounds: none available.",
      strokesGainedLines.length
        ? `Strokes gained:\n${strokesGainedLines.join("\n")}`
        : "Strokes gained: no event rows available.",
      speedLines.length || driverLast20AvgMph !== null
        ? `Speed Centre:\n${[
            `Driver with-ball: ${formatNumber(driverLast20AvgMph)} mph last-20 average, ${formatNumber(driverPbMph)} mph personal best.`,
            `Latest dry speed session: ${formatNumber(latestDrySpeedMph)} mph average.`,
            `Dry minus with-ball gap: ${formatNumber(dryVsBallGapMph)} mph.`,
            ...speedLines,
          ].join("\n")}`
        : "Speed Centre: no speed training sessions logged.",
    ].join("\n\n"),
  };
}

function dedupeCitations(citations: CoachSqlCitation[]) {
  const byId = new Map<string, CoachSqlCitation>();

  for (const citation of citations) {
    byId.set(citation.id, citation);
  }

  return [...byId.values()];
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "--";
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function labelForSpeedImplement(kind: string) {
  switch (kind) {
    case "speed_stick":
      return "Speed stick";
    case "weighted_club":
      return "Weighted club";
    case "club":
      return "Golf club";
    default:
      return "Speed implement";
  }
}
