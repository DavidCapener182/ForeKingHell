import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/api/course-twins/[courseId]/putting-surveys/route.ts"),
  "utf8",
);

describe("Course Twin putting survey admin boundary", () => {
  it("hides the route from non-admins and bounds both import and review bodies", () => {
    expect(source).toContain("requireApiAdmin");
    expect(source).toContain('return Response.json({ message: "Not found." }, { status: 404 })');
    expect(source).toContain("2 * 1024 * 1024");
    expect(source).toContain("8_192");
  });

  it("only rebuilds the course after a verified review", () => {
    expect(source).toContain('payload.status === "verified"');
    expect(source).toContain("enqueueCourseTwinBuild");
    expect(source).toContain("force: true");
  });
});
