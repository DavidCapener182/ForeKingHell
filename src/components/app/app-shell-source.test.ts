import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/workbench-app-shell.tsx"),
  "utf8",
);
const companionSource = readFileSync(
  join(process.cwd(), "src/components/app/companion-app-shell.tsx"),
  "utf8",
);
const privateShellSource = readFileSync(
  join(process.cwd(), "src/components/app/private-app-shell.tsx"),
  "utf8",
);
const achievementSource = readFileSync(
  join(process.cwd(), "src/components/achievement-notifications.tsx"),
  "utf8",
);

describe("app shell desktop accessibility", () => {
  it("branches before importing companion or workbench client chrome", () => {
    expect(privateShellSource).toContain('surface === "companion"');
    expect(privateShellSource).toContain('import("@/components/app/companion-app-shell")');
    expect(privateShellSource).toContain('import("@/components/app/workbench-app-shell")');
    expect(companionSource).toContain('data-app-surface="companion"');
    expect(companionSource).toContain("<MobileNav");
    expect(companionSource).not.toContain("DesktopWorkbenchChrome");
    expect(companionSource).not.toContain("GlobalCommandCentre");
  });

  it("keeps skip links for content, sidebar and table-heavy pages", () => {
    expect(source).toContain('href="#main-content"');
    expect(source).toContain("Skip to content");
    expect(source).toContain('href="#app-sidebar"');
    expect(source).toContain("Skip to sidebar");
    expect(source).toContain("<MainTableSkipLink pathname={pathname} />");
    expect(source).toContain("Skip to main table");
    expect(source).toContain("resolveMainTableTarget()");
    expect(source).toContain('document.querySelector<HTMLElement>("[data-main-table-target');
    expect(source).toContain("table[data-workbench-export-table]");
  });

  it("clears stale main-table skip state when routes change", () => {
    expect(source).toContain("setHasMainTable(false);");
    expect(source).toContain("}, [pathname]);");
  });

  it("keeps sidebar density modes persisted and connected to the desktop sidebar", () => {
    expect(source).toContain('type SidebarDensity = "comfortable" | "compact" | "icon"');
    expect(source).toContain('const sidebarDensityStorageKey = "fkh:desktop-sidebar-density"');
    expect(source).toContain("window.localStorage.setItem(sidebarDensityStorageKey, nextDensity)");
    expect(source).toContain("data-sidebar-density={sidebarDensity}");
    expect(source).toContain("<SidebarDensityMenu");
    expect(source).toContain("aria-label={`Sidebar density: ${densityLabel}`}");
    expect(source).toContain("Comfortable");
    expect(source).toContain("Compact");
    expect(source).toContain("Icon-only");
  });

  it("uses sidebar semantic colours for every header and footer control", () => {
    expect(source).not.toContain("bg-[linear-gradient(180deg,var(--lux-ivory),#f4f7ef)]");
    expect(source).not.toContain("bg-[linear-gradient(180deg,#f8fbf3,var(--lux-ivory))]");
    expect(source).toContain('"border-b border-sidebar-border bg-sidebar text-sidebar-foreground"');
    expect(source).toContain('"border-t border-sidebar-border bg-sidebar text-sidebar-foreground"');
    expect(source).toContain("text-sidebar-accent-foreground");
    expect(source).toContain("text-sidebar-foreground/70");
  });

  it("defers private mobile navigation on public routes", () => {
    expect(source).toContain('import("@/components/app/mobile-nav")');
    expect(source).toContain('import("@/components/app/desktop-workbench-chrome")');
    expect(source).toContain("ssr: false");
    expect(source).toContain("if (isPublicRoute(pathname))");
  });

  it("removes shared mobile chrome only for an immersive Course Twin", () => {
    expect(source).toContain("isMobileImmersiveRoute");
    expect(source).toContain("const isMobileImmersive");
    expect(source).toContain(
      'data-mobile-immersive-shell={isMobileImmersive ? "course-twin" : undefined}',
    );
    expect(source).toContain('{isMobileImmersive || surface !== "companion" ? null : (');
    expect(source).toContain("<MobileNav");
    expect(source).toContain("document.documentElement.dataset.mobileImmersive");
    expect(source).toContain("document.body.dataset.mobileImmersive");
    expect(source).toContain("delete document.documentElement.dataset.mobileImmersive");
    expect(source).toContain("delete document.body.dataset.mobileImmersive");
  });

  it("retains desktop workbench chrome while removing mobile Course Twin padding", () => {
    expect(source).toContain("<DesktopWorkbenchChrome");
    expect(source).toContain('surface === "workbench" ? "overflow-x-auto pt-0"');
    expect(source).toContain('isMobileImmersive || surface === "workbench"');
    expect(source).toContain("pt-[calc(3.25rem+env(safe-area-inset-top))]");
  });

  it("keeps achievement state mounted while exposing mobile-only toast suppression", () => {
    expect(achievementSource).toContain("data-achievement-toast-viewport");
    expect(achievementSource).toContain("{children}");
    expect(achievementSource).toContain(
      "window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, handleAchievementUnlock)",
    );
  });
});
