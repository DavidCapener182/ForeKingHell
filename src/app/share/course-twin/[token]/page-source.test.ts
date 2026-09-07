import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve(process.cwd(), "src/app/share/course-twin/[token]/page.tsx"),
  "utf8",
);
const view = readFileSync(
  resolve(process.cwd(), "src/app/share/course-twin/[token]/shared-twin-view.tsx"),
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
    expect(view).toContain("read-only Course Twin");
    expect(page).toContain("replay={shared.replay}");
    expect(view).toMatch(/replay=\{replay\}\s+readOnly/);
    expect(page).toContain("eq(sessions.userId, shareLinks.userId)");
  });

  it("uses the immersive viewport contract with a safe mobile exit", () => {
    expect(view).toContain("course-twin-mobile.module.css");
    expect(view).toContain("data-shared-course-twin-viewport");
    expect(view).toContain("mobileStyles.viewport");
    expect(view).toContain("styles.runtime");
    expect(view).toContain("data-shared-course-twin-exit");
    expect(view).toContain('href="/"');
    expect(view).toContain("Product home");
    expect(view).toContain("min-h-11");
    expect(view).toContain('aria-describedby="shared-course-twin-context"');
    expect(view).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);
  });
});
