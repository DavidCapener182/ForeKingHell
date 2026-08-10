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

  it("keeps legacy desktop back/action rows out of the mobile accessibility tree", () => {
    expect(source("src/app/(app)/analyse/compare/page.tsx")).toContain(
      'className="hidden flex-wrap items-center justify-between gap-2 lg:flex"',
    );
    for (const file of [
      "src/app/(app)/analyse/conditions/page.tsx",
      "src/app/(app)/analyse/workspace/page.tsx",
    ]) {
      expect(source(file), file).toContain('className="hidden min-h-11 w-fit px-0 lg:inline-flex"');
    }
    expect(source("src/app/(app)/courses/new/page.tsx")).toContain(
      'className="hidden items-center justify-between gap-4 lg:flex"',
    );
    expect(source("src/app/(app)/rounds/[sessionId]/page.tsx")).toContain(
      'className="hidden items-center justify-between gap-4 lg:flex"',
    );
  });
});
