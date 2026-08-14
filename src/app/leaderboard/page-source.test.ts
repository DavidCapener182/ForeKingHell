import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/leaderboard/page.tsx"), "utf8");
const controls = readFileSync(
  join(process.cwd(), "src/app/leaderboard/leaderboard-controls.tsx"),
  "utf8",
);

describe("leaderboard desktop workspace source", () => {
  it("uses linked Tabs for the five competition scopes", () => {
    expect(controls).toContain("<Tabs");
    expect(controls).toContain("<TabsList");
    expect(controls).toContain("<TabsTrigger");
    expect(controls).toContain('aria-label="Leaderboard views"');
    expect(controls).toContain('{ value: "friends", label: "Friends"');
    expect(controls).toContain('{ value: "public", label: "Global"');
    expect(controls).toContain('{ value: "courses", label: "Course"');
    expect(controls).toContain('{ value: "challenges", label: "Challenge"');
    expect(controls).toContain('{ value: "tournaments", label: "Tournament"');
    expect(controls).toContain("const href = `/leaderboard?tab=${tab.value}");
    expect(controls).toContain('aria-current={active ? "page" : undefined}');
    expect(controls).toContain('from "@/components/ui/tabs"');
    expect(source).toContain("<LeaderboardTypeTabs activeTab={activeTab} period={period} />");
  });

  it("keeps period and friends/global scope as independent toggle groups", () => {
    expect(controls).toContain('aria-label="Leaderboard period"');
    expect(controls).toContain('aria-label="Leaderboard scope"');
    expect(controls).toContain('<ToggleGroupItem value="monthly">This month</ToggleGroupItem>');
    expect(controls).toContain('<ToggleGroupItem value="friends">Friends</ToggleGroupItem>');
    expect(controls).toContain('<ToggleGroupItem value="global">Global</ToggleGroupItem>');
    expect(source).toContain("parseLeaderboardPeriod(params?.period, requestedTab)");
  });

  it("selects one request surface before loading the desktop workbench", () => {
    const staticWorkbenchImport =
      source.match(
        /import(?: type)? \{[^}]*\} from "@\/components\/app\/desktop-workbench";/,
      )?.[0] ?? "";

    expect(source).toContain("getRequestAppSurface()");
    expect(source).toContain(
      'surface === "workbench" ? await import("@/components/app/desktop-workbench") : null',
    );
    expect(source).toContain('surface === "companion" ? (');
    expect(source).toContain('surface === "workbench" && DesktopWorkbenchLayout ? (');
    expect(staticWorkbenchImport).not.toContain("DesktopWorkbenchLayout");
    expect(staticWorkbenchImport).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('<DesktopWorkbenchLayout scope="leaderboard" className="hidden');
  });

  it("uses semantic theme tokens for ordinary leaderboard surfaces", () => {
    expect(source).toContain("bg-muted");
    expect(source).toContain("bg-card");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose)-\d+/,
    );
  });

  it("keeps leaderboards in the desktop workbench without a persistent AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="leaderboard"');
    expect(source).toContain("LeaderboardCompetitionHeader");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps player leaderboards as controlled exportable tables", () => {
    const playerTableBlock =
      source.match(
        /<DataTableFrame[\s\S]*?mainTableId="leaderboard-player-main-table"[\s\S]*?mainTableLabel="Leaderboard player table"[\s\S]*?<\/DataTableFrame>/,
      )?.[0] ?? "";

    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("leaderboardPlayerColumns");
    expect(source).toContain("leaderboardSuggestedViews");
    expect(source).toContain("viewKey={`leaderboard-${activeTab}`}");
    expect(source).toContain('scope="leaderboard"');
    expect(source).toContain('exportTableId="leaderboard-players"');
    expect(source).toContain('exportFileName="forekinghell-leaderboard-players-view.csv"');
    expect(source).toContain('data-workbench-scope="leaderboard"');
    expect(source).toContain('data-workbench-export-table="leaderboard-players"');
    expect(source).toContain('mainTableId="leaderboard-player-main-table"');
    expect(source).toContain('mainTableLabel="Leaderboard player table"');
    expect(playerTableBlock).toContain("stickyFirstColumn");
    expect(source).toContain('activeTab === "challenges" ? (');
    expect(source).toContain(
      "<ChallengeBoards boards={data.challengeBoards} sortState={challengeSort} />",
    );
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["rank", "player", "result", "movement", "rounds-sessions", "proof"]) {
      expect(source).toContain(`data-column="${column}"`);
    }

    expect(source).toContain("leaderboardRowClassName(rank, player.isCurrentUser)");
    expect(source).toContain("rankMovementForPlayer(player)");
    expect(source).toContain('title="No prior rank snapshot"');
    expect(source).not.toContain("LeaderboardPodiumCard");
    expect(source).not.toContain("monthlyMovementShortLabel");
  });

  it("keeps challenge leaderboards exportable for desktop users", () => {
    const challengeTableBlock =
      source.match(
        /<DataTableFrame[\s\S]*?mainTableId="challenge-leaderboard-main-table"[\s\S]*?mainTableLabel="Challenge leaderboard table"[\s\S]*?<\/DataTableFrame>/,
      )?.[0] ?? "";

    expect(source).toContain("challengeLeaderboardColumns");
    expect(source).toContain("challengeLeaderboardSuggestedViews");
    expect(source).toContain('viewKey="leaderboard-challenges"');
    expect(source).toContain('exportTableId="leaderboard-challenges"');
    expect(source).toContain('exportFileName="forekinghell-challenge-leaderboards-view.csv"');
    expect(source).toContain('data-workbench-scope="leaderboard"');
    expect(source).toContain('data-workbench-export-table="leaderboard-challenges"');
    expect(source).toContain('mainTableId="challenge-leaderboard-main-table"');
    expect(source).toContain('mainTableLabel="Challenge leaderboard table"');
    expect(challengeTableBlock).toContain("stickyFirstColumn");
    expect(challengeTableBlock).toContain("mainTable");

    for (const column of ["challenge", "template", "participants", "leader", "score", "source"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});

describe("leaderboard mobile state", () => {
  it("exposes the period control and scopes proof filters to player boards", () => {
    expect(controls).toContain('<ToggleGroupItem value="monthly">This month</ToggleGroupItem>');
    expect(source).toContain("const showMobilePlayerFilters = isPlayerLeaderboardTab(activeTab);");
    expect(source).toContain("showMobilePlayerFilters ? (");
    expect(source).not.toContain('<option value="mixed">Mixed</option>');
  });

  it("uses one compact mobile row list instead of golfer cards", () => {
    expect(source).toContain("MobileCompetitionLeaderboard");
    expect(source).toContain("Rank");
    expect(source).toContain("Golfer");
    expect(source).toContain("Score");
    expect(source).toContain("Move");
    expect(source).not.toContain('viewAllHref="#full-leaderboard"');
    expect(source).not.toContain("LeaderboardPodiumCard");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden sm:contents"');
  });
});
