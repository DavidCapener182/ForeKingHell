import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { and, eq, sql } from "drizzle-orm";
import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { AppShell } from "@/components/app/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { SocialFeedRail } from "@/components/social/social-feed-rail";
import { TooltipProvider } from "@/components/ui/tooltip";
import { adminUsers, userProfiles, users, xpLedger } from "@/db/schema";
import { getAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";
import { getDb } from "@/db/client";
import { getCurrentUser, type CurrentUserPreferences } from "@/lib/current-user";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: BRAND_SHORT_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/lmwt-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f8fa",
};

type AppShellData = {
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
  theme: "system",
  tableDensity: "comfortable",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { totalXp, achievementNotifications, preferences, isAdmin, mobileNavProfile } =
    await getAppShellData();

  return (
    <html
      lang="en"
      className={preferences.theme === "dark" ? "h-full dark" : "h-full"}
      data-theme={preferences.theme}
      data-table-density={preferences.tableDensity}
      data-preferred-units={preferences.preferredUnits}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased">
        <PlausibleScript />
        <TooltipProvider delayDuration={200}>
          <PwaRegister />
          <AppShell totalXp={totalXp} isAdmin={isAdmin} profile={mobileNavProfile}>
            <AchievementNotificationProvider initialNotifications={achievementNotifications}>
              {children}
            </AchievementNotificationProvider>
          </AppShell>
          <SocialFeedRail />
        </TooltipProvider>
      </body>
    </html>
  );
}

async function getAppShellData(): Promise<AppShellData> {
  const [achievementNotifications, user] = await Promise.all([
    getAchievementUnlockFlash().catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  if (!user) {
    return defaultAppShellData(achievementNotifications);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return defaultAppShellData(achievementNotifications, {
      displayName: fallbackProfileLabel(user.name, user.email),
      username: "",
      avatarUrl: null,
    });
  }

  try {
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
        .select({
          totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
        })
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
      cleanProfileValue(accountRow?.displayName) ?? fallbackProfileLabel(user.name, user.email);

    return {
      totalXp: Number(xpRow[0]?.totalXp ?? 0),
      achievementNotifications,
      preferences: {
        preferredUnits: accountRow?.preferredUnits === "metres" ? "metres" : "yards",
        theme:
          accountRow?.theme === "dark" || accountRow?.theme === "light"
            ? accountRow.theme
            : "system",
        tableDensity: accountRow?.tableDensity === "compact" ? "compact" : "comfortable",
      },
      isAdmin: Boolean(admin[0]),
      mobileNavProfile: {
        displayName: profileLabel,
        username: cleanProfileValue(accountRow?.username) ?? "",
        avatarUrl: accountRow?.avatarUrl ?? null,
      },
    };
  } catch {
    return defaultAppShellData(achievementNotifications, {
      displayName: fallbackProfileLabel(user.name, user.email),
      username: "",
      avatarUrl: null,
    });
  }
}

function defaultAppShellData(
  achievementNotifications: AppShellData["achievementNotifications"],
  mobileNavProfile: AppShellData["mobileNavProfile"] = null,
): AppShellData {
  return {
    totalXp: 0,
    achievementNotifications,
    preferences: defaultPreferences,
    isAdmin: false,
    mobileNavProfile,
  };
}

function fallbackProfileLabel(name: string | null, email: string | null) {
  return cleanProfileValue(name) ?? cleanProfileValue(email?.split("@")[0]) ?? "Profile";
}

function cleanProfileValue(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) {
    return null;
  }

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
