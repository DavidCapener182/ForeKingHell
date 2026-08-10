import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/bag/[clubId]/analytics/page.tsx"),
  "utf8",
);

describe("club analytics desktop evidence ledger", () => {
  it("gives phones an answer-first analytics composition without the desktop ledger", () => {
    const mobileStart = source.indexOf("data-mobile-club-analytics");
    const shotCloud = source.indexOf("<ShotCloud", mobileStart);
    const disclosures = source.indexOf("<IOSDisclosureGroup", mobileStart);

    expect(source).toContain("data-mobile-club-analytics");
    expect(source).toContain("data-desktop-club-analytics");
    expect(source).toContain("MobileAnalyticsEvidenceRows");
    expect(source).toContain("data-mobile-club-evidence-rows");
    expect(source).toContain('title: "Measured shot evidence"');
    expect(source).toContain("MOBILE_EVIDENCE_LIMIT = 12");
    expect(source).toContain("slice(0, MOBILE_EVIDENCE_LIMIT)");
    expect(source).toContain("/shots?club=${encodeURIComponent(clubType)}");
    expect(source).toContain('className="hidden gap-4 lg:grid"');
    expect(mobileStart).toBeGreaterThan(-1);
    expect(shotCloud).toBeGreaterThan(mobileStart);
    expect(disclosures).toBeGreaterThan(shotCloud);
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
