import type { AchievementTier } from "./types";

export const DAILY_ACTION_XP_CAP = 500;
export const REPEATABLE_BADGE_XP_MULTIPLIER = 0.25;

export const TIER_XP: Record<AchievementTier, number> = {
  bronze: 50,
  silver: 100,
  gold: 200,
  platinum: 400,
  diamond: 800,
  hidden: 50,
};

export function xpRequiredForLevel(level: number) {
  if (level <= 1) {
    return 0;
  }

  return Math.round(250 * Math.pow(level - 1, 1.55));
}

export function calculateUserLevel(totalXp: number) {
  let level = 1;

  while (xpRequiredForLevel(level + 1) <= totalXp) {
    level += 1;
  }

  const currentLevelXp = xpRequiredForLevel(level);
  const nextLevelXp = xpRequiredForLevel(level + 1);
  const progressXp = Math.max(0, totalXp - currentLevelXp);
  const neededXp = Math.max(1, nextLevelXp - currentLevelXp);

  return {
    level,
    totalXp,
    currentLevelXp,
    nextLevelXp,
    progressXp,
    neededXp,
    progressPercent: Math.min(100, Math.round((progressXp / neededXp) * 100)),
  };
}

export function xpForAchievement(baseXp: number, isRepeatUnlock: boolean) {
  if (!isRepeatUnlock) {
    return baseXp;
  }

  return Math.max(1, Math.round(baseXp * REPEATABLE_BADGE_XP_MULTIPLIER));
}

export function capActionXpForDay(existingActionXp: number, requestedXp: number) {
  return Math.max(0, Math.min(requestedXp, DAILY_ACTION_XP_CAP - existingActionXp));
}
