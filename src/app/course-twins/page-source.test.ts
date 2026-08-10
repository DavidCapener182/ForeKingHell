import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/course-twins/page.tsx"), "utf8");

describe("Course Twin catalogue page", () => {
  it("gives generated courses a first-class golfer-facing destination", () => {
    expect(source).toContain("listAvailableCourseTwins(userId)");
    expect(source).toContain('title="Course Twin"');
    expect(source).toContain("Aintree, Bootle and every checked package");
    expect(source).toContain("data-course-twin={twin.courseId}");
    expect(source).toContain("href={`/play/${twin.courseId}`}");
    expect(source).toContain("Open Course Twin");
    expect(source).toContain("Grade {twin.grade}");
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
    expect(source).toContain('className="hidden lg:contents" data-course-twin-desktop-catalogue');
  });
});
