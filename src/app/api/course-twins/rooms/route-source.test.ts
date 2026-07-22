import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sources = [
  "src/app/api/course-twins/[courseId]/rooms/route.ts",
  "src/app/api/course-twins/rooms/join/route.ts",
  "src/app/api/course-twins/rooms/[roomId]/route.ts",
  "src/app/api/course-twins/rooms/[roomId]/state/route.ts",
  "src/app/api/course-twins/rooms/[roomId]/events/route.ts",
  "src/app/api/course-twins/rooms/[roomId]/shared-round/events/route.ts",
].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

describe("Course Twin room API boundaries", () => {
  it("requires authentication across every room endpoint", () => {
    for (const source of sources) {
      expect(source).toContain("getCurrentUser()");
      expect(source).toContain("status: 401");
    }
  });

  it("bounds mutation bodies and hides non-member rooms", () => {
    for (const source of sources.filter((source) => source.includes("readBoundedJsonBody"))) {
      expect(source).toContain("readBoundedJsonBody(request");
    }
    expect(sources[2]).toContain("getCourseTwinRoom(roomId, user.id)");
    expect(sources[4]).toContain("listCourseTwinRoomEvents(roomId, user.id, since)");
    expect(sources[4]).toContain("rateLimitRequest(request");
    expect(sources[5]).toContain("listCourseTwinSharedRoundEvents(roomId, user.id)");
    expect(sources[5]).toContain("readBoundedJsonBody(request, 16_384)");
  });

  it("requires course access, private cache headers and optimistic host updates", () => {
    expect(sources[0]).toContain("getCourseTwinManifest({ userId: user.id, courseId })");
    expect(sources[0]).toContain('"Cache-Control": "private, no-store"');
    expect(sources[3]).toContain("parseCourseTwinRoomStateInput");
    expect(sources[3]).toContain("status: 409");
    expect(sources[5]).toContain("parseCourseTwinSharedRoundEventInput");
  });

  it("keeps spectators read-only and shared mutations versioned", () => {
    expect(sources[1]).toContain("parseCourseTwinJoinRoomInput");
    expect(sources[5]).toContain('result.status === "forbidden"');
    expect(sources[5]).toContain('result.status === "conflict"');
    expect(sources[5]).toContain("currentVersion: result.currentVersion");
  });
});
