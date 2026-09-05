import "server-only";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedItems,
  importFiles,
  practicePlans,
  sessions,
  userAchievements,
  userFeaturePreferences,
} from "@/db/schema";
import { getAchievement } from "@/lib/achievements/registry";
import { formatClubType } from "@/lib/club-format";
import { readGoalMovements } from "@/lib/goal-movement";
import { selectTodayActivity, type TodayActivity } from "@/lib/today-activity";

export async function getTodayActivity(userId: string): Promise<TodayActivity[]> {
  const db = getDb();
  const [sessionRows, imports, practices, achievements, bests, preferences] = await Promise.all([
    db
      .select({
        id: sessions.id,
        date: sessions.date,
        type: sessions.type,
        courseName: sessions.courseName,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.roundStatus, "complete")))
      .orderBy(desc(sessions.date))
      .limit(8),
    db
      .select({
        id: importFiles.id,
        date: importFiles.createdAt,
        source: importFiles.source,
        sessionId: sessions.id,
      })
      .from(importFiles)
      .leftJoin(sessions, and(eq(importFiles.sessionId, sessions.id), eq(sessions.userId, userId)))
      .where(and(eq(importFiles.userId, userId), eq(importFiles.status, "saved")))
      .orderBy(desc(importFiles.createdAt))
      .limit(4),
    db
      .select({
        id: practicePlans.id,
        date: practicePlans.completedAt,
        title: practicePlans.title,
        status: practicePlans.status,
      })
      .from(practicePlans)
      .where(
        and(
          eq(practicePlans.userId, userId),
          inArray(practicePlans.status, ["completed", "analysed"]),
          isNotNull(practicePlans.completedAt),
        ),
      )
      .orderBy(desc(practicePlans.completedAt))
      .limit(4),
    db
      .select({
        id: userAchievements.id,
        date: userAchievements.lastUnlockedAt,
        achievementId: userAchievements.achievementId,
      })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.lastUnlockedAt))
      .limit(4),
    db
      .select({
        id: feedItems.id,
        date: feedItems.createdAt,
        metricLabel: feedItems.metricLabel,
        metricValue: feedItems.metricValue,
        metadata: feedItems.metadataJson,
      })
      .from(feedItems)
      .where(and(eq(feedItems.userId, userId), eq(feedItems.itemType, "new_pb")))
      .orderBy(desc(feedItems.createdAt))
      .limit(4),
    db
      .select({ settings: userFeaturePreferences.highlightSettingsJson })
      .from(userFeaturePreferences)
      .where(eq(userFeaturePreferences.userId, userId))
      .limit(1),
  ]);
  return selectTodayActivity([
    ...sessionRows.map((item): TodayActivity => {
      const round = ["round", "real_round", "simulator", "simulated_course"].includes(item.type);
      return {
        id: `session:${item.id}`,
        kind: round ? "round" : "practice",
        title: item.courseName ?? (round ? "Round recorded" : "Range practice"),
        detail: round ? "Round" : "Measured session",
        href: `/${round ? "rounds" : "sessions"}/${item.id}`,
        date: item.date,
      };
    }),
    ...imports.map(
      (item): TodayActivity => ({
        id: `import:${item.id}`,
        kind: "import",
        title: "Shots imported",
        detail:
          item.source === "rapsodo"
            ? "Rapsodo"
            : item.source === "trackman"
              ? "TrackMan"
              : "Golf data saved",
        href: item.sessionId ? `/sessions/${item.sessionId}` : "/import",
        date: item.date,
      }),
    ),
    ...practices.map(
      (item): TodayActivity => ({
        id: `practice:${item.id}`,
        kind: "practice",
        title: item.title,
        detail:
          item.status === "analysed" ? "Practice reviewed" : "Practice completed · activity only",
        href: `/practice?planId=${item.id}`,
        date: item.date!,
      }),
    ),
    ...achievements.flatMap((item): TodayActivity[] => {
      const achievement = getAchievement(item.achievementId);
      return achievement
        ? [
            {
              id: `achievement:${item.id}`,
              kind: "achievement",
              title: achievement.name,
              detail: "Achievement unlocked",
              href: "/achievements",
              date: item.date,
            },
          ]
        : [];
    }),
    ...bests.map(
      (item): TodayActivity => ({
        id: `pb:${item.id}`,
        kind: "personal-best",
        title: `${typeof item.metadata.clubType === "string" ? formatClubType(item.metadata.clubType) : "Golf"} personal best`,
        detail: [item.metricValue, item.metricLabel, "PB recorded"].filter(Boolean).join(" · "),
        href: "/bag/longest",
        date: item.date,
      }),
    ),
    ...readGoalMovements(preferences[0]?.settings?.goalMovements).map(
      (item): TodayActivity => ({
        id: `goal:${item.id}`,
        kind: "goal",
        title: item.title,
        detail: `${item.from} → ${item.to} ${item.unit} · Value updated`,
        href: "/goals",
        date: new Date(item.recordedAt),
      }),
    ),
  ]);
}
