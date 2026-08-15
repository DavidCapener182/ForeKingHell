import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("companion local-control adoption", () => {
  it("uses shared in-place controls for the high-frequency companion filters", () => {
    for (const path of [
      "src/components/app/mobile-shot-pattern-charts.tsx",
      "src/app/practice/practice-companion-client.tsx",
      "src/app/quick-bag/quick-bag-client.tsx",
      "src/app/sessions/sessions-companion-list.tsx",
    ]) {
      const source = read(path);
      expect(source).toMatch(/MobileSegmentedControl|MobileFilterChipGroup/);
      expect(source).not.toContain("router.push");
      expect(source).not.toContain("router.replace");
    }
  });

  it("keeps data-already-loaded page sections mounted during tab changes", () => {
    for (const path of [
      "src/app/(app)/challenges/page.tsx",
      "src/app/(app)/challenges/[challengeId]/page.tsx",
      "src/app/(app)/tournaments/page.tsx",
      "src/app/leaderboard/mobile-leaderboard.tsx",
      "src/app/(app)/rounds/[sessionId]/page.tsx",
    ]) {
      expect(read(path)).toContain("MobilePageTabs");
    }
  });
});
