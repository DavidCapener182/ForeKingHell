import "server-only";

import { and, asc, desc, eq, isNull, or } from "drizzle-orm";

import { clubs, courseFeatures, courses, holes, stockYardages, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  classifyProjectedPatternPoints,
  type CourseFeature,
  type LandingClassification,
  type LandingClassificationSummary,
} from "@/lib/course-feature-classification";
import { ensureCourseFeatures } from "@/lib/course-feature-enrichment";
import type { LatLngPoint } from "@/lib/geo/yard-projection";
import {
  projectShotPatternOntoHole,
  type ProjectedShotPatternPoint,
  type ProjectedShotPatternSummary,
} from "@/lib/shot-pattern-projection";
import {
  DEFAULT_PATTERN_LIMIT,
  getShotPattern,
  getShotPatternClubOptions,
  type ShotPatternClubOption,
  type ShotPatternMode,
  type ShotPatternOutlierMode,
  type ShotPatternResult,
} from "@/lib/shot-patterns";

export type ShotPatternHoleOption = {
  holeNumber: number;
  par: number;
  yards: number;
};

export type ShotPatternTeeSetOption = {
  id: string;
  name: string;
  par: number;
  yards: number | null;
  holeCount: number;
};

export type ShotPatternCourseSummary = {
  id: string;
  name: string;
};

export type ShotPatternSetup = {
  course: ShotPatternCourseSummary;
  teeSets: ShotPatternTeeSetOption[];
  holes: ShotPatternHoleOption[];
  holesByTeeSet: Record<string, ShotPatternHoleOption[]>;
  clubOptions: ShotPatternClubOption[];
  defaultControls: {
    teeSetId: string | null;
    holeNumber: number | null;
    clubId: string | null;
    clubType: string;
    mode: ShotPatternMode;
    outlierMode: ShotPatternOutlierMode;
  };
};

export type ShotPatternOverlayData = {
  hole: {
    holeNumber: number;
    par: number;
    yards: number;
    geometry: LatLngPoint[];
  } | null;
  club: {
    id: string | null;
    type: string;
    label: string;
  };
  pattern: ShotPatternResult;
  projectedPoints: ProjectedShotPatternPoint[];
  projectedSummary: ProjectedShotPatternSummary;
  landingClassifications: LandingClassification[];
  landingSummary: LandingClassificationSummary;
  courseFeatures: CourseFeature[];
  clubOptions: ShotPatternClubOption[];
};

export async function getShotPatternSetup({
  userId,
  courseId,
}: {
  userId: string;
  courseId: string;
}): Promise<ShotPatternSetup | null> {
  const db = getDb();
  const [course, teeSetRows, holeRows, clubOptions, stockRows] = await Promise.all([
    loadVisibleCourse(courseId, userId),
    db.select().from(teeSets).where(eq(teeSets.courseId, courseId)).orderBy(asc(teeSets.name)),
    db.select().from(holes).where(eq(holes.courseId, courseId)).orderBy(asc(holes.holeNumber)),
    getShotPatternClubOptions(userId),
    db
      .select({
        clubId: stockYardages.clubId,
        clubType: clubs.type,
        totalMedianYd: stockYardages.totalMedianYd,
        carryMedianYd: stockYardages.carryMedianYd,
        recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
        sampleSize: stockYardages.sampleSize,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
      .where(and(eq(stockYardages.userId, userId), eq(clubs.active, true)))
      .orderBy(desc(stockYardages.calculatedAt)),
  ]);

  if (!course) {
    return null;
  }

  const teeSetsWithCounts = teeSetRows.map((teeSet) => ({
    id: teeSet.id,
    name: teeSet.name,
    par: teeSet.par,
    yards: teeSet.yards,
    holeCount: holeRows.filter((hole) => hole.teeSetId === teeSet.id).length,
  }));
  const defaultTeeSet =
    teeSetsWithCounts
      .filter((teeSet) => teeSet.holeCount > 0)
      .sort(
        (left, right) => right.holeCount - left.holeCount || left.name.localeCompare(right.name),
      )[0] ??
    teeSetsWithCounts[0] ??
    null;
  const holesForDefaultTee = holeRows
    .filter((hole) => hole.teeSetId === defaultTeeSet?.id)
    .map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
    }));
  const holesByTeeSet = teeSetRows.reduce<Record<string, ShotPatternHoleOption[]>>(
    (acc, teeSet) => {
      acc[teeSet.id] = holeRows
        .filter((hole) => hole.teeSetId === teeSet.id)
        .map((hole) => ({
          holeNumber: hole.holeNumber,
          par: hole.par,
          yards: hole.yards,
        }));
      return acc;
    },
    {},
  );
  const defaultHole = holesForDefaultTee[0] ?? null;
  const clubOptionsWithStock = enrichClubOptionsWithStock(clubOptions, stockRows);
  const defaultClub = chooseDefaultClub({
    hole: defaultHole,
    clubOptions: clubOptionsWithStock,
    stockRows,
  });

  return {
    course: {
      id: course.id,
      name: course.name,
    },
    teeSets: teeSetsWithCounts,
    holes: holesForDefaultTee,
    holesByTeeSet,
    clubOptions: clubOptionsWithStock,
    defaultControls: {
      teeSetId: defaultTeeSet?.id ?? null,
      holeNumber: defaultHole?.holeNumber ?? null,
      clubId: defaultClub.clubId,
      clubType: defaultClub.clubType,
      mode: "total",
      outlierMode: "best90",
    },
  };
}

export async function getShotPatternOverlayData({
  userId,
  courseId,
  teeSetId,
  holeNumber,
  clubId,
  clubType,
  mode = "total",
  outlierMode = "best90",
  limit = DEFAULT_PATTERN_LIMIT,
}: {
  userId: string;
  courseId: string;
  teeSetId?: string | null;
  holeNumber?: number | null;
  clubId?: string | null;
  clubType?: string | null;
  mode?: ShotPatternMode;
  outlierMode?: ShotPatternOutlierMode;
  limit?: number;
}): Promise<ShotPatternOverlayData | null> {
  const setup = await getShotPatternSetup({ userId, courseId });

  if (!setup) {
    return null;
  }

  const resolvedTeeSetId = teeSetId ?? setup.defaultControls.teeSetId;
  const holeRows = await loadHolesForTeeSet(courseId, resolvedTeeSetId);
  const selectedHole =
    holeRows.find((hole) => hole.holeNumber === holeNumber) ?? holeRows[0] ?? null;
  const selectedHoleOption = selectedHole
    ? {
        holeNumber: selectedHole.holeNumber,
        par: selectedHole.par,
        yards: selectedHole.yards,
      }
    : null;
  const selectedClub =
    resolveRequestedClubSelection({ clubId, clubType, clubOptions: setup.clubOptions }) ??
    chooseDefaultClub({
      hole: selectedHoleOption,
      clubOptions: setup.clubOptions,
      stockRows: await loadStockRows(userId),
    });
  const pattern = await getShotPattern({
    userId,
    clubId: selectedClub.clubId ?? undefined,
    clubType: selectedClub.clubId ? undefined : selectedClub.clubType,
    mode,
    outlierMode,
    limit,
  });
  const hole = selectedHole
    ? {
        holeNumber: selectedHole.holeNumber,
        par: selectedHole.par,
        yards: selectedHole.yards,
        geometry: centerlineGeometry(selectedHole.centerlineGeojson),
      }
    : null;
  const projection =
    hole && hole.geometry.length > 0
      ? projectShotPatternOntoHole({
          holeGeometry: hole.geometry,
          holeYards: hole.yards,
          pattern,
        })
      : { points: [], summary: { medianLatLng: null, includedBounds: null } };
  await ensureCourseFeatures({ courseId, osmTimeoutMs: 1_200 });
  const featureRows = hole
    ? await getDb()
        .select({
          id: courseFeatures.id,
          featureType: courseFeatures.featureType,
          holeNumber: courseFeatures.holeNumber,
          geometryJson: courseFeatures.geometryJson,
          source: courseFeatures.source,
        })
        .from(courseFeatures)
        .where(
          and(
            eq(courseFeatures.courseId, courseId),
            or(eq(courseFeatures.holeNumber, hole.holeNumber), isNull(courseFeatures.holeNumber)),
          ),
        )
    : [];
  const classification = classifyProjectedPatternPoints(projection.points, featureRows);

  return {
    hole,
    club: {
      id: selectedClub.clubId,
      type: pattern.clubType,
      label: pattern.clubLabel,
    },
    pattern,
    projectedPoints: projection.points,
    projectedSummary: projection.summary,
    landingClassifications: classification.classifications,
    landingSummary: classification.summary,
    courseFeatures: featureRows,
    clubOptions: setup.clubOptions,
  };
}

async function loadVisibleCourse(courseId: string, userId: string) {
  const [course] = await getDb()
    .select({
      id: courses.id,
      name: courses.name,
    })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
      ),
    )
    .limit(1);

  return course ?? null;
}

async function loadHolesForTeeSet(courseId: string, teeSetId: string | null | undefined) {
  if (!teeSetId) {
    return [];
  }

  return getDb()
    .select()
    .from(holes)
    .where(and(eq(holes.courseId, courseId), eq(holes.teeSetId, teeSetId)))
    .orderBy(asc(holes.holeNumber));
}

async function loadStockRows(userId: string) {
  return getDb()
    .select({
      clubId: stockYardages.clubId,
      clubType: clubs.type,
      totalMedianYd: stockYardages.totalMedianYd,
      carryMedianYd: stockYardages.carryMedianYd,
      recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
      sampleSize: stockYardages.sampleSize,
      calculatedAt: stockYardages.calculatedAt,
    })
    .from(stockYardages)
    .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
    .where(and(eq(stockYardages.userId, userId), eq(clubs.active, true)))
    .orderBy(desc(stockYardages.calculatedAt));
}

function chooseDefaultClub({
  hole,
  clubOptions,
  stockRows,
}: {
  hole: ShotPatternHoleOption | null;
  clubOptions: ShotPatternClubOption[];
  stockRows: Array<{
    clubId: string;
    clubType: string;
    totalMedianYd: number | null;
    carryMedianYd: number | null;
    recommendedPlayNumberYd: number | null;
    sampleSize: number;
  }>;
}) {
  const reliableOptions = clubOptions.filter((option) => option.sampleSize >= 8);

  if (hole?.par === 3 && stockRows.length > 0) {
    const byClubId = new Map(clubOptions.map((option) => [option.clubId, option]));
    const closest = stockRows
      .filter((row) => row.sampleSize >= 8)
      .map((row) => ({
        row,
        option: byClubId.get(row.clubId) ?? null,
        yardage: row.recommendedPlayNumberYd ?? row.totalMedianYd ?? row.carryMedianYd,
      }))
      .filter((item) => item.option && typeof item.yardage === "number")
      .sort(
        (left, right) =>
          Math.abs(left.yardage! - hole.yards) - Math.abs(right.yardage! - hole.yards),
      )[0];

    if (closest?.option) {
      return {
        clubId: closest.option.clubId,
        clubType: closest.option.clubType,
      };
    }
  }

  const driver = reliableOptions.find((option) => option.clubType === "driver");
  const fallback = driver ?? reliableOptions[0] ?? clubOptions[0];

  return {
    clubId: fallback?.clubId ?? null,
    clubType: fallback?.clubType ?? "driver",
  };
}

function resolveRequestedClubSelection({
  clubId,
  clubType,
  clubOptions,
}: {
  clubId?: string | null;
  clubType?: string | null;
  clubOptions: ShotPatternClubOption[];
}) {
  if (clubId) {
    const option = clubOptions.find((item) => item.clubId === clubId);

    if (option) {
      return {
        clubId: option.clubId,
        clubType: option.clubType,
      };
    }
  }

  if (clubType) {
    const option = clubOptions.find((item) => item.clubId === null && item.clubType === clubType);

    if (option) {
      return {
        clubId: null,
        clubType: option.clubType,
      };
    }
  }

  return null;
}

function enrichClubOptionsWithStock(
  clubOptions: ShotPatternClubOption[],
  stockRows: Array<{
    clubId: string;
    clubType: string;
    totalMedianYd: number | null;
    carryMedianYd: number | null;
    recommendedPlayNumberYd: number | null;
    sampleSize: number;
  }>,
): ShotPatternClubOption[] {
  const byClubId = new Map(stockRows.map((row) => [row.clubId, row]));
  const byClubType = new Map<string, number[]>();

  for (const row of stockRows) {
    const playNumberYd = stockPlayNumber(row);

    if (playNumberYd === null || row.sampleSize < 8) {
      continue;
    }

    byClubType.set(row.clubType, [...(byClubType.get(row.clubType) ?? []), playNumberYd]);
  }

  return clubOptions.map((option) => {
    const clubPlayNumber =
      option.clubId && byClubId.has(option.clubId)
        ? stockPlayNumber(byClubId.get(option.clubId)!)
        : null;
    const typePlayNumber =
      option.clubId === null ? median(byClubType.get(option.clubType) ?? []) : null;

    return {
      ...option,
      playNumberYd: clubPlayNumber ?? typePlayNumber,
    };
  });
}

function stockPlayNumber(row: {
  recommendedPlayNumberYd: number | null;
  totalMedianYd: number | null;
  carryMedianYd: number | null;
}) {
  return row.recommendedPlayNumberYd ?? row.totalMedianYd ?? row.carryMedianYd ?? null;
}

function median(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return Math.round(sorted[middle]);
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function centerlineGeometry(value: unknown) {
  const geojson = parseCenterlineGeojson(value);

  if (
    !geojson ||
    typeof geojson !== "object" ||
    Array.isArray(geojson) ||
    geojson.type !== "LineString" ||
    !Array.isArray(geojson.coordinates)
  ) {
    return [];
  }

  return geojson.coordinates
    .filter(
      (coordinate): coordinate is [number, number] =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        typeof coordinate[0] === "number" &&
        typeof coordinate[1] === "number",
    )
    .map(([lng, lat]) => [lat, lng] as LatLngPoint);
}

function parseCenterlineGeojson(value: unknown): {
  type?: unknown;
  coordinates?: unknown[];
} | null {
  if (typeof value !== "string") {
    return value as { type?: unknown; coordinates?: unknown[] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string"
      ? parseCenterlineGeojson(parsed)
      : (parsed as { type?: unknown; coordinates?: unknown[] });
  } catch {
    return null;
  }
}
