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

  it("keeps desktop-only compare controls visible while companion traffic falls back", () => {
    const analyseCompare = source("src/app/(app)/analyse/compare/page.tsx");
    expect(analyseCompare).toContain(
      'className="flex flex-wrap items-center justify-between gap-2"',
    );
    expect(analyseCompare).not.toContain("MobileTopBar");
    expect(analyseCompare).not.toContain('className="hidden flex-wrap');
  });

  it("keeps redirected desktop back rows visible without CSS-hidden duplicate trees", () => {
    for (const file of [
      "src/app/(app)/analyse/conditions/page.tsx",
      "src/app/(app)/analyse/workspace/page.tsx",
    ]) {
      expect(source(file), file).toContain('className="min-h-11 w-fit px-0"');
      expect(source(file), file).not.toContain("lg:hidden");
      expect(source(file), file).not.toContain("hidden lg:");
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
