import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/leaderboard/page.tsx"), "utf8");
const controls = readFileSync(
  join(process.cwd(), "src/app/leaderboard/leaderboard-controls.tsx"),
  "utf8",
);
const mobile = readFileSync(
  join(process.cwd(), "src/app/leaderboard/leaderboard-detail-cards.tsx"),
  "utf8",
);

describe("leaderboard desktop workspace source", () => {
  it("keeps board audience and period independent from compete destinations", () => {
    expect(source).toContain("<LeaderboardPlayerControls");
    expect(controls).toContain('["friends", "Friends"]');
    expect(controls).toContain('["public", "Global"]');
    expect(controls).toContain('"period"');
    expect(source).toContain('requestedTab === "monthly" ? "friends" : requestedTab');
    expect(source).toContain("parseLeaderboardPeriod(params?.period, requestedTab)");
  });

  it("keeps period and audience as independently labelled fields", () => {
    expect(controls).toContain("aria-label={`Leaderboard ${label.toLowerCase()}`}");
    expect(controls).toContain('["all-time", "All time"]');
    expect(controls).toContain('["monthly", monthLabel]');
    expect(controls).toContain("value={draft[key]}");
    expect(controls).toContain("Object.entries(next)");
    expect(controls).toContain("new URLSearchParams(window.location.search)");
  });

  it("shares the ranked population between responsive list and table", () => {
    expect(source).toContain("className={boardStyles.mobile}");
    expect(source).toContain("className={boardStyles.desktop}");
    expect(source).toContain("rows={tablePlayers.map((player) => ({");
    expect(source).not.toContain("<MobileLeaderboard");
    expect(source).toContain("<LeaderboardDetailCards");
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
    expect(source).toContain("<PageShell>");
    expect(source).toContain("LeaderboardCompetitionHeader");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
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

  it("lifecycle-gates public shot counts and longest-drive evidence", () => {
    const loader =
      source.match(
        /async function getLeaderboardData[\s\S]*?function getCourseChampionBoards/,
      )?.[0] ?? "";

    expect(loader).toContain('eq(shots.reviewStatus, "restored")');
    expect(loader).toContain('eq(shots.reviewStatus, "included")');
    expect(loader).toContain("trustedShotEvidence");
    expect(loader).toContain('"warm_up"');
    expect(loader).toContain("monthlyShotsByUser");
    expect(loader).toContain("longestDriveRowsByUser(shotRows)");
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
  it("keeps mobile filters and rank evidence aligned with desktop", () => {
    expect(controls).toContain('title="Leaderboard filters"');
    expect(controls).toContain("<ResponsiveDetailPanel");
    expect(controls).toContain("<div className={styles.desktop}>{fields}</div>");
    expect(controls).toContain("{fields}");
    expect(controls).toContain("original ranks");
    expect(source).toContain("rankByUserId.get(player.userId)");
    expect(source).toContain("scoreForPeriod(player, period)");
  });

  it("keeps mobile standing identity and detailed evidence reachable", () => {
    expect(mobile).toContain("rows.map((item) => (");
    expect(mobile).toContain('item.personal ? " · You" : ""');
    expect(mobile).toContain("onClick={() => setSelected(item.id)}");
    expect(mobile).toContain("rows.find((item) => item.id === selected)");
    expect(mobile).toContain("<ResponsiveDetailPanel");
    expect(mobile).toContain("row.fields.map(([label, value])");
    expect(mobile).toContain("<Link href={row.href}>Open full record</Link>");
    expect(source).toContain('"Unavailable: no prior ranking snapshot"');
  });
});
