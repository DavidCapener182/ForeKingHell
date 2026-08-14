import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/tournaments/[tournamentId]/page.tsx"),
  "utf8",
);

describe("tournament detail theme semantics", () => {
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
    expect(source).not.toContain(
      '<DesktopWorkbenchLayout scope="tournament-detail" className="hidden',
    );
  });

  it("uses semantic surfaces and status tokens for ordinary interface chrome", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-muted");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose|sky)-\d+/,
    );
  });

  it("renders server-authored rules and submission triggers directly across RSC boundaries", () => {
    expect(source).toContain('import { Button, buttonVariants } from "@/components/ui/button"');
    expect(source).toMatch(/<SheetTrigger\s+type="button"[\s\S]*?buttonVariants\(\{/);
    expect(source).toMatch(/<DialogTrigger\s+type="button"[\s\S]*?buttonVariants\(\{/);
    expect(source).not.toMatch(/<(?:Sheet|Dialog)Trigger\s+asChild>[\s\S]*?<Button/);
  });
});

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
    expect(source).toContain('mainTableLabel="Tournament standings table" stickyFirstColumn');
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

describe("tournament detail mobile standings", () => {
  it("keeps the complete board available from the board tab", () => {
    expect(source).toContain("MobileTournamentStandings");
    expect(source).toContain("visibleStandings={visibleStandings}");
    expect(source).not.toContain("viewAllHref={`/tournaments/${data.tournament.id}#standings`}");
    expect(source).not.toContain(
      '<DesktopWorkbenchLayout scope="tournament-detail" className="hidden',
    );
  });
});
