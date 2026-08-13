import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");

describe("dashboard desktop source", () => {
  it("separates historical trust from the best course-scoring club", () => {
    expect(source).toContain('title="Most trusted historically"');
    expect(source).toContain('title="Best course scoring club"');
  });

  it("does not present a path moving away from neutral as an improvement", () => {
    expect(source).toContain("if (changeTowardNeutral <= 0.05)");
    expect(source).not.toContain('return "Holding steady";');
  });

  it("uses the consolidated answer, KPI, trend and activity hierarchy without an AI rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="dashboard"');
    expect(layoutBlock).not.toContain("DesktopInsightRail");
    expect(layoutBlock).not.toContain("rail=");
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain("<DashboardSummaryHero");
    expect(layoutBlock).toContain("<ConnectedMetricBar");
    expect(layoutBlock).toContain("<DriverStatusPanel");
    expect(layoutBlock).toContain("<StatusTimeline");
    expect(layoutBlock).toContain('title="Current work"');
    expect(source).not.toContain("function TodayCommandBrief");
    expect(source).not.toContain("function QuickActions");
  });
});

describe("dashboard mobile Apple system surfaces", () => {
  it("uses the compact platform wrapper without duplicating the desktop workbench", () => {
    const mobileLayoutBlock =
      source.match(
        /function DashboardMobileLayout[\s\S]*?function DashboardAiCaddieBriefCard/,
      )?.[0] ?? "";

    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="dashboard" className="hidden lg:grid">',
    );
    expect(mobileLayoutBlock).toContain("ios-mobile-screen");
    expect(mobileLayoutBlock).toContain("lg:hidden");
    expect(mobileLayoutBlock).not.toContain("StickyMobileAction");
  });

  it("keeps the AI brief neutral and exposes its action and evidence in DOM content", () => {
    const briefBlock =
      source.match(
        /function DashboardAiCaddieBriefCard[\s\S]*?function DashboardMobileGroup/,
      )?.[0] ?? "";

    expect(briefBlock).toContain('data-mobile-surface="grouped"');
    expect(briefBlock).toContain("ios-grouped-row");
    expect(briefBlock).toContain("data-primary-action");
    expect(briefBlock).toContain("Data used");
    expect(briefBlock).not.toContain("linear-gradient");
    expect(briefBlock).not.toContain("bg-emerald");
    expect(briefBlock).not.toContain("bg-amber");
    expect(briefBlock).not.toContain("StatusPill");
  });

  it("uses one system symbol treatment for mobile tool cards", () => {
    const toolsBlock =
      source.match(
        /function DashboardMobileTools[\s\S]*?function DashboardFirstRunOnboarding/,
      )?.[0] ?? "";

    expect(toolsBlock).toContain("bg-[var(--ios-fill)] text-[var(--ios-tint)]");
    expect(toolsBlock).not.toContain("card.accent");
  });
});
