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
const googleContextSource = readFileSync(
  join(process.cwd(), "src/app/courses/[courseId]/holes/google-course-context-panel.tsx"),
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
    expect(source).toContain("defaultValue={activeTab}");
    expect(source).toContain('href: "?tab=holes#hole-geometry-table"');
    expect(source).toContain('href: "?tab=tees#tee-set"');
    expect(source).toContain('href: "?tab=tees#geometry-preview"');
    expect(source).toContain('id="tee-set"');
  });

  it("keeps converted table and form surfaces theme-safe", () => {
    expect(source).not.toMatch(
      /bg-white|bg-slate-50|border-slate-200|text-sky-600|border-amber-500|bg-amber-500/,
    );
    expect(source).not.toContain("rgba(15,23,42,0.08)");
    expect(source).toContain("[&_th]:bg-card");
    expect(source).toContain("bg-background");
    expect(source).toContain("bg-muted/35");

    const ordinaryMapChrome = mapEditorSource.slice(
      mapEditorSource.indexOf('<div className="grid gap-4" data-selected-hole='),
      mapEditorSource.indexOf("function setDraftValue"),
    );
    expect(ordinaryMapChrome).not.toMatch(
      /bg-(?:white|emerald|sky)|text-(?:white|emerald|sky)|border-(?:emerald|sky)|#[0-9A-Fa-f]{3,8}/,
    );
    expect(ordinaryMapChrome).toContain('variant="secondary"');
    expect(ordinaryMapChrome).toContain("text-primary");
    expect(ordinaryMapChrome).not.toContain("<button");

    expect(googleContextSource).not.toMatch(/bg-white|text-(?:emerald|sky)|#[0-9A-Fa-f]{3,8}/);
    expect(googleContextSource).toContain("border-border bg-card");
    expect(googleContextSource).toContain("border-border bg-muted/35");
  });
  it("excludes the obsolete companion graph from the desktop-only course editor", () => {
    expect(source.match(/<CourseHoleMapEditor/g)).toHaveLength(1);
    for (const obsolete of [
      "IOSDisclosureGroup",
      "IOSInlineStatus",
      "IOSSectionHeader",
      "MobileDetailRow",
      "mobile-course-title",
      "lg:hidden",
      'className="hidden lg:block"',
      'className="hidden items-center justify-between gap-4 lg:flex"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
    expect(source).toContain('title="Hole geometry"');
    expect(source).toContain('className="grid" data-workbench-scope="courses"');
  });

  it("keeps the specialist map controls and one real save form", () => {
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
