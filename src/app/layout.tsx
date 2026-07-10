import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { and, eq, sql } from "drizzle-orm";
import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { AppShell } from "@/components/app/app-shell";
import { InteractionFeedback } from "@/components/interaction-feedback";
import { PwaRegister } from "@/components/pwa-register";
import { SocialFeedRail } from "@/components/social/social-feed-rail";
import { ThemeController } from "@/components/theme-controller";
import { TooltipProvider } from "@/components/ui/tooltip";
import { adminUsers, userProfiles, users, xpLedger } from "@/db/schema";
import { getAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";
import { getDb } from "@/db/client";
import { ensureUserProfile, getCurrentUser, type CurrentUserPreferences } from "@/lib/current-user";
import { cleanProfileLabel, profileLabelFromIdentity } from "@/lib/profile-label";
import { themeColourByMode } from "@/lib/theme";
import { parseTheme } from "@/lib/user-settings";
import "./globals.css";
import "./mobile-apple.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColourByMode.light },
    { media: "(prefers-color-scheme: dark)", color: themeColourByMode.dark },
  ],
};

type AppShellData = {
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
  theme: "system",
  tableDensity: "comfortable",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, totalXp, achievementNotifications, preferences, isAdmin, mobileNavProfile } =
    await getAppShellData();

  return (
    <html
      lang="en"
      className={["h-full", plusJakarta.variable, barlowCondensed.variable].join(" ")}
      data-theme={preferences.theme === "dark" ? "dark" : "light"}
      data-theme-preference={preferences.theme}
      data-table-density={preferences.tableDensity}
      data-preferred-units={preferences.preferredUnits}
      data-offline-account-id={userId ?? undefined}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased">
        <ThemeBootstrapScript preference={preferences.theme} />
        <ThemeController />
        <PlausibleScript />
        <InteractionFeedback />
        <TooltipProvider delayDuration={200}>
          <PwaRegister activeUserId={userId} />
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

function ThemeBootstrapScript({ preference }: { preference: CurrentUserPreferences["theme"] }) {
  const script = `(() => {
    const root = document.documentElement;
    const preference = ${JSON.stringify(preference)};
    const theme = preference === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    root.dataset.themePreference = preference;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? ${JSON.stringify(
      themeColourByMode.dark,
    )} : ${JSON.stringify(themeColourByMode.light)});
  })();`;

  return (
    <Script id="fkh-theme-bootstrap" strategy="beforeInteractive">
      {script}
    </Script>
  );
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
