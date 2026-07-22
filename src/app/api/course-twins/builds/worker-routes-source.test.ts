import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dispatch = readFileSync(
  resolve(process.cwd(), "src/app/api/cron/course-twin-builds/route.ts"),
  "utf8",
);
const completion = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/builds/[buildId]/complete/route.ts"),
  "utf8",
);
const publish = readFileSync(
  resolve(
    process.cwd(),
    "src/app/api/course-twins/[courseId]/versions/[versionId]/publish/route.ts",
  ),
  "utf8",
);

describe("Course Twin worker routes", () => {
  it("protects dispatch with the existing cron secret", () => {
    expect(dispatch).toContain("process.env.CRON_SECRET");
    expect(dispatch).toContain("dispatchNextCourseTwinBuild()");
    expect(dispatch).toContain("status: 401");
  });

  it("verifies exact callback bytes, timestamped HMAC and body size before completion", () => {
    expect(completion).toContain("MAX_COMPLETION_BYTES");
    expect(completion).toContain("verifyCourseTwinWorkerSignature({");
    expect(completion).toContain('request.headers.get("x-fkh-timestamp")');
    expect(completion).toContain('request.headers.get("x-fkh-signature")');
    expect(completion).toContain("status: 404");
  });

  it("keeps publication a separate authenticated admin decision", () => {
    expect(publish).toContain("getOptionalCurrentUserId()");
    expect(publish).toContain('eq(adminUsers.status, "active")');
    expect(publish).toContain("publishCourseTwinVersion({");
  });
});
