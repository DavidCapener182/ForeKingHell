import Link from "next/link";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { RoundsScoringIndex } from "@/app/rounds/rounds-scoring-index";
import type { RoundsWorkspaceRound } from "@/app/rounds/rounds-workspace";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { PageShell, StatusPill } from "@/components/premium";
import { rapsodoSyncSessions, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { isPlaywrightE2eAuthBypassEnabled, requireCurrentUserId } from "@/lib/current-user";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { reportServerFailure } from "@/lib/server-observability";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  formatHandicapValue,
} from "@/lib/round-handicap";

export const dynamic = "force-dynamic";

const handicapFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export default async function RoundsPage() {
  const [surface, rounds] = await Promise.all([getRequestAppSurface(), getRounds()]);
  const indexRounds = toWorkspaceRounds(rounds);
  const completedRounds = indexRounds.filter((round) => round.totalScore !== null).length;

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileRouteHeader title="Rounds" group="play" activeKey="rounds" />
      ) : (
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
      )}

      <header
        className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"
        data-rounds-workbench={surface === "workbench" ? "" : undefined}
        data-rounds-companion={surface === "companion" ? "" : undefined}
      >
        <div className="min-w-0">
          <StatusPill tone="sky">Scoring history</StatusPill>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Rounds</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Follow the score, see what changed your handicap, and carry one lesson into the next
            practice session.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {completedRounds} completed · {indexRounds.length} saved
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/import">
              <Upload className="size-4" />
              Import
            </Link>
          </Button>
          <Button asChild className="min-h-11" data-primary-action>
            <Link href="/rounds/new">
              <Plus className="size-4" />
              Add round
            </Link>
          </Button>
        </div>
      </header>

      <RoundsScoringIndex rounds={indexRounds} />
    </PageShell>
  );
}

async function getRounds() {
  try {
    return await getLiveRounds();
  } catch (error) {
    if (isPlaywrightE2eAuthBypassEnabled()) {
      reportServerFailure("rounds_e2e_fallback", error, {
        "app.route": "/rounds",
        "app.fallback": "empty_round_history",
      });
      return [];
    }

    throw error;
  }
}

async function getLiveRounds() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [sessionRows, shotCounts] = await Promise.all([
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
        roundStatus: sessions.roundStatus,
        scorecardJson: sessions.scorecardJson,
        teeName: teeSets.name,
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
    const totalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
    const totalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
    const totalPar =
      scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
    const handicapDifferential = calculateRoundDifferential({
      totalScore,
      totalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
      holesPlayed: scorecard.length,
    });

    return {
      ...session,
      shotCount: shotCountBySessionId.get(session.id) ?? 0,
      totalScore,
      totalPutts,
      totalPar,
      handicapDifferential,
    };
  });
}

function toWorkspaceRounds(rounds: Awaited<ReturnType<typeof getRounds>>): RoundsWorkspaceRound[] {
  return rounds.map((round, index) => {
    const scorecard = (round.scorecardJson ?? [])
      .slice()
      .sort((left, right) => left.holeNumber - right.holeNumber);
    const toPar =
      round.totalScore !== null && round.totalPar !== null
        ? round.totalScore - round.totalPar
        : null;
    const handicapImpact = handicapImpactForRound(rounds, index);

    return {
      id: round.id,
      courseName: round.courseName,
      fileName: round.fileName,
      teeName: round.teeName,
      dateLabel: formatDate(round.date),
      dateIso: round.date.toISOString(),
      type: round.type,
      typeLabel: formatSessionType(round.type),
      roundStatus: round.roundStatus,
      totalScore: round.totalScore,
      totalPar: round.totalPar,
      totalPutts: round.totalPutts,
      toPar,
      toParLabel: formatToPar(toPar),
      handicapDifferential: round.handicapDifferential,
      handicapDifferentialLabel: formatHandicapValue(round.handicapDifferential),
      handicapImpactLabel: handicapImpact.label,
      handicapImpactTone: handicapImpact.tone,
      mainVerdict: mainRoundVerdict(round),
      scoreSummary: scoreSummary(round.totalScore, toPar),
      shotCount: round.shotCount,
      dataLabel: round.shotCount > 0 ? `${round.shotCount} shot rows linked` : "Scorecard only",
      rowDataLabel: round.shotCount > 0 ? "Shot-linked" : "Scorecard only",
      statusLabel: round.shotCount > 0 ? "Shot-linked" : "Scorecard only",
      holeResults: scorecard.map(formatHoleResult),
      scorecardHoles: scorecard.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        yards: hole.yards,
        score: hole.score ?? null,
        putts: hole.putts ?? null,
        penalties: hole.penalties ?? null,
        shotCount: hole.csvShotCount ?? null,
      })),
    };
  });
}

function handicapImpactForRound(
  rounds: Awaited<ReturnType<typeof getRounds>>,
  index: number,
): { label: string; tone: "positive" | "attention" | "neutral" } {
  const differential = rounds[index]?.handicapDifferential;
  if (typeof differential !== "number") return { label: "Not eligible", tone: "neutral" };

  const current = calculateHandicapSummary(
    rounds.slice(index).map((round) => round.handicapDifferential),
  );
  const previous = calculateHandicapSummary(
    rounds.slice(index + 1).map((round) => round.handicapDifferential),
  );

  if (typeof current.value !== "number") return { label: "Not eligible", tone: "neutral" };
  if (typeof previous.value !== "number") {
    return { label: `Established ${formatHandicapValue(current.value)}`, tone: "neutral" };
  }

  const delta = current.value - previous.value;
  if (Math.abs(delta) < 0.05) return { label: "No change", tone: "neutral" };
  return delta < 0
    ? { label: `Improved by ${handicapFormatter.format(Math.abs(delta))}`, tone: "positive" }
    : { label: `Increased by ${handicapFormatter.format(delta)}`, tone: "attention" };
}

function mainRoundVerdict(round: Awaited<ReturnType<typeof getRounds>>[number]) {
  if (round.roundStatus === "in_progress") return "Finish the scorecard";
  if (round.totalScore === null || round.totalPar === null) return "Scorecard needs completing";

  const scoredHoles = (round.scorecardJson ?? []).filter(
    (hole): hole is typeof hole & { score: number } => typeof hole.score === "number",
  );
  const penaltyTotal = scoredHoles.reduce((total, hole) => total + (hole.penalties ?? 0), 0);
  const costliest = [...scoredHoles].sort(
    (left, right) =>
      right.score - right.par - (left.score - left.par) || left.holeNumber - right.holeNumber,
  )[0];
  const worstDifference = costliest ? costliest.score - costliest.par : 0;

  if (penaltyTotal >= 2) return `${penaltyTotal} penalties drove the damage`;
  if (costliest && worstDifference >= 3) return `Hole ${costliest.holeNumber} was the blow-up`;
  if (costliest && worstDifference === 2) return `Hole ${costliest.holeNumber} cost two shots`;
  if (round.totalScore <= round.totalPar) return "Scoring held under pressure";
  return "Bogey control is the next win";
}

function scoreSummary(totalScore: number | null, toPar: number | null) {
  return totalScore === null ? "--" : `${totalScore} · ${formatToPar(toPar)}`;
}

function formatToPar(value: number | null) {
  if (value === null) return "--";
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : value.toString();
}

function formatHoleResult(hole: { holeNumber: number; par: number; score?: number | null }) {
  return `H${hole.holeNumber} ${formatToPar(typeof hole.score === "number" ? hole.score - hole.par : null)}`;
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatSessionType(value: string) {
  if (value === "real_round") return "Real round";
  if (value === "simulated_course") return "Simulator round";
  return value.replaceAll("_", " ");
}
