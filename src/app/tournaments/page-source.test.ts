import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/tournaments/page.tsx"), "utf8");

describe("tournaments desktop event board", () => {
  it("keeps the tournament hub table-first with saved views, filters and export", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("TournamentHubEventTable");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("TournamentHubFilterTabs");
    expect(source).toContain("filterTournamentHubEvents");
    expect(source).toContain('data-workbench-scope="tournament-events"');
    expect(source).toContain('exportTableId="tournament-events"');
    expect(source).toContain('data-workbench-export-table="tournament-events"');
    expect(source).toContain('mainTableLabel="Tournament event board table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('href: "/tournaments?tab=past"');

    for (const column of [
      "event",
      "type",
      "status",
      "course",
      "window",
      "format",
      "entries",
      "leader",
      "proof",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
