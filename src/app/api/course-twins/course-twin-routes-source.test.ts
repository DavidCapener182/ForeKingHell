import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifestRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/[courseId]/manifest/route.ts"),
  "utf8",
);
const replayRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/[courseId]/replay/route.ts"),
  "utf8",
);
const dataSource = readFileSync(resolve(process.cwd(), "src/lib/course-twin-data.ts"), "utf8");

describe("Course Twin API boundaries", () => {
  it("requires authentication and course access for both endpoints", () => {
    for (const source of [manifestRoute, replayRoute]) {
      expect(source).toContain("getCurrentUser()");
      expect(source).toContain("status: 401");
      expect(source).toContain("status: 404");
      expect(source).toContain("getCourseTwinManifest({ userId: user.id, courseId })");
    }
    expect(dataSource).toContain("eq(courses.id, courseId)");
    expect(dataSource).toContain('eq(courses.visibility, "shared")');
    expect(dataSource).toContain("eq(courses.createdByUserId, userId)");
  });

  it("returns an explicit not-found boundary for an unavailable package or replay", () => {
    expect(manifestRoute).toContain('error: "Course Twin not found"');
    expect(replayRoute).toContain('error: "Course Twin not found"');
    expect(replayRoute).toContain('error: "No eligible replay found"');
  });

  it("keeps manifests private-cacheable and replay evidence non-cacheable", () => {
    expect(manifestRoute).toContain('"Cache-Control": "private, max-age=60"');
    expect(replayRoute).toContain('"Cache-Control": "private, no-store"');
  });

  it("scopes replay sessions and shots to the authenticated owner", () => {
    expect(dataSource).toContain("eq(sessions.userId, userId)");
    expect(dataSource).toContain("eq(sessions.courseId, courseId)");
    expect(dataSource).toContain("eq(shots.userId, userId)");
    expect(dataSource).toContain("eq(shots.sessionId, session.id)");
  });
});
