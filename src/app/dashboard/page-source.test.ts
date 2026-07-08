import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");

describe("dashboard desktop source", () => {
  it("keeps dashboard cards readable without a persistent AI rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";
    const quickAnswersBlock =
      source.match(/function TodayCommandBrief[\s\S]*?function LatestPracticeSignalPanel/)?.[0] ??
      "";
    const practiceCardBlock =
      source.match(
        /function PracticeRecommendationCard[\s\S]*?function PracticePlannerDashboardCard/,
      )?.[0] ?? "";
    const plannerCardBlock =
      source.match(
        /function PracticePlannerDashboardCard[\s\S]*?function PracticePayoffPill/,
      )?.[0] ?? "";

    expect(layoutBlock).toContain('scope="dashboard"');
    expect(layoutBlock).not.toContain("DesktopInsightRail");
    expect(layoutBlock).not.toContain("rail=");
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(source).toContain("@container/dashboard-card premium-card");
    expect(source).toContain("@[34rem]/dashboard-card:grid-cols-3");
    expect(source).toContain("@[42rem]/dashboard-panel:grid-cols-2");
    expect(source).toContain("@[72rem]/dashboard-panel:grid-cols-4");
    expect(source).toContain("@[42rem]/dashboard-card:grid-cols-2");
    expect(source).toContain("@[72rem]/dashboard-card:grid-cols-4");
    expect(source).toContain("@[44rem]/dashboard-card:grid-cols-2");
    expect(quickAnswersBlock).toContain("xl:grid-cols-2 min-[1900px]:grid-cols-4");
    expect(quickAnswersBlock).not.toContain("lg:grid-cols-4");

    expect(practiceCardBlock).toContain(
      'className={cn("premium-card scroll-mt-28 rounded-lg p-5 lg:p-6", className)}',
    );
    expect(plannerCardBlock).toContain("Session blocks");
    expect(plannerCardBlock).toContain("blocks.map");
    expect(plannerCardBlock).not.toContain("grid h-full content-between");
    expect(practiceCardBlock).not.toContain("<TargetLaneVisual");
    expect(practiceCardBlock).not.toContain("310px");
    expect(practiceCardBlock).not.toContain("xl:grid-cols-[minmax(0,1fr)_310px]");
  });
});
