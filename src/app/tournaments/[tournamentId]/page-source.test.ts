import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/tournaments/[tournamentId]/page.tsx"),
  "utf8",
);

describe("tournament detail desktop standings", () => {
  it("keeps event standings table-first with saved views, column control and export", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="tournament-detail"');
    expect(source).toContain("TournamentStandingsTable");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="tournament-standings"');
    expect(source).toContain('exportTableId="tournament-standings"');
    expect(source).toContain('data-workbench-export-table="tournament-standings"');
    expect(source).toContain('mainTableLabel="Tournament standings table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "rank",
      "player",
      "gross",
      "net",
      "stableford",
      "rounds",
      "status",
      "updated",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }

    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });
});
