import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const nativePremiumCardShell =
  /<(?:article|section|div|aside|main|form|nav|Link|Collapsible)\b[^>]*premium-card/;

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function slice(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing start marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing end marker: ${end}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("ordinary workbench card composition", () => {
  // Inspect complete current components, including extracted workspaces, rather than retired function slices.
  it.each([
    "src/app/bag/[clubId]/club-analysis-tabs.tsx",
    "src/app/(app)/dashboard/page.tsx",
    "src/app/(app)/challenges/[challengeId]/page.tsx",
    "src/app/(app)/course-records/[recordId]/page.tsx",
    "src/app/(app)/leaderboard/page.tsx",
    "src/app/(app)/equipment/page.tsx",
    "src/app/(app)/challenges/page.tsx",
    "src/app/(app)/providers/page.tsx",
    "src/app/(app)/achievements/page.tsx",
    "src/app/(app)/partners/page.tsx",
    "src/app/(app)/tournaments/[tournamentId]/page.tsx",
    "src/app/(app)/course-records/page.tsx",
    "src/app/(app)/courses/[courseId]/records/page.tsx",
    "src/app/(app)/rounds/[sessionId]/page.tsx",
    "src/app/rounds/new/new-round-form.tsx",
    "src/app/challenges/challenge-workspace.tsx",
    "src/app/achievements/achievements-client.tsx",
    "src/app/partners/partner-register.tsx",
    "src/app/course-records/course-record-board.tsx",
  ])("keeps native premium-card shells out of %s", (path) => {
    expect(read(path)).not.toMatch(nativePremiumCardShell);
  });

  it("uses a shadcn Card surface for dashboard workspace controls", () => {
    const source = read("src/app/dashboard/dashboard-workspace-layout.tsx");
    const block = slice(
      source,
      '<Card className="gap-0 rounded-lg py-0">',
      "data-dashboard-bento-grid",
    );

    expect(block).toContain("<Card");
    expect(block).not.toMatch(nativePremiumCardShell);
  });

  it("uses the shared table frame for the tournament event workbench", () => {
    const source = read("src/app/(app)/tournaments/page.tsx");
    const block = slice(source, "function TournamentEventTable", "function TournamentMobileList");

    expect(block).toContain("<DataTableFrame");
    expect(block).not.toMatch(nativePremiumCardShell);
  });
});
