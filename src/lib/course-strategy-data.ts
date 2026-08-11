import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, courseFeatures, courses, holes, stockYardages, teeSets } from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import { buildHoleStrategies } from "@/lib/course-strategy";
import { requireCurrentUserId } from "@/lib/current-user";

export async function getCourseStrategyData(requestedCourseId?: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const courseOptions = await db
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .orderBy(asc(courses.name))
    .limit(80);
  const selectedCourse =
    courseOptions.find((course) => course.id === requestedCourseId) ?? courseOptions[0] ?? null;

  if (!selectedCourse) {
    return { courseOptions, selectedCourse, selectedTee: null, strategies: [], trustedBag: [] };
  }

  const [teeRows, featureRows, stockRows] = await Promise.all([
    db
      .select()
      .from(teeSets)
      .where(eq(teeSets.courseId, selectedCourse.id))
      .orderBy(asc(teeSets.yards))
      .limit(8),
    db
      .select({ holeNumber: courseFeatures.holeNumber, featureType: courseFeatures.featureType })
      .from(courseFeatures)
      .where(eq(courseFeatures.courseId, selectedCourse.id)),
    db
      .select({
        clubId: clubs.id,
        type: clubs.type,
        sampleSize: stockYardages.sampleSize,
        carry: stockYardages.carryMedianYd,
        p25: stockYardages.carryP25Yd,
        p75: stockYardages.carryP75Yd,
        left: stockYardages.dispersionLeftYd,
        right: stockYardages.dispersionRightYd,
        confidence: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .innerJoin(clubs, and(eq(clubs.id, stockYardages.clubId), eq(clubs.userId, userId)))
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt)),
  ]);
  const selectedTee = teeRows[0] ?? null;

  if (!selectedTee) {
    return { courseOptions, selectedCourse, selectedTee, strategies: [], trustedBag: [] };
  }

  const holeRows = await db
    .select({ holeNumber: holes.holeNumber, par: holes.par, yards: holes.yards })
    .from(holes)
    .where(eq(holes.teeSetId, selectedTee.id))
    .orderBy(asc(holes.holeNumber));
  const latestStocks = [
    ...new Map(
      stockRows.filter((row) => row.carry !== null).map((row) => [row.clubId, row] as const),
    ).values(),
  ];
  const hazardsByHole = new Map<number, string[]>();

  for (const feature of featureRows) {
    if (feature.holeNumber === null) continue;
    hazardsByHole.set(feature.holeNumber, [
      ...(hazardsByHole.get(feature.holeNumber) ?? []),
      feature.featureType,
    ]);
  }

  return {
    courseOptions,
    selectedCourse,
    selectedTee,
    strategies: buildHoleStrategies({
      holes: holeRows,
      hazardsByHole,
      clubs: latestStocks.map((row) => ({
        clubId: row.clubId,
        clubType: row.type,
        label: formatClubType(row.type),
        carryYd: row.carry!,
        minCarryYd: row.p25 ?? row.carry! * 0.94,
        maxCarryYd: row.p75 ?? row.carry! * 1.04,
        leftYd: Math.abs(row.left ?? 0),
        rightYd: Math.abs(row.right ?? 0),
        confidence: normalizedConfidence(row.confidence),
        sampleSize: row.sampleSize,
      })),
    }),
    trustedBag: latestStocks.map((row) => ({
      clubId: row.clubId,
      clubType: row.type,
      label: formatClubType(row.type),
      carryYd: row.carry!,
      minCarryYd: row.p25 ?? row.carry! * 0.94,
      maxCarryYd: row.p75 ?? row.carry! * 1.04,
      confidence: normalizedConfidence(row.confidence),
      sampleSize: row.sampleSize,
    })),
  };
}

function normalizedConfidence(value: number | null) {
  return (value ?? 0) > 1 ? (value ?? 0) / 100 : (value ?? 0);
}
