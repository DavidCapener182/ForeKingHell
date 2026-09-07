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
    expect(source).toContain("Grade B uses real terrain with approximate putting contours.");
    expect(source).toContain("<CourseTwinCatalogue twins={twins} />");
    expect(catalogueSource).toContain("data-course-twin={twin.courseId}");
    expect(catalogueSource).toContain("href={`/play/${twin.courseId}`}");
    expect(catalogueSource).toContain("Open Course Twin");
    expect(catalogueSource).toContain("Grade {twin.grade}");
    expect(catalogueSource).toContain("DataToolbar");
    expect(catalogueSource).toContain("EntityCombobox");
    expect(catalogueSource).toContain("ToggleGroup");
  });

  it("shares a responsive catalogue with accuracy warnings and a disclosed 2D fallback", () => {
    expect(catalogueSource).toContain("grid gap-3 md:grid-cols-2 xl:grid-cols-3");
    expect(catalogueSource).toContain("{twin.warning}");
    expect(catalogueSource).toContain("Course details and 2D fallback");
    expect(catalogueSource).toContain("<details");
    expect(catalogueSource).toContain("<summary");
    expect(catalogueSource).toContain("href={`/courses/${twin.courseId}/holes`}");
    expect(catalogueSource.match(/href=\{`\/play\/\$\{twin\.courseId\}`\}/g)).toHaveLength(1);
    expect(catalogueSource).toContain("prefetch={false}");
    expect(catalogueSource).not.toContain("@react-three");
    expect(catalogueSource).not.toContain("<Canvas");
    expect(source).not.toContain('className="hidden lg:contents"');
  });
});
