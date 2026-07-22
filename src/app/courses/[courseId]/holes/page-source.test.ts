import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/holes/page.tsx"),
  "utf8",
);

describe("course holes desktop workspace", () => {
  it("keeps the hole geometry table exportable, captioned and configurable", () => {
    expect(source).toContain("HoleGeometryTable");
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="course-holes">');
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="courses"');
    expect(source).toContain("viewKey={`course-holes-${courseId}`}");
    expect(source).toContain('scope="courses"');
    expect(source).toContain('exportTableId="course-hole-geometry"');
    expect(source).toContain('data-workbench-export-table="course-hole-geometry"');
    expect(source).toContain('mainTableLabel="Course hole geometry table"');
    expect(source).toContain('mainTableLabel="Course hole geometry table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain('tabIndex={0} className="focus-aaa outline-none"');
    expect(source).toContain("#desktop-hole-form-${holeNumber}");
    expect(source).not.toContain('<PageShell size="wide">');
    expect(source).not.toContain("DesktopInsightRail");

    for (const column of [
      "hole",
      "par",
      "yards",
      "stroke-index",
      "tee",
      "green",
      "status",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("offers the 3D pilot only for the published Bootle prototype", () => {
    expect(source).toContain(
      'const hasCourseTwinPilot = data.course.externalId === "bootle-golf-course";',
    );
    expect(source).toContain("{hasCourseTwinPilot ? (");
    expect(source).toContain("href={`/play/${courseId}`}");
    expect(source).toContain("3D pilot");
  });
});
