import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gte, inArray, like, lt, sql } from "drizzle-orm";

import {
  achievementProgress,
  achievementSyncState,
  clubs,
  sessions,
  shots,
  speedTrainingGoals,
  speedTrainingSessions,
  stockYardages,
  userAchievements,
  users,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import {
  clubSortValue,
  formatClubType,
  isShortGameTouchClubType,
  isTrackedClubType,
} from "@/lib/club-format";
import { getOptionalCurrentUserId, requireCurrentUserId } from "@/lib/current-user";
import { isShotEvidenceEligible } from "@/lib/shot-review";
import {
  ACHIEVEMENT_REGISTRY_VERSION,
  ACHIEVEMENTS,
  GENERATED_CLUB_METRIC_ACHIEVEMENTS,
  getAchievement,
} from "./registry";
import { evaluateAllAchievementCandidates } from "./evaluator";
import type {
  Achievement,
  AchievementCategory,
  AchievementClub,
  AchievementProgressCandidate,
  AchievementSession,
  AchievementShot,
  AchievementSpeedTrainingGoal,
  AchievementSpeedTrainingSession,
  AchievementStockYardage,
  AchievementTier,
  AchievementTriggerType,
  AchievementUnlockCandidate,
  AchievementUnlockNotification,
} from "./types";
import { calculateUserLevel, capActionXpForDay, xpForAchievement } from "./xp";

const GENERATED_CLUB_METRIC_IDS = new Set(
  GENERATED_CLUB_METRIC_ACHIEVEMENTS.map((achievement) => achievement.id),
);

export type AchievementSourceStat = {
  label: string;
  value: string;
};

export type AchievementSourceView = {
  kind: "shot" | "round" | "session" | "stock" | "progress" | "speed" | "unknown";
  title: string;
  detail: string;
  occurredAt: string | null;
  href: string | null;
  stats: AchievementSourceStat[];
};

type AchievementUnlockRow = {
  achievementId: string;
  firstUnlockedAt: Date;
  lastUnlockedAt: Date;
  unlockCount: number;
  sourceSessionId: string | null;
  sourceShotId: string | null;
  xpAwarded: number;
  metadataJson: Record<string, unknown> | null;
};

type AchievementSourceShot = {
  id: string;
  sessionId: string;
  clubId: string;
  shotAt: Date;
  clubType: string;
  shotNumber: number | null;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  sideCarryYd: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  courseHoleNumber: number | null;
  sessionSource: string;
  sessionType: string;
  sessionDate: Date;
  fileName: string | null;
  courseName: string | null;
  location: string | null;
  clubBrand: string | null;
  clubModel: string | null;
};

type AchievementSourceSession = {
  id: string;
  source: string;
  type: string;
  date: Date;
  fileName: string | null;
  courseName: string | null;
  location: string | null;
  scorecardJson: AchievementSession["scorecardJson"];
};

type AchievementSourceMaps = {
  shotsById: Map<string, AchievementSourceShot>;
  sessionsById: Map<string, AchievementSourceSession>;
};

export type AchievementView = Achievement & {
  unlocked: boolean;
  unlockCount: number;
  unlockedAt: string | null;
  xpAwarded: number;
  progressValue: number | null;
  progressTargetValue: number | null;
  progressPercent: number | null;
  progressLabel: string | null;
  displayName: string;
  displayDescription: string;
  source: AchievementSourceView | null;
};

export type AchievementPageData = {
  totalXp: number;
  level: ReturnType<typeof calculateUserLevel>;
  unlockedCount: number;
  totalCount: number;
  needsSync: boolean;
  recentUnlocks: AchievementView[];
  achievements: AchievementView[];
  trackedClubTypes: string[];
  categorySummaries: Array<{
    category: string;
    total: number;
    unlocked: number;
  }>;
};

export async function syncAchievementsForDefaultUser() {
  return syncAchievementsForUser(await requireCurrentUserId());
}

export async function getTotalXpForDefaultUser() {
  return getTotalXpForCurrentUser();
}

export async function getTotalXpForCurrentUser() {
  const userId = await getOptionalCurrentUserId();
  return userId ? getTotalXpForUser(userId) : 0;
}

export async function getTotalXpForUser(userId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
    })
    .from(xpLedger)
    .where(eq(xpLedger.userId, userId));

  return Number(row?.totalXp ?? 0);
}

export async function syncAchievementsForUser(userId: string) {
  await ensureUser(userId);

  const context = await loadAchievementContext(userId);
  const evaluation = evaluateAllAchievementCandidates(context);

  await awardActionXpForContext(userId, context);

  const unlockedAchievements = await awardAchievements(userId, evaluation.unlocks);

  await upsertProgressCandidates(
    userId,
    evaluation.progress.filter(shouldPersistProgressCandidate),
  );

  const db = getDb();
  const [[shotCount], [sessionCount], [speedSessionCount], [speedGoalCount], [achievementCount]] =
    await Promise.all([
      db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
      db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
      db
        .select({ value: count() })
        .from(speedTrainingSessions)
        .where(eq(speedTrainingSessions.userId, userId)),
      db
        .select({ value: count() })
        .from(speedTrainingGoals)
        .where(eq(speedTrainingGoals.userId, userId)),
      db
        .select({ value: count() })
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId)),
    ]);

  await db
    .insert(achievementSyncState)
    .values({
      userId,
      registryVersion: ACHIEVEMENT_REGISTRY_VERSION,
      lastSyncedAt: new Date(),
      lastShotCount: shotCount?.value ?? 0,
      lastSessionCount: sessionCount?.value ?? 0,
      lastAchievementCount: achievementCount?.value ?? 0,
      metadataJson: {
        registryCount: ACHIEVEMENTS.length,
        speedSessionCount: speedSessionCount?.value ?? 0,
        speedGoalCount: speedGoalCount?.value ?? 0,
      },
    })
    .onConflictDoUpdate({
      target: achievementSyncState.userId,
      set: {
        registryVersion: ACHIEVEMENT_REGISTRY_VERSION,
        lastSyncedAt: new Date(),
        lastShotCount: shotCount?.value ?? 0,
        lastSessionCount: sessionCount?.value ?? 0,
        lastAchievementCount: achievementCount?.value ?? 0,
        metadataJson: {
          registryCount: ACHIEVEMENTS.length,
          speedSessionCount: speedSessionCount?.value ?? 0,
          speedGoalCount: speedGoalCount?.value ?? 0,
        },
      },
    });

  safeRevalidatePath("/achievements");

  return {
    unlockedCount: achievementCount?.value ?? 0,
    registryCount: ACHIEVEMENTS.length,
    unlockedAchievements,
  };
}

export async function evaluateAchievementsAfterImport(userId: string) {
  const result = await syncAchievementsForUser(userId);
  revalidateAchievementPages();
  return result;
}

export async function evaluateRoundAchievementsForSession(sessionId: string, actorUserId: string) {
  const db = getDb();
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, actorUserId)))
    .limit(1);

  if (!session) {
    return {
      unlockedCount: 0,
      registryCount: ACHIEVEMENTS.length,
      unlockedAchievements: [],
    };
  }

  const result = await syncAchievementsForUser(actorUserId);
  revalidateAchievementPages();
  return result;
}

export async function getAchievementPageData(userId?: string): Promise<AchievementPageData> {
  userId ??= await requireCurrentUserId();
  const db = getDb();
  const [
    [shotCount],
    [sessionCount],
    [speedSessionCount],
    [speedGoalCount],
    unlockRows,
    progressRows,
    [xpTotalRow],
    clubTypeRows,
    speedClubTypeRows,
    [syncState],
  ] = await Promise.all([
    db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
    db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
    db
      .select({ value: count() })
      .from(speedTrainingSessions)
      .where(eq(speedTrainingSessions.userId, userId)),
    db
      .select({ value: count() })
      .from(speedTrainingGoals)
      .where(eq(speedTrainingGoals.userId, userId)),
    db
      .select({
        achievementId: userAchievements.achievementId,
        firstUnlockedAt: userAchievements.firstUnlockedAt,
        lastUnlockedAt: userAchievements.lastUnlockedAt,
        unlockCount: userAchievements.unlockCount,
        sourceSessionId: userAchievements.sourceSessionId,
        sourceShotId: userAchievements.sourceShotId,
        xpAwarded: userAchievements.xpAwarded,
        metadataJson: userAchievements.metadataJson,
      })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.lastUnlockedAt)),
    db
      .select({
        achievementId: achievementProgress.achievementId,
        progressValue: achievementProgress.progressValue,
        targetValue: achievementProgress.targetValue,
        metadataJson: achievementProgress.metadataJson,
      })
      .from(achievementProgress)
      .where(eq(achievementProgress.userId, userId)),
    db
      .select({
        totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
      })
      .from(xpLedger)
      .where(eq(xpLedger.userId, userId)),
    db
      .select({
        clubType: shots.clubType,
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.clubType),
    db
      .select({
        clubType: clubs.type,
      })
      .from(speedTrainingSessions)
      .innerJoin(clubs, eq(speedTrainingSessions.clubId, clubs.id))
      .where(eq(speedTrainingSessions.userId, userId))
      .groupBy(clubs.type),
    db
      .select({
        registryVersion: achievementSyncState.registryVersion,
        lastShotCount: achievementSyncState.lastShotCount,
        lastSessionCount: achievementSyncState.lastSessionCount,
        metadataJson: achievementSyncState.metadataJson,
      })
      .from(achievementSyncState)
      .where(eq(achievementSyncState.userId, userId))
      .limit(1),
  ]);
  const sourceRowsForView = selectSourceRowsForView(unlockRows);
  const sourceMaps = await loadAchievementSourceMaps(userId, sourceRowsForView);
  const sourceByAchievementId = new Map(
    sourceRowsForView
      .map((unlock) => {
        const achievement = achievementForUnlockRow(unlock);
        const source = achievement
          ? buildAchievementSourceView(achievement, unlock, sourceMaps)
          : null;
        return source ? ([unlock.achievementId, source] as const) : null;
      })
      .filter((entry): entry is readonly [string, AchievementSourceView] => Boolean(entry)),
  );
  const unlockByAchievementId = new Map(unlockRows.map((row) => [row.achievementId, row]));
  const dynamicAchievements = unlockRows
    .map((row) => dynamicAchievementFromUnlockRow(row))
    .filter((achievement): achievement is Achievement => Boolean(achievement))
    .sort((left, right) => {
      const leftUnlockedAt = unlockByAchievementId.get(left.id)?.lastUnlockedAt.getTime() ?? 0;
      const rightUnlockedAt = unlockByAchievementId.get(right.id)?.lastUnlockedAt.getTime() ?? 0;
      return rightUnlockedAt - leftUnlockedAt;
    });
  const progressByAchievementId = new Map(progressRows.map((row) => [row.achievementId, row]));
  const totalXp = Number(xpTotalRow?.totalXp ?? 0);
  const trackedClubTypes = [...clubTypeRows, ...speedClubTypeRows]
    .map((row) => row.clubType)
    .filter((clubType): clubType is string => isTrackedClubType(clubType))
    .filter((clubType, index, clubTypes) => clubTypes.indexOf(clubType) === index)
    .sort((left, right) => clubSortValue(left) - clubSortValue(right));
  const trackedClubTypeSet = new Set(trackedClubTypes);
  const visibleAchievementRegistry = ACHIEVEMENTS.filter((achievement) =>
    isAchievementVisibleForTrackedClubs(achievement, trackedClubTypeSet),
  );
  const visibleAchievements = [...visibleAchievementRegistry, ...dynamicAchievements];
  const achievementViews = visibleAchievements.map<AchievementView>((achievement) => {
    const unlock = unlockByAchievementId.get(achievement.id);
    const progress = progressByAchievementId.get(achievement.id);
    const unlocked = Boolean(unlock);
    const progressPercent = progress
      ? Math.min(
          100,
          Math.round((progress.progressValue / Math.max(1, progress.targetValue)) * 100),
        )
      : null;
    const progressLabel = progress
      ? progressLabelFromMetadata(
          progress.metadataJson,
          progress.progressValue,
          progress.targetValue,
        )
      : null;

    return {
      ...achievement,
      unlocked,
      unlockCount: unlock?.unlockCount ?? 0,
      unlockedAt: unlock?.lastUnlockedAt.toISOString() ?? null,
      xpAwarded: unlock?.xpAwarded ?? 0,
      progressValue: progress?.progressValue ?? null,
      progressTargetValue: progress?.targetValue ?? null,
      progressPercent,
      progressLabel,
      displayName: achievement.hidden && !unlocked ? "Hidden achievement" : achievement.name,
      displayDescription:
        achievement.hidden && !unlocked
          ? "Unlock from your Rapsodo or round data."
          : achievement.description,
      source: unlock ? (sourceByAchievementId.get(achievement.id) ?? null) : null,
    };
  });
  const categorySummaries = [
    ...new Set(visibleAchievements.map((achievement) => achievement.category)),
  ].map((category) => {
    const categoryAchievements = achievementViews.filter(
      (achievement) => achievement.category === category,
    );

    return {
      category,
      total: categoryAchievements.length,
      unlocked: categoryAchievements.filter((achievement) => achievement.unlocked).length,
    };
  });

  const sortedUnlockedAchievements = achievementViews
    .filter((achievement) => achievement.unlocked)
    .sort((left, right) => {
      const leftTime = left.unlockedAt ? new Date(left.unlockedAt).getTime() : 0;
      const rightTime = right.unlockedAt ? new Date(right.unlockedAt).getTime() : 0;
      return rightTime - leftTime;
    });

  return {
    totalXp,
    level: calculateUserLevel(totalXp),
    unlockedCount: achievementViews.filter((achievement) => achievement.unlocked).length,
    totalCount: visibleAchievementRegistry.length,
    needsSync:
      !syncState ||
      syncState.registryVersion !== ACHIEVEMENT_REGISTRY_VERSION ||
      syncState.lastShotCount !== (shotCount?.value ?? 0) ||
      syncState.lastSessionCount !== (sessionCount?.value ?? 0) ||
      numberFromMetadata(syncState.metadataJson, "speedSessionCount") !==
        (speedSessionCount?.value ?? 0) ||
      numberFromMetadata(syncState.metadataJson, "speedGoalCount") !== (speedGoalCount?.value ?? 0),
    recentUnlocks: sortedUnlockedAchievements.slice(0, 10),
    achievements: achievementViews,
    trackedClubTypes,
    categorySummaries,
  };
}

function selectSourceRowsForView(unlockRows: AchievementUnlockRow[]) {
  const selectedRowsByAchievementId = new Map<string, AchievementUnlockRow>();

  for (const row of unlockRows.slice(0, 10)) {
    selectedRowsByAchievementId.set(row.achievementId, row);
  }

  return [...selectedRowsByAchievementId.values()];
}

function isAchievementVisibleForTrackedClubs(
  achievement: Achievement,
  trackedClubTypes: Set<string>,
) {
  const clubTypes = achievement.clubTypes ?? [];

  if (clubTypes.length === 0) {
    return true;
  }

  return clubTypes.some((clubType) => trackedClubTypes.has(clubType));
}

function achievementForUnlockRow(unlock: AchievementUnlockRow) {
  return getAchievement(unlock.achievementId) ?? dynamicAchievementFromUnlockRow(unlock);
}

function dynamicAchievementFromUnlockRow(unlock: AchievementUnlockRow): Achievement | null {
  if (!unlock.achievementId.startsWith("coach_") || !unlock.metadataJson) {
    return null;
  }

  const metadata = unlock.metadataJson;
  const tier = achievementTierFromMetadata(metadata.tier);
  const category = achievementCategoryFromMetadata(metadata.category);
  const triggerType = achievementTriggerTypeFromMetadata(metadata.triggerType);
  const name = stringFromMetadata(metadata.name) ?? "Coach drill";
  const description = stringFromMetadata(metadata.description) ?? "Completed a coach drill.";
  const clubType = stringFromMetadata(metadata.clubType);

  return {
    id: unlock.achievementId,
    name,
    description,
    category,
    tier,
    xp: unlock.xpAwarded,
    repeatable: false,
    hidden: false,
    triggerType,
    targetValue: 1,
    clubTypes: clubType ? [clubType] : undefined,
  };
}

function achievementTierFromMetadata(value: unknown): AchievementTier {
  if (
    value === "bronze" ||
    value === "silver" ||
    value === "gold" ||
    value === "platinum" ||
    value === "diamond" ||
    value === "hidden"
  ) {
    return value;
  }

  return "bronze";
}

function achievementCategoryFromMetadata(value: unknown): AchievementCategory {
  if (
    value === "data" ||
    value === "power" ||
    value === "accuracy" ||
    value === "launch" ||
    value === "strike" ||
    value === "driver" ||
    value === "fiveWood" ||
    value === "gapping" ||
    value === "consistency" ||
    value === "coach" ||
    value === "progress" ||
    value === "speed" ||
    value === "mileage" ||
    value === "scoring" ||
    value === "putting" ||
    value === "shortGame" ||
    value === "roundStats" ||
    value === "hidden"
  ) {
    return value;
  }

  return "coach";
}

function achievementTriggerTypeFromMetadata(value: unknown): AchievementTriggerType {
  if (
    value === "singleShot" ||
    value === "session" ||
    value === "stockYardage" ||
    value === "rollingWindow" ||
    value === "progress" ||
    value === "speedTraining" ||
    value === "roundScorecard"
  ) {
    return value;
  }

  return "progress";
}

function stringFromMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

async function loadAchievementSourceMaps(
  userId: string,
  unlockRows: AchievementUnlockRow[],
): Promise<AchievementSourceMaps> {
  const db = getDb();
  const sourceShotIds = uniqueStrings(unlockRows.map((row) => row.sourceShotId));
  const sourceSessionIds = uniqueStrings(unlockRows.map((row) => row.sourceSessionId));
  const [sourceShotRows, sourceSessionRows] = await Promise.all([
    sourceShotIds.length > 0
      ? db
          .select({
            id: shots.id,
            sessionId: shots.sessionId,
            clubId: shots.clubId,
            shotAt: shots.shotAt,
            clubType: shots.clubType,
            shotNumber: shots.shotNumber,
            carryYd: shots.carryYd,
            totalYd: shots.totalYd,
            ballSpeedMph: shots.ballSpeedMph,
            clubSpeedMph: shots.clubSpeedMph,
            launchAngleDeg: shots.launchAngleDeg,
            launchDirectionDeg: shots.launchDirectionDeg,
            apexFt: shots.apexFt,
            sideCarryYd: shots.sideCarryYd,
            attackAngleDeg: shots.attackAngleDeg,
            clubPathDeg: shots.clubPathDeg,
            descentAngleDeg: shots.descentAngleDeg,
            smashFactor: shots.smashFactor,
            courseHoleNumber: shots.courseHoleNumber,
            sessionSource: sessions.source,
            sessionType: sessions.type,
            sessionDate: sessions.date,
            fileName: sessions.fileName,
            courseName: sessions.courseName,
            location: sessions.location,
            clubBrand: clubs.brand,
            clubModel: clubs.model,
          })
          .from(shots)
          .innerJoin(sessions, eq(shots.sessionId, sessions.id))
          .innerJoin(clubs, eq(shots.clubId, clubs.id))
          .where(and(eq(shots.userId, userId), inArray(shots.id, sourceShotIds)))
      : Promise.resolve([]),
    sourceSessionIds.length > 0
      ? db
          .select({
            id: sessions.id,
            source: sessions.source,
            type: sessions.type,
            date: sessions.date,
            fileName: sessions.fileName,
            courseName: sessions.courseName,
            location: sessions.location,
            scorecardJson: sessions.scorecardJson,
          })
          .from(sessions)
          .where(and(eq(sessions.userId, userId), inArray(sessions.id, sourceSessionIds)))
      : Promise.resolve([]),
  ]);

  return {
    shotsById: new Map(sourceShotRows.map((shot) => [shot.id, shot])),
    sessionsById: new Map(sourceSessionRows.map((session) => [session.id, session])),
  };
}

function buildAchievementSourceView(
  achievement: Achievement,
  unlock: AchievementUnlockRow,
  sourceMaps: AchievementSourceMaps,
): AchievementSourceView | null {
  const metadataStats = statsFromMetadata(unlock.metadataJson);

  if (unlock.sourceShotId) {
    const shot = sourceMaps.shotsById.get(unlock.sourceShotId);

    if (shot) {
      return buildShotSourceView(shot, metadataStats);
    }
  }

  if (unlock.sourceSessionId) {
    const session = sourceMaps.sessionsById.get(unlock.sourceSessionId);

    if (session) {
      return buildSessionSourceView(achievement, unlock, session, metadataStats);
    }
  }

  if (achievement.triggerType === "speedTraining" && metadataStats.length > 0) {
    return buildSpeedTrainingSourceView(unlock, metadataStats);
  }

  if (metadataStats.length > 0) {
    const kind =
      achievement.triggerType === "progress"
        ? "progress"
        : achievement.triggerType === "stockYardage"
          ? "stock"
          : "unknown";

    return {
      kind,
      title:
        kind === "progress"
          ? "Progress milestone"
          : kind === "stock"
            ? "Bag data"
            : "Recorded data",
      detail: "Unlocked from stored Rapsodo or round metrics.",
      occurredAt: unlock.lastUnlockedAt.toISOString(),
      href: null,
      stats: metadataStats.slice(0, 6),
    };
  }

  return null;
}

function buildSpeedTrainingSourceView(
  unlock: AchievementUnlockRow,
  metadataStats: AchievementSourceStat[],
): AchievementSourceView {
  const metadata = unlock.metadataJson;
  const title =
    formatText(metadata?.speedSessionTitle) ??
    formatText(metadata?.implementLabel) ??
    formatText(metadata?.clubName) ??
    (metadata?.speedGoalId ? "Speed target" : null) ??
    "Speed Centre session";
  const occurredAt =
    typeof metadata?.speedSessionDateIso === "string" && metadata.speedSessionDateIso
      ? metadata.speedSessionDateIso
      : unlock.lastUnlockedAt.toISOString();

  return {
    kind: "speed",
    title,
    detail: `Speed Centre · ${formatIsoDate(occurredAt)}`,
    occurredAt,
    href: "/speed",
    stats: metadataStats.slice(0, 7),
  };
}

function buildShotSourceView(
  shot: AchievementSourceShot,
  metadataStats: AchievementSourceStat[],
): AchievementSourceView {
  const clubLabel = formatClubType(shot.clubType);
  const shotLabel = shot.shotNumber ? `Shot ${shot.shotNumber}` : "Source shot";
  const sourceName = shot.courseName ?? shot.fileName ?? shot.location ?? "Rapsodo session";
  const detailParts = [
    sourceName,
    formatSessionType(shot.sessionType),
    shot.courseHoleNumber ? `Hole ${shot.courseHoleNumber}` : null,
  ].filter(Boolean);
  const stats = [
    stat("Carry", formatYards(shot.carryYd)),
    stat("Total", formatYards(shot.totalYd)),
    stat("Side", formatSignedYards(shot.sideCarryYd)),
    stat("Launch", formatDegrees(shot.launchAngleDeg)),
    stat("Smash", formatDecimal(shot.smashFactor, 2)),
    stat("Ball speed", formatMph(shot.ballSpeedMph)),
  ];
  const href = isRoundSessionType(shot.sessionType) ? `/rounds/${shot.sessionId}` : "/shots";

  return {
    kind: "shot",
    title: `${clubLabel} · ${shotLabel}`,
    detail: detailParts.join(" · "),
    occurredAt: shot.shotAt.toISOString(),
    href,
    stats: mergeStats(stats, metadataStats).slice(0, 7),
  };
}

function buildSessionSourceView(
  achievement: Achievement,
  unlock: AchievementUnlockRow,
  session: AchievementSourceSession,
  metadataStats: AchievementSourceStat[],
): AchievementSourceView {
  const isRound = isRoundSessionType(session.type);
  const sourceName =
    session.courseName ??
    session.fileName ??
    session.location ??
    (isRound ? "Round scorecard" : "Rapsodo session");
  const roundStats = isRound ? statsFromScorecard(session.scorecardJson) : [];
  const holeNumber = numberFromMetadata(unlock.metadataJson, "holeNumber");
  const title = isRound && holeNumber ? `${sourceName} · Hole ${holeNumber}` : sourceName;

  return {
    kind: isRound ? "round" : "session",
    title,
    detail: `${formatSessionType(session.type)} · ${formatDate(session.date)}`,
    occurredAt: session.date.toISOString(),
    href: isRound ? `/rounds/${session.id}` : "/shots",
    stats: mergeStats(metadataStats, roundStats).slice(0, 7),
  };
}

function statsFromScorecard(scorecardJson: AchievementSession["scorecardJson"]) {
  const holes =
    scorecardJson?.filter(
      (hole) => typeof hole.score === "number" && typeof hole.par === "number",
    ) ?? [];

  if (holes.length === 0) {
    return [];
  }

  const score = holes.reduce((total, hole) => total + (hole.score ?? 0), 0);
  const par = holes.reduce((total, hole) => total + hole.par, 0);
  const putts = holes.reduce(
    (total, hole) => total + (typeof hole.putts === "number" ? hole.putts : 0),
    0,
  );
  const puttHoles = holes.filter((hole) => typeof hole.putts === "number").length;

  return [
    stat("Score", `${score} (${score - par >= 0 ? "+" : ""}${score - par})`),
    puttHoles > 0 ? stat("Putts", putts.toString()) : null,
    stat("Holes", holes.length.toString()),
  ].filter((item): item is AchievementSourceStat => Boolean(item));
}

function statsFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return [];
  }

  const stats = [
    stat("Club", formatText(metadata.clubName)),
    stat("Drill", formatText(metadata.drillTitle)),
    stat("Result", formatText(metadata.result)),
    stat("Target", formatText(metadata.target)),
    stat("Hole", formatInteger(metadata.holeNumber)),
    stat("Shot", formatInteger(metadata.shotNumber)),
    stat("Score", formatInteger(metadata.score)),
    stat("Putts", formatInteger(metadata.putts)),
    stat("Birdies", formatInteger(metadata.birdies)),
    stat("Shots", formatInteger(metadata.shotCount)),
    stat("Sessions", formatInteger(metadata.speedSessionCount)),
    stat("Swings", formatInteger(metadata.swingCount ?? metadata.totalSwings)),
    stat("Targets", formatInteger(metadata.speedTargetCount)),
    stat("Club targets", formatInteger(metadata.clubTargetCount)),
    stat("Targets hit", formatInteger(metadata.targetHitClubCount)),
    stat("Sample", formatInteger(metadata.sampleSize)),
    stat("Target", formatInteger(metadata.targetShots)),
    stat("Threshold", formatMetricValue(metadata.targetValue)),
    stat("Miles", formatMiles(metadata.totalMiles)),
    stat("Target miles", formatMiles(metadata.targetMiles)),
    stat("Fairways", formatInteger(metadata.fairways)),
    stat("GIR", formatInteger(metadata.gir)),
    stat("Stock clubs", formatInteger(metadata.stockCount ?? metadata.activeClubCount)),
    stat("Benchmark clubs", formatInteger(metadata.benchmarkClubCount)),
    stat("Level", formatText(metadata.benchmarkLevel)),
    stat("Actual level", formatText(metadata.actualLevel)),
    stat("Average level", formatDecimal(metadata.benchmarkAverageLevel, 1)),
    stat("Target", formatYards(metadata.targetYd)),
    stat("Carry", formatYards(metadata.carryYd)),
    stat("Total", formatYards(metadata.totalYd)),
    stat("Side", formatSignedYards(metadata.sideCarryYd)),
    stat("Offline", formatYards(metadata.offlineYd)),
    stat("Ball speed", formatMph(metadata.ballSpeedMph)),
    stat("Avg speed", formatMph(metadata.avgSpeedMph ?? metadata.bestSpeedMph)),
    stat("Max speed", formatMph(metadata.maxSpeedMph)),
    stat("Min speed", formatMph(metadata.minSpeedMph)),
    stat("Target speed", formatMph(metadata.targetSpeedMph)),
    stat("Carry spread", formatYards(metadata.carrySpreadYd)),
    stat("Total spread", formatYards(metadata.totalSpreadYd)),
    stat("Avg offline", formatYards(metadata.offlineAverageYd)),
    stat("Launch spread", formatDegrees(metadata.launchSpreadDeg)),
    stat("Avg smash", formatDecimal(metadata.smashAverage, 2)),
    stat("Gain", formatMph(metadata.gainMph)),
    stat("Gain", formatYards(metadata.gainYd)),
    stat("Gap", formatYards(metadata.gapYd ?? metadata.driverGap ?? metadata.fiveWoodGap)),
    stat("Launch", formatDegrees(metadata.launchAngleDeg ?? metadata.recentLaunch)),
    stat("Old launch", formatDegrees(metadata.earlyLaunch)),
    stat("Apex", formatFeet(metadata.apexFt)),
    stat("Path", formatSignedDegrees(metadata.clubPathDeg)),
    stat("Attack", formatSignedDegrees(metadata.attackAngleDeg)),
    stat("Smash", formatDecimal(metadata.smashFactor, 2)),
    stat("Rate", formatPercent(metadata.fairwayRate ?? metadata.girRate ?? metadata.scrambleRate)),
    stat("Target rate", formatPercent(metadata.targetRatio)),
    stat("Improvement", formatPercent(metadata.improvementPercent)),
    stat("Value", formatMetricValue(metadata.value)),
  ];

  return mergeStats(stats, []).slice(0, 8);
}

function stat(label: string, value: string | null | undefined): AchievementSourceStat | null {
  return value ? { label, value } : null;
}

function mergeStats(
  primary: Array<AchievementSourceStat | null>,
  secondary: Array<AchievementSourceStat | null>,
) {
  const seen = new Set<string>();
  const merged: AchievementSourceStat[] = [];

  for (const item of [...primary, ...secondary]) {
    if (!item || seen.has(item.label)) {
      continue;
    }

    seen.add(item.label);
    merged.push(item);
  }

  return merged;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function isRoundSessionType(value: string) {
  return (
    value === "round" ||
    value === "simulator" ||
    value === "simulated_course" ||
    value === "real_round"
  );
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real round";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  if (value === "simulator") {
    return "Simulator";
  }

  if (value === "round") {
    return "Round";
  }

  return "Range";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatIsoDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recorded";
  }

  return formatDate(date);
}

function formatYards(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : `${roundOne(numberValue)} yd`;
}

function formatSignedYards(value: unknown) {
  const numberValue = finiteNumber(value);
  if (numberValue === null) {
    return null;
  }

  return `${numberValue > 0 ? "+" : ""}${roundOne(numberValue)} yd`;
}

function formatMph(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : `${roundOne(numberValue)} mph`;
}

function formatDegrees(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : `${roundOne(numberValue)}°`;
}

function formatSignedDegrees(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : `${numberValue > 0 ? "+" : ""}${roundOne(numberValue)}°`;
}

function formatPercent(value: unknown) {
  const numberValue = finiteNumber(value);

  if (numberValue === null) {
    return null;
  }

  const percentage = Math.abs(numberValue) <= 1 ? numberValue * 100 : numberValue;
  return `${roundOne(percentage)}%`;
}

function formatMiles(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : `${roundOne(numberValue)} mi`;
}

function formatFeet(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : `${roundOne(numberValue)} ft`;
}

function formatDecimal(value: unknown, digits: number) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : numberValue.toFixed(digits);
}

function formatInteger(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : Math.round(numberValue).toString();
}

function formatMetricValue(value: unknown) {
  const numberValue = finiteNumber(value);
  return numberValue === null ? null : roundOne(numberValue).toString();
}

function formatText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberFromMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  return finiteNumber(metadata?.[key]);
}

function finiteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function roundOne(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

async function loadAchievementContext(userId: string) {
  const db = getDb();
  const [sessionRows, shotRows, clubRows, stockRows, speedSessionRows, speedGoalRows] =
    await Promise.all([
      db
        .select({
          id: sessions.id,
          source: sessions.source,
          type: sessions.type,
          date: sessions.date,
          scorecardJson: sessions.scorecardJson,
        })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(sessions.date),
      db
        .select({
          id: shots.id,
          userId: shots.userId,
          sessionId: shots.sessionId,
          sessionType: sessions.type,
          clubId: shots.clubId,
          shotAt: shots.shotAt,
          clubType: shots.clubType,
          shotNumber: shots.shotNumber,
          carryYd: shots.carryYd,
          totalYd: shots.totalYd,
          ballSpeedMph: shots.ballSpeedMph,
          clubSpeedMph: shots.clubSpeedMph,
          launchAngleDeg: shots.launchAngleDeg,
          launchDirectionDeg: shots.launchDirectionDeg,
          apexFt: shots.apexFt,
          sideCarryYd: shots.sideCarryYd,
          courseHoleNumber: shots.courseHoleNumber,
          attackAngleDeg: shots.attackAngleDeg,
          clubPathDeg: shots.clubPathDeg,
          descentAngleDeg: shots.descentAngleDeg,
          smashFactor: shots.smashFactor,
          shotCategory: shots.shotCategory,
          qualityTag: shots.qualityTag,
          reviewStatus: shots.reviewStatus,
        })
        .from(shots)
        .innerJoin(sessions, eq(shots.sessionId, sessions.id))
        .where(and(eq(shots.userId, userId), inArray(shots.reviewStatus, ["included", "restored"])))
        .orderBy(shots.shotAt),
      db
        .select({
          id: clubs.id,
          type: clubs.type,
          active: clubs.active,
        })
        .from(clubs)
        .where(eq(clubs.userId, userId)),
      db
        .select({
          clubId: stockYardages.clubId,
          clubType: clubs.type,
          calculatedAt: stockYardages.calculatedAt,
          sampleSize: stockYardages.sampleSize,
          carryMedianYd: stockYardages.carryMedianYd,
          carryMeanYd: stockYardages.carryMeanYd,
          totalMedianYd: stockYardages.totalMedianYd,
          dispersionLeftYd: stockYardages.dispersionLeftYd,
          dispersionRightYd: stockYardages.dispersionRightYd,
          confidenceScore: stockYardages.confidenceScore,
        })
        .from(stockYardages)
        .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
        .where(eq(stockYardages.userId, userId))
        .orderBy(stockYardages.calculatedAt),
      db
        .select({
          id: speedTrainingSessions.id,
          source: speedTrainingSessions.source,
          sessionDate: speedTrainingSessions.sessionDate,
          title: speedTrainingSessions.title,
          clubId: speedTrainingSessions.clubId,
          clubType: clubs.type,
          implementKind: speedTrainingSessions.implementKind,
          implementLabel: speedTrainingSessions.implementLabel,
          speedSystem: speedTrainingSessions.speedSystem,
          handedness: speedTrainingSessions.handedness,
          swingCount: speedTrainingSessions.swingCount,
          minSpeedMph: speedTrainingSessions.minSpeedMph,
          avgSpeedMph: speedTrainingSessions.avgSpeedMph,
          maxSpeedMph: speedTrainingSessions.maxSpeedMph,
          targetSpeedMph: speedTrainingSessions.targetSpeedMph,
        })
        .from(speedTrainingSessions)
        .leftJoin(clubs, eq(speedTrainingSessions.clubId, clubs.id))
        .where(eq(speedTrainingSessions.userId, userId))
        .orderBy(speedTrainingSessions.sessionDate),
      db
        .select({
          id: speedTrainingGoals.id,
          goalKey: speedTrainingGoals.goalKey,
          clubId: speedTrainingGoals.clubId,
          clubType: clubs.type,
          targetSpeedMph: speedTrainingGoals.targetSpeedMph,
          targetDate: speedTrainingGoals.targetDate,
          notes: speedTrainingGoals.notes,
        })
        .from(speedTrainingGoals)
        .leftJoin(clubs, eq(speedTrainingGoals.clubId, clubs.id))
        .where(eq(speedTrainingGoals.userId, userId))
        .orderBy(speedTrainingGoals.goalKey),
    ]);

  return {
    sessions: sessionRows satisfies AchievementSession[],
    shots: shotRows.filter(
      (shot) => isTrackedClubType(shot.clubType) && isShotEvidenceEligible(shot),
    ) satisfies AchievementShot[],
    clubs: clubRows.filter((club) => isTrackedClubType(club.type)) satisfies AchievementClub[],
    stockYardages: stockRows.filter(
      (stock) => isTrackedClubType(stock.clubType) && !isShortGameTouchClubType(stock.clubType),
    ) satisfies AchievementStockYardage[],
    speedTrainingSessions: speedSessionRows.filter(
      (session) => !session.clubType || isTrackedClubType(session.clubType),
    ) satisfies AchievementSpeedTrainingSession[],
    speedTrainingGoals: speedGoalRows.filter(
      (goal) => !goal.clubType || isTrackedClubType(goal.clubType),
    ) satisfies AchievementSpeedTrainingGoal[],
  };
}

async function awardActionXpForContext(
  userId: string,
  context: {
    sessions: AchievementSession[];
    shots: AchievementShot[];
    stockYardages: AchievementStockYardage[];
  },
) {
  const shotsBySessionId = new Map<string, AchievementShot[]>();

  for (const shot of context.shots) {
    const existing = shotsBySessionId.get(shot.sessionId) ?? [];
    existing.push(shot);
    shotsBySessionId.set(shot.sessionId, existing);
  }

  const rapsodoSessions = context.sessions
    .filter(
      (session) =>
        session.source === "rapsodo" && (shotsBySessionId.get(session.id)?.length ?? 0) > 0,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  for (const [index, session] of rapsodoSessions.entries()) {
    const sessionShots = shotsBySessionId.get(session.id) ?? [];

    await awardXP({
      userId,
      amount: 50,
      reason: "action:import_session",
      dedupeKey: `action:import_session:${session.id}`,
      sessionId: session.id,
      createdAt: session.date,
    });

    if (index === 0) {
      await awardXP({
        userId,
        amount: 100,
        reason: "action:first_session",
        dedupeKey: "action:first_session",
        sessionId: session.id,
        createdAt: session.date,
      });
    }

    for (const threshold of [
      { shots: 10, xp: 25 },
      { shots: 25, xp: 50 },
      { shots: 50, xp: 100 },
    ]) {
      if (sessionShots.length >= threshold.shots) {
        await awardXP({
          userId,
          amount: threshold.xp,
          reason: `action:${threshold.shots}_shot_session`,
          dedupeKey: `action:${threshold.shots}_shot_session:${session.id}`,
          sessionId: session.id,
          createdAt: session.date,
        });
      }
    }
  }

  const reliableStockByClubId = new Map<string, AchievementStockYardage>();
  for (const stock of context.stockYardages) {
    if ((stock.confidenceScore ?? 0) < 50 || stock.carryMedianYd === null) {
      continue;
    }

    if (!reliableStockByClubId.has(stock.clubId)) {
      reliableStockByClubId.set(stock.clubId, stock);
    }
  }

  for (const stock of reliableStockByClubId.values()) {
    await awardXP({
      userId,
      amount: 150,
      reason: "action:stock_yardage",
      dedupeKey: `action:stock_yardage:${stock.clubId}`,
      createdAt: stock.calculatedAt,
      metadata: {
        clubType: stock.clubType,
        carryMedianYd: stock.carryMedianYd,
      },
    });
  }
}

async function awardAchievements(
  userId: string,
  candidates: AchievementUnlockCandidate[],
): Promise<AchievementUnlockNotification[]> {
  const db = getDb();
  const existingRows = await db
    .select({
      achievementId: userAchievements.achievementId,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const existingIds = new Set(existingRows.map((row) => row.achievementId));
  const xpRows: Array<typeof xpLedger.$inferInsert> = [];
  const achievementRows: Array<typeof userAchievements.$inferInsert> = [];
  const notificationsByAchievementId = new Map<string, AchievementUnlockNotification>();
  const now = new Date();

  for (const candidate of candidates) {
    if (existingIds.has(candidate.achievementId)) {
      continue;
    }

    const achievement = getAchievement(candidate.achievementId);

    if (!achievement) {
      continue;
    }

    const unlockedAt = candidate.unlockedAt ?? now;
    const xpAwarded = xpForAchievement(achievement.xp, false);

    xpRows.push({
      userId,
      amount: xpAwarded,
      reason: "achievement",
      achievementId: achievement.id,
      sessionId: candidate.sourceSessionId ?? null,
      shotId: candidate.sourceShotId ?? null,
      dedupeKey: `achievement:${achievement.id}`,
      metadataJson: {
        achievementName: achievement.name,
        ...(candidate.metadata ?? {}),
      },
      createdAt: unlockedAt,
    });
    achievementRows.push({
      userId,
      achievementId: achievement.id,
      firstUnlockedAt: unlockedAt,
      lastUnlockedAt: unlockedAt,
      unlockCount: 1,
      sourceSessionId: candidate.sourceSessionId ?? null,
      sourceShotId: candidate.sourceShotId ?? null,
      xpAwarded,
      metadataJson: candidate.metadata ?? null,
      createdAt: unlockedAt,
      updatedAt: now,
    });
    notificationsByAchievementId.set(achievement.id, {
      achievementId: achievement.id,
      name: achievement.name,
      description: achievement.description,
      tier: achievement.tier,
      xpAwarded,
      unlockedAt: unlockedAt.toISOString(),
    });
    existingIds.add(candidate.achievementId);
  }

  if (xpRows.length > 0) {
    await db
      .insert(xpLedger)
      .values(xpRows)
      .onConflictDoNothing({
        target: [xpLedger.userId, xpLedger.dedupeKey],
      });
  }

  if (achievementRows.length > 0) {
    const insertedAchievements = await db
      .insert(userAchievements)
      .values(achievementRows)
      .onConflictDoNothing({
        target: [userAchievements.userId, userAchievements.achievementId],
      })
      .returning({ achievementId: userAchievements.achievementId });

    return insertedAchievements
      .map((row) => notificationsByAchievementId.get(row.achievementId))
      .filter((notification): notification is AchievementUnlockNotification =>
        Boolean(notification),
      );
  }

  return [];
}

async function awardXP(input: {
  userId: string;
  amount: number;
  reason: string;
  dedupeKey: string;
  achievementId?: string | null;
  sessionId?: string | null;
  shotId?: string | null;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  ignoreDailyActionCap?: boolean;
}) {
  const db = getDb();
  let amount = input.amount;
  const createdAt = input.createdAt ?? new Date();

  if (!input.ignoreDailyActionCap && input.reason.startsWith("action:")) {
    const dayStart = startOfUtcDay(createdAt);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const [actionTotal] = await db
      .select({
        totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
      })
      .from(xpLedger)
      .where(
        and(
          eq(xpLedger.userId, input.userId),
          like(xpLedger.reason, "action:%"),
          gte(xpLedger.createdAt, dayStart),
          lt(xpLedger.createdAt, dayEnd),
        ),
      );
    const existingActionXp = Number(actionTotal?.totalXp ?? 0);
    amount = capActionXpForDay(existingActionXp, input.amount);
  }

  if (amount <= 0) {
    return { awarded: false, amount: 0 };
  }

  const inserted = await db
    .insert(xpLedger)
    .values({
      userId: input.userId,
      amount,
      reason: input.reason,
      achievementId: input.achievementId ?? null,
      sessionId: input.sessionId ?? null,
      shotId: input.shotId ?? null,
      dedupeKey: input.dedupeKey,
      metadataJson: input.metadata ?? null,
      createdAt,
    })
    .onConflictDoNothing({
      target: [xpLedger.userId, xpLedger.dedupeKey],
    })
    .returning({ id: xpLedger.id });

  if (inserted.length === 0) {
    return { awarded: false, amount: 0 };
  }

  return { awarded: true, amount };
}

async function upsertProgressCandidates(
  userId: string,
  candidates: AchievementProgressCandidate[],
) {
  if (candidates.length === 0) {
    return;
  }

  const db = getDb();
  const updatedAt = new Date();

  await db
    .insert(achievementProgress)
    .values(
      candidates.map((candidate) => ({
        userId,
        achievementId: candidate.achievementId,
        progressValue: candidate.progressValue,
        targetValue: candidate.targetValue,
        metadataJson: candidate.metadata ?? null,
        updatedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [achievementProgress.userId, achievementProgress.achievementId],
      set: {
        progressValue: sql`excluded.progress_value`,
        targetValue: sql`excluded.target_value`,
        metadataJson: sql`excluded.metadata_json`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

async function ensureUser(userId: string) {
  const db = getDb();

  await db
    .insert(users)
    .values({
      id: userId,
      preferredUnits: "yards",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        updatedAt: new Date(),
      },
    });
}

function progressLabelFromMetadata(
  metadata: Record<string, unknown> | null,
  progressValue: number,
  targetValue: number,
) {
  if (metadata && typeof metadata.totalMiles === "number") {
    return `${formatNumber(metadata.totalMiles)} / ${formatNumber(targetValue)} mi`;
  }

  if (metadata && typeof metadata.value === "number") {
    return `${formatNumber(metadata.value)} / ${formatNumber(targetValue)}`;
  }

  if (metadata && typeof metadata.bestValue === "number") {
    return `${formatNumber(metadata.bestValue)} / ${formatNumber(targetValue)}`;
  }

  if (metadata && typeof metadata.gainYd === "number") {
    return `${formatNumber(metadata.gainYd)} yd gain`;
  }

  if (metadata && typeof metadata.improvementPercent === "number") {
    return `${formatNumber(metadata.improvementPercent)}%`;
  }

  if (metadata && typeof metadata.bestSpeedMph === "number") {
    return `${formatNumber(metadata.bestSpeedMph)} / ${formatNumber(targetValue)} mph`;
  }

  if (metadata && typeof metadata.targetRatio === "number") {
    return `${formatNumber(metadata.targetRatio * 100)}% of target`;
  }

  if (metadata && typeof metadata.avgSpeedMph === "number") {
    return `${formatNumber(metadata.avgSpeedMph)} / ${formatNumber(targetValue)} mph`;
  }

  if (metadata && typeof metadata.totalSwings === "number") {
    return `${formatNumber(metadata.totalSwings)} / ${formatNumber(targetValue)} swings`;
  }

  if (metadata && typeof metadata.speedSessionCount === "number") {
    return `${formatNumber(metadata.speedSessionCount)} / ${formatNumber(targetValue)} sessions`;
  }

  if (metadata && typeof metadata.clubTargetCount === "number") {
    return `${formatNumber(metadata.clubTargetCount)} / ${formatNumber(targetValue)} clubs`;
  }

  if (metadata && typeof metadata.targetHitClubCount === "number") {
    return `${formatNumber(metadata.targetHitClubCount)} / ${formatNumber(targetValue)} clubs hit`;
  }

  if (metadata && typeof metadata.benchmarkAverageLevel === "number") {
    return `${formatNumber(metadata.benchmarkAverageLevel)} / ${formatNumber(targetValue)} avg`;
  }

  if (metadata && typeof metadata.carryYd === "number" && typeof metadata.targetYd === "number") {
    return `${formatNumber(metadata.carryYd)} / ${formatNumber(metadata.targetYd)} yd`;
  }

  if (metadata && typeof metadata.actualLevel === "string") {
    return `${metadata.actualLevel} level`;
  }

  return `${formatNumber(progressValue)} / ${formatNumber(targetValue)}`;
}

export function shouldPersistProgressCandidate(candidate: AchievementProgressCandidate) {
  return (
    !candidate.achievementId.startsWith("club_") ||
    GENERATED_CLUB_METRIC_IDS.has(candidate.achievementId) ||
    candidate.achievementId.includes("_miles_") ||
    candidate.achievementId.includes("_benchmark_")
  );
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value);
}

function revalidateAchievementPages() {
  safeRevalidatePath("/dashboard");
  safeRevalidatePath("/import");
  safeRevalidatePath("/rounds");
  safeRevalidatePath("/achievements");
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Allows achievement sync to run from local maintenance scripts.
  }
}
