import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/[courseId]/build/route.ts"),
  "utf8",
);

describe("Course Twin build route boundary", () => {
  it("hides build status from unauthenticated and non-admin callers", () => {
    expect(source).toContain("requireApiAdmin()");
    expect(source).toContain('{ message: "Not found." }, { status: 404 }');
    expect(source).toContain('eq(adminUsers.status, "active")');
  });

  it("rate limits and queues idempotent generation requests", () => {
    expect(source).toContain('keyPrefix: "course-twin-build"');
    expect(source).toContain("enqueueCourseTwinBuild({");
    expect(source).toContain("status: 202");
    expect(source).toContain('"Cache-Control": "no-store"');
  });
});
