"use server";

import { directionalMetricSql } from "@/lib/directional-confidence-sql";

import { redirect } from "next/navigation";
import { readMobileSpeedSaveReceipt } from "@/lib/mobile-speed-save-receipt";
import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  clubs,
  sessions as practiceSessions,
  shots,
  speedTrainingGoals,
  speedTrainingSessions,
  speedTrainingSwings,
} from "@/db/schema";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { syncAchievementsForUser } from "@/lib/achievements/service";
import { formatClubModelName, formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { effectiveShotReviewStatus } from "@/lib/shot-review";
import {
  parseSpeedReadings,
  summarizePhasedReadingsForPersistence,
  type SpeedTrainingPhase,
} from "@/lib/speed-training";
import {
  buildPersonalDriverCorridor,
  buildSpeedTransferMetadata,
  isSpeedTransferUuid,
  withSpeedTransferMetadata,
} from "@/lib/speed-transfer-test";

const IMPLEMENT_KINDS = new Set(["club", "speed_stick", "weighted_club", "other"]);
const HANDEDNESS_VALUES = new Set(["dominant", "non_dominant", "both"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export async function createManualSpeedSessionAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const mobileSaveReceipt = readMobileSpeedSaveReceipt({
    draftId: formValue(formData, "mobileDraftId"),
    revision: Number(formValue(formData, "mobileDraftRevision")),
  });
  const phasedReadings = parsePhasedSpeedReadings(formData);
  const readings = phasedReadings.map((reading) => reading.clubSpeedMph);
  const readingSummary = summarizePhasedReadingsForPersistence(phasedReadings);
  const fallbackSummary = buildFallbackSummary(formData);
  const summary = readingSummary ?? fallbackSummary;

  if (!summary) {
    fail("Add the swing speeds, or enter min, average, max and swing count.");
  }

  const db = getDb();
  const implementKind = normalizeAllowedValue(
    formValue(formData, "implementKind"),
    IMPLEMENT_KINDS,
    "club",
  );
  const handedness = normalizeAllowedValue(
    formValue(formData, "handedness"),
    HANDEDNESS_VALUES,
    "dominant",
  );
  const sessionDate = parseSessionDate(formValue(formData, "sessionDate"));
  const targetSpeedMph = parseOptionalSpeed(formValue(formData, "targetSpeedMph"));
  const notes = emptyToNull(formValue(formData, "notes"));
  const speedSystem = emptyToNull(formValue(formData, "speedSystem"));
  const clubIdInput = emptyToNull(formValue(formData, "clubId"));
  const customImplementLabel = emptyToNull(formValue(formData, "implementLabel"));
  const [club] = clubIdInput
    ? await db
        .select({
          id: clubs.id,
          type: clubs.type,
          brand: clubs.brand,
          model: clubs.model,
        })
        .from(clubs)
        .where(and(eq(clubs.id, clubIdInput), eq(clubs.userId, userId)))
        .limit(1)
    : [null];

  if (clubIdInput && !club) {
    fail("That club is not available in your bag.");
  }

  const implementLabel =
    club !== null
      ? `${formatClubType(club.type)} - ${formatClubModelName(club)}`
      : (customImplementLabel ?? labelForImplementKind(implementKind));

  const savedSessionId = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(speedTrainingSessions)
      .values({
        userId,
        source: "manual",
        sessionDate,
        title: formValue(formData, "title") || "Speed session",
        clubId: club?.id ?? null,
        implementKind,
        implementLabel,
        speedSystem,
        handedness,
        swingCount: summary.count,
        minSpeedMph: summary.minSpeedMph,
        avgSpeedMph: summary.avgSpeedMph,
        maxSpeedMph: summary.maxSpeedMph,
        targetSpeedMph,
        notes,
        rawMetadataJson: {
          entryMode: readingSummary ? "readings" : "summary",
          readingsProvided: readings.length,
          phaseSchemaVersion: phasedReadings.length > 0 ? 1 : null,
          phaseCounts: speedPhaseCounts(phasedReadings),
          ...(mobileSaveReceipt ? { mobileSaveReceipt } : {}),
        },
      })
      .returning({ id: speedTrainingSessions.id });

    if (session && readings.length > 0) {
      await tx.insert(speedTrainingSwings).values(
        phasedReadings.map(({ clubSpeedMph, phase }, index) => ({
          userId,
          speedSessionId: session.id,
          swingNumber: index + 1,
          clubSpeedMph,
          sourceRawJson: {
            source: "manual",
            phase,
          },
        })),
      );
    }
    return session?.id;
  });

  await syncSpeedAchievementsAndFlash(userId);

  revalidatePath("/speed");
  if (mobileSaveReceipt && savedSessionId)
    redirect(`/speed?speed_saved=1&speed_session=${encodeURIComponent(savedSessionId)}`);
  redirect("/speed?speed_saved=1");
}

export async function updateSpeedGoalsAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const activeClubs = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(and(eq(clubs.userId, userId), eq(clubs.active, true)));
  const activeClubIds = new Set(activeClubs.map((club) => club.id));

  await db.transaction(async (tx) => {
    await upsertOrDeleteGoal(tx, {
      userId,
      goalKey: "driver_global",
      clubId: null,
      targetSpeedMph: parseOptionalSpeed(formValue(formData, "driverGlobalTarget")),
      targetDate: parseOptionalDate(formValue(formData, "driverGlobalDate")),
      notes: emptyToNull(formValue(formData, "driverGlobalNotes")),
    });

    for (const clubId of activeClubIds) {
      await upsertOrDeleteGoal(tx, {
        userId,
        goalKey: clubGoalKey(clubId),
        clubId,
        targetSpeedMph: parseOptionalSpeed(formValue(formData, `clubTarget:${clubId}`)),
        targetDate: parseOptionalDate(formValue(formData, `clubTargetDate:${clubId}`)),
        notes: null,
      });
    }
  });

  await syncSpeedAchievementsAndFlash(userId);

  revalidatePath("/speed");
  revalidatePath("/coach");
  redirect("/speed?speed_saved=goals");
}

export async function updateSpeedSessionAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = formValue(formData, "sessionId");

  if (!sessionId) {
    fail("Choose a speed session to update.");
  }

  const db = getDb();
  const [existingSession] = await db
    .select({
      id: speedTrainingSessions.id,
      clubId: speedTrainingSessions.clubId,
      swingCount: speedTrainingSessions.swingCount,
      minSpeedMph: speedTrainingSessions.minSpeedMph,
      avgSpeedMph: speedTrainingSessions.avgSpeedMph,
      maxSpeedMph: speedTrainingSessions.maxSpeedMph,
      rawMetadataJson: speedTrainingSessions.rawMetadataJson,
    })
    .from(speedTrainingSessions)
    .where(and(eq(speedTrainingSessions.id, sessionId), eq(speedTrainingSessions.userId, userId)))
    .limit(1);

  if (!existingSession) {
    fail("That speed session was not found.");
  }

  const phasedReadings = parsePhasedSpeedReadings(formData);
  const readings = phasedReadings.map((reading) => reading.clubSpeedMph);
  const readingSummary = summarizePhasedReadingsForPersistence(phasedReadings);
  const fallbackSummary = buildFallbackSummary(formData);
  const summary = readingSummary ??
    fallbackSummary ?? {
      count: existingSession.swingCount,
      minSpeedMph: existingSession.minSpeedMph,
      avgSpeedMph: existingSession.avgSpeedMph,
      maxSpeedMph: existingSession.maxSpeedMph,
    };

  if (
    summary.minSpeedMph === null ||
    summary.avgSpeedMph === null ||
    summary.maxSpeedMph === null
  ) {
    fail("Add the swing speeds, or enter min, average, max and swing count.");
  }

  const sessionFields = await buildSessionFormFields({
    db,
    userId,
    formData,
  });
  const retainedMetadata =
    existingSession.clubId === sessionFields.clubId
      ? existingSession.rawMetadataJson
      : withSpeedTransferMetadata(existingSession.rawMetadataJson, null);

  await db.transaction(async (tx) => {
    await tx
      .update(speedTrainingSessions)
      .set({
        sessionDate: sessionFields.sessionDate,
        title: sessionFields.title,
        clubId: sessionFields.clubId,
        implementKind: sessionFields.implementKind,
        implementLabel: sessionFields.implementLabel,
        speedSystem: sessionFields.speedSystem,
        handedness: sessionFields.handedness,
        swingCount: summary.count,
        minSpeedMph: summary.minSpeedMph,
        avgSpeedMph: summary.avgSpeedMph,
        maxSpeedMph: summary.maxSpeedMph,
        targetSpeedMph: sessionFields.targetSpeedMph,
        notes: sessionFields.notes,
        rawMetadataJson: {
          ...retainedMetadata,
          entryMode: readings.length > 0 ? "readings" : "summary",
          readingsProvided: readings.length,
          editedFromSpeedCentre: true,
          phaseSchemaVersion: phasedReadings.length > 0 ? 1 : null,
          phaseCounts: speedPhaseCounts(phasedReadings),
        },
        updatedAt: new Date(),
      })
      .where(
        and(eq(speedTrainingSessions.id, sessionId), eq(speedTrainingSessions.userId, userId)),
      );

    if (readings.length > 0) {
      await tx
        .delete(speedTrainingSwings)
        .where(
          and(
            eq(speedTrainingSwings.speedSessionId, sessionId),
            eq(speedTrainingSwings.userId, userId),
          ),
        );
      await tx.insert(speedTrainingSwings).values(
        phasedReadings.map(({ clubSpeedMph, phase }, index) => ({
          userId,
          speedSessionId: sessionId,
          swingNumber: index + 1,
          clubSpeedMph,
          sourceRawJson: {
            source: "manual_edit",
            phase,
          },
        })),
      );
    }
  });

  await syncSpeedAchievementsAndFlash(userId);

  revalidatePath("/speed");
  revalidatePath(`/speed/sessions/${sessionId}`);
  revalidatePath("/coach");
  redirect(`/speed/sessions/${sessionId}?speed_saved=1`);
}

export async function saveSpeedTransferTestAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const speedSessionId = formValue(formData, "speedSessionId");
  const shotSessionId = formValue(formData, "shotSessionId");
  const shotIds = formData
    .getAll("shotId")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!isSpeedTransferUuid(speedSessionId)) {
    fail("Choose a valid speed session.");
  }

  if (shotSessionId && !isSpeedTransferUuid(shotSessionId)) {
    failSpeedSession(speedSessionId, "Choose a valid Driver transfer session.");
  }

  const db = getDb();
  const [speedSession] = await db
    .select({
      id: speedTrainingSessions.id,
      clubId: speedTrainingSessions.clubId,
      clubType: clubs.type,
      sessionDate: speedTrainingSessions.sessionDate,
      rawMetadataJson: speedTrainingSessions.rawMetadataJson,
    })
    .from(speedTrainingSessions)
    .leftJoin(clubs, and(eq(speedTrainingSessions.clubId, clubs.id), eq(clubs.userId, userId)))
    .where(
      and(eq(speedTrainingSessions.id, speedSessionId), eq(speedTrainingSessions.userId, userId)),
    )
    .limit(1);

  if (!speedSession) {
    fail("That speed session was not found.");
  }

  if (speedSession.clubType !== "driver" || !speedSession.clubId) {
    fail("A transfer test can only be linked to a Driver speed session.");
  }

  if (!shotSessionId) {
    await db
      .update(speedTrainingSessions)
      .set({
        rawMetadataJson: withSpeedTransferMetadata(speedSession.rawMetadataJson, null),
        updatedAt: new Date(),
      })
      .where(
        and(eq(speedTrainingSessions.id, speedSessionId), eq(speedTrainingSessions.userId, userId)),
      );

    revalidatePath("/speed");
    revalidatePath(`/speed/sessions/${speedSessionId}`);
    redirect(`/speed/sessions/${speedSessionId}?speed_saved=transfer_cleared`);
  }

  if (
    shotIds.length !== 5 ||
    new Set(shotIds).size !== 5 ||
    shotIds.some((shotId) => !isSpeedTransferUuid(shotId))
  ) {
    failSpeedSession(
      speedSessionId,
      "Choose exactly five unique Driver shots for the transfer test.",
    );
  }

  const candidateRows = await db
    .select({
      id: shots.id,
      shotAt: shots.shotAt,
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
      sideCarryYd: directionalMetricSql(shots.sideCarryYd),
    })
    .from(shots)
    .innerJoin(practiceSessions, eq(shots.sessionId, practiceSessions.id))
    .where(
      and(
        eq(shots.userId, userId),
        eq(practiceSessions.userId, userId),
        eq(shots.sessionId, shotSessionId),
        eq(shots.clubId, speedSession.clubId),
        inArray(shots.id, shotIds),
        gte(practiceSessions.date, new Date(speedSession.sessionDate.getTime() - DAY_MS)),
        lte(practiceSessions.date, new Date(speedSession.sessionDate.getTime() + 7 * DAY_MS)),
      ),
    );
  const transferShots = candidateRows.filter(
    (shot) =>
      shot.sideCarryYd !== null &&
      ["included", "restored"].includes(
        effectiveShotReviewStatus({
          reviewStatus: shot.reviewStatus,
          qualityTag: shot.qualityTag,
          shotCategory: shot.shotCategory,
        }),
      ),
  );

  if (transferShots.length !== 5) {
    failSpeedSession(
      speedSessionId,
      "That session needs five included Driver shots with measured side carry.",
    );
  }

  const earliestTransferShotAt = transferShots.reduce(
    (earliest, shot) => (shot.shotAt < earliest ? shot.shotAt : earliest),
    transferShots[0]!.shotAt,
  );
  const priorDriverRows = await db
    .select({
      sideCarryYd: directionalMetricSql(shots.sideCarryYd),
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
    })
    .from(shots)
    .where(
      and(
        eq(shots.userId, userId),
        eq(shots.clubId, speedSession.clubId),
        lt(shots.shotAt, earliestTransferShotAt),
        isNotNull(shots.sideCarryYd),
      ),
    )
    .orderBy(desc(shots.shotAt))
    .limit(80);
  const transferCorridor = buildPersonalDriverCorridor(
    priorDriverRows
      .filter((shot) =>
        ["included", "restored"].includes(
          effectiveShotReviewStatus({
            reviewStatus: shot.reviewStatus,
            qualityTag: shot.qualityTag,
            shotCategory: shot.shotCategory,
          }),
        ),
      )
      .map((shot) => shot.sideCarryYd),
  );

  const transferTest = buildSpeedTransferMetadata({
    shotSessionId,
    shotIds,
    corridor: transferCorridor,
  });

  await db
    .update(speedTrainingSessions)
    .set({
      rawMetadataJson: withSpeedTransferMetadata(speedSession.rawMetadataJson, transferTest),
      updatedAt: new Date(),
    })
    .where(
      and(eq(speedTrainingSessions.id, speedSessionId), eq(speedTrainingSessions.userId, userId)),
    );

  revalidatePath("/speed");
  revalidatePath(`/speed/sessions/${speedSessionId}`);
  redirect(`/speed/sessions/${speedSessionId}?speed_saved=transfer`);
}

export async function deleteSpeedSessionAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = formValue(formData, "sessionId");

  if (!sessionId) {
    fail("Choose a speed session to delete.");
  }

  const db = getDb();
  await db
    .delete(speedTrainingSessions)
    .where(and(eq(speedTrainingSessions.id, sessionId), eq(speedTrainingSessions.userId, userId)));

  await syncSpeedAchievementsAndFlash(userId);

  revalidatePath("/speed");
  revalidatePath("/coach");
  redirect("/speed?speed_saved=deleted");
}

async function buildSessionFormFields(input: {
  db: ReturnType<typeof getDb>;
  userId: string;
  formData: FormData;
}) {
  const implementKind = normalizeAllowedValue(
    formValue(input.formData, "implementKind"),
    IMPLEMENT_KINDS,
    "club",
  );
  const handedness = normalizeAllowedValue(
    formValue(input.formData, "handedness"),
    HANDEDNESS_VALUES,
    "dominant",
  );
  const sessionDate = parseSessionDate(formValue(input.formData, "sessionDate"));
  const targetSpeedMph = parseOptionalSpeed(formValue(input.formData, "targetSpeedMph"));
  const notes = emptyToNull(formValue(input.formData, "notes"));
  const speedSystem = emptyToNull(formValue(input.formData, "speedSystem"));
  const clubIdInput = emptyToNull(formValue(input.formData, "clubId"));
  const customImplementLabel = emptyToNull(formValue(input.formData, "implementLabel"));
  const [club] = clubIdInput
    ? await input.db
        .select({
          id: clubs.id,
          type: clubs.type,
          brand: clubs.brand,
          model: clubs.model,
        })
        .from(clubs)
        .where(and(eq(clubs.id, clubIdInput), eq(clubs.userId, input.userId)))
        .limit(1)
    : [null];

  if (clubIdInput && !club) {
    fail("That club is not available in your bag.");
  }

  return {
    sessionDate,
    title: formValue(input.formData, "title") || "Speed session",
    clubId: club?.id ?? null,
    implementKind,
    implementLabel:
      club !== null
        ? `${formatClubType(club.type)} - ${formatClubModelName(club)}`
        : (customImplementLabel ?? labelForImplementKind(implementKind)),
    speedSystem,
    handedness,
    targetSpeedMph,
    notes,
  };
}

async function syncSpeedAchievementsAndFlash(userId: string) {
  const achievementResult = await syncAchievementsForUser(userId);
  await setAchievementUnlockFlash(achievementResult.unlockedAchievements);
  revalidatePath("/achievements");
}

function buildFallbackSummary(formData: FormData) {
  const minSpeedMph = parseOptionalSpeed(formValue(formData, "minSpeedMph"));
  const avgSpeedMph = parseOptionalSpeed(formValue(formData, "avgSpeedMph"));
  const maxSpeedMph = parseOptionalSpeed(formValue(formData, "maxSpeedMph"));
  const count = parseOptionalInteger(formValue(formData, "swingCount"));

  if (!minSpeedMph || !avgSpeedMph || !maxSpeedMph || !count) {
    return null;
  }

  if (minSpeedMph > avgSpeedMph || avgSpeedMph > maxSpeedMph) {
    fail("Check the summary speeds: min should be below average, and average below max.");
  }

  return {
    count,
    minSpeedMph,
    avgSpeedMph,
    maxSpeedMph,
  };
}

function parsePhasedSpeedReadings(formData: FormData) {
  const warmUp = parseSpeedReadings(formValue(formData, "warmupReadings")).map((clubSpeedMph) => ({
    clubSpeedMph,
    phase: "warm_up" as const,
  }));
  const maximumSpeed = parseSpeedReadings(formValue(formData, "speedReadings")).map(
    (clubSpeedMph) => ({
      clubSpeedMph,
      phase: "max_speed" as const,
    }),
  );

  return [...warmUp, ...maximumSpeed];
}

function speedPhaseCounts(readings: Array<{ clubSpeedMph: number; phase: SpeedTrainingPhase }>) {
  return readings.reduce(
    (counts, reading) => ({
      ...counts,
      [reading.phase]: counts[reading.phase] + 1,
    }),
    { warm_up: 0, max_speed: 0, transfer: 0 } satisfies Record<SpeedTrainingPhase, number>,
  );
}

function parseSessionDate(value: string) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    fail("Choose a valid session date.");
  }

  return parsed;
}

function parseOptionalSpeed(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 20 || parsed > 180) {
    fail("Speed values need to be between 20 and 180 mph.");
  }

  return Math.round(parsed * 10) / 10;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 500) {
    fail("Swing count needs to be a whole number between 1 and 500.");
  }

  return parsed;
}

function parseOptionalDate(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    fail("Choose a valid target date.");
  }

  return value;
}

async function upsertOrDeleteGoal(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  input: {
    userId: string;
    goalKey: string;
    clubId: string | null;
    targetSpeedMph: number | null;
    targetDate: string | null;
    notes: string | null;
  },
) {
  if (input.targetSpeedMph === null) {
    await tx
      .delete(speedTrainingGoals)
      .where(
        and(
          eq(speedTrainingGoals.userId, input.userId),
          eq(speedTrainingGoals.goalKey, input.goalKey),
        ),
      );
    return;
  }

  await tx
    .insert(speedTrainingGoals)
    .values({
      userId: input.userId,
      goalKey: input.goalKey,
      clubId: input.clubId,
      targetSpeedMph: input.targetSpeedMph,
      targetDate: input.targetDate,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [speedTrainingGoals.userId, speedTrainingGoals.goalKey],
      set: {
        clubId: input.clubId,
        targetSpeedMph: input.targetSpeedMph,
        targetDate: input.targetDate,
        notes: input.notes,
        updatedAt: new Date(),
      },
    });
}

function clubGoalKey(clubId: string) {
  return `club:${clubId}`;
}

function normalizeAllowedValue(value: string, allowed: Set<string>, fallback: string) {
  return allowed.has(value) ? value : fallback;
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";

  const normalized = value.trim();
  return normalized === "__none__" ? "" : normalized;
}

function emptyToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

function fail(message: string): never {
  redirect(`/speed?speed_error=${encodeURIComponent(message)}`);
}

function failSpeedSession(sessionId: string, message: string): never {
  redirect(`/speed/sessions/${sessionId}?speed_error=${encodeURIComponent(message)}`);
}

function labelForImplementKind(kind: string) {
  switch (kind) {
    case "speed_stick":
      return "Speed stick";
    case "weighted_club":
      return "Weighted club";
    case "club":
      return "Golf club";
    default:
      return "Other implement";
  }
}
