import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { rapsodoSyncSessions, sessions, shots, teeSets } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  calculateHandicapSummary,
  calculatePlayingHandicapSummary,
  calculateRoundDifferential,
  handicapBandFromValue,
  normaliseHandicapRoundInput,
} from "@/lib/round-handicap";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";

export type HandicapRound = Awaited<ReturnType<typeof getHandicapRoundsForUser>>[number];

export async function getCurrentHandicapRounds() {
  return getHandicapRoundsForUser(await requireCurrentUserId());
}

export async function getCurrentHandicapProfile() {
  return getUserHandicapProfile(await requireCurrentUserId());
}

export async function getUserHandicapProfile(userId: string) {
  const rounds = await getHandicapRoundsForUser(userId);
  const realRounds = rounds.filter((round) => round.type === "real_round");
  const simulatorRounds = rounds.filter((round) => round.type !== "real_round");
  const realHandicap = calculateHandicapSummary(
    realRounds.map((round) => round.handicapDifferential),
  );
  const simulatorHandicap = calculateHandicapSummary(
    simulatorRounds.map((round) => round.handicapDifferential),
  );
  const combinedHandicap = calculateHandicapSummary(
    rounds.map((round) => round.handicapDifferential),
  );
  const playingHandicap = calculatePlayingHandicapSummary(
    rounds.map((round) => ({
      handicapDifferential: round.handicapDifferential,
      type: round.type,
    })),
  );
  const displayValue =
    playingHandicap.value ??
    realHandicap.value ??
    combinedHandicap.value ??
    simulatorHandicap.value;

  return {
    rounds,
    realHandicap,
    simulatorHandicap,
    combinedHandicap,
    playingHandicap,
    displayValue,
    band: handicapBandFromValue(displayValue),
    sourceLabel:
      playingHandicap.value !== null
        ? "Realistic playing estimate"
        : realHandicap.value !== null
          ? "Real best-form estimate"
          : combinedHandicap.value !== null
            ? "Combined score differentials"
            : simulatorHandicap.value !== null
              ? "Simulator best-form estimate"
              : "No eligible score differentials",
  };
}

export async function getHandicapRoundsForUser(userId: string) {
  const db = getDb();
  const [sessionRows, shotCounts] = await Promise.all([
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
        sessionId: shots.sessionId,
        count: count(),
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.sessionId),
  ]);
  const shotCountBySessionId = new Map(shotCounts.map((row) => [row.sessionId, row.count]));

  return sessionRows.filter(isRoundHistorySession).map((session) => {
    const scorecard = session.scorecardJson ?? [];
    const rawTotalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
    const rawTotalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
    const rawTotalPar =
      scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
    const handicapInput = normaliseHandicapRoundInput({
      totalScore: rawTotalScore,
      totalPar: rawTotalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
      holesPlayed: scorecard.length,
    });
    const handicapDifferential = calculateRoundDifferential(handicapInput);

    return {
      ...session,
      courseRating: handicapInput.courseRating,
      totalScore: handicapInput.totalScore,
      totalPutts: handicapInput.isNineHoleEquivalent
        ? doubleNullable(rawTotalPutts)
        : rawTotalPutts,
      totalPar: handicapInput.totalPar ?? null,
      handicapDifferential,
      holesPlayed: handicapInput.holesPlayed ?? null,
      originalHolesPlayed: handicapInput.originalHolesPlayed,
      isNineHoleEquivalent: handicapInput.isNineHoleEquivalent,
      shotCount: shotCountBySessionId.get(session.id) ?? 0,
    };
  });
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function doubleNullable(value: number | null) {
  return typeof value === "number" ? value * 2 : null;
}
