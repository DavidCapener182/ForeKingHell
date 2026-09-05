import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { userFeaturePreferences } from "@/db/schema";
import { recordGoalMovements } from "@/lib/goal-movement";
import {
  goalTypeLabel,
  goalTypes,
  type GoalType,
  type SeasonGoal,
  type SeasonPlan,
} from "@/lib/product-preferences-model";

export {
  goalTypeLabel,
  goalTypes,
  type GoalType,
  type SeasonGoal,
  type SeasonPlan,
} from "@/lib/product-preferences-model";

export const notificationCategories = [
  "dataQuality",
  "practiceDue",
  "goalProgress",
  "personalBest",
  "providerSync",
  "competition",
  "friendActivity",
  "billing",
  "security",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];
export type NotificationDelivery = "in_app" | "digest" | "immediate" | "weekly" | "off";

export type NotificationPreferences = {
  social: boolean;
  challenges: boolean;
  dataQuality: boolean;
  achievements: boolean;
  weeklyReview: boolean;
  delivery: Record<NotificationCategory, NotificationDelivery>;
};

export type ProductPreferences = {
  seasonPlan: SeasonPlan;
  goals: SeasonGoal[];
  notifications: NotificationPreferences;
};

export const defaultSeasonPlan: SeasonPlan = {
  outcome: "Build a more repeatable scoring game",
  targetDate: "",
  focus: "Distance control",
  weeklySessions: 2,
  successMeasure: "Two measured practice sessions each week",
};

export const defaultNotificationPreferences: NotificationPreferences = {
  social: true,
  challenges: true,
  dataQuality: true,
  achievements: true,
  weeklyReview: true,
  delivery: {
    dataQuality: "in_app",
    practiceDue: "weekly",
    goalProgress: "weekly",
    personalBest: "in_app",
    providerSync: "immediate",
    competition: "in_app",
    friendActivity: "in_app",
    billing: "immediate",
    security: "immediate",
  },
};

export async function getProductPreferences(userId: string): Promise<ProductPreferences> {
  const [row] = await getDb()
    .select({ settings: userFeaturePreferences.highlightSettingsJson })
    .from(userFeaturePreferences)
    .where(eq(userFeaturePreferences.userId, userId))
    .limit(1);

  return parseProductPreferences(row?.settings);
}

export async function updateProductPreferences(userId: string, patch: Partial<ProductPreferences>) {
  await getDb().transaction(async (db) => {
    await db
      .insert(userFeaturePreferences)
      .values({ userId })
      .onConflictDoNothing({ target: userFeaturePreferences.userId });
    const [existing] = await db
      .select({ settings: userFeaturePreferences.highlightSettingsJson })
      .from(userFeaturePreferences)
      .where(eq(userFeaturePreferences.userId, userId))
      .limit(1)
      .for("update");
    const current = record(existing?.settings);
    const now = new Date();
    const next = {
      ...current,
      ...(patch.seasonPlan ? { seasonPlan: patch.seasonPlan } : {}),
      ...(patch.goals
        ? {
            goals: patch.goals,
            goalMovements: recordGoalMovements(
              parseProductPreferences(current).goals,
              patch.goals,
              current.goalMovements,
              now,
            ),
          }
        : {}),
      ...(patch.notifications ? { notifications: patch.notifications } : {}),
    };

    await db
      .insert(userFeaturePreferences)
      .values({ userId, highlightSettingsJson: next, updatedAt: now })
      .onConflictDoUpdate({
        target: userFeaturePreferences.userId,
        set: { highlightSettingsJson: next, updatedAt: now },
      });
  });
}

export function parseProductPreferences(value: unknown): ProductPreferences {
  const settings = record(value);
  const season = record(settings.seasonPlan);
  const notifications = record(settings.notifications);
  const rawGoals = Array.isArray(settings.goals) ? settings.goals : [];

  return {
    seasonPlan: {
      outcome: cleanText(season.outcome, defaultSeasonPlan.outcome, 160),
      targetDate: parseDate(season.targetDate),
      focus: cleanText(season.focus, defaultSeasonPlan.focus, 80),
      weeklySessions: clampInteger(season.weeklySessions, 1, 7, defaultSeasonPlan.weeklySessions),
      successMeasure: cleanText(season.successMeasure, defaultSeasonPlan.successMeasure, 180),
    },
    goals: rawGoals.slice(0, 12).flatMap((value, index) => {
      const goal = parseSeasonGoal(value, index);
      return goal ? [goal] : [];
    }),
    notifications: {
      social: booleanValue(notifications.social, defaultNotificationPreferences.social),
      challenges: booleanValue(notifications.challenges, defaultNotificationPreferences.challenges),
      dataQuality: booleanValue(
        notifications.dataQuality,
        defaultNotificationPreferences.dataQuality,
      ),
      achievements: booleanValue(
        notifications.achievements,
        defaultNotificationPreferences.achievements,
      ),
      weeklyReview: booleanValue(
        notifications.weeklyReview,
        defaultNotificationPreferences.weeklyReview,
      ),
      delivery: Object.fromEntries(
        notificationCategories.map((category) => [
          category,
          notificationDelivery(
            record(notifications.delivery)[category],
            defaultNotificationPreferences.delivery[category],
          ),
        ]),
      ) as Record<NotificationCategory, NotificationDelivery>,
    },
  };
}

export function parseSeasonGoal(value: unknown, index = 0): SeasonGoal | null {
  const goal = record(value);
  const type = goalTypes.includes(goal.type as GoalType) ? (goal.type as GoalType) : null;
  if (!type) return null;
  const title = cleanText(goal.title, goalTypeLabel(type), 100);
  const startingValue = finiteNumber(goal.startingValue, 0);
  const currentValue = finiteNumber(goal.currentValue, startingValue);
  const targetValue = finiteNumber(goal.targetValue, currentValue);
  return {
    id: cleanId(goal.id, `goal-${index + 1}`),
    type,
    title,
    club: cleanText(goal.club, "All clubs", 40),
    startingValue,
    currentValue,
    targetValue,
    unit: cleanText(goal.unit, defaultGoalUnit(type), 20),
    targetDate: parseDate(goal.targetDate),
    evidenceSource: cleanText(goal.evidenceSource, "Imported session evidence", 120),
    nextAction: cleanText(goal.nextAction, defaultGoalAction(type), 180),
  };
}

export function goalProgress(goal: SeasonGoal) {
  const distance = goal.targetValue - goal.startingValue;
  if (distance === 0) return goal.currentValue === goal.targetValue ? 100 : 0;
  return Math.round(
    Math.min(100, Math.max(0, ((goal.currentValue - goal.startingValue) / distance) * 100)),
  );
}

function defaultGoalUnit(type: GoalType) {
  if (type === "carry" || type === "dispersion") return "yd";
  if (type === "speed") return "mph";
  if (type === "practice_frequency") return "sessions/week";
  if (type === "course_record") return "strokes";
  if (type === "tournament") return "position";
  return "index";
}

function defaultGoalAction(type: GoalType) {
  if (type === "practice_frequency") return "Schedule the next measured practice session.";
  if (type === "course_record" || type === "tournament")
    return "Add the next qualifying round and review the evidence.";
  return "Run a focused measured session and compare it with the baseline.";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned || fallback;
}

function parseDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function notificationDelivery(
  value: unknown,
  fallback: NotificationDelivery,
): NotificationDelivery {
  return value === "in_app" ||
    value === "digest" ||
    value === "immediate" ||
    value === "weekly" ||
    value === "off"
    ? value
    : fallback;
}

function finiteNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : fallback;
}

function cleanId(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : fallback;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
