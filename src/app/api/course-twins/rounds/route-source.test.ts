import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const createSource = read("src/app/api/course-twins/[courseId]/rounds/route.ts");
const roundSource = read("src/app/api/course-twins/rounds/[roundId]/route.ts");
const eventsSource = read("src/app/api/course-twins/rounds/[roundId]/events/route.ts");

describe("Course Twin round API boundaries", () => {
  it("requires authentication and ownership-mediated stores", () => {
    for (const source of [createSource, roundSource, eventsSource]) {
      expect(source).toContain("getCurrentUser()");
      expect(source).toContain("status: 401");
    }
    expect(roundSource).toContain("loadCourseTwinRound(roundId, user.id)");
    expect(eventsSource).toContain("userId: user.id");
  });

  it("bounds mutations and protects optimistic ordering", () => {
    expect(createSource).toContain("readBoundedJsonBody(request, 16_384)");
    expect(createSource).toContain("rateLimitRequest(request");
    expect(eventsSource).toContain("readBoundedJsonBody(request, 16_384)");
    expect(eventsSource).toContain("expectedVersion");
    expect(eventsSource).toContain("status: 409");
  });

  it("checks the published course capability before starting", () => {
    expect(createSource).toContain("getCourseTwinManifest({ userId: user.id, courseId })");
    expect(createSource).toContain("manifest.supportedModes.includes(input.mode)");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
