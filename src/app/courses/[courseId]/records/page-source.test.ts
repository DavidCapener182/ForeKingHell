import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/records/page.tsx"),
  "utf8",
);

describe("course-specific records desktop board", () => {
  it("keeps the native course board through tablet widths and uses 44px actions", () => {
    const mobileSource = source.slice(
      source.indexOf("<MobileAppShell>"),
      source.indexOf("</MobileAppShell>"),
    );

    expect(source.match(/className="size-11 rounded-full"/g)).toHaveLength(1);
    expect(mobileSource).not.toContain("<ArrowLeft");
    expect(mobileSource).not.toContain("leading=");
    expect(source).toContain('className="min-h-11 justify-between rounded-full"');
    expect(source).toContain('className="hidden lg:grid"');
    expect(source).not.toContain('scope="course-records-course" className="hidden sm:grid"');
  });

  it("keeps course boards table-first with saved views, column control and export", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="course-records-course"');
    expect(source).toContain("CourseRecordCourseTable");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
    expect(source).toContain('exportTableId="course-record-course-board"');
    expect(source).toContain('data-workbench-scope="course-records-course"');
    expect(source).toContain('data-workbench-export-table="course-record-course-board"');
    expect(source).toContain('mainTableLabel="Course-specific record board table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "board",
      "scope",
      "champion",
      "score",
      "proof",
      "your-best",
      "friend",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
