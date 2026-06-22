"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { golfTrainingSessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { calculateSessionLoad } from "@/lib/training/trainingLoad";
import type { TrainingSourceType } from "@/lib/training/trainingData";

const VALID_SOURCE_TYPES = new Set<TrainingSourceType>([
  "round",
  "practice",
  "manual",
  "launch_monitor",
  "imported",
]);

export async function createGolfTrainingSessionAction(formData: FormData) {
  const userId = await requireCurrentUserId();
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

  await getDb().insert(golfTrainingSessions).values({
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
  });

  revalidatePath("/stats/training-over-time");
  const range = encodeURIComponent(formValue(formData, "range") || "3m");
  redirect(`/stats/training-over-time?range=${range}&saved=1#recent`);
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
    throw new Error("Choose a valid session date.");
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
    throw new Error(`${key} must be a positive whole number.`);
  }

  return parsed;
}

function boundedInteger(formData: FormData, key: string, min: number, max: number) {
  const value = Number(formValue(formData, key));

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be between ${min} and ${max}.`);
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
