import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  clubs,
  golfTrainingSessions,
  importFiles,
  importRows,
  sessions,
  shots,
  stockYardages,
  strokesGainedBaselines,
  strokesGainedShotEvents,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { evaluateAchievementsAfterImport } from "@/lib/achievements/service";
import type { AchievementUnlockNotification } from "@/lib/achievements/types";
import { evaluateCoachDrillAchievementsForUser } from "@/lib/coach-drill-awards";
import { isShortGameTouchClubType, isTrackedClubType } from "@/lib/club-format";
import {
  canonicalKnownCourseNameForSession,
  ensureCourseForSession,
  type CourseSessionLink,
} from "@/lib/courses";
import { requireCurrentUserId } from "@/lib/current-user";
import { inferPlayContext } from "@/lib/play-context";
import { recordImportFeedItems } from "@/lib/social";
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
  type RapsodoColumnMapping,
  type ShotCategory,
  buildClubKey,
  formatClubType,
  normalizeClubType,
} from "@/lib/rapsodo/parser";
import {
  parseLaunchMonitorImportCsv,
  type ParsedLaunchMonitorImportResult,
} from "@/lib/imports/normalized-import";
import type { LaunchMonitorProviderKind } from "@/lib/imports/providers";
import {
  DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
  buildStrokesGainedEventsFromCourseShots,
} from "@/lib/strokes-gained";
import { buildImportedTrainingSessionRow } from "@/lib/training/sourceLoad";
import {
  MAX_IMPORT_CSV_BYTES,
  MAX_IMPORT_CSV_ROWS,
  MAX_IMPORT_FILES_PER_BATCH,
  MAX_PARSED_SHOTS_PER_FILE,
  formatMegabytes,
  utf8ByteLength,
} from "@/lib/imports/import-limits";

export type RapsodoShotOverride = {
  rowNumber: number;
  clubType: string;
  clubBrand?: string | null;
  clubModel?: string | null;
  shotCategory?: ShotCategory;
  qualityTag?: string | null;
};

export type SaveRapsodoImportInput = {
  rawCsvText: string;
  fileName: string;
  fileSizeBytes: number;
  source: LaunchMonitorProviderKind;
  sessionType: "range" | "round" | "simulator" | "simulated_course";
  sessionDate: string;
  distanceUnit: DistanceUnit;
  columnMapping?: RapsodoColumnMapping;
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
  shotOverrides?: RapsodoShotOverride[];
  notes?: string;
};

export type LongestShotNotification = {
  sessionId: string;
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
      savedSessionId: string | null;
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

const BAD_DATA_QUALITY_TAG = "bad_data";
const WEDGE_CLUB_TYPES = new Set(["pw", "gw", "aw", "sw", "lw", "wedge"]);
const SHORT_WEDGE_CLUB_TYPES = new Set(["sw", "lw", "wedge"]);

export async function saveRapsodoImport(
  input: SaveRapsodoImportInput,
): Promise<SaveRapsodoImportResult> {
  return saveLaunchMonitorImport(input);
}

export async function saveLaunchMonitorImport(
  input: SaveRapsodoImportInput,
): Promise<SaveRapsodoImportResult> {
  const startedAt = Date.now();
  try {
    const userId = await requireCurrentUserId();
    const validatedInput = validateInput(input);
    const parsed = await parseLaunchMonitorImportCsv({
      rawCsvText: validatedInput.rawCsvText,
      fileName: validatedInput.fileName,
      source: validatedInput.source,
      fallbackDistanceUnit: validatedInput.distanceUnit,
      columnMapping: validatedInput.columnMapping,
    });
    validateParsedImport(validatedInput, parsed);

    if (parsed.shots.length === 0) {
      return {
        ok: false,
        message: parsed.warnings[0] ?? "No shots were found in the uploaded CSV.",
      };
    }

    const importedShots = applyRapsodoShotOverridesForImport(
      parsed.shots,
      validatedInput.shotOverrides,
    );
    const coursePlan = buildCoursePlan(validatedInput, importedShots);
    const courseName =
      canonicalKnownCourseNameForSession(validatedInput.courseName) ?? validatedInput.courseName;
    const courseLink =
      validatedInput.sessionType === "simulated_course"
        ? await ensureCourseForSession({
            userId,
            courseName,
            scorecardHoles: coursePlan?.holes,
          })
        : { courseId: null, teeSetId: null };

    const result = await persistImport({
      ...validatedInput,
      courseName,
      userId,
      sessionDate: parsed.exportedAtIso ?? validatedInput.sessionDate,
      shots: importedShots,
      rawRows: parsed.rawRows,
      coursePlan,
      courseLink,
    });

    const achievementUnlockNotifications = result.skipped
      ? []
      : [
          ...(await evaluateAchievementsAfterImport(userId)).unlockedAchievements,
          ...(await evaluateCoachDrillAchievementsForUser(userId)).notifications,
        ];

    if (!result.skipped) {
      await recordImportFeedItems({
        userId,
        sessionId: result.sessionId,
        fileName: validatedInput.fileName,
        source: validatedInput.source,
        shotCount: result.shotCount,
        rawRowCount: result.rawRowCount,
        longestShotNotifications: result.longestShotNotifications,
        achievementUnlockNotifications,
      });
    }

    revalidateImportPages();
    logImportTelemetry("fkh.import.saved", {
      userId,
      fileName: validatedInput.fileName,
      fileHash: hashRawCsv(validatedInput.rawCsvText),
      fileSizeBytes: utf8ByteLength(validatedInput.rawCsvText),
      rawRowCount: parsed.rawRows.length,
      parsedShotCount: parsed.shots.length,
      warningCount: parsed.warnings.length + (coursePlan?.warnings.length ?? 0),
      duplicate: result.skipped,
      parseVersion: `${validatedInput.source}-v1`,
      source: validatedInput.source,
      offlineReplay: false,
      durationMs: Date.now() - startedAt,
    });

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

  if (inputs.length > MAX_IMPORT_FILES_PER_BATCH) {
    return {
      ok: false,
      message: `Import up to ${MAX_IMPORT_FILES_PER_BATCH} CSV files at a time. Split larger batches into smaller imports.`,
    };
  }

  let validatedInputs: SaveRapsodoImportInput[];
  try {
    validatedInputs = inputs.map(validateInput);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Import validation failed.",
    };
  }

  const warnings: string[] = [];
  const uniqueClubKeys = new Set<string>();
  let shotCount = 0;
  let rawRowCount = 0;
  let sessionCount = 0;
  let skippedCount = 0;
  let savedSessionId: string | null = null;
  const longestShotNotifications: LongestShotNotification[] = [];
  const achievementUnlockNotifications: AchievementUnlockNotification[] = [];

  const parsedInputs: Array<{
    input: SaveRapsodoImportInput;
    parsed: ParsedLaunchMonitorImportResult;
  }> = [];
  for (const input of validatedInputs) {
    const parsed = await parseLaunchMonitorImportCsv({
      rawCsvText: input.rawCsvText,
      fileName: input.fileName,
      source: input.source,
      fallbackDistanceUnit: input.distanceUnit,
      columnMapping: input.columnMapping,
    });

    try {
      validateParsedImport(input, parsed);
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? `${input.fileName}: ${error.message}`
            : "Import validation failed.",
      };
    }

    parsedInputs.push({ input, parsed });
  }

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
      savedSessionId = result.sessionId;
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
    savedSessionId,
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
    userId: string;
    shots: ParsedRapsodoShot[];
    rawRows: ParsedRapsodoRawRow[];
    coursePlan: CourseInferenceResult | null;
    courseLink: CourseSessionLink;
  },
) {
  const db = getDb();
  const userId = input.userId;
  const preferredUnits = "yards";
  const now = new Date();
  const sessionDate = parseSessionDate(input.sessionDate);
  const rawCsvHash = hashRawCsv(input.rawCsvText);
  const playContext = inferPlayContext({
    sessionType: input.sessionType,
    source: input.source,
    title: input.fileName,
  });
  const uniqueClubKeys = new Set(input.shots.map((shot) => shot.clubKey));
  const courseShotByRowNumber = new Map(
    (input.coursePlan?.shots ?? []).map((shot) => [shot.sourceShot.rowNumber, shot]),
  );

  return db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: userId,
        preferredUnits,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
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
      await tx
        .insert(golfTrainingSessions)
        .values(
          buildImportedTrainingSessionRow({
            userId,
            sourceId: existingImport.id,
            source: input.source,
            sessionType: input.sessionType,
            sessionDate,
            fileName: input.fileName,
            courseName: input.courseName,
            shotCount: input.shots.length,
            scorecardHoleCount: input.coursePlan?.scorecard.length ?? null,
          }),
        )
        .onConflictDoNothing();

      await tx
        .insert(importFiles)
        .values({
          userId,
          sessionId: existingImport.id,
          source: input.source,
          parseVersion: `${input.source}-v1`,
          playContext,
          fileName: input.fileName,
          fileSizeBytes: input.fileSizeBytes,
          rawCsvHash,
          status: "duplicate",
          metadataJson: {
            skippedSessionId: existingImport.id,
          },
          updatedAt: now,
        })
        .onConflictDoNothing();

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
        playContext,
        date: sessionDate,
        courseId: input.courseLink.courseId,
        teeSetId: input.courseLink.teeSetId,
        notes: input.notes?.trim() || null,
        courseName: input.courseName?.trim() || null,
        scorecardJson: input.coursePlan
          ? buildScorecardSnapshot(input.coursePlan, input.courseHoleScoring)
          : null,
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
        rawCsvHash,
        rawCsvText: input.rawCsvText,
      })
      .returning({ id: sessions.id });

    await tx
      .insert(importFiles)
      .values({
        userId,
        sessionId: session.id,
        source: input.source,
        parseVersion: `${input.source}-v1`,
        playContext,
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
        rawCsvHash,
        status: "saved",
        metadataJson: {
          sessionType: input.sessionType,
          courseName: input.courseName?.trim() || null,
        },
        updatedAt: now,
      })
      .onConflictDoNothing();

    const clubIdByKey = new Map<string, string>();

    if (input.rawRows.length > 0) {
      await tx.insert(importRows).values(
        input.rawRows.map((row) => ({
          userId,
          sessionId: session.id,
          rowNumber: row.rowNumber,
          rowType: row.rowType,
          playContext,
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
      sessionId: session.id,
      fileName: input.fileName,
    });

    const insertedShots = await tx
      .insert(shots)
      .values(
        input.shots.map((shot) => ({
          userId,
          sessionId: session.id,
          clubId: clubIdByKey.get(shot.clubKey) ?? "",
          playContext,
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
          faceAngleDeg: shot.faceAngleDeg,
          descentAngleDeg: shot.descentAngleDeg,
          smashFactor: shot.smashFactor,
          spinRate: shot.spinRate,
          spinAxis: shot.spinAxis,
          shotShape: shot.shotShape,
          shotCategory:
            courseShotByRowNumber.get(shot.rowNumber)?.shotCategory ?? shot.shotCategory,
          courseHoleNumber: courseShotByRowNumber.get(shot.rowNumber)?.holeNumber ?? null,
          courseHoleShotNumber: courseShotByRowNumber.get(shot.rowNumber)?.holeShotNumber ?? null,
          courseHolePar: courseShotByRowNumber.get(shot.rowNumber)?.holePar ?? null,
          courseHoleYards: courseShotByRowNumber.get(shot.rowNumber)?.holeYards ?? null,
          distanceRemainingYd:
            courseShotByRowNumber.get(shot.rowNumber)?.distanceRemainingYd ?? null,
          qualityTag: shot.qualityTag,
          clubDataEstType: shot.clubDataEstType,
          sourceRawJson: shot.sourceRawJson,
        })),
      )
      .returning({ id: shots.id });

    await tx
      .insert(golfTrainingSessions)
      .values(
        buildImportedTrainingSessionRow({
          userId,
          sourceId: session.id,
          source: input.source,
          sessionType: input.sessionType,
          sessionDate,
          fileName: input.fileName,
          courseName: input.courseName,
          shotCount: input.shots.length,
          scorecardHoleCount: input.coursePlan?.scorecard.length ?? null,
        }),
      )
      .onConflictDoNothing();

    if (input.coursePlan?.shots.length) {
      const shotIdByRowNumber = new Map<number, string>();

      input.shots.forEach((shot, index) => {
        const insertedShot = insertedShots[index];

        if (insertedShot) {
          shotIdByRowNumber.set(shot.rowNumber, insertedShot.id);
        }
      });

      const baselineRows = await tx
        .select({
          category: strokesGainedBaselines.category,
          lie: strokesGainedBaselines.lie,
          distanceStartYd: strokesGainedBaselines.distanceStartYd,
          distanceEndYd: strokesGainedBaselines.distanceEndYd,
          expectedStrokes: strokesGainedBaselines.expectedStrokes,
        })
        .from(strokesGainedBaselines);
      const strokesGainedEvents = buildStrokesGainedEventsFromCourseShots({
        userId,
        sessionId: session.id,
        courseShots: input.coursePlan.shots,
        holeScoring: input.courseHoleScoring,
        shotIdByRowNumber,
        baselineBuckets:
          baselineRows.length > 0 ? baselineRows : DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
      });

      if (strokesGainedEvents.length > 0) {
        await tx.insert(strokesGainedShotEvents).values(strokesGainedEvents);
      }
    }

    for (const [clubKey, clubId] of clubIdByKey) {
      const firstShotForClub = input.shots.find((shot) => shot.clubKey === clubKey);

      if (
        !isTrackedClubType(firstShotForClub?.clubType) ||
        isShortGameTouchClubType(firstShotForClub?.clubType)
      ) {
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
          playContext: shots.playContext,
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
          playContext,
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
      clubCount: new Set(
        input.shots.filter((shot) => isTrackedClubType(shot.clubType)).map((shot) => shot.clubKey),
      ).size,
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
  sessionId,
  fileName,
}: {
  importedShots: ParsedRapsodoShot[];
  clubIdByKey: Map<string, string>;
  previousLongestByClubId: Map<string, number | null>;
  sessionId: string;
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

      if (
        previousDistance === undefined ||
        previousDistance === null ||
        shotDistance <= previousDistance
      ) {
        return null;
      }

      return {
        sessionId,
        clubId,
        clubType: shot.clubType,
        clubLabel: shot.clubLabel,
        brandModel:
          [shot.clubBrand, shot.clubModel].filter(Boolean).join(" ") || "Unspecified model",
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

function logImportTelemetry(event: string, payload: Record<string, unknown>) {
  console.info(event, payload);
}

function validateInput(input: SaveRapsodoImportInput): SaveRapsodoImportInput {
  if (!["rapsodo", "square", "trackman"].includes(input.source)) {
    throw new Error("Launch monitor source is invalid.");
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

  const actualSizeBytes = utf8ByteLength(input.rawCsvText);
  const reportedSizeBytes = Number.isFinite(input.fileSizeBytes) ? input.fileSizeBytes : 0;

  if (Math.max(actualSizeBytes, reportedSizeBytes) > MAX_IMPORT_CSV_BYTES) {
    throw new Error(
      `This file is too large. Split it into smaller session exports. Maximum CSV size is ${formatMegabytes(
        MAX_IMPORT_CSV_BYTES,
      )}.`,
    );
  }

  return {
    ...input,
    fileName: input.fileName.trim().slice(0, 260) || `${input.source}-import.csv`,
    fileSizeBytes: Number.isFinite(input.fileSizeBytes) ? Math.max(0, input.fileSizeBytes) : 0,
    columnMapping: sanitizeColumnMapping(input.columnMapping),
    courseName: input.courseName?.trim().slice(0, 180),
    courseScorecardText: input.courseScorecardText?.slice(0, 12000),
    courseHoleShotCounts: sanitizeHoleShotCounts(input.courseHoleShotCounts),
    courseHoleScoring: sanitizeHoleScoring(input.courseHoleScoring),
    shotOverrides: sanitizeShotOverrides(input.shotOverrides),
    notes: input.notes?.slice(0, 2000),
  };
}

function validateParsedImport(
  input: SaveRapsodoImportInput,
  parsed: ParsedLaunchMonitorImportResult,
) {
  if (parsed.rawRows.length > MAX_IMPORT_CSV_ROWS) {
    throw new Error(
      `This file has too many rows. Split it into smaller session exports. Maximum row count is ${MAX_IMPORT_CSV_ROWS.toLocaleString(
        "en-GB",
      )}.`,
    );
  }

  if (parsed.shots.length > MAX_PARSED_SHOTS_PER_FILE) {
    throw new Error(
      `This file has too many parsed shots. Split it into smaller session exports. Maximum shots per file is ${MAX_PARSED_SHOTS_PER_FILE.toLocaleString(
        "en-GB",
      )}.`,
    );
  }

  logImportTelemetry("fkh.import.parsed", {
    fileName: input.fileName,
    fileHash: hashRawCsv(input.rawCsvText),
    fileSizeBytes: utf8ByteLength(input.rawCsvText),
    rawRowCount: parsed.rawRows.length,
    parsedShotCount: parsed.shots.length,
    warningCount: parsed.warnings.length,
    parseVersion: `${input.source}-v1`,
    source: input.source,
  });
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
    throw new Error(
      "Add a scorecard with hole, par, and yardage rows before saving a simulated course.",
    );
  }

  const coursePlan =
    input.courseHoleShotCounts && input.courseHoleShotCounts.length > 0
      ? inferCourseShotsFromHoleShotCounts(parsedShots, scorecard.holes, input.courseHoleShotCounts)
      : inferCourseShots(parsedShots, scorecard.holes);
  coursePlan.warnings.push(...scorecard.warnings);

  return coursePlan;
}

function sanitizeColumnMapping(input: SaveRapsodoImportInput["columnMapping"]) {
  if (!input) {
    return undefined;
  }

  const sanitized: RapsodoColumnMapping = {};

  for (const [field, header] of Object.entries(input) as Array<
    [keyof RapsodoColumnMapping, string | undefined]
  >) {
    const value = header?.trim();

    if (value) {
      sanitized[field] = value.slice(0, 160);
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
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

function sanitizeShotOverrides(input: SaveRapsodoImportInput["shotOverrides"]) {
  if (!input) {
    return undefined;
  }

  const seenRows = new Set<number>();
  const overrides: RapsodoShotOverride[] = [];

  for (const override of input) {
    const rowNumber = sanitizeNonNegativeInteger(override.rowNumber);
    const clubType = normalizeClubType(override.clubType);

    if (rowNumber === null || rowNumber <= 0 || !clubType || seenRows.has(rowNumber)) {
      continue;
    }

    seenRows.add(rowNumber);
    overrides.push({
      rowNumber,
      clubType,
      clubBrand: nullableOverrideText(override.clubBrand, 120),
      clubModel: nullableOverrideText(override.clubModel, 160),
      shotCategory: sanitizeShotCategory(override.shotCategory),
      qualityTag: nullableOverrideText(override.qualityTag, 40),
    });
  }

  return overrides;
}

function sanitizeShotCategory(value: ShotCategory | undefined) {
  return value && ["full", "pitch", "chip", "recovery", "tee", "approach"].includes(value)
    ? value
    : undefined;
}

function nullableOverrideText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function withInferredImportedQualityTag(shot: ParsedRapsodoShot) {
  if (shot.qualityTag) {
    return shot;
  }

  const qualityTag = inferImportedShotQualityTag(shot);
  return qualityTag ? { ...shot, qualityTag } : shot;
}

function inferImportedShotQualityTag(shot: ParsedRapsodoShot) {
  const clubType = normalizeClubType(shot.clubType);

  if (
    WEDGE_CLUB_TYPES.has(clubType) &&
    isFiniteNumber(shot.ballSpeedMph) &&
    shot.ballSpeedMph >= 115 &&
    isFiniteNumber(shot.launchAngleDeg) &&
    shot.launchAngleDeg <= 15
  ) {
    return BAD_DATA_QUALITY_TAG;
  }

  if (SHORT_WEDGE_CLUB_TYPES.has(clubType) && isFiniteNumber(shot.carryYd) && shot.carryYd >= 170) {
    return BAD_DATA_QUALITY_TAG;
  }

  return null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function applyRapsodoShotOverridesForImport(
  shotsToImport: ParsedRapsodoShot[],
  overrides: RapsodoShotOverride[] | undefined,
) {
  if (!overrides || overrides.length === 0) {
    return shotsToImport.map(withInferredImportedQualityTag);
  }

  const overrideByRowNumber = new Map(overrides.map((override) => [override.rowNumber, override]));

  return shotsToImport.map((shot) => {
    const override = overrideByRowNumber.get(shot.rowNumber);

    if (!override) {
      return withInferredImportedQualityTag(shot);
    }

    const clubType = normalizeClubType(override.clubType);
    const clubBrand = override.clubBrand ?? null;
    const clubModel = override.clubModel ?? null;

    return withInferredImportedQualityTag({
      ...shot,
      clubType,
      clubLabel: formatClubType(clubType),
      clubBrand,
      clubModel,
      clubKey: buildClubKey(clubType, clubBrand, clubModel),
      shotCategory: override.shotCategory ?? shot.shotCategory,
      qualityTag: override.qualityTag ?? shot.qualityTag,
    });
  });
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
    const putts =
      review?.putts ?? (score === null ? null : Math.max(0, score - csvShotCount - penalties));

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
    revalidatePath("/courses");
    revalidatePath("/stats/training-over-time");
  } catch {
    // Allows the import helper to be reused by local scripts outside a Next.js request.
  }
}
