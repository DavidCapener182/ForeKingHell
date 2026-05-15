import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { AppNav } from "@/components/app-nav";
import { PwaRegister } from "@/components/pwa-register";
import { SocialFeedRail } from "@/components/social/social-feed-rail";
import { getAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { getTotalXpForCurrentUser } from "@/lib/achievements/service";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getCurrentUser, getCurrentUserPreferences, ensureUserProfile } from "@/lib/current-user";
import { ensureSocialProfileForUser } from "@/lib/social";
import "./globals.css";

export const metadata: Metadata = {
  title: "ForeKingHell",
  description: "Personal golf analytics for launch monitor data, bag mapping, and progress tracking.",
  applicationName: "ForeKingHell",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "ForeKingHell",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/fkh-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f8fa",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [totalXp, achievementNotifications, preferences, isAdmin, mobileNavProfile] = await Promise.all([
    getTotalXpForCurrentUser().catch(() => 0),
    getAchievementUnlockFlash().catch(() => []),
    getCurrentUserPreferences().catch(() => ({
      preferredUnits: "yards" as const,
      theme: "light" as const,
      tableDensity: "comfortable" as const,
    })),
    isCurrentUserAdmin().catch(() => false),
    getMobileNavProfile().catch(() => null),
  ]);

  return (
    <html
      lang="en"
      className="h-full"
      data-theme="light"
      data-table-density={preferences.tableDensity}
      data-preferred-units={preferences.preferredUnits}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased">
        <PlausibleScript />
        <PwaRegister />
        <AppNav totalXp={totalXp} isAdmin={isAdmin} profile={mobileNavProfile} />
        <AchievementNotificationProvider initialNotifications={achievementNotifications}>
          {children}
        </AchievementNotificationProvider>
        <SocialFeedRail />
      </body>
    </html>
  );
}

async function getMobileNavProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  await ensureUserProfile(user);
  const profile = await ensureSocialProfileForUser(user.id);

  return {
    displayName: profile.displayName,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
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
