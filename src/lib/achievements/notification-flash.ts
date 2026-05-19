import { cookies } from "next/headers";

import {
  ACHIEVEMENT_UNLOCK_FLASH_COOKIE,
  decodeAchievementUnlockNotifications,
  encodeAchievementUnlockNotifications,
  MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS,
} from "./notification-cookie";
import type { AchievementUnlockNotification } from "./types";

const FLASH_COOKIE_MAX_AGE_SECONDS = 90;

export async function getAchievementUnlockFlash() {
  const cookieStore = await cookies();
  return decodeAchievementUnlockNotifications(
    cookieStore.get(ACHIEVEMENT_UNLOCK_FLASH_COOKIE)?.value,
  );
}

export async function setAchievementUnlockFlash(notifications: AchievementUnlockNotification[]) {
  if (notifications.length === 0) {
    return;
  }

  const cookieStore = await cookies();
  const existing = decodeAchievementUnlockNotifications(
    cookieStore.get(ACHIEVEMENT_UNLOCK_FLASH_COOKIE)?.value,
  );
  const next = dedupeNotifications([...notifications, ...existing]).slice(
    0,
    MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS,
  );

  cookieStore.set(ACHIEVEMENT_UNLOCK_FLASH_COOKIE, encodeAchievementUnlockNotifications(next), {
    maxAge: FLASH_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}

function dedupeNotifications(notifications: AchievementUnlockNotification[]) {
  const seen = new Set<string>();
  const deduped: AchievementUnlockNotification[] = [];

  for (const notification of notifications) {
    const key = `${notification.achievementId}:${notification.unlockedAt}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(notification);
  }

  return deduped;
}
