import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  GENERATED_CLUB_MASTERY_ACHIEVEMENTS,
  GENERATED_CLUB_VOLUME_ACHIEVEMENTS,
} from "./registry";
import { capActionXpForDay, calculateUserLevel, xpForAchievement, xpRequiredForLevel } from "./xp";

describe("achievement registry", () => {
  it("generates a large mastery catalog", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThan(1000);
  });

  it("adds 100 club-volume mastery achievements", () => {
    expect(GENERATED_CLUB_VOLUME_ACHIEVEMENTS).toHaveLength(100);
    expect(ACHIEVEMENTS.some((achievement) => achievement.id === "club_driver_volume_100")).toBe(true);
    expect(ACHIEVEMENTS.some((achievement) => achievement.id === "club_pw_volume_200")).toBe(true);
  });

  it("adds 500 club-session mastery achievements", () => {
    expect(GENERATED_CLUB_MASTERY_ACHIEVEMENTS).toHaveLength(500);
    expect(ACHIEVEMENTS.some((achievement) => achievement.id === "club_driver_mastery_carry_spread_12")).toBe(true);
    expect(ACHIEVEMENTS.some((achievement) => achievement.id === "club_7i_mastery_launch_spread_25")).toBe(true);
    expect(ACHIEVEMENTS.some((achievement) => achievement.id === "club_pw_mastery_smash_average_129")).toBe(true);
  });
});

describe("achievement XP", () => {
  it("uses the progressive level curve", () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(250);
    expect(xpRequiredForLevel(3)).toBe(732);

    const level = calculateUserLevel(300);

    expect(level.level).toBe(2);
    expect(level.progressXp).toBe(50);
    expect(level.nextLevelXp).toBe(732);
  });

  it("awards reduced XP for repeat unlocks", () => {
    expect(xpForAchievement(400, false)).toBe(400);
    expect(xpForAchievement(400, true)).toBe(100);
  });

  it("caps action XP per day", () => {
    expect(capActionXpForDay(450, 100)).toBe(50);
    expect(capActionXpForDay(500, 100)).toBe(0);
  });
});
