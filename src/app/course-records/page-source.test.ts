import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/course-records/page.tsx"), "utf8");

describe("course records desktop board", () => {
  it("keeps the desktop-only hub free of the obsolete companion record board", () => {
    for (const obsoleteSymbol of [
      "MobileAppShell",
      "MobileRouteTabs",
      "MobileStatusAction",
      "MobileTabBar",
      "MobileTopBar",
      "NativeListSection",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
    ]) {
      expect(source).not.toContain(obsoleteSymbol);
    }

    expect(source).not.toContain("@/components/mobile-sports");
    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).toContain("<DesktopWorkbenchLayout");
    expect(source).toContain('scope="course-records"');
    expect(source).toContain("<ProofChecklistPanel");
    expect(source).toContain("<DataFirstFlowPanel");
    expect(source).toContain("<CourseRecordFeaturePanel");
    expect(source).not.toMatch(/(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-/);
    expect(source).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("keeps a table-first desktop board with saved views, columns and export", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).not.toContain("railBreakpoint=");
    expect(source).toContain('title="AI course records rail"');
    expect(source).toContain("CourseRecordBoardTable");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="course-records-board"');
    expect(source).toContain('scope="course-records"');
    expect(source).toContain('exportTableId="course-records-board"');
    expect(source).toContain('data-workbench-scope="course-records"');
    expect(source).toContain('data-workbench-export-table="course-records-board"');
    expect(source).toContain('mainTableLabel="Course records board table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "course",
      "champion",
      "score",
      "proof",
      "boards",
      "tees",
      "attempts",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
