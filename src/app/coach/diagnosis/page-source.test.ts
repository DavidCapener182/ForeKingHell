import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/coach/diagnosis/page.tsx"), "utf8");

describe("coach diagnosis desktop workbench", () => {
  it("turns the deep diagnosis page into an exportable evidence workbench", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toMatch(/<DesktopWorkbenchLayout\s+scope="coach-diagnosis"/);
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="coach-diagnosis-evidence"');
    expect(source).toContain('scope="coach-diagnosis-evidence"');
    expect(source).toContain('data-workbench-scope="coach-diagnosis-evidence"');
    expect(source).toContain('exportTableId="coach-diagnosis-evidence"');
    expect(source).toContain('exportFileName="forekinghell-coach-diagnosis.csv"');
    expect(source).toContain('data-workbench-export-table="coach-diagnosis-evidence"');
    expect(source).toContain('mainTableLabel="Coach diagnosis evidence table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "club",
      "issue",
      "trust",
      "sample",
      "stock",
      "playable",
      "miss",
      "drill",
      "retest",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the deep diagnosis page focused instead of adding a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps the desktop-only route free of its obsolete mobile diagnosis tree", () => {
    for (const obsoleteSymbol of [
      "MobileCoachDiagnosis",
      "MobileDiagnosisIssueRow",
      "MobileAppShell",
      "MobileTopBar",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSMetricRow",
      "IOSSectionHeader",
    ]) {
      expect(source).not.toContain(obsoleteSymbol);
    }

    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain("@/components/mobile-sports");
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain('<DesktopWorkbenchLayout scope="coach-diagnosis">');
    expect(source).toContain("bg-card");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).not.toMatch(/(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-/);
    expect(source).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
