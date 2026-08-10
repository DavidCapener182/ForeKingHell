import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/course-records/page.tsx"), "utf8");

describe("course records desktop board", () => {
  it("puts the native honours list before one-level proof and planning disclosures", () => {
    const boards = source.indexOf('label="Course record boards"');
    const disclosures = source.indexOf('label="Course record supporting detail"');
    const mobileHeader = source.match(/<MobileTopBar[^>]*\/>/)?.[0] ?? "";

    expect(source).toContain("<IOSGroupedList");
    expect(source).toContain("<IOSListRow");
    expect(source).toContain('title: "Proof requirements"');
    expect(source).toContain('title: "Plan a record attempt"');
    expect(source).toContain('title: "Record alerts"');
    expect(source).not.toContain("<EventHeroCard");
    expect(source).not.toContain("<CourseRecordCard");
    expect(source).toContain('className="hidden lg:contents"');
    expect(mobileHeader).toBe('<MobileTopBar title="Course Records" />');
    expect(source).not.toContain('label="Search records"');
    expect(boards).toBeGreaterThan(-1);
    expect(disclosures).toBeGreaterThan(boards);
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
