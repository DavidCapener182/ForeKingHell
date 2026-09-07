import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/records/page.tsx"),
  "utf8",
);

describe("course-specific records desktop board", () => {
  it("keeps the responsive course board free of its obsolete mobile route", () => {
    for (const obsoleteSymbol of [
      "BottomSheet",
      "CourseRecordCard",
      "MobileAppShell",
      "MobileStatusAction",
      "MobileTabBar",
      "MobileTopBar",
      "NativeListSection",
    ]) {
      expect(source).not.toContain(obsoleteSymbol);
    }

    expect(source).not.toContain("@/components/mobile-sports");
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain("<CourseCategoryList key={active} records={records}");
    expect(source).not.toMatch(/(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-/);
    expect(source).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("keeps course boards configurable with saved views and export", () => {
    const board = readFileSync(
      join(process.cwd(), "src/app/courses/[courseId]/records/course-category-list.tsx"),
      "utf8",
    );
    expect(source).toContain("<PageShell>");
    expect(board).toContain("<DesktopWorkbenchControls");
    expect(board).toContain("viewKey={`course-categories:${pathname}`}");
    expect(board).toContain('scope="course-categories"');
    expect(board).toContain("columns={categoryColumns}");
    expect(board).toContain('exportFileName="course-categories-filtered.csv"');
    expect(board).toContain('data-workbench-export-table="course-categories"');
    expect(board).toContain("<caption");
    expect(board).toContain("tabIndex={0}");
    for (const field of [
      "row.name",
      "row.scope",
      "row.leader",
      "row.result",
      "row.proof",
      "row.personal",
      "row.friend",
    ])
      expect(board).toContain(field);
  });
});
