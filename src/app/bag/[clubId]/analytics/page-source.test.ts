import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/bag/[clubId]/analytics/page.tsx"),
  "utf8",
);

describe("club analytics desktop evidence ledger", () => {
  it("ships only the desktop workbench for this desktop-only route", () => {
    expect(source).toContain("data-desktop-club-analytics");
    expect(source).toContain('className="grid gap-4" data-desktop-club-analytics');

    for (const obsoleteSurface of [
      "MobileClubAnalytics",
      "MobileAnalyticsMetricGroups",
      "MobileAnalyticsEvidenceRows",
      "@/components/app/ios-mobile",
      "data-mobile-club-analytics",
      "lg:hidden",
      'className="hidden gap-4 lg:grid"',
    ]) {
      expect(source).not.toContain(obsoleteSurface);
    }
  });

  it("uses semantic theme surfaces outside the custom golf charts", () => {
    const ordinaryUi = source.replace(
      /function ShotCloud[\s\S]*?function shotCloudChartSummary/,
      "function shotCloudChartSummary",
    );

    expect(ordinaryUi).toContain("bg-card");
    expect(ordinaryUi).toContain("var(--status-warning-surface)");
    expect(ordinaryUi).not.toMatch(/\b(?:bg-white|text-slate-|border-slate-|bg-\[#)/);
  });

  it("keeps club shots in an exportable desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("clubShotEvidenceColumns");
    expect(source).toContain('scope="club-analytics"');
    expect(source).toContain('exportTableId="club-analytics-shots"');
    expect(source).toContain('data-workbench-scope="club-analytics"');
    expect(source).toContain('data-workbench-export-table="club-analytics-shots"');
    expect(source).toContain('mainTableLabel="Club analytics shot evidence table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-");
    expect(source).toContain("analytics-shots.csv");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).toContain("likelyMishitTags");
    expect(source).toContain("classifyShotShape");

    for (const column of [
      "shot",
      "date",
      "shape",
      "carry",
      "total",
      "side",
      "ball-speed",
      "launch",
      "path",
      "face",
      "smash",
      "quality",
      "session",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the raw ledger while limiting derived club analytics to lifecycle evidence", () => {
    expect(source.match(/reviewStatus: shots\.reviewStatus/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("shots: analyticsShots.filter(isShotEvidenceEligible)");
    expect(source).toContain("const evidenceClubShots = clubShots.filter(isShotEvidenceEligible)");
    expect(source).toContain("const latestShots = [...evidenceClubShots]");
    expect(source).toContain("<ShotCloud shots={evidenceClubShots}");
    expect(source).toContain("shots: analyticsShots,");
    expect(source).toContain("<ClubShotEvidenceLedger");
    expect(source).toContain("shots={clubShots}");
  });

  it("keeps the contextual AI rail as shared wide-monitor support", () => {
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI club rail"');
    expect(source).toContain('scope="club-analytics"');
    expect(source).not.toContain("railBreakpoint=");
  });

  it("keeps deep club analytics charts explainable with fallback tables", () => {
    const shotCloudBlock =
      source.match(/function ShotCloud[\s\S]*?function DistanceDistribution/)?.[0] ?? "";
    const distanceBlock =
      source.match(/function DistanceDistribution[\s\S]*?function LaunchWindowChart/)?.[0] ?? "";
    const launchBlock =
      source.match(/function LaunchWindowChart[\s\S]*?function shotCloudChartSummary/)?.[0] ?? "";

    expect(shotCloudBlock).toContain('role="img"');
    expect(shotCloudBlock).toContain('aria-label="Shot cloud on a 350 yard hole"');
    expect(shotCloudBlock).toContain("ChartAccessibleFallback");
    expect(shotCloudBlock).toContain('title="Shot cloud"');
    expect(shotCloudBlock).toContain("summary={shotCloudChartSummary(analytics, plotted.length)}");
    expect(shotCloudBlock).toContain("rows={shotCloudChartRows(analytics, plotted.length)}");

    expect(distanceBlock).toContain("ChartAccessibleFallback");
    expect(distanceBlock).toContain('title="Distance profile"');
    expect(distanceBlock).toContain("summary={distanceProfileChartSummary(analytics)}");
    expect(distanceBlock).toContain("rows={distanceProfileChartRows(values)}");

    expect(launchBlock).toContain("ChartAccessibleFallback");
    expect(launchBlock).toContain('title="Launch window"');
    expect(launchBlock).toContain("summary={launchWindowChartSummary(analytics)}");
    expect(launchBlock).toContain("rows={launchWindowChartRows(analytics)}");
  });
});
