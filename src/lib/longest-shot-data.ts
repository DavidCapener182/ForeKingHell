import "server-only";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { clubAccent, clubSortValue, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { excludedRecordQualityTags, excludedRecordShotCategories } from "@/lib/shot-records";
import type { LongestShot } from "@/app/bag/longest-shots-section";

export async function getLongestShots(metric: "carry" | "total" = "total") {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const distanceExpression = metric === "carry" ? shots.carryYd : shots.totalYd;
  const excludedQualityValues = sql.join(
    [...excludedRecordQualityTags, "warm_up"].map((tag) => sql`${tag}`),
    sql`, `,
  );
  const excludedCategoryValues = sql.join(
    [...excludedRecordShotCategories, "warm_up"].map((category) => sql`${category}`),
    sql`, `,
  );
  const trustedLifecycleEvidence = or(
    eq(shots.reviewStatus, "restored"),
    and(
      eq(shots.reviewStatus, "included"),
      sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
      sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in (${excludedQualityValues})`,
      sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in (${excludedCategoryValues})`,
    ),
  );
  const shotSelection = {
    id: shots.id,
    clubId: shots.clubId,
    sessionId: shots.sessionId,
    sessionSource: sessions.source,
    sessionFileName: sessions.fileName,
    shotNumber: shots.shotNumber,
    shotAt: shots.shotAt,
    carryYd: shots.carryYd,
    totalYd: shots.totalYd,
    sideCarryYd: shots.sideCarryYd,
    ballSpeedMph: shots.ballSpeedMph,
    clubSpeedMph: shots.clubSpeedMph,
    launchAngleDeg: shots.launchAngleDeg,
    launchDirectionDeg: shots.launchDirectionDeg,
    apexFt: shots.apexFt,
    descentAngleDeg: shots.descentAngleDeg,
    spinRate: shots.spinRate,
    spinAxis: shots.spinAxis,
    qualityTag: shots.qualityTag,
    shotCategory: shots.shotCategory,
  };
  const [clubRows, rawRecordRows, trustedRecordRows] = await Promise.all([
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
      .selectDistinctOn([shots.clubId], shotSelection)
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(
        and(eq(shots.userId, userId), eq(sessions.userId, userId), sql`${distanceExpression} > 0`),
      )
      .orderBy(shots.clubId, desc(distanceExpression), desc(shots.shotAt)),
    db
      .selectDistinctOn([shots.clubId], shotSelection)
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(
        and(
          eq(shots.userId, userId),
          eq(sessions.userId, userId),
          sql`${distanceExpression} > 0`,
          trustedLifecycleEvidence,
          sql`lower(${sessions.source}) not in ('manual', 'manual_edit')`,
        ),
      )
      .orderBy(shots.clubId, desc(distanceExpression), desc(shots.shotAt)),
  ]);

  const rawRecordByClubId = new Map(rawRecordRows.map((shot) => [shot.clubId, shot]));
  const trustedRecordByClubId = new Map(trustedRecordRows.map((shot) => [shot.clubId, shot]));

  return clubRows
    .filter((club) => isTrackedClubType(club.type))
    .map((club) => {
      const rawRecord = rawRecordByClubId.get(club.id) ?? null;
      const trustedRecord = trustedRecordByClubId.get(club.id) ?? null;
      const longestShot = trustedRecord ?? rawRecord;

      if (!longestShot) {
        return null;
      }

      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";

      return toLongestShot({
        shot: longestShot,
        clubId: club.id,
        clubType: club.type,
        brandModel,
        accent: clubAccent(club.type),
        recordTrust: trustedRecord ? "trusted" : "raw",
        rawMaximumYd: rawRecord
          ? metric === "carry"
            ? rawRecord.carryYd
            : rawRecord.totalYd
          : null,
      });
    })
    .filter((shot): shot is LongestShot => shot !== null)
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
}

type LongestShotRow = {
  id: string;
  clubId: string;
  sessionId: string;
  sessionSource: string;
  sessionFileName: string | null;
  shotNumber: number | null;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  descentAngleDeg: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  qualityTag: string | null;
  shotCategory: string | null;
};

function toLongestShot({
  shot,
  clubId,
  clubType,
  brandModel,
  accent,
  recordTrust,
  rawMaximumYd,
}: {
  shot: LongestShotRow;
  clubId: string;
  clubType: string;
  brandModel: string;
  accent: string;
  recordTrust: "trusted" | "raw";
  rawMaximumYd: number | null;
}): LongestShot {
  return {
    id: shot.id,
    clubId,
    clubType,
    brandModel,
    accent,
    sessionId: shot.sessionId,
    sessionSource: shot.sessionSource,
    sessionFileName: shot.sessionFileName,
    qualityTag: shot.qualityTag,
    shotCategory: shot.shotCategory,
    recordTrust,
    rawMaximumYd,
    shotNumber: shot.shotNumber,
    shotAt: shot.shotAt.toISOString(),
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    ballSpeedMph: shot.ballSpeedMph,
    clubSpeedMph: shot.clubSpeedMph,
    launchAngleDeg: shot.launchAngleDeg,
    launchDirectionDeg: shot.launchDirectionDeg,
    apexFt: shot.apexFt,
    descentAngleDeg: shot.descentAngleDeg,
    spinRate: shot.spinRate,
    spinAxis: shot.spinAxis,
  };
}
