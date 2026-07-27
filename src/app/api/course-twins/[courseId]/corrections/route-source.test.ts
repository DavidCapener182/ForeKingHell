import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const collection = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/[courseId]/corrections/route.ts"),
  "utf8",
);
const item = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/[courseId]/corrections/[correctionId]/route.ts"),
  "utf8",
);

describe("Course Twin correction route boundary", () => {
  it("keeps correction creation admin-only, validated and rate limited", () => {
    expect(collection).toContain("requireApiAdmin()");
    expect(collection).toContain("validateCourseTwinCorrectionBody");
    expect(collection).toContain('keyPrefix: "course-twin-correction"');
    expect(collection).toContain('status: "pending"');
  });

  it("accepts each pending correction once and forces a new fingerprinted build", () => {
    expect(item).toContain('action !== "accept" && action !== "reject"');
    expect(item).toContain('eq(courseTwinCorrections.status, "pending")');
    expect(item).toContain("enqueueCourseTwinBuild({");
    expect(item).toContain("force: true");
  });
});
