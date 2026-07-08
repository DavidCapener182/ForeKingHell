import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/courses/[courseId]/records/page.tsx"),
  "utf8",
);

describe("course-specific records desktop board", () => {
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
    expect(source).toContain('data-workbench-export-table="course-record-course-board"');
    expect(source).toContain('mainTableLabel="Course-specific record board table"');
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
