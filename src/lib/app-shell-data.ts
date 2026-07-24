import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { adminUsers, userProfiles, users, xpLedger } from "@/db/schema";
import { getAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { ensureUserProfile, getCurrentUser, type CurrentUserPreferences } from "@/lib/current-user";
import { cleanProfileLabel, profileLabelFromIdentity } from "@/lib/profile-label";
import { defaultThemePreference, parseTheme } from "@/lib/user-settings";

export type AppShellData = {
  userId: string | null;
  totalXp: number;
  achievementNotifications: Awaited<ReturnType<typeof getAchievementUnlockFlash>>;
  preferences: CurrentUserPreferences;
  isAdmin: boolean;
  mobileNavProfile: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
  } | null;
};

const defaultPreferences: CurrentUserPreferences = {
  preferredUnits: "yards",
  theme: defaultThemePreference,
  tableDensity: "comfortable",
};

export async function getAppShellData(): Promise<AppShellData> {
  const [achievementNotifications, user] = await Promise.all([
    getAchievementUnlockFlash().catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  if (!user) return defaultAppShellData(achievementNotifications);

  if (!process.env.DATABASE_URL?.trim()) {
    return defaultAppShellData(
      achievementNotifications,
      {
        displayName: profileLabelFromIdentity(user.name, user.email),
        username: "",
        avatarUrl: null,
      },
      user.id,
    );
  }

  try {
    await ensureUserProfile(user);
    const db = getDb();
    const [account, xpRow, admin] = await Promise.all([
      db
        .select({
          preferredUnits: users.preferredUnits,
          theme: users.theme,
          tableDensity: users.tableDensity,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
          avatarUrl: userProfiles.avatarUrl,
        })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.id, user.id))
        .limit(1),
      db
        .select({ totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
        .from(xpLedger)
        .where(eq(xpLedger.userId, user.id)),
      db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(and(eq(adminUsers.userId, user.id), eq(adminUsers.status, "active")))
        .limit(1),
    ]);
    const accountRow = account[0];
    const profileLabel =
      cleanProfileLabel(accountRow?.displayName) ?? profileLabelFromIdentity(user.name, user.email);

    return {
      userId: user.id,
      totalXp: Number(xpRow[0]?.totalXp ?? 0),
      achievementNotifications,
      preferences: {
        preferredUnits: accountRow?.preferredUnits === "metres" ? "metres" : "yards",
        theme: parseTheme(accountRow?.theme ?? null),
        tableDensity: accountRow?.tableDensity === "compact" ? "compact" : "comfortable",
      },
      isAdmin: Boolean(admin[0]),
      mobileNavProfile: {
        displayName: profileLabel,
        username: cleanProfileLabel(accountRow?.username) ?? "",
        avatarUrl: accountRow?.avatarUrl ?? null,
      },
    };
  } catch {
    return defaultAppShellData(
      achievementNotifications,
      {
        displayName: profileLabelFromIdentity(user.name, user.email),
        username: "",
        avatarUrl: null,
      },
      user.id,
    );
  }
}

function defaultAppShellData(
  achievementNotifications: AppShellData["achievementNotifications"],
  mobileNavProfile: AppShellData["mobileNavProfile"] = null,
  userId: string | null = null,
): AppShellData {
  return {
    userId,
    totalXp: 0,
    achievementNotifications,
    preferences: defaultPreferences,
    isAdmin: false,
    mobileNavProfile,
  };
}
