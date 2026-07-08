import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/leaderboard/page.tsx"), "utf8");

describe("leaderboard desktop workspace source", () => {
  it("keeps leaderboards in the desktop workbench without a persistent AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="leaderboard"');
    expect(source).toContain("DataFirstFlowPanel");
    expect(source).toContain("LeaderboardClimbPanel");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps player leaderboards as controlled exportable tables", () => {
    const playerTableBlock =
      source.match(
        /<DataTableFrame mainTable mainTableLabel="Leaderboard player table"[\s\S]*?<\/DataTableFrame>/,
      )?.[0] ?? "";

    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("leaderboardPlayerColumns");
    expect(source).toContain("leaderboardSuggestedViews");
    expect(source).toContain("viewKey={`leaderboard-${activeTab}`}");
    expect(source).toContain('scope="leaderboard"');
    expect(source).toContain('exportTableId="leaderboard-players"');
    expect(source).toContain('exportFileName="forekinghell-leaderboard-players-view.csv"');
    expect(source).toContain('data-workbench-export-table="leaderboard-players"');
    expect(source).toContain('mainTableLabel="Leaderboard player table"');
    expect(playerTableBlock).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "rank",
      "player",
      "total-xp",
      "monthly-xp",
      "monthly-shots",
      "best-round",
      "longest-drive",
      "source",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps challenge leaderboards exportable for desktop users", () => {
    const challengeTableBlock =
      source.match(
        /<DataTableFrame mainTable mainTableLabel="Challenge leaderboard table"[\s\S]*?<\/DataTableFrame>/,
      )?.[0] ?? "";

    expect(source).toContain("challengeLeaderboardColumns");
    expect(source).toContain("challengeLeaderboardSuggestedViews");
    expect(source).toContain('viewKey="leaderboard-challenges"');
    expect(source).toContain('exportTableId="leaderboard-challenges"');
    expect(source).toContain('exportFileName="forekinghell-challenge-leaderboards-view.csv"');
    expect(source).toContain('data-workbench-export-table="leaderboard-challenges"');
    expect(source).toContain('mainTableLabel="Challenge leaderboard table"');
    expect(challengeTableBlock).toContain("stickyFirstColumn");

    for (const column of ["challenge", "template", "participants", "leader", "score", "source"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
