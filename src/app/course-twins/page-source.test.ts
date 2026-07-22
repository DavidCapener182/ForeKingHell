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
});
