import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { AppNav } from "@/components/app-nav";
import { PwaRegister } from "@/components/pwa-register";
import { getAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { getTotalXpForDefaultUser } from "@/lib/achievements/service";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  themeColor: "#111827",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [totalXp, achievementNotifications] = await Promise.all([
    getTotalXpForDefaultUser().catch(() => 0),
    getAchievementUnlockFlash().catch(() => []),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <PwaRegister />
        <AppNav totalXp={totalXp} />
        <AchievementNotificationProvider initialNotifications={achievementNotifications}>
          {children}
        </AchievementNotificationProvider>
      </body>
    </html>
  );
}
