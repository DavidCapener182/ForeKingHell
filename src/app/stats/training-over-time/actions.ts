"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { golfTrainingSessions, sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { calculateSessionLoad } from "@/lib/training/trainingLoad";
import type { TrainingSourceType } from "@/lib/training/trainingData";

import {
  calculateRoundLoad,
  ROUND_DEFAULT_RPE,
  ROUND_LOAD_MODEL,
  type RoundMovement,
} from "@/lib/training/roundLoad";

const VALID_SOURCE_TYPES = new Set<TrainingSourceType>([
  "round",
  "practice",
  "manual",
  "launch_monitor",
  "imported",
]);

export type TrainingSessionFormResult = { ok: true } | { ok: false; error: string };
class TrainingFormError extends Error {}
export async function createGolfTrainingSessionWithStateAction(
  formData: FormData,
): Promise<TrainingSessionFormResult> {
  const userId = await requireCurrentUserId();
  try {
    await createGolfTrainingSession(formData, userId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof TrainingFormError
          ? error.message
          : "The training session could not be saved. Your entries are still available to retry.",
    };
  }
}
export async function createGolfTrainingSessionAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  await createGolfTrainingSession(formData, userId);
  const range = encodeURIComponent(formValue(formData, "range") || "3m");
  redirect(`/stats/training-over-time?range=${range}&saved=1#recent`);
}
async function createGolfTrainingSession(formData: FormData, userId: string) {
  const sourceType = parseSourceType(formData);
  const sourceId = emptyToNull(formValue(formData, "sourceId"));
  const title = formValue(formData, "title") || defaultTitle(formValue(formData, "activityType"));
  const sessionDate = parseDate(formValue(formData, "sessionDate"));
  const durationMinutes = nullablePositiveInteger(formData, "durationMinutes");
  const holesPlayed = nullablePositiveInteger(formData, "holesPlayed");
  const fullSwings = nullablePositiveInteger(formData, "fullSwings");
  const shortGameSwings = nullablePositiveInteger(formData, "shortGameSwings");
  const puttingSwings = nullablePositiveInteger(formData, "puttingSwings");
  const totalSwings = normaliseTotalSwings(
    nullablePositiveInteger(formData, "totalSwings"),
    fullSwings,
    shortGameSwings,
    puttingSwings,
  );
  const rpe = boundedInteger(formData, "rpe", 1, 10);
  const mentalPressure = nullableBoundedInteger(formData, "mentalPressure", 1, 10);
  const physicalDemand = nullableBoundedInteger(formData, "physicalDemand", 1, 10);
  const movement = formValue(formData, "movement");
  const walked =
    movement === "walked"
      ? true
      : movement === "cart"
        ? false
        : nullableBoolean(formData, "walked");
  const usedCart =
    movement === "cart"
      ? true
      : movement === "walked"
        ? false
        : nullableBoolean(formData, "usedCart");
  const competition =
    formData.get("competition") === "on" || formValue(formData, "competition") === "true";
  const notes = emptyToNull(formValue(formData, "notes"));
  const sessionLoad = calculateSessionLoad({
    durationMinutes,
    holesPlayed,
    totalSwings,
    fullSwings,
    shortGameSwings,
    puttingSwings,
    walked,
    competition,
    rpe,
    mentalPressure,
  });

  const db = getDb();
  if (sourceId) {
    const owned = await db.execute(sql`
      select 1 from fkh_sessions where id::text = ${sourceId} and user_id = ${userId}
      union all select 1 from fkh_practice_sessions where id::text = ${sourceId} and user_id = ${userId}
      union all select 1 from fkh_speed_training_sessions where id::text = ${sourceId} and user_id = ${userId}
      limit 1
    `);
    if (!owned.length)
      throw new TrainingFormError("That source session is not available in your account.");
  }
  const inserted = await db
    .insert(golfTrainingSessions)
    .values({
      userId,
      sourceType,
      sourceId,
      title,
      sessionDate,
      durationMinutes,
      holesPlayed,
      totalSwings,
      fullSwings,
      shortGameSwings,
      puttingSwings,
      walked,
      usedCart,
      competition,
      rpe,
      mentalPressure,
      physicalDemand,
      sessionLoad,
      notes,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        golfTrainingSessions.userId,
        golfTrainingSessions.sourceType,
        golfTrainingSessions.sourceId,
      ],
    })
    .returning({ id: golfTrainingSessions.id });
  if (!inserted.length)
    throw new TrainingFormError(
      "This source session already has a training load. Open the existing entry to review it.",
    );

  try {
    revalidatePath("/stats/training-over-time");
  } catch {
    console.error("Training page refresh failed after saving.");
  }
}

function parseSourceType(formData: FormData): TrainingSourceType {
  const explicit = formValue(formData, "sourceType");
  if (VALID_SOURCE_TYPES.has(explicit as TrainingSourceType)) {
    return explicit as TrainingSourceType;
  }

  switch (formValue(formData, "activityType")) {
    case "round":
      return "round";
    case "range":
    case "short_game":
    case "putting":
      return "practice";
    case "gym_speed":
      return "manual";
    default:
      return "manual";
  }
}

function defaultTitle(activityType: string) {
  switch (activityType) {
    case "round":
      return "Golf round";
    case "range":
      return "Range session";
    case "short_game":
      return "Short-game session";
    case "putting":
      return "Putting session";
    case "gym_speed":
      return "Speed training";
    default:
      return "Manual golf load";
  }
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TrainingFormError("Choose a valid session date.");
  }

  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TrainingFormError("Choose a valid session date.");
  }
  return value;
}

function nullablePositiveInteger(formData: FormData, key: string) {
  const value = formValue(formData, key);
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TrainingFormError(`${key} must be a positive whole number.`);
  }

  return parsed;
}

function boundedInteger(formData: FormData, key: string, min: number, max: number) {
  const value = Number(formValue(formData, key));

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TrainingFormError(`${key} must be between ${min} and ${max}.`);
  }

  return value;
}

function nullableBoundedInteger(formData: FormData, key: string, min: number, max: number) {
  const value = formValue(formData, key);
  if (!value) {
    return null;
  }

  return boundedInteger(formData, key, min, max);
}

function nullableBoolean(formData: FormData, key: string) {
  const value = formValue(formData, key);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function normaliseTotalSwings(
  totalSwings: number | null,
  fullSwings: number | null,
  shortGameSwings: number | null,
  puttingSwings: number | null,
) {
  if (totalSwings !== null) {
    return totalSwings;
  }

  const total = (fullSwings ?? 0) + (shortGameSwings ?? 0) + (puttingSwings ?? 0);
  return total > 0 ? total : null;
}

export async function updateRoundTrainingEffortAction(
  formData: FormData,
): Promise<TrainingSessionFormResult> {
  const userId = await requireCurrentUserId();
  const id = formValue(formData, "trainingSessionId");
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return { ok: false, error: "That training entry is not available." };
  const db = getDb();
  const [entry] = await db
    .select({ id: golfTrainingSessions.id, holes: golfTrainingSessions.holesPlayed })
    .from(golfTrainingSessions)
    .innerJoin(
      sessions,
      and(
        eq(sql`${sessions.id}::text`, golfTrainingSessions.sourceId),
        eq(sessions.userId, userId),
      ),
    )
    .where(
      and(
        eq(golfTrainingSessions.id, id),
        eq(golfTrainingSessions.userId, userId),
        eq(golfTrainingSessions.sourceType, "round"),
        eq(sessions.type, "real_round"),
        eq(sessions.roundStatus, "complete"),
        sql`${golfTrainingSessions.loadMetadataJson}->>'model' = ${ROUND_LOAD_MODEL}`,
      ),
    )
    .limit(1);
  if (!entry?.holes) return { ok: false, error: "That completed round is not available." };
  const durationText = formValue(formData, "durationMinutes");
  const rpeText = formValue(formData, "rpe");
  const duration = durationText ? Number(durationText) : null;
  const rpe = rpeText ? Number(rpeText) : ROUND_DEFAULT_RPE;
  const movement = formValue(formData, "movement") as RoundMovement;
  if (!["unknown", "carry", "trolley", "cart"].includes(movement))
    return { ok: false, error: "Choose how you got around the course." };
  let load: number;
  try {
    load = calculateRoundLoad(entry.holes, duration, rpe).load;
  } catch {
    return {
      ok: false,
      error:
        "Use a duration of 1–1,440 whole minutes and effort of 1–10, or leave unknown values blank.",
    };
  }
  await db
    .update(golfTrainingSessions)
    .set({
      durationMinutes: duration,
      rpe,
      walked: movement === "unknown" ? null : movement !== "cart",
      usedCart: movement === "unknown" ? null : movement === "cart",
      sessionLoad: load,
      loadMetadataJson: { model: ROUND_LOAD_MODEL, rpeEstimated: !rpeText, movement },
      updatedAt: new Date(),
    })
    .where(and(eq(golfTrainingSessions.id, id), eq(golfTrainingSessions.userId, userId)));
  revalidatePath("/stats/training-over-time");
  revalidatePath("/today");
  revalidatePath("/speed");
  return { ok: true };
}
