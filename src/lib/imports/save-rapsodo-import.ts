import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";

import { clubs, importRows, sessions, shots, stockYardages, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { evaluateAchievementsAfterImport } from "@/lib/achievements/service";
import type { AchievementUnlockNotification } from "@/lib/achievements/types";
import { evaluateCoachDrillAchievementsForDefaultUser } from "@/lib/coach-drill-awards";
import { isShortGameTouchClubType, isTrackedClubType } from "@/lib/club-format";
import { ensureKnownCourseForSession, type CourseSessionLink } from "@/lib/courses";
import { getDefaultUserId } from "@/lib/current-user";
import {
  type CourseInferenceResult,
  inferCourseShotsFromHoleShotCounts,
  inferCourseShots,
  parseScorecardText,
} from "@/lib/course-scorecard";
import { calculateStockYardage } from "@/lib/stock-yardage";
import {
  type DistanceUnit,
  type ParsedRapsodoRawRow,
  type ParsedRapsodoShot,
  parseRapsodoCsv,
} from "@/lib/rapsodo/parser";

export type SaveRapsodoImportInput = {
  rawCsvText: string;
  fileName: string;
  fileSizeBytes: number;
  source: "rapsodo";
  sessionType: "range" | "round" | "simulator" | "simulated_course";
  sessionDate: string;
  distanceUnit: DistanceUnit;
  courseName?: string;
  courseScorecardText?: string;
  courseHoleShotCounts?: Array<{ holeNumber: number; shotCount: number }>;
  courseHoleScoring?: Array<{
    holeNumber: number;
    csvShotCount: number;
    putts: number | null;
    penalties: number | null;
    score: number | null;
    netScore?: number | null;
    fairwayHit?: boolean | null;
    gir?: boolean | null;
    strokeIndex?: number | null;
  }>;
  notes?: string;
};

export type LongestShotNotification = {
  clubId: string;
  clubType: string;
  clubLabel: string;
  brandModel: string;
  fileName: string;
  shotNumber: number | null;
  shotDistanceYd: number;
  previousDistanceYd: number;
  distanceType: "total" | "carry";
  carryYd: number | null;
  totalYd: number | null;
};

export type SaveRapsodoImportResult =
  | {
      ok: true;
      sessionId: string;
      shotCount: number;
      clubCount: number;
      rawRowCount: number;
      skipped: boolean;
      longestShotNotifications: LongestShotNotification[];
      achievementUnlockNotifications: AchievementUnlockNotification[];
      warnings: string[];
    }
  | {
      ok: false;
      message: string;
    };

export type SaveRapsodoImportBatchResult =
  | {
      ok: true;
      sessionCount: number;
      shotCount: number;
      clubCount: number;
      rawRowCount: number;
      skippedCount: number;
      longestShotNotifications: LongestShotNotification[];
      achievementUnlockNotifications: AchievementUnlockNotification[];
      warnings: string[];
    }
  | {
      ok: false;
      message: string;
    };

export async function saveRapsodoImport(
  input: SaveRapsodoImportInput,
): Promise<SaveRapsodoImportResult> {
  try {
    const validatedInput = validateInput(input);
    const parsed = parseRapsodoCsv(validatedInput.rawCsvText, {
      fallbackDistanceUnit: validatedInput.distanceUnit,
    });

    if (parsed.shots.length === 0) {
      return {
        ok: false,
        message: parsed.warnings[0] ?? "No shots were found in the uploaded CSV.",
      };
    }

    const coursePlan = buildCoursePlan(validatedInput, parsed.shots);
    const courseLink =
      validatedInput.sessionType === "simulated_course"
        ? await ensureKnownCourseForSession(validatedInput.courseName)
        : { courseId: null, teeSetId: null };

    const result = await persistImport({
      ...validatedInput,
      sessionDate: parsed.exportedAtIso ?? validatedInput.sessionDate,
      shots: parsed.shots,
      rawRows: parsed.rawRows,
      coursePlan,
      courseLink,
    });

    const achievementUnlockNotifications = result.skipped
      ? []
      : [
          ...(await evaluateAchievementsAfterImport(getDefaultUserId())).unlockedAchievements,
          ...(await evaluateCoachDrillAchievementsForDefaultUser()).notifications,
        ];

    revalidateImportPages();

    return {
      ok: true,
      ...result,
      achievementUnlockNotifications,
      warnings: [...parsed.warnings, ...(coursePlan?.warnings ?? [])],
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Import failed.",
    };
  }
}

export async function saveRapsodoImportBatch(
  inputs: SaveRapsodoImportInput[],
): Promise<SaveRapsodoImportBatchResult> {
  if (inputs.length === 0) {
    return {
      ok: false,
      message: "Select at least one CSV file before saving.",
    };
  }

  const warnings: string[] = [];
  const uniqueClubKeys = new Set<string>();
  let shotCount = 0;
  let rawRowCount = 0;
  let sessionCount = 0;
  let skippedCount = 0;
  const longestShotNotifications: LongestShotNotification[] = [];
  const achievementUnlockNotifications: AchievementUnlockNotification[] = [];

  const parsedInputs = inputs.map((input) => {
    const parsed = parseRapsodoCsv(input.rawCsvText, {
      fallbackDistanceUnit: input.distanceUnit,
    });

    return { input, parsed };
  });

  for (const { input, parsed } of parsedInputs) {
    const result = await saveRapsodoImport(input);

    if (!result.ok) {
      return {
        ok: false,
        message: `${input.fileName}: ${result.message}`,
      };
    }

    if (result.skipped) {
      skippedCount += 1;
      warnings.push(`${input.fileName}: identical CSV was already imported and was skipped.`);
    } else {
      sessionCount += 1;
      shotCount += result.shotCount;
      rawRowCount += result.rawRowCount;
      longestShotNotifications.push(...result.longestShotNotifications);
      achievementUnlockNotifications.push(...result.achievementUnlockNotifications);
      for (const shot of parsed.shots) {
        uniqueClubKeys.add(shot.clubKey);
      }
    }

    warnings.push(...result.warnings.map((warning) => `${input.fileName}: ${warning}`));
  }

  return {
    ok: true,
    sessionCount,
    shotCount,
    clubCount: uniqueClubKeys.size,
    rawRowCount,
    skippedCount,
    longestShotNotifications,
    achievementUnlockNotifications,
    warnings,
  };
}

async function persistImport(
  input: SaveRapsodoImportInput & {
    shots: ParsedRapsodoShot[];
    rawRows: ParsedRapsodoRawRow[];
    coursePlan: CourseInferenceResult | null;
    courseLink: CourseSessionLink;
  },
) {
  const db = getDb();
  const userId = getDefaultUserId();
  const preferredUnits = "yards";
  const now = new Date();
  const sessionDate = parseSessionDate(input.sessionDate);
  const rawCsvHash = hashRawCsv(input.rawCsvText);
  const uniqueClubKeys = new Set(input.shots.map((shot) => shot.clubKey));
  const courseShotByRowNumber = new Map(
    (input.coursePlan?.shots ?? []).map((shot) => [shot.sourceShot.rowNumber, shot]),
  );

  return db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: userId,
        email: "single-user@forekinghell.local",
        name: "ForeKingHell Player",
        preferredUnits,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          preferredUnits,
          updatedAt: now,
        },
      });

    const [existingImport] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.source, input.source),
          eq(sessions.rawCsvHash, rawCsvHash),
        ),
      )
      .limit(1);

    if (existingImport) {
      return {
        sessionId: existingImport.id,
        shotCount: 0,
        clubCount: 0,
        rawRowCount: 0,
        skipped: true,
        longestShotNotifications: [],
      };
    }

    const [session] = await tx
      .insert(sessions)
      .values({
        userId,
        source: input.source,
        type: input.sessionType,
        date: sessionDate,
        courseId: input.courseLink.courseId,
        teeSetId: input.courseLink.teeSetId,
        notes: input.notes?.trim() || null,
        courseName: input.courseName?.trim() || null,
        scorecardJson: input.coursePlan ? buildScorecardSnapshot(input.coursePlan, input.courseHoleScoring) : null,
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
        rawCsvHash,
        rawCsvText: input.rawCsvText,
      })
      .returning({ id: sessions.id });

    const clubIdByKey = new Map<string, string>();

    if (input.rawRows.length > 0) {
      await tx.insert(importRows).values(
        input.rawRows.map((row) => ({
          userId,
          sessionId: session.id,
          rowNumber: row.rowNumber,
          rowType: row.rowType,
          sourceRawJson: row.sourceRawJson,
        })),
      );
    }

    for (const clubKey of uniqueClubKeys) {
      const firstShotForClub = input.shots.find((shot) => shot.clubKey === clubKey);

      if (!firstShotForClub) {
        continue;
      }

      const [club] = await tx
        .insert(clubs)
        .values({
          userId,
          type: firstShotForClub.clubType,
          brand: firstShotForClub.clubBrand,
          model: firstShotForClub.clubModel,
          normalizedClubKey: firstShotForClub.clubKey,
          active: isTrackedClubType(firstShotForClub.clubType),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [clubs.userId, clubs.normalizedClubKey],
          set: {
            type: firstShotForClub.clubType,
            brand: firstShotForClub.clubBrand,
            model: firstShotForClub.clubModel,
            active: isTrackedClubType(firstShotForClub.clubType),
            updatedAt: now,
          },
        })
        .returning({ id: clubs.id });

      clubIdByKey.set(clubKey, club.id);
    }

    const previousLongestByClubId = new Map<string, number | null>();

    for (const clubId of clubIdByKey.values()) {
      const [previousLongest] = await tx
        .select({
          distanceYd: sql<number | null>`max(coalesce(${shots.totalYd}, ${shots.carryYd}))`,
        })
        .from(shots)
        .where(and(eq(shots.userId, userId), eq(shots.clubId, clubId)));

      previousLongestByClubId.set(clubId, previousLongest?.distanceYd ?? null);
    }

    const longestShotNotifications = buildLongestShotNotifications({
      importedShots: input.shots,
      clubIdByKey,
      previousLongestByClubId,
      fileName: input.fileName,
    });

    await tx.insert(shots).values(
      input.shots.map((shot) => ({
        userId,
        sessionId: session.id,
        clubId: clubIdByKey.get(shot.clubKey) ?? "",
        shotAt: sessionDate,
        clubType: shot.clubType,
        shotNumber: shot.shotNumber,
        carryYd: shot.carryYd,
        totalYd: shot.totalYd,
        ballSpeedMph: shot.ballSpeedMph,
        clubSpeedMph: shot.clubSpeedMph,
        launchAngleDeg: shot.launchAngleDeg,
        launchDirectionDeg: shot.launchDirectionDeg,
        apexFt: shot.apexFt,
        sideCarryYd: shot.sideCarryYd,
        attackAngleDeg: shot.attackAngleDeg,
        clubPathDeg: shot.clubPathDeg,
        descentAngleDeg: shot.descentAngleDeg,
        smashFactor: shot.smashFactor,
        spinRate: shot.spinRate,
        spinAxis: shot.spinAxis,
        shotShape: shot.shotShape,
        shotCategory: courseShotByRowNumber.get(shot.rowNumber)?.shotCategory ?? shot.shotCategory,
        courseHoleNumber: courseShotByRowNumber.get(shot.rowNumber)?.holeNumber ?? null,
        courseHoleShotNumber: courseShotByRowNumber.get(shot.rowNumber)?.holeShotNumber ?? null,
        courseHolePar: courseShotByRowNumber.get(shot.rowNumber)?.holePar ?? null,
        courseHoleYards: courseShotByRowNumber.get(shot.rowNumber)?.holeYards ?? null,
        distanceRemainingYd: courseShotByRowNumber.get(shot.rowNumber)?.distanceRemainingYd ?? null,
        qualityTag: shot.qualityTag,
        clubDataEstType: shot.clubDataEstType,
        sourceRawJson: shot.sourceRawJson,
      })),
    );

    for (const [clubKey, clubId] of clubIdByKey) {
      const firstShotForClub = input.shots.find((shot) => shot.clubKey === clubKey);

      if (!isTrackedClubType(firstShotForClub?.clubType) || isShortGameTouchClubType(firstShotForClub?.clubType)) {
        continue;
      }

      const clubShots = await tx
        .select({
          clubType: shots.clubType,
          carryYd: shots.carryYd,
          totalYd: shots.totalYd,
          sideCarryYd: shots.sideCarryYd,
          ballSpeedMph: shots.ballSpeedMph,
          launchAngleDeg: shots.launchAngleDeg,
          courseHoleNumber: shots.courseHoleNumber,
          sessionType: sessions.type,
          shotCategory: shots.shotCategory,
          qualityTag: shots.qualityTag,
          shotAt: shots.shotAt,
        })
        .from(shots)
        .innerJoin(sessions, eq(shots.sessionId, sessions.id))
        .where(and(eq(shots.userId, userId), eq(shots.clubId, clubId)))
        .orderBy(desc(shots.shotAt));
      const stock = calculateStockYardage(clubShots, 50, { clubType: firstShotForClub?.clubType });

      if (stock.sampleSize > 0) {
        await tx.insert(stockYardages).values({
          userId,
          clubId,
          sampleSize: stock.sampleSize,
          carryMedianYd: stock.carryMedianYd,
          carryMeanYd: stock.carryMeanYd,
          carryP75Yd: stock.carryP75Yd,
          carryP25Yd: stock.carryP25Yd,
          totalMedianYd: stock.totalMedianYd,
          dispersionLeftYd: stock.dispersionLeftYd,
          dispersionRightYd: stock.dispersionRightYd,
          confidenceScore: stock.confidenceScore,
          recommendedPlayNumberYd: stock.recommendedPlayNumberYd,
        });
      }
    }

    return {
      sessionId: session.id,
      shotCount: input.shots.length,
      clubCount: new Set(input.shots.filter((shot) => isTrackedClubType(shot.clubType)).map((shot) => shot.clubKey)).size,
      rawRowCount: input.rawRows.length,
      skipped: false,
      longestShotNotifications,
    };
  });
}

export function buildLongestShotNotifications({
  importedShots,
  clubIdByKey,
  previousLongestByClubId,
  fileName,
}: {
  importedShots: ParsedRapsodoShot[];
  clubIdByKey: Map<string, string>;
  previousLongestByClubId: Map<string, number | null>;
  fileName: string;
}): LongestShotNotification[] {
  const bestShotByClubKey = new Map<string, ParsedRapsodoShot>();

  for (const shot of importedShots) {
    if (!isTrackedClubType(shot.clubType) || isShortGameTouchClubType(shot.clubType)) {
      continue;
    }

    const currentDistance = shotDistanceYd(shot);

    if (currentDistance === null) {
      continue;
    }

    const bestShot = bestShotByClubKey.get(shot.clubKey);
    const bestDistance = bestShot ? shotDistanceYd(bestShot) : null;

    if (bestDistance === null || currentDistance > bestDistance) {
      bestShotByClubKey.set(shot.clubKey, shot);
    }
  }

  return [...bestShotByClubKey.values()]
    .map((shot) => {
      const clubId = clubIdByKey.get(shot.clubKey);
      const shotDistance = shotDistanceYd(shot);

      if (!clubId || shotDistance === null) {
        return null;
      }

      const previousDistance = previousLongestByClubId.get(clubId);

      if (previousDistance === undefined || previousDistance === null || shotDistance <= previousDistance) {
        return null;
      }

      return {
        clubId,
        clubType: shot.clubType,
        clubLabel: shot.clubLabel,
        brandModel: [shot.clubBrand, shot.clubModel].filter(Boolean).join(" ") || "Unspecified model",
        fileName,
        shotNumber: shot.shotNumber,
        shotDistanceYd: roundOne(shotDistance),
        previousDistanceYd: roundOne(previousDistance),
        distanceType: shot.totalYd !== null ? "total" : "carry",
        carryYd: shot.carryYd,
        totalYd: shot.totalYd,
      } satisfies LongestShotNotification;
    })
    .filter((notification): notification is LongestShotNotification => notification !== null)
    .sort((left, right) => right.shotDistanceYd - left.shotDistanceYd);
}

function hashRawCsv(rawCsvText: string) {
  return createHash("sha256").update(rawCsvText, "utf8").digest("hex");
}

function shotDistanceYd(shot: Pick<ParsedRapsodoShot, "carryYd" | "totalYd">) {
  return shot.totalYd ?? shot.carryYd;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function validateInput(input: SaveRapsodoImportInput): SaveRapsodoImportInput {
  if (input.source !== "rapsodo") {
    throw new Error("Only Rapsodo CSV imports are supported in this slice.");
  }

  if (!["range", "round", "simulator", "simulated_course"].includes(input.sessionType)) {
    throw new Error("Session type is invalid.");
  }

  if (!["meters", "yards"].includes(input.distanceUnit)) {
    throw new Error("Distance unit is invalid.");
  }

  if (!input.rawCsvText.trim()) {
    throw new Error("CSV file is empty.");
  }

  return {
    ...input,
    fileName: input.fileName.trim().slice(0, 260) || "rapsodo-import.csv",
    fileSizeBytes: Number.isFinite(input.fileSizeBytes) ? Math.max(0, input.fileSizeBytes) : 0,
    courseName: input.courseName?.trim().slice(0, 180),
    courseScorecardText: input.courseScorecardText?.slice(0, 12000),
    courseHoleShotCounts: sanitizeHoleShotCounts(input.courseHoleShotCounts),
    courseHoleScoring: sanitizeHoleScoring(input.courseHoleScoring),
    notes: input.notes?.slice(0, 2000),
  };
}

function buildCoursePlan(
  input: SaveRapsodoImportInput,
  parsedShots: ParsedRapsodoShot[],
): CourseInferenceResult | null {
  if (input.sessionType !== "simulated_course" || !input.courseScorecardText?.trim()) {
    return null;
  }

  const scorecard = parseScorecardText(input.courseScorecardText);

  if (scorecard.holes.length === 0) {
    throw new Error("Add a scorecard with hole, par, and yardage rows before saving a simulated course.");
  }

  const coursePlan =
    input.courseHoleShotCounts && input.courseHoleShotCounts.length > 0
      ? inferCourseShotsFromHoleShotCounts(parsedShots, scorecard.holes, input.courseHoleShotCounts)
      : inferCourseShots(parsedShots, scorecard.holes);
  coursePlan.warnings.push(...scorecard.warnings);

  return coursePlan;
}

function sanitizeHoleShotCounts(input: SaveRapsodoImportInput["courseHoleShotCounts"]) {
  if (!input) {
    return undefined;
  }

  return input
    .map((entry) => ({
      holeNumber: sanitizeHoleNumber(entry.holeNumber),
      shotCount: sanitizeNonNegativeInteger(entry.shotCount),
    }))
    .filter((entry) => entry.holeNumber !== null && entry.shotCount !== null)
    .map((entry) => ({
      holeNumber: entry.holeNumber as number,
      shotCount: Math.min(10, entry.shotCount as number),
    }));
}

function sanitizeHoleScoring(input: SaveRapsodoImportInput["courseHoleScoring"]) {
  if (!input) {
    return undefined;
  }

  return input
    .map((entry) => {
      const holeNumber = sanitizeHoleNumber(entry.holeNumber);
      const csvShotCount = sanitizeNonNegativeInteger(entry.csvShotCount);
      const putts = sanitizeNullableNonNegativeInteger(entry.putts);
      const penalties = sanitizeNullableNonNegativeInteger(entry.penalties);
      const score = sanitizeNullableNonNegativeInteger(entry.score);
      const netScore = sanitizeNullableNonNegativeInteger(entry.netScore ?? null);
      const strokeIndex = sanitizeNullableNonNegativeInteger(entry.strokeIndex ?? null);

      if (holeNumber === null || csvShotCount === null) {
        return null;
      }

      return {
        holeNumber,
        csvShotCount,
        putts,
        penalties,
        score,
        netScore,
        fairwayHit: sanitizeNullableBoolean(entry.fairwayHit),
        gir: sanitizeNullableBoolean(entry.gir),
        strokeIndex,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function sanitizeHoleNumber(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  return rounded >= 1 && rounded <= 18 ? rounded : null;
}

function sanitizeNonNegativeInteger(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function sanitizeNullableNonNegativeInteger(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function sanitizeNullableBoolean(value: boolean | null | undefined) {
  return typeof value === "boolean" ? value : null;
}

function buildScorecardSnapshot(
  coursePlan: CourseInferenceResult,
  scoring: SaveRapsodoImportInput["courseHoleScoring"],
) {
  const scoringByHole = new Map((scoring ?? []).map((entry) => [entry.holeNumber, entry]));

  return coursePlan.holes.map((hole) => {
    const review = scoringByHole.get(hole.holeNumber);
    const csvShotCount = hole.shots.length;
    const penalties = review?.penalties ?? 0;
    const score = review?.score ?? null;
    const putts = review?.putts ?? (score === null ? null : Math.max(0, score - csvShotCount - penalties));

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      name: hole.name,
      csvShotCount,
      progressYd: hole.progressYd,
      distanceRemainingYd: hole.distanceRemainingYd,
      putts,
      penalties,
      score,
      netScore: review?.netScore ?? null,
      fairwayHit: review?.fairwayHit ?? null,
      gir: review?.gir ?? null,
      strokeIndex: review?.strokeIndex ?? null,
    };
  });
}

function parseSessionDate(value: string) {
  const parsed = value
    ? new Date(value.includes("T") ? value : `${value}T12:00:00.000Z`)
    : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function revalidateImportPages() {
  try {
    revalidatePath("/dashboard");
    revalidatePath("/today");
    revalidatePath("/import");
    revalidatePath("/bag");
    revalidatePath("/shots");
    revalidatePath("/rounds");
  } catch {
    // Allows the import helper to be reused by local scripts outside a Next.js request.
  }
}
