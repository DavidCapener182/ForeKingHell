import { describe, expect, it } from "vitest";

import {
  decodeAchievementUnlockNotifications,
  encodeAchievementUnlockNotifications,
  MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS,
} from "./notification-cookie";
import type { AchievementUnlockNotification } from "./types";

describe("achievement notification cookie helpers", () => {
  it("round-trips valid unlock notifications", () => {
    const notifications: AchievementUnlockNotification[] = [
      {
        achievementId: "driver_total_200",
        name: "Driver 200 Total",
        description: "Hit driver 200 yards total.",
        tier: "bronze",
        xpAwarded: 50,
        unlockedAt: "2026-05-11T10:00:00.000Z",
      },
    ];

    expect(
      decodeAchievementUnlockNotifications(encodeAchievementUnlockNotifications(notifications)),
    ).toEqual(notifications);
  });

  it("drops malformed and excess notifications", () => {
    const notifications = Array.from(
      { length: MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS + 2 },
      (_, index) => ({
        achievementId: `achievement_${index}`,
        name: `Achievement ${index}`,
        description: "Unlocked from test data.",
        tier: "silver",
        xpAwarded: 100,
        unlockedAt: `2026-05-11T10:${String(index).padStart(2, "0")}:00.000Z`,
      }),
    );
    const encoded = encodeURIComponent(
      JSON.stringify([...notifications, { achievementId: "bad" }]),
    );

    const decoded = decodeAchievementUnlockNotifications(encoded);

    expect(decoded).toHaveLength(MAX_FLASH_ACHIEVEMENT_NOTIFICATIONS);
    expect(decoded[0]?.achievementId).toBe("achievement_0");
  });

  it("returns an empty list for invalid cookie payloads", () => {
    expect(decodeAchievementUnlockNotifications("%7Bbad")).toEqual([]);
  });
});
