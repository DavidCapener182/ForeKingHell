import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/courses/new/page.tsx"), "utf8");
const googleImporterSource = readFileSync(
  join(process.cwd(), "src/app/courses/google-course-importer.tsx"),
  "utf8",
);
const osmImporterSource = readFileSync(
  join(process.cwd(), "src/app/courses/osm-course-importer.tsx"),
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

describe("new course desktop-only bundle", () => {
  it("keeps obsolete companion source-selection UI out of the workbench route", () => {
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source.match(/<GoogleCourseImporter \/>/g)).toHaveLength(1);
    expect(source.match(/<OsmCourseImporter \/>/g)).toHaveLength(1);
    expect(source).not.toContain("MobileCourseSourceChooser");
    expect(source).not.toContain("MobileMetricStrip");
    expect(source).not.toMatch(/bg-white|bg-\[#|text-emerald-|text-sky-/);
  });

  it("keeps imported search helpers on themed shadcn controls", () => {
    for (const importerSource of [googleImporterSource, osmImporterSource]) {
      expect(importerSource).toContain('from "@/components/ui/alert"');
      expect(importerSource).toContain('from "@/components/ui/button"');
      expect(importerSource).toContain('from "@/components/ui/input"');
      expect(importerSource).toContain('from "@/components/ui/item"');
      expect(importerSource).toContain("<Alert");
      expect(importerSource).toContain("<Item");
      expect(importerSource).not.toContain("<button");
      expect(importerSource).not.toMatch(
        /(?:bg-white|bg-\[#|text-emerald-|border-emerald|bg-emerald|text-amber-|border-amber|bg-amber)/,
      );
    }

    expect(googleImporterSource).toContain("data-google-course-search-feedback");
    expect(googleImporterSource).toContain("data-google-course-result");
    expect(googleImporterSource).toContain("data-google-course-selection");
    expect(osmImporterSource).toContain("data-osm-search-feedback");
    expect(osmImporterSource).toContain("data-osm-course-result");
    expect(osmImporterSource).toContain("data-osm-course-selection");
    expect(osmImporterSource).toContain("var(--status-warning-surface)");
  });

  it("keeps selected importer results flat inside the route DataPanels", () => {
    const googleSelection =
      googleImporterSource.match(/export function GoogleCourseSelection[\s\S]*$/)?.[0] ?? "";
    const osmSelection =
      osmImporterSource.match(
        /export function OsmCourseSelection[\s\S]*?function SmallMetric/,
      )?.[0] ?? "";

    expect(source).toContain("<DataPanel>");
    expect(googleSelection).toContain("<Item");
    expect(googleSelection).toContain("data-google-course-selection");
    expect(googleSelection).not.toMatch(/<Card(?:\s|>)/);
    expect(googleSelection).not.toContain("<CardContent");
    expect(osmSelection).toContain("<section");
    expect(osmSelection).toContain("<Item");
    expect(osmSelection).toContain("data-osm-course-selection");
    expect(osmSelection).not.toMatch(/<Card(?:\s|>)/);
    expect(osmSelection).not.toContain("<CardContent");
    expect(googleImporterSource).not.toContain('from "@/components/ui/card"');
    expect(osmImporterSource).not.toContain('from "@/components/ui/card"');
  });
});
