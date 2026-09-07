import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/course-records/page.tsx"), "utf8");

describe("course records desktop board", () => {
  it("keeps the responsive hub free of the obsolete companion record board", () => {
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
    expect(source).toContain("<CourseRecordBoard");
    expect(source).toContain("Before you submit");
    expect(source).toContain("pending attempt is not a verified record");
    expect(source).not.toMatch(/(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-/);
    expect(source).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("keeps the extracted board configurable and exportable", () => {
    const board = readFileSync(
      join(process.cwd(), "src/app/course-records/course-record-board.tsx"),
      "utf8",
    );
    expect(source).toContain("<PageShell>");
    expect(board).toContain("<DesktopWorkbenchControls");
    expect(board).toContain('viewKey="course-records"');
    expect(board).toContain('scope="course-records"');
    expect(board).toContain("columns={boardColumns}");
    expect(board).toContain('exportFileName="course-records-filtered.csv"');
    expect(board).toContain('data-workbench-export-table="course-records"');
    expect(board).toContain("<caption");
    expect(board).toContain("tabIndex={0}");
    for (const column of [
      "course",
      "leader",
      "category",
      "result",
      "boards",
      "tees",
      "submissions",
      "actions",
    ]) {
      expect(board).toContain(`data-column="${column}"`);
    }
  });
});
