import "server-only";

import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions, shots, speedTrainingSessions } from "@/db/schema";
import { buildDistanceLossDiagnosis } from "@/lib/distance-loss-diagnosis";
import { isShotEvidenceEligible } from "@/lib/shot-review";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getDistanceLossDiagnosisData(userId: string) {
  const db = getDb();
  const now = new Date();
  const distanceLookback = new Date(now.getTime() - 160 * DAY_MS);
  const exposureLookback = new Date(now.getTime() - 112 * DAY_MS);
  const [distanceLossRows, exposureSessionRows, speedExposureRows] = await Promise.all([
    db
      .select({
        sessionId: shots.sessionId,
        shotAt: shots.shotAt,
        source: sessions.source,
        carryYd: shots.carryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        smashFactor: shots.smashFactor,
        spinRate: shots.spinRate,
        reviewStatus: shots.reviewStatus,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        clubDataEstType: shots.clubDataEstType,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(
        and(
          eq(shots.userId, userId),
          eq(sessions.userId, userId),
          eq(shots.clubType, "driver"),
          gte(shots.shotAt, distanceLookback),
          shotEvidenceSqlPredicate(),
        ),
      )
      .orderBy(asc(shots.shotAt)),
    db
      .select({
        id: sessions.id,
        occurredAt: sessions.date,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.date, exposureLookback)))
      .orderBy(asc(sessions.date)),
    db
      .select({
        id: speedTrainingSessions.id,
        occurredAt: speedTrainingSessions.sessionDate,
      })
      .from(speedTrainingSessions)
      .where(
        and(
          eq(speedTrainingSessions.userId, userId),
          gte(speedTrainingSessions.sessionDate, exposureLookback),
        ),
      )
      .orderBy(asc(speedTrainingSessions.sessionDate)),
  ]);

  return buildDistanceLossDiagnosis({
    shots: distanceLossRows.filter(isShotEvidenceEligible),
    exposure: [
      ...exposureSessionRows.map((session) => ({
        id: `session:${session.id}`,
        occurredAt: session.occurredAt,
      })),
      ...speedExposureRows.map((session) => ({
        id: `speed:${session.id}`,
        occurredAt: session.occurredAt,
      })),
    ],
    now,
  });
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
