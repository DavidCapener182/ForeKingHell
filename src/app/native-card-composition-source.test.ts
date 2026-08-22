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
  it.each([
    {
      route: "club analysis detail",
      source: read("src/app/bag/[clubId]/club-analysis-tabs.tsx"),
      ranges: [
        ["data-desktop-club-analysis", "function ShotEvidenceWorkbench"],
        ["function ShotHistory", "function DispersionPanel"],
      ],
    },
    {
      route: "dashboard",
      source: read("src/app/(app)/dashboard/page.tsx"),
      ranges: [
        ["function RoundReadinessCard", "function ReadinessRow"],
        ["function SinceLastSessionCard", "function calculateRoundReadiness"],
        ["function PracticeRecommendationCard", "function PracticePayoffPill"],
      ],
    },
    {
      route: "challenge detail",
      source: read("src/app/(app)/challenges/[challengeId]/page.tsx"),
      ranges: [['id="board"', "<ChallengeCommandTables"]],
    },
    {
      route: "course record detail",
      source: read("src/app/(app)/course-records/[recordId]/page.tsx"),
      ranges: [["<DesktopWorkbenchLayout", "type CourseRecordLeaderboardRow"]],
    },
    {
      route: "leaderboard",
      source: read("src/app/(app)/leaderboard/page.tsx"),
      ranges: [
        ["async function PlayerLeaderboard", "function SortablePlayerHead"],
        ["function CourseChampionBoards", "function allowsLeaderboard"],
      ],
    },
    {
      route: "equipment",
      source: read("src/app/(app)/equipment/page.tsx"),
      ranges: [["function CurrentSetupStrip", "function BagTimelineSection"]],
    },
    {
      route: "challenge directory",
      source: read("src/app/(app)/challenges/page.tsx"),
      ranges: [
        ["function ActiveChallengeCard", "function ChallengeMetric"],
        ["function AvailableChallengeTile", "function CompactFact"],
      ],
    },
    {
      route: "provider sessions",
      source: read("src/app/(app)/providers/page.tsx"),
      ranges: [["function ProviderSessionsTable", "function ProviderHealthRow"]],
    },
    {
      route: "achievement workbench",
      source: read("src/app/(app)/achievements/page.tsx"),
      ranges: [["function AchievementSocialPanel", "\n  );\n}"]],
    },
    {
      route: "achievement companion",
      source: read("src/app/(app)/achievements/page.tsx"),
      ranges: [
        ['<Card className="gap-0 py-0" data-achievements-companion>', "<AchievementsClient"],
      ],
    },
    {
      route: "partners",
      source: read("src/app/(app)/partners/page.tsx"),
      ranges: [
        ['id="offers"', "<SponsorPipelineTable"],
        ["async function SponsorPipelineTable", "function sponsorContactLabel"],
      ],
    },
    {
      route: "tournament detail",
      source: read("src/app/(app)/tournaments/[tournamentId]/page.tsx"),
      ranges: [
        ['<section id="leaderboard"', '<section className="grid gap-4 lg:grid-cols-2">'],
        ['<Card id="your-result"', "</DesktopWorkbenchLayout>"],
      ],
    },
    {
      route: "course record directory",
      source: read("src/app/(app)/course-records/page.tsx"),
      ranges: [["data.courses.map", "<CourseRecordBoardTable"]],
    },
    {
      route: "course records for course",
      source: read("src/app/(app)/courses/[courseId]/records/page.tsx"),
      ranges: [["Previous rounds you can submit", "</DesktopWorkbenchLayout>"]],
    },
    {
      route: "round review",
      source: read("src/app/(app)/rounds/[sessionId]/page.tsx"),
      ranges: [["function ReviewAccordion", "async function getRoundDetail"]],
    },
    {
      route: "new round review",
      source: read("src/app/rounds/new/new-round-form.tsx"),
      ranges: [['hidden={mobileStep !== "review"}', '<Button\n        type="submit"']],
    },
  ])("uses shadcn Cards instead of native premium-card shells on $route", ({ source, ranges }) => {
    for (const [start, end] of ranges) {
      const block = slice(source, start, end);

      expect(block).toContain("<Card");
      expect(block).not.toMatch(nativePremiumCardShell);
    }
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
