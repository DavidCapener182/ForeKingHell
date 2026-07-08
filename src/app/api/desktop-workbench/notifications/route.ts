import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  challengeInvites,
  challenges,
  friendRequests,
  importFiles,
  userAchievements,
  userProfiles,
} from "@/db/schema";
import { achievementUnlockHref } from "@/lib/alert-links";
import { getAchievement } from "@/lib/achievements/registry";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type DesktopNotificationTone = "green" | "amber" | "blue" | "slate";

type DesktopNotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: DesktopNotificationTone;
  createdAt: string;
  unread: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const db = getDb();

    const [
      friendRows,
      challengeRows,
      latestImportRows,
      duplicateImportRows,
      latestAchievementRows,
    ] = await Promise.all([
      db
        .select({
          id: friendRequests.id,
          createdAt: friendRequests.createdAt,
          displayName: userProfiles.displayName,
        })
        .from(friendRequests)
        .innerJoin(userProfiles, eq(friendRequests.requesterUserId, userProfiles.userId))
        .where(
          and(eq(friendRequests.recipientUserId, user.id), eq(friendRequests.status, "pending")),
        )
        .orderBy(desc(friendRequests.createdAt))
        .limit(3),
      db
        .select({
          id: challengeInvites.id,
          challengeId: challengeInvites.challengeId,
          createdAt: challengeInvites.createdAt,
          challengeTitle: challenges.title,
          inviterName: userProfiles.displayName,
        })
        .from(challengeInvites)
        .innerJoin(challenges, eq(challengeInvites.challengeId, challenges.id))
        .innerJoin(userProfiles, eq(challengeInvites.inviterUserId, userProfiles.userId))
        .where(
          and(eq(challengeInvites.inviteeUserId, user.id), eq(challengeInvites.status, "pending")),
        )
        .orderBy(desc(challengeInvites.createdAt))
        .limit(3),
      db
        .select({
          id: importFiles.id,
          fileName: importFiles.fileName,
          status: importFiles.status,
          playContext: importFiles.playContext,
          createdAt: importFiles.createdAt,
        })
        .from(importFiles)
        .where(eq(importFiles.userId, user.id))
        .orderBy(desc(importFiles.createdAt))
        .limit(1),
      db
        .select({
          id: importFiles.id,
          fileName: importFiles.fileName,
          createdAt: importFiles.createdAt,
        })
        .from(importFiles)
        .where(and(eq(importFiles.userId, user.id), isNotNull(importFiles.duplicateOfFileId)))
        .orderBy(desc(importFiles.createdAt))
        .limit(1),
      db
        .select({
          id: userAchievements.id,
          achievementId: userAchievements.achievementId,
          xpAwarded: userAchievements.xpAwarded,
          lastUnlockedAt: userAchievements.lastUnlockedAt,
        })
        .from(userAchievements)
        .where(eq(userAchievements.userId, user.id))
        .orderBy(desc(userAchievements.lastUnlockedAt))
        .limit(1),
    ]);

    const items: DesktopNotificationItem[] = [
      ...friendRows.map((row) => ({
        id: `friend-${row.id}`,
        title: `${row.displayName} sent a friend request`,
        detail: "Review the request from Friends.",
        href: "/friends",
        tone: "blue" as const,
        createdAt: row.createdAt.toISOString(),
        unread: true,
      })),
      ...challengeRows.map((row) => ({
        id: `challenge-${row.id}`,
        title: `Challenge invite: ${row.challengeTitle}`,
        detail: `${row.inviterName} invited you to join.`,
        href: `/challenges/${row.challengeId}`,
        tone: "amber" as const,
        createdAt: row.createdAt.toISOString(),
        unread: true,
      })),
      ...latestImportRows.map((row) => ({
        id: `import-${row.id}`,
        title: `Import ${importStatusLabel(row.status)}: ${row.fileName}`,
        detail: `${formatPlayContext(row.playContext)} evidence saved ${dateFormatter.format(row.createdAt)}.`,
        href: "/import",
        tone: row.status === "saved" ? ("green" as const) : ("amber" as const),
        createdAt: row.createdAt.toISOString(),
        unread: false,
      })),
      ...duplicateImportRows.map((row) => ({
        id: `data-warning-${row.id}`,
        title: "Duplicate import warning",
        detail: `${row.fileName} matched an earlier file.`,
        href: "/import",
        tone: "amber" as const,
        createdAt: row.createdAt.toISOString(),
        unread: true,
      })),
      ...latestAchievementRows.map((row) => {
        const achievement = getAchievement(row.achievementId);

        return {
          id: `achievement-${row.id}`,
          title: `Achievement unlocked: ${achievement?.name ?? formatAchievementId(row.achievementId)}`,
          detail: `+${row.xpAwarded.toLocaleString("en-GB")} XP - ${dateFormatter.format(row.lastUnlockedAt)}.`,
          href: achievementUnlockHref(row.achievementId),
          tone: "green" as const,
          createdAt: row.lastUnlockedAt.toISOString(),
          unread: false,
        };
      }),
    ]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 8);

    return NextResponse.json({ items });
  } catch (error) {
    console.warn("Failed to load desktop workbench notifications", error);
    return NextResponse.json({ items: [] });
  }
}

function importStatusLabel(status: string) {
  return status
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlayContext(value: string) {
  if (value === "unknown") {
    return "Golf";
  }

  return importStatusLabel(value);
}

function formatAchievementId(value: string) {
  return importStatusLabel(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}
