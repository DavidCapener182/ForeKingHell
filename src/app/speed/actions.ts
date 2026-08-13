"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, speedTrainingGoals, speedTrainingSessions, speedTrainingSwings } from "@/db/schema";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { syncAchievementsForUser } from "@/lib/achievements/service";
import { formatClubModelName, formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { parseSpeedReadings, summarizeSpeedReadings } from "@/lib/speed-training";

const IMPLEMENT_KINDS = new Set(["club", "speed_stick", "weighted_club", "other"]);
const HANDEDNESS_VALUES = new Set(["dominant", "non_dominant", "both"]);

export async function createManualSpeedSessionAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const speedText = formValue(formData, "speedReadings");
  const readings = parseSpeedReadings(speedText);
  const readingSummary = summarizeSpeedReadings(readings);
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

  await db.transaction(async (tx) => {
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
        },
      })
      .returning({ id: speedTrainingSessions.id });

    if (session && readings.length > 0) {
      await tx.insert(speedTrainingSwings).values(
        readings.map((clubSpeedMph, index) => ({
          userId,
          speedSessionId: session.id,
          swingNumber: index + 1,
          clubSpeedMph,
          sourceRawJson: {
            source: "manual",
          },
        })),
      );
    }
  });

  await syncSpeedAchievementsAndFlash(userId);

  revalidatePath("/speed");
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
      swingCount: speedTrainingSessions.swingCount,
      minSpeedMph: speedTrainingSessions.minSpeedMph,
      avgSpeedMph: speedTrainingSessions.avgSpeedMph,
      maxSpeedMph: speedTrainingSessions.maxSpeedMph,
    })
    .from(speedTrainingSessions)
    .where(and(eq(speedTrainingSessions.id, sessionId), eq(speedTrainingSessions.userId, userId)))
    .limit(1);

  if (!existingSession) {
    fail("That speed session was not found.");
  }

  const speedText = formValue(formData, "speedReadings");
  const readings = parseSpeedReadings(speedText);
  const readingSummary = summarizeSpeedReadings(readings);
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
          entryMode: readings.length > 0 ? "readings" : "summary",
          readingsProvided: readings.length,
          editedFromSpeedCentre: true,
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
        readings.map((clubSpeedMph, index) => ({
          userId,
          speedSessionId: sessionId,
          swingNumber: index + 1,
          clubSpeedMph,
          sourceRawJson: {
            source: "manual_edit",
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
