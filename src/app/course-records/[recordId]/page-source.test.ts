import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/course-records/[recordId]/page.tsx"),
  "utf8",
);

describe("course record detail desktop board", () => {
  it("keeps the verified leaderboard table exportable, captioned and keyboard-focusable", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="6xl"');
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="course-record-detail"');
    expect(source).toContain("CourseRecordLeaderboardTable");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
    expect(source).toContain('exportTableId="course-record-leaderboard"');
    expect(source).toContain('data-workbench-scope="course-record-detail"');
    expect(source).toContain('data-workbench-export-table="course-record-leaderboard"');
    expect(source).toContain('mainTableLabel="Course record leaderboard table"');
    expect(source).toContain('mainTableLabel="Course record leaderboard table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["rank", "player", "score", "proof", "status", "date", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
