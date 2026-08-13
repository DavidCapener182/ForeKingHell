import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/holes/page.tsx"),
  "utf8",
);
const mapEditorSource = readFileSync(
  join(process.cwd(), "src/app/courses/[courseId]/holes/course-hole-map-editor.tsx"),
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

  it("offers every available local or published course an in-app Course Twin action", () => {
    expect(source).toContain("await isCourseTwinAvailable({");
    expect(source).toContain("courseId,");
    expect(source).toContain("externalId: data.course.externalId");
    expect(source).toContain("{hasCourseTwinPilot ? (");
    expect(source).toContain("href={`/play/${courseId}`}");
    expect(source).toContain("Open Course Twin");
  });

  it("organises course details with tabs, a mapping alert and a tee editor sheet", () => {
    expect(source).toContain("data-course-detail-tabs");
    expect(source).toContain('<TabsTrigger value="overview">');
    expect(source).toContain('<TabsTrigger value="mapping">');
    expect(source).toContain('<TabsTrigger value="tees">');
    expect(source).toContain('<TabsTrigger value="holes">');
    expect(source).toContain('<TabsTrigger value="records">');
    expect(source).toContain("<Alert");
    expect(source).toContain("ConnectedMetricBar");
    expect(source).toContain("CourseTeeEditorSheet");
  });
});

describe("course holes mobile editor", () => {
  it("uses one selected-hole editor and keeps the batch workspace desktop-only", () => {
    expect(source.match(/<CourseHoleMapEditor/g)).toHaveLength(1);
    expect(source).not.toContain("MobileCurrentItemCard");
    expect(source).not.toContain("MobileAccordionSection");
    expect(source).not.toContain("MobileMetricStrip");
    expect(source).not.toContain("mobile-current-hole-form");
    expect(source).not.toContain("mobile-hole-form");
    expect(source).toContain('<DataPanel className="hidden lg:block">');
    expect(source).toContain('className="hidden lg:block" data-workbench-scope="courses"');
    expect(source).toContain('aria-labelledby="mobile-course-title"');
    expect(source).toContain('className="hidden items-center justify-between gap-4 lg:flex"');
    expect(source.indexOf("<CourseHoleMapEditor")).toBeLessThan(
      source.indexOf('title="Course options"'),
    );
    expect(source).toContain('label="Course details and tools"');
  });

  it("keeps the specialist map first and progressively discloses one real save form", () => {
    expect(mapEditorSource).toContain('aria-label="Choose a hole to edit"');
    expect(mapEditorSource).toContain("aria-pressed={selectedHoleNumber === holeNumber}");
    expect(mapEditorSource).toContain("aria-label={`Edit hole ${holeNumber}`}");
    expect(mapEditorSource).toContain('"size-11 shrink-0 rounded-lg p-0"');
    expect(mapEditorSource.indexOf("ref={setMapContainerRef}")).toBeLessThan(
      mapEditorSource.indexOf("aria-expanded={controlsOpen}"),
    );
    expect(mapEditorSource).toContain("aria-controls={controlsId}");
    expect(mapEditorSource).toContain("id={controlsId}");
    expect(mapEditorSource).toContain('!controlsOpen && "hidden"');
    expect(mapEditorSource).toContain('"lg:block"');
    expect(mapEditorSource.match(/name="holeNumber"/g)).toHaveLength(1);
    expect(mapEditorSource).toContain("h-[56dvh]");
    expect(mapEditorSource).toContain("lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]");
  });
});
