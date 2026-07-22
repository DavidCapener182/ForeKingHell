import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { AppShell } from "@/components/app/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { SocialFeedRail } from "@/components/social/social-feed-rail";
import { ThemeBootstrapScript } from "@/components/theme-bootstrap-script";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppShellData } from "@/lib/app-shell-data";

export function PrivateAppShell({
  children,
  data,
}: {
  children: React.ReactNode;
  data: AppShellData;
}) {
  return (
    <>
      <ThemeBootstrapScript
        preference={data.preferences.theme}
        preferredUnits={data.preferences.preferredUnits}
        tableDensity={data.preferences.tableDensity}
        offlineAccountId={data.userId ?? undefined}
        scriptId="fkh-app-theme-bootstrap"
      />
      <TooltipProvider delayDuration={200}>
        <PwaRegister activeUserId={data.userId} />
        <AppShell totalXp={data.totalXp} isAdmin={data.isAdmin} profile={data.mobileNavProfile}>
          <AchievementNotificationProvider initialNotifications={data.achievementNotifications}>
            {children}
          </AchievementNotificationProvider>
        </AppShell>
        <SocialFeedRail />
      </TooltipProvider>
    </>
  );
}
