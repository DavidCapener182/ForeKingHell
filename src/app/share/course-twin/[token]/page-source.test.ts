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

  it("uses the immersive viewport contract with a safe mobile exit", () => {
    expect(page).toContain("course-twin-mobile.module.css");
    expect(page).toContain("data-shared-course-twin-viewport");
    expect(page).toContain("mobileStyles.viewport");
    expect(page).toContain('className="relative h-full min-h-0 lg:h-auto lg:flex-1"');
    expect(page).toContain("data-shared-course-twin-exit");
    expect(page).toContain("mobileStyles.exitButton");
    expect(page).toContain('href="/login"');
    expect(page).toContain("Leave shared replay and open");
    expect(page).toContain('className="hidden flex-wrap');
  });
});
