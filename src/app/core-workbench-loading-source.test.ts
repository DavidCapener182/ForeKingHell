import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function loadingPathFor(route: string) {
  const routeGroup = route === "admin" || route.startsWith("admin/") ? "(admin)" : "(app)";
  return join(root, "src/app", routeGroup, route, "loading.tsx");
}

describe("core desktop workbench loading states", () => {
  it("keeps Phase 3 desktop routes on route-level loading skeletons", () => {
    for (const route of ["dashboard", "shots", "bag", "rounds", "coach", "data-chat"]) {
      const loadingPath = loadingPathFor(route);

      expect(existsSync(loadingPath), `/${route} loading.tsx`).toBe(true);
      expect(readFileSync(loadingPath, "utf8")).toContain("GolfRouteLoading");
    }
  });

  it("keeps data-heavy desktop workbench and detail routes on loading skeletons", () => {
    const routes = [
      { route: "analyse", variant: "analyse" },
      { route: "analyse/compare", variant: "compare" },
      { route: "compare", variant: "compare" },
      { route: "courses", variant: "courses" },
      { route: "course-records", variant: "courseRecords" },
      { route: "admin", variant: "admin" },
      { route: "bag/[clubId]/analytics", variant: "clubAnalytics" },
      { route: "rounds/[sessionId]", variant: "roundDetail" },
      { route: "courses/[courseId]/holes", variant: "courses" },
      { route: "courses/[courseId]/records", variant: "courseRecords" },
      { route: "sessions", variant: "sessions" },
    ];

    for (const { route, variant } of routes) {
      const loadingPath = loadingPathFor(route);
      const source = existsSync(loadingPath) ? readFileSync(loadingPath, "utf8") : "";

      expect(existsSync(loadingPath), `/${route} loading.tsx`).toBe(true);
      expect(source).toContain("GolfRouteLoading");
      expect(source).toContain(`variant="${variant}"`);
    }
  });

  it("keeps Phase 4 social, platform, workflow and competition routes on loading skeletons", () => {
    const routes = [
      { route: "achievements", variant: "achievements" },
      { route: "billing", variant: "billing" },
      { route: "challenges", variant: "challenges" },
      { route: "equipment", variant: "equipment" },
      { route: "feed", variant: "feed" },
      { route: "friends", variant: "friends" },
      { route: "groups", variant: "groups" },
      { route: "handicap", variant: "handicap" },
      { route: "import", variant: "import" },
      { route: "leaderboard", variant: "leaderboard" },
      { route: "partners", variant: "partners" },
      { route: "practice", variant: "practice" },
      { route: "profile", variant: "profile" },
      { route: "providers", variant: "providers" },
      { route: "rapsodo", variant: "rapsodo" },
      { route: "settings", variant: "settings" },
      { route: "simulator-lab", variant: "simulatorLab" },
      { route: "social-intelligence", variant: "socialSafety" },
      { route: "stats/training-over-time", variant: "trainingLoad" },
      { route: "today", variant: "today" },
      { route: "tournaments", variant: "tournaments" },
    ];

    for (const { route, variant } of routes) {
      const loadingPath = loadingPathFor(route);
      const source = existsSync(loadingPath) ? readFileSync(loadingPath, "utf8") : "";

      expect(existsSync(loadingPath), `/${route} loading.tsx`).toBe(true);
      expect(source).toContain("GolfRouteLoading");
      expect(source).toContain(`variant="${variant}"`);
    }
  });

  it("labels the shared golf loader for core workbench contexts", () => {
    const source = readFileSync(join(root, "src/components/golf-loading.tsx"), "utf8");

    for (const variant of [
      "shots",
      "rounds",
      "sessions",
      "coach",
      "analyse",
      "dataChat",
      "compare",
      "courses",
      "courseRecords",
      "admin",
      "clubAnalytics",
      "roundDetail",
      "today",
      "import",
      "rapsodo",
      "providers",
      "practice",
      "equipment",
      "handicap",
      "simulatorLab",
      "trainingLoad",
      "achievements",
      "leaderboard",
      "challenges",
      "tournaments",
      "feed",
      "friends",
      "groups",
      "profile",
      "settings",
      "billing",
      "partners",
      "socialSafety",
    ]) {
      expect(source).toContain(`| "${variant}"`);
      expect(source).toContain(`case "${variant}"`);
    }
  });
});
