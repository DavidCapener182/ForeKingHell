import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(file: string) {
  return readFileSync(join(root, file), "utf8");
}

describe("mobile pushed-screen header contract", () => {
  it("does not repeat a local back control inside native detail top bars", () => {
    for (const file of [
      "src/app/(app)/challenges/[challengeId]/page.tsx",
      "src/app/(app)/tournaments/[tournamentId]/page.tsx",
      "src/app/(app)/course-records/[recordId]/page.tsx",
      "src/app/(app)/courses/[courseId]/records/page.tsx",
      "src/app/(app)/import/result/page.tsx",
    ]) {
      expect(source(file), file).not.toMatch(/<MobileTopBar[\s\S]{0,320}\bleading=/);
    }
  });

  it("keeps compare navigation visible in its shared route", () => {
    const analyseCompare = source("src/app/(app)/analyse/compare/page.tsx");
    expect(analyseCompare).toContain(
      'className="flex flex-wrap items-center justify-between gap-2"',
    );
    expect(analyseCompare).not.toContain("MobileTopBar");
    expect(analyseCompare).not.toContain('className="hidden flex-wrap');
  });

  it("keeps back rows visible independently of responsive data sections", () => {
    for (const file of [
      "src/app/(app)/analyse/conditions/page.tsx",
      "src/app/(app)/analyse/workspace/page.tsx",
    ]) {
      expect(source(file), file).toContain('className="min-h-11 w-fit px-0"');
      const backControl =
        source(file).match(
          /<Button[^>]*className="min-h-11 w-fit px-0"[^>]*>[\s\S]*?<\/Button>/,
        )?.[0] ?? "";
      expect(backControl, file).toContain('href="/analyse"');
      expect(backControl, file).not.toMatch(/className="[^"]*\bhidden\b/);
    }

    const newCourse = source("src/app/(app)/courses/new/page.tsx");
    expect(newCourse).toContain('className="flex items-center justify-between gap-4"');
    expect(newCourse).not.toContain("lg:hidden");
    expect(newCourse).not.toContain("hidden lg:");

    const roundDetail = source("src/app/(app)/rounds/[sessionId]/page.tsx");
    expect(roundDetail).toContain("getRequestAppSurface()");
    expect(roundDetail).toContain('surface === "companion" ? (');
    expect(roundDetail).toContain('surface === "workbench"');
    expect(roundDetail).toContain('className="flex items-center justify-between gap-4"');
    expect(roundDetail).not.toContain('className="hidden items-center justify-between gap-4');
  });
});
