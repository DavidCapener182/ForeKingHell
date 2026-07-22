import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/api/course-twins/[courseId]/strategy/route.ts", "utf8");

describe("Course Twin strategy route boundaries", () => {
  it("requires auth, validates the hole and scopes both manifest and bag to the user", () => {
    expect(source).toContain("getCurrentUser");
    expect(source).toContain("status: 401");
    expect(source).toContain("holeNumber must be an integer from 1 to 18");
    expect(source).toContain("getCourseTwinManifest({ userId: user.id, courseId })");
    expect(source).toContain("getCourseTwinBagProfiles(user.id)");
    expect(source).toContain('"Cache-Control": "private, no-store"');
  });
});
