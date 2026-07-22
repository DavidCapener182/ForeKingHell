import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/api/course-twins/builds/batch/route.ts"),
  "utf8",
);
const store = readFileSync(join(process.cwd(), "src/lib/course-twin-build-jobs.ts"), "utf8");

describe("UK Course Twin batch boundary", () => {
  it("keeps preview and queueing admin-only, bounded and rate-limited", () => {
    expect(source.match(/requireApiAdmin\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('{ message: "Not found." }, { status: 404 }');
    expect(source).toContain('keyPrefix: "course-twin-batch-build"');
    expect(source).toContain("limit > 50");
    expect(source).toContain("readBoundedJsonBody(request, 4_096)");
  });

  it("ranks mapped UK courses and queues them through the idempotent single-course path", () => {
    expect(store).toContain("listUkCourseTwinCandidates");
    expect(store).toContain("readinessScore");
    expect(store).toContain("enqueueCourseTwinBuild({");
    expect(store).toContain('candidate.twinStatus !== "published"');
  });
});
