import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");

describe("dashboard desktop source", () => {
  it("does not present a path moving away from neutral as an improvement", () => {
    expect(source).toContain("if (changeTowardNeutral <= 0.05)");
    expect(source).not.toContain('return "Holding steady";');
  });

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
    expect(source).toContain("@[64rem]/dashboard-panel:grid-cols-4");
    expect(source).toContain("@[42rem]/dashboard-card:grid-cols-2");
    expect(source).toContain("@[64rem]/dashboard-card:grid-cols-4");
    expect(source).toContain("@[44rem]/dashboard-card:grid-cols-2");
    expect(quickAnswersBlock).toContain("xl:grid-cols-4");
    expect(quickAnswersBlock).not.toContain("lg:grid-cols-4");

    expect(practiceCardBlock).toContain(
      '"premium-card flex h-full scroll-mt-28 flex-col rounded-lg p-5 lg:p-6"',
    );
    expect(practiceCardBlock).toContain('className="grid h-full content-between gap-5"');
    expect(plannerCardBlock).toContain("Session blocks");
    expect(plannerCardBlock).toContain("blocks.map");
    expect(plannerCardBlock).toContain("grid h-full content-between");
    expect(practiceCardBlock).not.toContain("<TargetLaneVisual");
    expect(practiceCardBlock).not.toContain("310px");
    expect(practiceCardBlock).not.toContain("xl:grid-cols-[minmax(0,1fr)_310px]");
  });
});
