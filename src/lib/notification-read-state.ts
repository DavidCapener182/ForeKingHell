import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { userFeaturePreferences } from "@/db/schema";

function settingsRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function notificationReadIds(value: unknown): string[] {
  const ids = settingsRecord(value).notificationReadIds;
  return Array.isArray(ids)
    ? [
        ...new Set(
          ids.filter(
            (id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120,
          ),
        ),
      ].slice(-80)
    : [];
}

export async function readNotificationState(userId: string) {
  const [row] = await getDb()
    .select({ settings: userFeaturePreferences.highlightSettingsJson })
    .from(userFeaturePreferences)
    .where(eq(userFeaturePreferences.userId, userId))
    .limit(1);
  return notificationReadIds(row?.settings);
}

export async function markNotificationsRead(userId: string, ids: string[]) {
  return getDb().transaction(async (db) => {
    await db
      .insert(userFeaturePreferences)
      .values({ userId })
      .onConflictDoNothing({ target: userFeaturePreferences.userId });
    const [row] = await db
      .select({ settings: userFeaturePreferences.highlightSettingsJson })
      .from(userFeaturePreferences)
      .where(eq(userFeaturePreferences.userId, userId))
      .limit(1)
      .for("update");
    const existing = settingsRecord(row?.settings);
    const nextIds = notificationReadIds({
      notificationReadIds: [...notificationReadIds(existing), ...ids],
    });
    await db
      .update(userFeaturePreferences)
      .set({
        highlightSettingsJson: { ...existing, notificationReadIds: nextIds },
        updatedAt: new Date(),
      })
      .where(eq(userFeaturePreferences.userId, userId));
    return nextIds;
  });
}
