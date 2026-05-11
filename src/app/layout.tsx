import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { AppNav } from "@/components/app-nav";
import { PwaRegister } from "@/components/pwa-register";
import { getAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { getTotalXpForDefaultUser } from "@/lib/achievements/service";
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
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <DevServiceWorkerResetScript />
        <PwaRegister />
        <AppNav totalXp={totalXp} />
        <AchievementNotificationProvider initialNotifications={achievementNotifications}>
          {children}
        </AchievementNotificationProvider>
      </body>
    </html>
  );
}

function DevServiceWorkerResetScript() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Script
      id="dev-service-worker-reset"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  if (!("serviceWorker" in navigator)) return;

  var wasControlled = Boolean(navigator.serviceWorker.controller);

  function clearForeKingHellCaches() {
    if (!("caches" in window)) return Promise.resolve();

    return caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key.indexOf("forekinghell-pwa") === 0; })
          .map(function (key) { return caches.delete(key); })
      );
    });
  }

  navigator.serviceWorker.getRegistrations()
    .then(function (registrations) {
      return Promise.all(
        registrations.map(function (registration) { return registration.unregister(); })
      );
    })
    .then(function (results) {
      return clearForeKingHellCaches().then(function () {
        return results.some(Boolean);
      });
    })
    .then(function (didUnregister) {
      if (!wasControlled || !didUnregister || sessionStorage.getItem("fkh-sw-reset")) return;
      sessionStorage.setItem("fkh-sw-reset", "1");
      window.location.reload();
    })
    .catch(function () {});
})();
        `,
      }}
    />
  );
}
