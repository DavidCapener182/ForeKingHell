import "server-only";
import { directionalMetricSql } from "@/lib/directional-confidence-sql";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildPostRoundReview, readStoredPostRoundReview } from "@/lib/post-round-review";
import { isShotEvidenceEligible } from "@/lib/shot-review";

export async function getPostRoundReviewData(requestedRoundId?: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const fields = {
    id: sessions.id,
    date: sessions.date,
    courseName: sessions.courseName,
    notes: sessions.notes,
    scorecard: sessions.scorecardJson,
    courseId: sessions.courseId,
    teeSetId: sessions.teeSetId,
  };
  const eligible = and(
    eq(sessions.userId, userId),
    inArray(sessions.type, ["real_round", "simulated_course"]),
    eq(sessions.roundStatus, "complete"),
  );
  const rounds = await db
    .select(fields)
    .from(sessions)
    .where(eligible)
    .orderBy(desc(sessions.date))
    .limit(30);
  let selectedRound = requestedRoundId
    ? (rounds.find((round) => round.id === requestedRoundId) ?? null)
    : (rounds[0] ?? null);
  if (
    !selectedRound &&
    requestedRoundId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedRoundId)
  ) {
    const [requested] = await db
      .select(fields)
      .from(sessions)
      .where(and(eligible, eq(sessions.id, requestedRoundId)))
      .limit(1);
    selectedRound = requested ?? null;
    if (selectedRound) rounds.push(selectedRound);
  }
  if (!selectedRound) {
    return {
      rounds,
      selectedRound,
      answers: readStoredPostRoundReview(null),
      review: buildPostRoundReview({ currentShots: [], baselineShots: [] }),
      scoreLabel: "No scorecard selected",
    };
  }

  const [currentShots, baselineShots] = await Promise.all([
    db
      .select({
        clubId: shots.clubId,
        clubType: shots.clubType,
        carryYd: shots.carryYd,
        sideYd: directionalMetricSql(shots.sideCarryYd),
        reviewStatus: shots.reviewStatus,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .where(
        and(
          eq(shots.userId, userId),
          eq(shots.sessionId, selectedRound.id),
          shotEvidenceSqlPredicate(),
        ),
      )
      .orderBy(asc(shots.shotAt)),
    db
      .select({
        clubId: shots.clubId,
        clubType: shots.clubType,
        carryYd: shots.carryYd,
        sideYd: directionalMetricSql(shots.sideCarryYd),
        reviewStatus: shots.reviewStatus,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .innerJoin(sessions, and(eq(sessions.id, shots.sessionId), eq(sessions.userId, userId)))
      .where(
        and(
          eq(shots.userId, userId),
          lt(sessions.date, selectedRound.date),
          shotEvidenceSqlPredicate(),
        ),
      )
      .orderBy(desc(shots.shotAt))
      .limit(2_000),
  ]);

  return {
    rounds,
    selectedRound,
    answers: readStoredPostRoundReview(selectedRound.notes),
    review: buildPostRoundReview({
      currentShots: currentShots.filter(isShotEvidenceEligible),
      baselineShots: baselineShots.filter(isShotEvidenceEligible),
    }),
    scoreLabel: roundScoreLabel(selectedRound.scorecard),
  };
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
  );
}

function roundScoreLabel(scorecard: Array<{ score?: number | null; par: number }> | null) {
  const completed = (scorecard ?? []).filter((hole) => typeof hole.score === "number");
  if (!completed.length) return "Scorecard has no completed holes";
  const score = completed.reduce((total, hole) => total + (hole.score ?? 0), 0);
  const par = completed.reduce((total, hole) => total + hole.par, 0);
  const relative = score - par;
  return `${score} (${relative === 0 ? "E" : `${relative > 0 ? "+" : ""}${relative}`}) across ${completed.length} holes`;
}
