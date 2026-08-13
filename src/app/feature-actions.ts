"use server";

import { redirect } from "next/navigation";

import {
  completePracticeDrill,
  createCoachSignalChallenge,
  createLatestRoundRecap,
  featureCourseRecord,
  followCourse,
  saveCurrentWeeklyRecap,
  saveShotView,
  updateFeaturePreferences,
  upsertCourseRecordGoal,
} from "@/lib/feature-ideas";

export async function saveShotViewAction(formData: FormData) {
  await saveShotView({
    name: requiredString(formData, "name"),
    description: optionalString(formData, "description"),
    filterJson: formFilterJson(formData),
    pinned: formData.get("pinned") === "on",
  });
}

export async function completePracticeDrillAction(formData: FormData) {
  await completePracticeDrill({
    sourceId: optionalString(formData, "sourceId"),
    clubId: optionalString(formData, "clubId"),
    clubType: optionalString(formData, "clubType"),
    title: requiredString(formData, "title"),
    focusArea: optionalString(formData, "focusArea") ?? "practice",
    targetShots: optionalNumber(formData, "targetShots") ?? 12,
    recordedShots:
      optionalNumber(formData, "recordedShots") ?? optionalNumber(formData, "targetShots") ?? 12,
    notes: optionalString(formData, "notes"),
  });
}

export async function upsertCourseRecordGoalAction(formData: FormData) {
  await upsertCourseRecordGoal({
    recordId: requiredString(formData, "recordId"),
    targetUserId: optionalString(formData, "targetUserId"),
    targetValue: optionalNumber(formData, "targetValue"),
    targetLabel: optionalString(formData, "targetLabel"),
    notifyWhenBeaten: formData.getAll("notifyWhenBeaten").includes("on"),
  });
}

export async function featureCourseRecordAction(formData: FormData) {
  await featureCourseRecord(requiredString(formData, "recordId"));
}

export async function followCourseAction(formData: FormData) {
  const alias = optionalString(formData, "alias");
  const provider = optionalString(formData, "provider") ?? "manual";
  await followCourse({
    courseId: requiredString(formData, "courseId"),
    notifyRecords: formData.getAll("notifyRecords").includes("on"),
    providerAliases: alias
      ? [
          {
            provider,
            alias,
            providerCourseId: optionalString(formData, "providerCourseId"),
            teeName: optionalString(formData, "teeName"),
          },
        ]
      : [],
  });
}

export async function updateFeaturePreferencesAction(formData: FormData) {
  await updateFeaturePreferences({
    autoShareRounds: formData.get("autoShareRounds") === "on",
    autoSharePbs: formData.get("autoSharePbs") === "on",
    autoShareAchievements: formData.get("autoShareAchievements") === "on",
    autoSharePractice: formData.get("autoSharePractice") === "on",
    publicSharePreview: formData.get("publicSharePreview") === "on",
  });
}

export async function saveCurrentWeeklyRecapAction() {
  await saveCurrentWeeklyRecap();
}

export async function createLatestRoundRecapAction() {
  await createLatestRoundRecap();
  redirect("/feed?filter=rounds");
}

export async function createCoachSignalChallengeAction(formData: FormData) {
  await createCoachSignalChallenge({
    title: requiredString(formData, "title"),
    description: requiredString(formData, "description"),
    clubId: optionalString(formData, "clubId"),
    clubType: optionalString(formData, "clubType"),
    focusArea: optionalString(formData, "focusArea"),
  });
}

function formFilterJson(formData: FormData) {
  return {
    club: optionalString(formData, "club"),
    category: optionalString(formData, "category"),
    from: optionalString(formData, "from"),
    to: optionalString(formData, "to"),
    q: optionalString(formData, "q"),
  };
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized && normalized !== "__all__" && normalized !== "__none__" ? normalized : null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
