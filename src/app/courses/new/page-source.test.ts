import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/courses/new/page.tsx"), "utf8");
const mobileSource = readFileSync(
  join(process.cwd(), "src/app/courses/new/mobile-course-source-chooser.tsx"),
  "utf8",
);

describe("new course desktop workflow", () => {
  it("uses the desktop wizard template for course setup and source review", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain("courseWorkflowSteps");
    expect(source).toContain("courseWorkflowHelpItems");
    expect(source).toContain('helpTitle="Course setup help"');
    expect(source).toContain('helpDescription="Build trustworthy course data"');

    for (const label of ["Choose source", "Confirm tee set", "Check duplicates", "Map holes"]) {
      expect(source).toContain(label);
    }

    expect(source).toContain("Google gives identity and media");
    expect(source).toContain("Keep low-confidence geometry visible");
    expect(source).toContain("hole-management workspace");
  });
});

describe("new course mobile source chooser", () => {
  it("keeps the desktop workbench isolated and removes duplicate mobile importers", () => {
    expect(source).toContain('className="hidden lg:grid"');
    expect(source.match(/<GoogleCourseImporter \/>/g)).toHaveLength(1);
    expect(source.match(/<OsmCourseImporter \/>/g)).toHaveLength(1);
    expect(source).toContain("<MobileCourseSourceChooser />");
    expect(source).not.toContain("MobileAccordionSection");
  });

  it("renders exactly the selected Google, OSM or manual workflow", () => {
    expect(mobileSource).toContain('type CourseSource = "google" | "osm" | "manual"');
    expect(mobileSource).toContain("<SegmentedControl");
    expect(mobileSource).toContain('source === "google" ? <GoogleCourseImporter /> : null');
    expect(mobileSource).toContain('source === "osm" ? <OsmCourseImporter /> : null');
    expect(mobileSource).toContain('source === "manual" ? <ManualCourseWorkflow /> : null');
    expect(mobileSource).toContain("function ManualCourseWorkflow");
    expect(mobileSource).toContain("action={createCourseAction}");
  });
});
