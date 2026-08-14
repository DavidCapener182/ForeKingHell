import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const pageSource = readSource("src/app/(app)/compare/page.tsx");
const workspaceSource = readSource("src/app/compare/comparison-workspace.tsx");
const actionsSource = readSource("src/app/compare/actions.ts");
const clubClientSource = readSource("src/app/compare/club-compare-client.tsx");
const progressClientSource = readSource("src/app/compare/progress-compare-client.tsx");
const playerClientSource = readSource("src/app/compare/player-compare-client.tsx");

describe("compare structural acceptance", () => {
  it("keeps one query-selected desktop comparison mode", () => {
    expect(pageSource).toContain("DesktopInsightRail");
    expect(pageSource).toContain('scope="compare"');
    expect(pageSource).toContain("data-compare-desktop-workbench");
    expect(pageSource).toContain("data-compare-active-view");
    expect(pageSource).toContain("<ButtonGroup");
    expect(pageSource).toContain('aria-label="Comparison view"');
    expect(pageSource).toContain("href={`/compare?view=${view}`}");
    expect(pageSource).toContain('aria-current={active ? "page" : undefined}');
    expect(pageSource).toContain('variant={active ? "secondary" : "outline"}');
    expect(pageSource).not.toContain("TabsTrigger");
    expect(pageSource).not.toContain("TabsList");
    expect(pageSource).not.toContain("TabsContent");
    expect(pageSource).not.toContain('from "@/components/ui/tabs"');
    expect(pageSource).toContain('activeView === "progress"');
    expect(pageSource).toContain('activeView === "clubs"');
    expect(pageSource.match(/<ProgressCompareClient/g)).toHaveLength(1);
    expect(pageSource.match(/<ClubCompareClient/g)).toHaveLength(1);
    expect(pageSource.match(/<PlayerCompareClient/g)).toHaveLength(1);
    expect(pageSource).toContain("workspace_comparison");
    expect(pageSource).toContain("savedWorkspaceComparison");
    expect(pageSource).not.toContain("ResultHero");

    for (const obsoleteSource of [
      "MobileCompareWorkspace",
      "mobile-compare-workspace",
      "parseMobileView",
      "lg:hidden",
      "hidden lg:",
    ]) {
      expect(pageSource).not.toContain(obsoleteSource);
    }
  });

  it("uses one connected shadcn comparison composition for all three clients", () => {
    expect(workspaceSource.match(/<DataToolbar\b/g)).toHaveLength(1);
    expect(workspaceSource.match(/<EntityCombobox\b/g)).toHaveLength(2);
    expect(workspaceSource.match(/<ButtonGroup\b/g)).toHaveLength(1);
    expect(workspaceSource.match(/<DesktopTableWorkbenchControls\b/g)).toHaveLength(1);
    expect(workspaceSource.match(/<DataTableFrame\b/g)).toHaveLength(1);
    expect(workspaceSource.match(/<Table\b/g)).toHaveLength(1);
    expect(workspaceSource).toContain("data-comparison-table");
    expect(workspaceSource).toContain("data-workbench-export-table={exportTableId}");
    expect(workspaceSource).toContain("exportTableId={exportTableId}");
    expect(workspaceSource).toContain("exportFileName={exportFileName}");
    for (const column of ["metric", "focus", "baseline", "delta", "direction", "confidence"]) {
      expect(workspaceSource).toContain(`data-column="${column}"`);
    }
    expect(workspaceSource).toContain("<Alert");
    expect(workspaceSource).toContain("<ResponsiveDetailPanel");
    expect(workspaceSource).toContain("<Dialog>");
    expect(workspaceSource).toContain("<StatusTimeline");
    expect(workspaceSource).toContain("<AlertDialog>");
    expect(workspaceSource).toContain("saveWorkspaceComparisonAction");
    expect(workspaceSource).toContain("deleteWorkspaceComparisonAction");

    for (const [view, source] of [
      ["progress", progressClientSource],
      ["clubs", clubClientSource],
      ["players", playerClientSource],
    ] as const) {
      expect(source.match(/<ComparisonWorkspace\b/g)).toHaveLength(1);
      expect(source).toContain(`view="${view}"`);
      expect(source).toContain("savedComparisons={savedComparisons}");
      expect(source).not.toContain("DesktopTableWorkbenchControls");
      expect(source).not.toContain("DataTableFrame");
      expect(source).not.toMatch(/<Card(?:\s|>)/);
      expect(source).not.toMatch(/<Table(?:\s|>)/);
      expect(source).not.toContain("data-club-compare-filters");
      expect(source).not.toContain("data-player-compare-filters");
    }

    expect(clubClientSource).toContain('exportFileName="forekinghell-club-comparison-metrics.csv"');
    expect(playerClientSource).toContain(
      'exportFileName="forekinghell-player-comparison-metrics.csv"',
    );
    expect(progressClientSource).toContain(
      "exportFileName={`forekinghell-compare-${appliedWindow}-history.csv`}",
    );
    expect(progressClientSource).toContain('appliedWindow === "week"');
    expect(progressClientSource).toContain("data.weeklyPeriods");
    expect(progressClientSource).toContain("data.monthlyPeriods");
    expect(progressClientSource).not.toContain("function FocusClubTable");
    expect(progressClientSource).not.toContain("function PeriodTable");
  });

  it("persists user-scoped workspace comparisons without reusing session-only actions", () => {
    expect(actionsSource).toContain('view: "workspace_comparison"');
    expect(actionsSource).toContain("compareView: view");
    expect(actionsSource).toContain("buildAnalysisSnapshot");
    expect(actionsSource).toContain("requireCurrentUserId");
    expect(actionsSource).toContain("getClubCompareData");
    expect(actionsSource).toContain("getPlayerCompareData");
    expect(actionsSource).toContain("eq(analysisSnapshots.userId, userId)");
    expect(actionsSource).toContain('revalidatePath("/compare")');
    expect(actionsSource).not.toContain("saveSessionComparisonAction");
    expect(actionsSource).not.toContain("deleteSessionComparisonAction");
  });

  it("moves specialist evidence behind the detail panel without losing calculations", () => {
    expect(clubClientSource).toContain("CompareRadarChart");
    expect(clubClientSource).toContain("ClubDispersionPlot");
    expect(clubClientSource).toContain("ChartAccessibleFallback");
    expect(clubClientSource).toContain("compareMetricRows");
    expect(clubClientSource).toContain("buildDelta");

    expect(progressClientSource).toContain("FocusClubEvidence");
    expect(progressClientSource).toContain("PeriodTrendStrip");
    expect(progressClientSource).toContain("PeriodHistory");
    expect(progressClientSource).toContain("ChartAccessibleFallback");
    expect(progressClientSource).toContain("controlDeltaScore");
    expect(progressClientSource).toContain("hasStrongImprovement");

    expect(playerClientSource).toContain("PlayerSummaryCard");
    expect(playerClientSource).toContain("RecentTournamentScores");
    expect(playerClientSource).toContain("buildPlayerDelta");
    expect(playerClientSource).not.toContain("apple-panel");
  });

  it("keeps ordinary compare chrome semantic while preserving specialist chart palettes", () => {
    for (const source of [workspaceSource, progressClientSource, playerClientSource]) {
      expect(source).not.toMatch(/(?:text|bg|ring|border)-(?:emerald|sky|amber|slate)-\d{2,3}/);
      expect(source).not.toMatch(/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/);
    }

    const clubOrdinarySource = clubClientSource.slice(
      0,
      clubClientSource.indexOf("export function CompareRadarChart"),
    );
    expect(clubOrdinarySource).not.toMatch(
      /(?:text|bg|ring|border)-(?:emerald|sky|amber|slate)-\d{2,3}/,
    );
    expect(clubOrdinarySource).not.toMatch(/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/);
    expect(clubClientSource).toContain('fill="#059669"');
    expect(clubClientSource).toContain('fill="#0284c7"');
  });
});
