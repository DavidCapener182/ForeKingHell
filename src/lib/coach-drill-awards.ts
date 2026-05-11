import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import { getDb } from "@/db/client";
import { shots, userAchievements, xpLedger } from "@/db/schema";
import {
  buildCoachDrillChallenges,
  buildCoachSummary,
  type CoachDrillChallenge,
  type CoachDrillWinRule,
} from "@/lib/coach";
import { getDefaultUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import type { AchievementTier, AchievementUnlockNotification } from "@/lib/achievements/types";

const APP_TIME_ZONE = "Europe/London";

export type CoachDrillAwardStatus = CoachDrillProgress & {
  completedAwarded: boolean;
  wonAwarded: boolean;
};

export type CoachDrillProgress = {
  uploadedShotCount: number;
  completionTarget: number;
  winCount: number;
  winTarget: number;
  completed: boolean;
  won: boolean;
};

export type CoachDrillShot = {
  id?: string;
  clubType: string;
  shotAt?: Date;
  shotCategory: string | null;
  carryYd: number | null;
  sideCarryYd: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  clubPathDeg: number | null;
};

export async function evaluateCoachDrillAchievementsForDefaultUser() {
  return evaluateCoachDrillAchievementsForUser(getDefaultUserId());
}

export async function evaluateCoachDrillAchievementsForUser(userId: string) {
  const data = await getProgressData();
  const challenges = buildCoachDrillChallenges(buildCoachSummary(data.clubs));
  const statuses = await getCoachDrillAwardStatuses(challenges, userId);
  const notifications: AchievementUnlockNotification[] = [];

  for (const challenge of challenges) {
    const status = statuses[challenge.id];

    if (!status) {
      continue;
    }

    if (status.completed && !status.completedAwarded) {
      notifications.push(...(await awardCoachDrillAchievement(userId, challenge, "complete")));
    }

    if (status.won && !status.wonAwarded) {
      notifications.push(...(await awardCoachDrillAchievement(userId, challenge, "win")));
    }
  }

  return {
    challenges,
    statuses: await getCoachDrillAwardStatuses(challenges, userId),
    notifications,
  };
}

export async function getCoachDrillAwardStatuses(
  challenges: CoachDrillChallenge[],
  userId = getDefaultUserId(),
) {
  const statusByDrillId: Record<string, CoachDrillAwardStatus> = Object.fromEntries(
    challenges.map((challenge) => [
      challenge.id,
      {
        ...emptyProgress(challenge),
        completedAwarded: false,
        wonAwarded: false,
      } satisfies CoachDrillAwardStatus,
    ]),
  );

  if (challenges.length === 0) {
    return statusByDrillId;
  }

  const [unlockedIds, drillShots] = await Promise.all([
    loadUnlockedCoachDrillAchievementIds(challenges, userId),
    loadCoachDrillShots(challenges, userId),
  ]);

  for (const challenge of challenges) {
    const shotsForChallenge = drillShots.filter((shot) => shot.clubType === challenge.clubType);
    const progress = evaluateCoachDrillProgress(challenge, shotsForChallenge);
    const wonAwarded = unlockedIds.has(challenge.winAchievementId);

    statusByDrillId[challenge.id] = {
      ...progress,
      completedAwarded: wonAwarded || unlockedIds.has(challenge.completeAchievementId),
      wonAwarded,
    };
  }

  return statusByDrillId;
}

export function evaluateCoachDrillProgress(
  challenge: CoachDrillChallenge,
  drillShots: CoachDrillShot[],
): CoachDrillProgress {
  const cleanShots = drillShots.filter(isCleanFullShot);
  const winCount = countWinningShots(challenge.winRule, challenge.clubType, cleanShots);
  const completed = cleanShots.length >= challenge.completionTarget;
  const won = completed && winCount >= challenge.winRule.target;

  return {
    uploadedShotCount: cleanShots.length,
    completionTarget: challenge.completionTarget,
    winCount,
    winTarget: challenge.winRule.target,
    completed,
    won,
  };
}

async function loadUnlockedCoachDrillAchievementIds(
  challenges: CoachDrillChallenge[],
  userId: string,
) {
  const achievementIds = challenges.flatMap((challenge) => [
    challenge.completeAchievementId,
    challenge.winAchievementId,
  ]);

  if (achievementIds.length === 0) {
    return new Set<string>();
  }

  const db = getDb();
  const rows = await db
    .select({
      achievementId: userAchievements.achievementId,
    })
    .from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), inArray(userAchievements.achievementId, achievementIds)));

  return new Set(rows.map((row) => row.achievementId));
}

async function loadCoachDrillShots(challenges: CoachDrillChallenge[], userId: string) {
  const clubTypes = [...new Set(challenges.map((challenge) => challenge.clubType))];
  const dateKeys = [...new Set(challenges.map((challenge) => challenge.dateKey))];

  if (clubTypes.length === 0 || dateKeys.length === 0) {
    return [];
  }

  const rows: CoachDrillShot[] = [];
  const db = getDb();

  for (const dateKey of dateKeys) {
    const bounds = dayBounds(dateKey);
    rows.push(
      ...(await db
        .select({
          id: shots.id,
          clubType: shots.clubType,
          shotAt: shots.shotAt,
          shotCategory: shots.shotCategory,
          carryYd: shots.carryYd,
          sideCarryYd: shots.sideCarryYd,
          launchAngleDeg: shots.launchAngleDeg,
          launchDirectionDeg: shots.launchDirectionDeg,
          ballSpeedMph: shots.ballSpeedMph,
          clubSpeedMph: shots.clubSpeedMph,
          smashFactor: shots.smashFactor,
          clubPathDeg: shots.clubPathDeg,
        })
        .from(shots)
        .where(
          and(
            eq(shots.userId, userId),
            gte(shots.shotAt, bounds.start),
            lt(shots.shotAt, bounds.end),
            inArray(shots.clubType, clubTypes),
          ),
        )
        .orderBy(asc(shots.shotAt), asc(shots.shotNumber))),
    );
  }

  return rows;
}

async function awardCoachDrillAchievement(
  userId: string,
  challenge: CoachDrillChallenge,
  outcome: "complete" | "win",
) {
  const award = buildAward(challenge, outcome);
  const db = getDb();
  const now = new Date();
  const insertedAchievements = await db
    .insert(userAchievements)
    .values({
      userId,
      achievementId: award.achievementId,
      firstUnlockedAt: now,
      lastUnlockedAt: now,
      unlockCount: 1,
      xpAwarded: award.xp,
      metadataJson: award.metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [userAchievements.userId, userAchievements.achievementId],
    })
    .returning({ achievementId: userAchievements.achievementId });

  if (insertedAchievements.length === 0) {
    return [];
  }

  await db
    .insert(xpLedger)
    .values({
      userId,
      amount: award.xp,
      reason: "achievement",
      achievementId: award.achievementId,
      dedupeKey: `achievement:${award.achievementId}`,
      metadataJson: award.metadata,
      createdAt: now,
    })
    .onConflictDoNothing({
      target: [xpLedger.userId, xpLedger.dedupeKey],
    });

  return [
    {
      achievementId: award.achievementId,
      name: award.name,
      description: award.description,
      tier: award.tier,
      xpAwarded: award.xp,
      unlockedAt: now.toISOString(),
    },
  ] satisfies AchievementUnlockNotification[];
}

function countWinningShots(
  rule: CoachDrillWinRule,
  clubType: string,
  cleanShots: CoachDrillShot[],
) {
  if (rule.kind === "clean-shots") {
    return cleanShots.length;
  }

  if (rule.kind === "playable") {
    return cleanShots.filter((shot) => isPlayableShot(shot, clubType)).length;
  }

  if (rule.kind === "launch-window") {
    return cleanShots.filter(
      (shot) =>
        isNumber(shot.launchAngleDeg) &&
        shot.launchAngleDeg >= rule.low &&
        shot.launchAngleDeg <= rule.high,
    ).length;
  }

  if (rule.kind === "solid-strike") {
    return cleanShots.filter((shot) => isNumber(shot.smashFactor) && shot.smashFactor >= highSmashThreshold(clubType)).length;
  }

  if (rule.kind === "delivery-window") {
    return cleanShots.filter(
      (shot) =>
        isNumber(shot.clubPathDeg) &&
        Math.abs(shot.clubPathDeg) <= 5 &&
        isNumber(shot.launchDirectionDeg) &&
        Math.abs(shot.launchDirectionDeg) <= 5,
    ).length;
  }

  return countCarryWindowSets(cleanShots, rule.setSize, rule.maxSpreadYd);
}

function countCarryWindowSets(
  cleanShots: CoachDrillShot[],
  setSize: number,
  maxSpreadYd: number,
) {
  let passingSets = 0;

  for (let index = 0; index + setSize <= cleanShots.length; index += setSize) {
    const carryValues = cleanShots
      .slice(index, index + setSize)
      .map((shot) => shot.carryYd)
      .filter(isNumber);

    if (carryValues.length !== setSize) {
      continue;
    }

    if (Math.max(...carryValues) - Math.min(...carryValues) <= maxSpreadYd) {
      passingSets += 1;
    }
  }

  return passingSets;
}

function buildAward(challenge: CoachDrillChallenge, outcome: "complete" | "win") {
  const isWin = outcome === "win";
  const tier: AchievementTier = isWin ? "gold" : "bronze";
  const achievementId = isWin ? challenge.winAchievementId : challenge.completeAchievementId;
  const name = isWin ? `${challenge.clubName} drill won` : `${challenge.clubName} drill complete`;
  const description = isWin
    ? `Beat today's ${challenge.issueLabel.toLowerCase()} coach drill.`
    : `Completed today's ${challenge.issueLabel.toLowerCase()} coach drill.`;
  const xp = isWin ? challenge.winXp : challenge.completeXp;

  return {
    achievementId,
    name,
    description,
    tier,
    xp,
    metadata: {
      dynamicAchievement: true,
      dynamicType: "coach_drill",
      category: "coach",
      triggerType: "progress",
      tier,
      name,
      description,
      clubId: challenge.clubId,
      clubType: challenge.clubType,
      clubName: challenge.clubName,
      issue: challenge.issue,
      issueLabel: challenge.issueLabel,
      drillId: challenge.id,
      drillTitle: challenge.title,
      result: isWin ? "Won" : "Completed",
      target: challenge.target,
      winCondition: challenge.winCondition,
      uploadedTarget: challenge.completionTarget,
      winTarget: challenge.winRule.target,
      dateKey: challenge.dateKey,
      xp,
    },
  };
}

function emptyProgress(challenge: CoachDrillChallenge): CoachDrillProgress {
  return {
    uploadedShotCount: 0,
    completionTarget: challenge.completionTarget,
    winCount: 0,
    winTarget: challenge.winRule.target,
    completed: false,
    won: false,
  };
}

function isCleanFullShot(shot: CoachDrillShot) {
  return shot.shotCategory !== "chip" && shot.shotCategory !== "recovery";
}

function isPlayableShot(shot: CoachDrillShot, clubType: string) {
  if (!isNumber(shot.sideCarryYd)) {
    return false;
  }

  return Math.abs(shot.sideCarryYd) <= playableLimit(clubType);
}

function playableLimit(clubType: string) {
  if (clubType === "driver") return 45;
  if (clubType.endsWith("w")) return 36;
  if (clubType.endsWith("h")) return 32;
  if (clubType.endsWith("i")) return 26;
  return 18;
}

function highSmashThreshold(clubType: string) {
  if (clubType === "driver" || clubType.endsWith("w")) {
    return 1.46;
  }

  if (["pw", "gw", "aw", "sw", "lw"].includes(clubType)) {
    return 1.22;
  }

  return 1.33;
}

function dayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = zonedLocalToUtc(year, month, day);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 12));
  const nextDateKey = localDateKey(nextDay);
  const [nextYear, nextMonth, nextDayOfMonth] = nextDateKey.split("-").map(Number);

  return {
    start,
    end: zonedLocalToUtc(nextYear, nextMonth, nextDayOfMonth),
  };
}

function zonedLocalToUtc(year: number, month: number, day: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMs = timeZoneOffsetMs(utcGuess);
  return new Date(utcGuess.getTime() - offsetMs);
}

function timeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return asUtc - date.getTime();
}

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
