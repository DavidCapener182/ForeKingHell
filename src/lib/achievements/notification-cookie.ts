import type { AchievementUnlockNotification } from "./types";

export const ACHIEVEMENT_UNLOCK_FLASH_COOKIE = "fkh_achievement_unlocks";
export const MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS = 10;

export function encodeAchievementUnlockNotifications(
  notifications: AchievementUnlockNotification[],
) {
  return encodeURIComponent(
    JSON.stringify(notifications.slice(0, MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS)),
  );
}

export function decodeAchievementUnlockNotifications(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isAchievementUnlockNotification)
      .slice(0, MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function isAchievementUnlockNotification(value: unknown): value is AchievementUnlockNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.achievementId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.tier === "string" &&
    typeof candidate.xpAwarded === "number" &&
    typeof candidate.unlockedAt === "string"
  );
}
