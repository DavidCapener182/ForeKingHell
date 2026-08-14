import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/course-twins/page.tsx"), "utf8");
const catalogueSource = readFileSync(
  join(process.cwd(), "src/app/course-twins/course-twin-catalogue.tsx"),
  "utf8",
);

describe("Course Twin catalogue page", () => {
  it("gives generated courses a first-class golfer-facing destination", () => {
    expect(source).toContain("listAvailableCourseTwins(userId)");
    expect(source).toContain('title="Course Twin"');
    expect(source).toContain("Aintree, Bootle and every checked package");
    expect(source).toContain("<CourseTwinCatalogue twins={twins} />");
    expect(catalogueSource).toContain("data-course-twin={twin.courseId}");
    expect(catalogueSource).toContain("href={`/play/${twin.courseId}`}");
    expect(catalogueSource).toContain("Open Course Twin");
    expect(catalogueSource).toContain("Grade {twin.grade}");
    expect(catalogueSource).toContain("DataToolbar");
    expect(catalogueSource).toContain("EntityCombobox");
    expect(catalogueSource).toContain("ToggleGroup");
  });

  it("uses a scan-first native mobile catalogue with secondary package detail disclosed", () => {
    const mobileSource = source.slice(
      source.indexOf("data-course-twin-mobile-catalogue"),
      source.indexOf("data-course-twin-desktop-catalogue"),
    );

    expect(mobileSource).toContain("<IOSGroupedList");
    expect(mobileSource).toContain("<IOSListRow");
    expect(mobileSource).toContain("ariaLabel={`Open ${twin.name} Course Twin`}");
    expect(mobileSource).toContain("<IOSDisclosureGroup");
    expect(mobileSource).toContain('title: "Terrain and accuracy"');
    expect(mobileSource).toContain("{twin.warning}");
    expect(mobileSource.match(/href=\{`\/play\/\$\{twin\.courseId\}`\}/g)).toHaveLength(1);
    expect(source).toContain("getRequestAppSurface");
    expect(source).toContain('surface === "companion"');
    expect(source).toContain('surface === "workbench" ? await import');
    expect(source).not.toContain(
      'import { CourseTwinCatalogue } from "@/app/course-twins/course-twin-catalogue"',
    );
    expect(source).not.toContain('className="hidden lg:contents"');
  });
});
