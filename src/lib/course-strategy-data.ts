import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, courseFeatures, courses, holes, stockYardages, teeSets } from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import { buildHoleStrategies } from "@/lib/course-strategy";
import { requireCurrentUserId } from "@/lib/current-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCourseStrategyData(
  requestedCourseId?: string,
  requestedTeeSetId?: string,
) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const courseOptions = await db
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .orderBy(asc(courses.name))
    .limit(80);
  let selectedCourse = requestedCourseId
    ? (courseOptions.find((course) => course.id === requestedCourseId) ?? null)
    : (courseOptions[0] ?? null);
  if (!selectedCourse && requestedCourseId && uuidPattern.test(requestedCourseId)) {
    const [requestedCourse] = await db
      .select({ id: courses.id, name: courses.name })
      .from(courses)
      .where(eq(courses.id, requestedCourseId))
      .limit(1);
    selectedCourse = requestedCourse ?? null;
    if (selectedCourse) courseOptions.push(selectedCourse);
  }

  if (!selectedCourse) {
    return {
      courseOptions,
      selectedCourse,
      selectedTee: null,
      teeOptions: [],
      strategies: [],
      trustedBag: [],
    };
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
      .where(and(eq(stockYardages.userId, userId), eq(clubs.active, true)))
      .orderBy(desc(stockYardages.calculatedAt)),
  ]);
  let selectedTee = requestedTeeSetId
    ? (teeRows.find((tee) => tee.id === requestedTeeSetId) ?? null)
    : (teeRows[Math.floor((teeRows.length - 1) / 2)] ?? null);
  if (!selectedTee && requestedTeeSetId && uuidPattern.test(requestedTeeSetId)) {
    const [requestedTee] = await db
      .select()
      .from(teeSets)
      .where(and(eq(teeSets.id, requestedTeeSetId), eq(teeSets.courseId, selectedCourse.id)))
      .limit(1);
    selectedTee = requestedTee ?? null;
    if (selectedTee) teeRows.push(selectedTee);
  }

  if (!selectedTee) {
    return {
      courseOptions,
      selectedCourse,
      selectedTee,
      teeOptions: teeRows,
      strategies: [],
      trustedBag: [],
    };
  }

  const holeRows = await db
    .select({ holeNumber: holes.holeNumber, par: holes.par, yards: holes.yards })
    .from(holes)
    .where(eq(holes.teeSetId, selectedTee.id))
    .orderBy(asc(holes.holeNumber));
  const newestByClub = new Map<string, (typeof stockRows)[number]>();
  for (const row of stockRows) {
    if (row.carry !== null && !newestByClub.has(row.clubId)) newestByClub.set(row.clubId, row);
  }
  const latestStocks = [...newestByClub.values()];
  const hazardsByHole = new Map<number, string[]>();

  for (const feature of featureRows) {
    if (feature.holeNumber === null || !isStrategyHazard(feature.featureType)) continue;
    hazardsByHole.set(feature.holeNumber, [
      ...(hazardsByHole.get(feature.holeNumber) ?? []),
      feature.featureType,
    ]);
  }

  return {
    courseOptions,
    selectedCourse,
    selectedTee,
    teeOptions: teeRows,
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

function isStrategyHazard(featureType: string) {
  const value = featureType
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return [
    "bunker",
    "sand",
    "water",
    "water_hazard",
    "ditch",
    "out_of_bounds",
    "oob",
    "trees",
    "woodland",
  ].some((hazard) => value === hazard || value.includes(hazard));
}
