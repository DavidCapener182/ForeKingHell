import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function expectAll(content: string, patterns: string[]) {
  for (const pattern of patterns) {
    expect(content).toContain(pattern);
  }
}

describe("user isolation source guards", () => {
  it("keeps bag index and bag subroutes scoped to the current user", () => {
    expectAll(source("src/app/bag/page.tsx"), [
      "const userId = await requireCurrentUserId();",
      "eq(clubs.userId, userId)",
      "eq(shots.userId, userId)",
      "eq(sessions.userId, userId)",
    ]);

    expectAll(source("src/app/bag/longest/page.tsx"), [
      "const userId = await requireCurrentUserId();",
      "eq(clubs.userId, userId)",
      "eq(shots.userId, userId)",
    ]);

    expectAll(source("src/app/bag/[clubId]/page.tsx"), [
      "const userId = await requireCurrentUserId();",
      "eq(clubs.userId, userId)",
      "eq(shots.userId, userId)",
      "eq(sessions.userId, userId)",
    ]);
  });

  it("keeps rounds and handicap sessions and shot counts scoped to the current user", () => {
    for (const path of ["src/app/rounds/page.tsx", "src/app/handicap/page.tsx"]) {
      expectAll(source(path), [
        "const userId = await requireCurrentUserId();",
        "eq(sessions.userId, userId)",
        "eq(shots.userId, userId)",
      ]);
    }
  });

  it("does not count private course metadata outside the visible course set", () => {
    const coursesPage = source("src/app/courses/page.tsx");

    expectAll(coursesPage, [
      "const visibleCourseIds = courseRows.map((course) => course.id);",
      "inArray(teeSets.courseId, visibleCourseIds)",
      "inArray(holes.courseId, visibleCourseIds)",
    ]);
  });

  it("only queries leaderboard activity for visible leaderboard participants", () => {
    const leaderboardPage = source("src/app/leaderboard/page.tsx");

    expectAll(leaderboardPage, [
      "const visibleIds = visibleProfiles.map((profile) => profile.id);",
      "inArray(xpLedger.userId, visibleIds)",
      "inArray(shots.userId, visibleIds)",
      "inArray(sessions.userId, visibleIds)",
    ]);
    expect(leaderboardPage).not.toContain("inArray(xpLedger.userId, ids)");
    expect(leaderboardPage).not.toContain("inArray(shots.userId, ids)");
    expect(leaderboardPage).not.toContain("inArray(sessions.userId, ids)");
  });

  it("requires auth in app API routes that handle private data or external lookups", () => {
    for (const path of [
      "src/app/api/coach/chat/route.ts",
      "src/app/api/coach/summary/route.ts",
      "src/app/api/courses/osm/holes/route.ts",
      "src/app/api/courses/osm/search/route.ts",
      "src/app/api/offline/imports/route.ts",
      "src/app/api/offline/round-edits/route.ts",
      "src/app/api/scorecard/extract/route.ts",
      "src/app/api/settings/export/route.ts",
    ]) {
      expect(source(path)).toContain("getOptionalCurrentUserId");
    }
  });

  it("does not expose a service-role client behind an ambiguous server-client alias", () => {
    const supabaseServer = source("src/lib/supabase/server.ts");

    expect(supabaseServer).toContain("getSupabaseServiceRoleClient");
    expect(supabaseServer).not.toContain("getSupabaseServerClient = getSupabaseServiceRoleClient");
  });
});
