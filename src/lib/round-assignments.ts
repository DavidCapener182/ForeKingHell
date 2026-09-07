import "server-only";
import { nextRoundVersionTime } from "@/lib/offline-round-precondition";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedItems,
  sessions,
  shots,
  strokesGainedBaselines,
  strokesGainedShotEvents,
} from "@/db/schema";
import {
  inferCourseShots,
  inferCourseShotsFromHoleShotCounts,
  type CourseScorecardHole,
} from "@/lib/course-scorecard";
import type { ParsedRapsodoShot } from "@/lib/rapsodo/parser";
import { physicalRoundShotsForAccounting } from "@/lib/round-shot-deletion";
import { roundPuttsAfterRecalculation } from "@/lib/round-hole-correction";
import { roundCompletionIssue } from "@/lib/round-context";
import {
  DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
  buildStrokesGainedEventsFromRoundAssignments,
} from "@/lib/strokes-gained";

type StoredScorecardHole = NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>[number];
type RoundActionTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type RoundAssignmentDatabase = Pick<RoundActionTransaction, "select" | "update">;

export async function recalculateRoundAssignments(
  sessionId: string,
  actorUserId: string,
  db: RoundAssignmentDatabase = getDb(),
) {
  const [session] = await db
    .select({
      scorecardJson: sessions.scorecardJson,
      updatedAt: sessions.updatedAt,
      userId: sessions.userId,
      courseName: sessions.courseName,
      roundStatus: sessions.roundStatus,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, actorUserId)))
    .limit(1);

  if (!session?.scorecardJson) {
    return;
  }

  const loadedSessionShots = await db
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      clubType: shots.clubType,
      courseHoleNumber: shots.courseHoleNumber,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, session.userId)))
    .orderBy(asc(shots.shotNumber), asc(shots.createdAt));
  const sessionShots = physicalRoundShotsForAccounting(loadedSessionShots);
  const sortedScorecard = session.scorecardJson
    .slice()
    .sort((left, right) => left.holeNumber - right.holeNumber);
  const inferredHoleByShotId =
    sessionShots.length > 0 &&
    sessionShots.every((shot) => !shot.courseHoleNumber) &&
    !sortedScorecard.some((hole) => hole.shotAssignmentSource === "manual")
      ? inferUnmappedShotHoles(sortedScorecard, sessionShots)
      : new Map<string, number>();
  const shotsByHole = new Map<number, typeof sessionShots>();

  for (const shot of sessionShots) {
    const courseHoleNumber = shot.courseHoleNumber ?? inferredHoleByShotId.get(shot.id) ?? null;

    if (!courseHoleNumber) {
      continue;
    }

    const existing = shotsByHole.get(courseHoleNumber) ?? [];
    existing.push({ ...shot, courseHoleNumber });
    shotsByHole.set(courseHoleNumber, existing);
  }

  const nextScorecard = await Promise.all(
    sortedScorecard.map(async (hole) => {
      const holeShots = shotsByHole.get(hole.holeNumber) ?? [];
      let progressYd = 0;

      for (const [index, shot] of holeShots.entries()) {
        progressYd += forwardDistanceYd(shot.totalYd ?? shot.carryYd, shot.sideCarryYd) ?? 0;

        await db
          .update(shots)
          .set({
            courseHoleNumber: hole.holeNumber,
            courseHoleShotNumber: index + 1,
            courseHolePar: hole.par,
            courseHoleYards: hole.yards,
            distanceRemainingYd: roundOne(Math.max(0, hole.yards - progressYd)),
            shotCategory: classifyCourseShot(
              shot.clubType,
              shot.totalYd ?? shot.carryYd,
              index + 1,
            ),
          })
          .where(
            and(
              eq(shots.id, shot.id),
              eq(shots.sessionId, sessionId),
              eq(shots.userId, session.userId),
            ),
          );
      }

      const putts = roundPuttsAfterRecalculation(hole, holeShots.length);

      return {
        ...hole,
        csvShotCount: holeShots.length,
        progressYd: roundOne(progressYd),
        distanceRemainingYd: roundOne(Math.max(0, hole.yards - progressYd)),
        putts,
        penalties: hole.penalties ?? null,
      };
    }),
  );

  await db
    .update(sessions)
    .set({ scorecardJson: nextScorecard, updatedAt: nextRoundVersionTime(session.updatedAt) })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)));

  if (session.roundStatus === "complete") {
    const complete = !roundCompletionIssue(nextScorecard);
    const score = complete ? nextScorecard.reduce((sum, hole) => sum + (hole.score ?? 0), 0) : null;
    // Refresh only an existing owned publication; its audience, identity and original date stay intact.
    await db
      .update(feedItems)
      .set({
        metricLabel: (session.courseName ?? "Round").slice(0, 80),
        metricValue: score === null ? "Logged" : String(score),
        context: session.courseName ?? "Manual round",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedItems.userId, actorUserId),
          eq(feedItems.dedupeKey, `round-completed:${sessionId}`),
          eq(feedItems.itemType, "round_completed"),
          eq(feedItems.sourceId, sessionId),
        ),
      );
  }

  return nextScorecard;
}

export async function rebuildRoundStrokesGainedEvents(
  sessionId: string,
  actorUserId: string,
  scorecard: StoredScorecardHole[],
  tx: RoundActionTransaction,
) {
  await tx
    .delete(strokesGainedShotEvents)
    .where(
      and(
        eq(strokesGainedShotEvents.userId, actorUserId),
        eq(strokesGainedShotEvents.sessionId, sessionId),
        isNotNull(strokesGainedShotEvents.shotId),
      ),
    );
  const remainingShots = await tx
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
      clubType: shots.clubType,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      courseHoleNumber: shots.courseHoleNumber,
      courseHoleShotNumber: shots.courseHoleShotNumber,
      courseHolePar: shots.courseHolePar,
      courseHoleYards: shots.courseHoleYards,
      distanceRemainingYd: shots.distanceRemainingYd,
      shotCategory: shots.shotCategory,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, actorUserId)))
    .orderBy(
      asc(shots.courseHoleNumber),
      asc(shots.courseHoleShotNumber),
      asc(shots.shotNumber),
      asc(shots.createdAt),
    );
  const baselineRows = await tx
    .select({
      category: strokesGainedBaselines.category,
      lie: strokesGainedBaselines.lie,
      distanceStartYd: strokesGainedBaselines.distanceStartYd,
      distanceEndYd: strokesGainedBaselines.distanceEndYd,
      expectedStrokes: strokesGainedBaselines.expectedStrokes,
    })
    .from(strokesGainedBaselines);
  const rebuiltEvents = buildStrokesGainedEventsFromRoundAssignments({
    userId: actorUserId,
    sessionId,
    shots: remainingShots,
    holeScoring: scorecard,
    baselineBuckets:
      baselineRows.length > 0 ? baselineRows : DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
  });

  if (rebuiltEvents.length > 0) {
    await tx.insert(strokesGainedShotEvents).values(rebuiltEvents);
  }
}

function inferUnmappedShotHoles(
  scorecard: StoredScorecardHole[],
  sessionShots: Array<{
    id: string;
    shotNumber: number | null;
    carryYd: number | null;
    totalYd: number | null;
    sideCarryYd: number | null;
    clubType: string;
  }>,
) {
  const scorecardHoles = scorecard.map<CourseScorecardHole>((hole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    yards: hole.yards,
    name: hole.name,
  }));
  const parsedShots = sessionShots.map<ParsedRapsodoShot>((shot, index) => ({
    rowNumber: index + 1,
    shotNumber: shot.shotNumber,
    clubTypeRaw: shot.clubType,
    clubType: shot.clubType,
    clubLabel: shot.clubType,
    clubBrand: null,
    clubModel: null,
    clubKey: shot.clubType,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    ballSpeedMph: null,
    clubSpeedMph: null,
    launchAngleDeg: null,
    launchDirectionDeg: null,
    apexFt: null,
    sideCarryYd: shot.sideCarryYd,
    attackAngleDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: {},
    warnings: [],
  }));
  const knownShotCounts = scorecardShotCountsFromStrokeAccounting(scorecard, sessionShots.length);
  const inferred = knownShotCounts
    ? inferCourseShotsFromHoleShotCounts(parsedShots, scorecardHoles, knownShotCounts)
    : inferCourseShots(parsedShots, scorecardHoles);
  const holeByShotId = new Map<string, number>();

  for (const courseShot of inferred.shots) {
    const shot = sessionShots[courseShot.absoluteShotNumber - 1];

    if (shot) {
      holeByShotId.set(shot.id, courseShot.holeNumber);
    }
  }

  return holeByShotId;
}

function scorecardShotCountsFromStrokeAccounting(
  scorecard: StoredScorecardHole[],
  totalShotCount: number,
) {
  const shotCounts: Array<{ holeNumber: number; shotCount: number }> = [];
  let accountedShots = 0;

  for (const hole of scorecard) {
    if (typeof hole.score !== "number" || typeof hole.putts !== "number") {
      return null;
    }

    const penalties = hole.penalties ?? 0;
    const shotCount = hole.score - hole.putts - penalties;

    if (!Number.isFinite(shotCount) || shotCount < 0) {
      return null;
    }

    const roundedShotCount = Math.floor(shotCount);
    accountedShots += roundedShotCount;
    shotCounts.push({ holeNumber: hole.holeNumber, shotCount: roundedShotCount });
  }

  return accountedShots === totalShotCount ? shotCounts : null;
}

function forwardDistanceYd(distanceYd: number | null, sideYd: number | null) {
  if (distanceYd === null) {
    return null;
  }

  const sideDistance = sideYd ?? 0;
  const forwardSquared = distanceYd ** 2 - sideDistance ** 2;

  if (forwardSquared <= 0) {
    return Math.max(0, distanceYd);
  }

  return Math.sqrt(forwardSquared);
}

function classifyCourseShot(clubType: string, distanceYd: number | null, holeShotNumber: number) {
  const distance = distanceYd ?? 0;

  if (holeShotNumber === 1) {
    return "tee";
  }

  if (distance <= 35) {
    return "chip";
  }

  if (distance <= 95 && ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(clubType)) {
    return "pitch";
  }

  return "approach";
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
