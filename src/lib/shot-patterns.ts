import "server-only";

import { directionalMetricSql } from "@/lib/directional-confidence-sql";

import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";

import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { forwardDistanceYd } from "@/lib/geo/yard-projection";
import { formatClubType } from "@/lib/rapsodo/parser";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";

export type ShotPatternMode = "carry" | "total";
export type ShotPatternOutlierMode = "all" | "best90" | "best80";

export type ShotPatternRequest = {
  userId: string;
  clubId?: string;
  clubType?: string;
  mode: ShotPatternMode;
  outlierMode: ShotPatternOutlierMode;
  limit?: number;
  sinceDays?: number;
};

export type ShotPatternRawShot = {
  id: string;
  clubId: string | null;
  clubType: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  shotAt: Date | null;
  reviewStatus?: ShotReviewStatus | null;
  shotCategory: string | null;
  qualityTag: string | null;
  sessionType: string | null;
};

export type ShotPatternPoint = {
  id: string;
  distanceYd: number;
  forwardYd: number;
  sideYd: number;
  included: boolean;
};

export type ShotPatternSummary = {
  sampleSize: number;
  includedSampleSize: number;
  maxDistanceYd: number | null;
  carryMedianYd: number | null;
  totalMedianYd: number | null;
  sideMedianYd: number | null;
  sideP10Yd: number | null;
  sideP90Yd: number | null;
  distanceP10Yd: number | null;
  distanceP50Yd: number | null;
  distanceP90Yd: number | null;
  leftMissYd: number | null;
  rightMissYd: number | null;
  shortLongSpreadYd: number | null;
  confidence: "high" | "medium" | "low" | "not_enough";
  warning: string | null;
};

export type ShotPatternResult = {
  clubId: string | null;
  clubType: string;
  clubLabel: string;
  mode: ShotPatternMode;
  outlierMode: ShotPatternOutlierMode;
  points: ShotPatternPoint[];
  summary: ShotPatternSummary;
};

export type ShotPatternClubOption = {
  clubId: string | null;
  clubType: string;
  label: string;
  sampleSize: number;
  active: boolean;
  playNumberYd?: number | null;
};

export const DEFAULT_PATTERN_LIMIT = 50;
export const MAX_PATTERN_LIMIT = 50;

type ShotPatternClubOptionClubRow = {
  id: string;
  type: string;
  brand: string | null;
  model: string | null;
  active: boolean;
};

type ShotPatternClubOptionShotRow = {
  clubId: string | null;
  clubType: string;
  reviewStatus?: ShotReviewStatus | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
};

const EXCLUDED_SHOT_CATEGORIES = new Set(["chip", "pitch", "putt", "recovery", "bunker"]);

export async function getShotPattern(request: ShotPatternRequest): Promise<ShotPatternResult> {
  const limit = clampLimit(request.limit);
  const db = getDb();
  const clauses = [
    eq(shots.userId, request.userId),
    eq(clubs.active, true),
    shotEvidenceSqlPredicate()!,
  ];

  if (request.clubId) {
    clauses.push(eq(shots.clubId, request.clubId));
  } else if (request.clubType) {
    clauses.push(eq(shots.clubType, request.clubType));
  }

  if (request.sinceDays && request.sinceDays > 0) {
    const since = new Date(Date.now() - request.sinceDays * 24 * 60 * 60 * 1000);
    clauses.push(gte(shots.shotAt, since));
  }

  const rows = await db
    .select({
      id: shots.id,
      clubId: shots.clubId,
      clubType: shots.clubType,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: directionalMetricSql(shots.sideCarryYd),
      shotAt: shots.shotAt,
      reviewStatus: shots.reviewStatus,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
      sessionType: sessions.type,
      brand: clubs.brand,
      model: clubs.model,
      active: clubs.active,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(and(...clauses))
    .orderBy(desc(shots.shotAt))
    .limit(limit);

  const rawShots = rows.map(
    (row): ShotPatternRawShot => ({
      id: row.id,
      clubId: row.clubId,
      clubType: row.clubType,
      carryYd: row.carryYd,
      totalYd: row.totalYd,
      sideCarryYd: row.sideCarryYd,
      shotAt: row.shotAt,
      reviewStatus: row.reviewStatus,
      shotCategory: row.shotCategory,
      qualityTag: row.qualityTag,
      sessionType: row.sessionType,
    }),
  );
  const firstRow = rows[0] ?? null;

  return buildShotPatternResult({
    rawShots,
    clubId: request.clubId ?? null,
    clubType: request.clubType ?? firstRow?.clubType ?? "driver",
    clubLabel: firstRow
      ? formatClubLabel({
          type: firstRow.clubType,
          brand: request.clubId ? firstRow.brand : null,
          model: request.clubId ? firstRow.model : null,
        })
      : formatClubType(request.clubType ?? "driver"),
    mode: request.mode,
    outlierMode: request.outlierMode,
  });
}

export async function getShotPatternClubOptions(userId: string): Promise<ShotPatternClubOption[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: clubs.id,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
      active: clubs.active,
    })
    .from(clubs)
    .where(and(eq(clubs.userId, userId), eq(clubs.active, true)));

  const shotRows = await db
    .select({
      clubId: shots.clubId,
      clubType: shots.clubType,
      reviewStatus: shots.reviewStatus,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
    })
    .from(shots)
    .where(
      and(
        eq(shots.userId, userId),
        or(
          eq(shots.shotCategory, "full"),
          eq(shots.shotCategory, "stock"),
          and(
            eq(shots.reviewStatus, "restored"),
            sql`lower(trim(coalesce(${shots.shotCategory}, ''))) in ('warm-up', 'warmup', 'warm_up')`,
          ),
        ),
        shotEvidenceSqlPredicate(),
      ),
    );

  return buildShotPatternClubOptions(rows, shotRows);
}

export function buildShotPatternClubOptions(
  clubRows: ShotPatternClubOptionClubRow[],
  shotRows: ShotPatternClubOptionShotRow[],
): ShotPatternClubOption[] {
  const activeClubs = clubRows.filter((club) => club.active);
  const activeClubIds = new Set(activeClubs.map((club) => club.id));
  const clubCounts = new Map<string, number>();

  for (const shot of shotRows) {
    if (!isShotEvidenceEligible(shot)) {
      continue;
    }

    if (shot.clubId && activeClubIds.has(shot.clubId)) {
      clubCounts.set(shot.clubId, (clubCounts.get(shot.clubId) ?? 0) + 1);
    }
  }

  const clubOptions: ShotPatternClubOption[] = activeClubs
    .filter((club) => (clubCounts.get(club.id) ?? 0) > 0)
    .map((club) => ({
      clubId: club.id,
      clubType: club.type,
      label: `${formatClubLabel(club)} · this club only`,
      sampleSize: clubCounts.get(club.id) ?? 0,
      active: true,
    }));

  return clubOptions.sort(
    (left, right) =>
      clubSortValue(left.clubType) - clubSortValue(right.clubType) ||
      right.sampleSize - left.sampleSize ||
      left.label.localeCompare(right.label),
  );
}

export function buildShotPatternResult({
  rawShots,
  clubId,
  clubType,
  clubLabel,
  mode,
  outlierMode,
}: {
  rawShots: ShotPatternRawShot[];
  clubId: string | null;
  clubType: string;
  clubLabel: string;
  mode: ShotPatternMode;
  outlierMode: ShotPatternOutlierMode;
}): ShotPatternResult {
  const validShots = filterShotPatternRawShots(rawShots, { clubId, clubType, mode });
  const ranked = rankPatternPoints(validShots, mode);
  const includedIds = includedPointIds(ranked, outlierMode);
  const points = ranked.map(({ point }) => ({
    ...point,
    included: outlierMode === "all" || includedIds.has(point.id),
  }));
  const includedPoints = points.filter((point) => point.included);

  return {
    clubId,
    clubType,
    clubLabel,
    mode,
    outlierMode,
    points,
    summary: summarizePattern(validShots, points, includedPoints),
  };
}

export function filterShotPatternRawShots(
  rawShots: ShotPatternRawShot[],
  {
    clubId,
    clubType,
    mode,
  }: {
    clubId?: string | null;
    clubType?: string | null;
    mode: ShotPatternMode;
  },
) {
  return rawShots.filter((shot) => {
    if (!isShotEvidenceEligible(shot)) {
      return false;
    }

    if (clubId && shot.clubId !== clubId) {
      return false;
    }

    if (!clubId && clubType && shot.clubType !== clubType) {
      return false;
    }

    if (shot.shotCategory && EXCLUDED_SHOT_CATEGORIES.has(shot.shotCategory.toLowerCase())) {
      return false;
    }

    const distanceYd = shotDistanceForMode(shot, mode);
    const sideYd = shot.sideCarryYd;

    return (
      isFiniteNumber(distanceYd) &&
      distanceYd >= 10 &&
      distanceYd <= 430 &&
      isFiniteNumber(sideYd) &&
      Math.abs(sideYd) <= 180
    );
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

function rankPatternPoints(rawShots: ShotPatternRawShot[], mode: ShotPatternMode) {
  const points = rawShots.map((shot) => {
    const distanceYd = shotDistanceForMode(shot, mode) ?? 0;
    const sideYd = shot.sideCarryYd ?? 0;

    return {
      id: shot.id,
      distanceYd,
      forwardYd: forwardDistanceYd(distanceYd, sideYd) ?? distanceYd,
      sideYd,
      included: true,
    };
  });
  const medianForward = median(points.map((point) => point.forwardYd)) ?? 0;
  const medianSide = median(points.map((point) => point.sideYd)) ?? 0;
  const madForward = median(points.map((point) => Math.abs(point.forwardYd - medianForward))) ?? 0;
  const madSide = median(points.map((point) => Math.abs(point.sideYd - medianSide))) ?? 0;
  const forwardScale = madForward > 0 ? madForward : 1;
  const sideScale = madSide > 0 ? madSide : 1;

  return points
    .map((point) => ({
      point,
      score:
        Math.abs(point.forwardYd - medianForward) / forwardScale +
        Math.abs(point.sideYd - medianSide) / sideScale,
    }))
    .sort((left, right) => left.score - right.score || left.point.id.localeCompare(right.point.id));
}

function includedPointIds(
  ranked: Array<{ point: ShotPatternPoint; score: number }>,
  outlierMode: ShotPatternOutlierMode,
) {
  const keepRatio = outlierMode === "best80" ? 0.8 : outlierMode === "best90" ? 0.9 : 1;
  const keepCount = Math.max(0, Math.ceil(ranked.length * keepRatio));

  return new Set(ranked.slice(0, keepCount).map((item) => item.point.id));
}

function summarizePattern(
  rawShots: ShotPatternRawShot[],
  points: ShotPatternPoint[],
  includedPoints: ShotPatternPoint[],
): ShotPatternSummary {
  const distanceP10Yd = percentile(
    includedPoints.map((point) => point.distanceYd),
    0.1,
  );
  const distanceP90Yd = percentile(
    includedPoints.map((point) => point.distanceYd),
    0.9,
  );
  const sideP10Yd = percentile(
    includedPoints.map((point) => point.sideYd),
    0.1,
  );
  const sideP90Yd = percentile(
    includedPoints.map((point) => point.sideYd),
    0.9,
  );

  return {
    sampleSize: points.length,
    includedSampleSize: includedPoints.length,
    maxDistanceYd: max(points.map((point) => point.distanceYd)),
    carryMedianYd: median(rawShots.map((shot) => shot.carryYd).filter(isFiniteNumber)),
    totalMedianYd: median(rawShots.map((shot) => shot.totalYd).filter(isFiniteNumber)),
    sideMedianYd: median(includedPoints.map((point) => point.sideYd)),
    sideP10Yd,
    sideP90Yd,
    distanceP10Yd,
    distanceP50Yd: median(includedPoints.map((point) => point.distanceYd)),
    distanceP90Yd,
    leftMissYd: sideP10Yd === null ? null : Math.max(0, Math.abs(Math.min(0, sideP10Yd))),
    rightMissYd: sideP90Yd === null ? null : Math.max(0, sideP90Yd),
    shortLongSpreadYd:
      distanceP10Yd === null || distanceP90Yd === null ? null : distanceP90Yd - distanceP10Yd,
    confidence: confidenceForSample(points.length),
    warning: warningForSample(points.length),
  };
}

function shotDistanceForMode(shot: ShotPatternRawShot, mode: ShotPatternMode) {
  return mode === "carry" ? (shot.carryYd ?? shot.totalYd) : (shot.totalYd ?? shot.carryYd);
}

function median(values: number[]) {
  return percentile(values, 0.5);
}

function max(values: number[]) {
  const cleanValues = values.filter(isFiniteNumber);

  if (cleanValues.length === 0) {
    return null;
  }

  return roundOne(Math.max(...cleanValues));
}

function percentile(values: number[], ratio: number) {
  const sorted = values.filter(isFiniteNumber).sort((left, right) => left - right);

  if (sorted.length === 0) {
    return null;
  }

  if (sorted.length === 1) {
    return roundOne(sorted[0]);
  }

  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return roundOne(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

function confidenceForSample(sampleSize: number): ShotPatternSummary["confidence"] {
  if (sampleSize >= 50) return "high";
  if (sampleSize >= 20) return "medium";
  if (sampleSize >= 8) return "low";
  return "not_enough";
}

function warningForSample(sampleSize: number) {
  if (sampleSize >= 8) {
    return null;
  }

  return "Import more rounds or range sessions to build a reliable pattern.";
}

function clampLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_PATTERN_LIMIT;
  }

  return Math.max(1, Math.min(MAX_PATTERN_LIMIT, Math.trunc(limit ?? DEFAULT_PATTERN_LIMIT)));
}

function formatClubLabel({
  type,
  brand,
  model,
}: {
  type: string;
  brand?: string | null;
  model?: string | null;
}) {
  return [brand, model, formatClubType(type)].filter(Boolean).join(" ");
}

function clubSortValue(clubType: string) {
  const order = [
    "driver",
    "3w",
    "5w",
    "7w",
    "2h",
    "3h",
    "4h",
    "5h",
    "3i",
    "4i",
    "5i",
    "6i",
    "7i",
    "8i",
    "9i",
    "pw",
    "gw",
    "aw",
    "sw",
    "lw",
  ];

  const index = order.indexOf(clubType);
  return index === -1 ? 999 : index;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
