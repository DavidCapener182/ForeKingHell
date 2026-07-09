import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/courses/page.tsx"), "utf8");

describe("courses desktop workspace source", () => {
  it("keeps the course directory as a desktop workbench with shared wide-monitor rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="courses"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI course rail"');
    expect(layoutBlock).toContain("rail={");
    expect(source).toContain("CourseDataQualityPanel");
    expect(source).toContain("CourseFollowFeaturePanel");
  });

  it("keeps the course library as a controlled exportable table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("courseWorkbenchColumns");
    expect(source).toContain("courseSuggestedViews");
    expect(source).toContain('viewKey="courses"');
    expect(source).toContain('scope="courses"');
    expect(source).toContain('exportTableId="courses"');
    expect(source).toContain('exportFileName="forekinghell-courses-view.csv"');
    expect(source).toContain('data-workbench-scope="courses"');
    expect(source).toContain('data-workbench-export-table="courses"');
    expect(source).toContain('mainTableLabel="Course library table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "course",
      "provider",
      "quality",
      "records",
      "champion",
      "tees",
      "holes",
      "rounds",
      "actions",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
