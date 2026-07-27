import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve(process.cwd(), "src/app/share/course-twin/[token]/page.tsx"),
  "utf8",
);
const actions = readFileSync(resolve(process.cwd(), "src/app/rounds/actions.ts"), "utf8");

describe("public Course Twin replay sharing", () => {
  it("creates an expiring owner-scoped link and renders only an active replay token", () => {
    expect(actions).toContain("createCourseTwinReplayShareLinkAction");
    expect(actions).toContain('resourceType: "course_twin_replay"');
    expect(actions).toContain("getShareExpiry(30, now)");
    expect(page).toContain('eq(shareLinks.resourceType, "course_twin_replay")');
    expect(page).toContain("isNull(shareLinks.revokedAt)");
    expect(page).toContain("gt(shareLinks.expiresAt, now)");
    expect(page).toContain("getCourseTwinReplay");
    expect(page).toContain("Read-only replay");
    expect(page).toContain("replay={shared.replay} readOnly");
  });
});
