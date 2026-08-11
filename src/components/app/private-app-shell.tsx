import { AchievementNotificationProvider } from "@/components/achievement-notifications";
import { PwaRegister } from "@/components/pwa-register";
import { SocialFeedRail } from "@/components/social/social-feed-rail";
import { ThemeBootstrapScript } from "@/components/theme-bootstrap-script";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppShellData } from "@/lib/app-shell-data";
import type { AppSurface } from "@/lib/app-surface";

export async function PrivateAppShell({
  children,
  data,
  surface,
}: {
  children: React.ReactNode;
  data: AppShellData;
  surface: AppSurface;
}) {
  const achievementContent = (
    <AchievementNotificationProvider initialNotifications={data.achievementNotifications}>
      {children}
    </AchievementNotificationProvider>
  );
  const shellContent =
    surface === "companion"
      ? await renderCompanionShell(data, achievementContent)
      : await renderWorkbenchShell(data, achievementContent);

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
        {shellContent}
        {surface === "workbench" ? <SocialFeedRail /> : null}
      </TooltipProvider>
    </>
  );
}

async function renderCompanionShell(data: AppShellData, children: React.ReactNode) {
  const { CompanionAppShell } = await import("@/components/app/companion-app-shell");

  return (
    <CompanionAppShell totalXp={data.totalXp} profile={data.mobileNavProfile}>
      {children}
    </CompanionAppShell>
  );
}

async function renderWorkbenchShell(data: AppShellData, children: React.ReactNode) {
  const { WorkbenchAppShell } = await import("@/components/app/workbench-app-shell");

  return (
    <WorkbenchAppShell
      totalXp={data.totalXp}
      isAdmin={data.isAdmin}
      profile={data.mobileNavProfile}
      surface="workbench"
    >
      {children}
    </WorkbenchAppShell>
  );
}
