import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/tournaments/page.tsx"), "utf8");
const tournamentDataSource = readFileSync(join(process.cwd(), "src/lib/tournaments.ts"), "utf8");
const courseAliasSource = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/tournaments/page.tsx"),
  "utf8",
);

describe("tournaments desktop event board", () => {
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
    expect(source).not.toContain('<DesktopWorkbenchLayout scope="tournaments" className="hidden');
  });

  it("uses semantic theme and status tokens around the preserved event artwork", () => {
    expect(source).toContain("bg-muted");
    expect(source).toContain("bg-card");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-information-surface)");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain('variant="tourCover"');
    expect(source).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose|sky)-\d+/,
    );
  });

  it("keeps the tournament hub table-first with saved views, filters and export", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("TournamentHubEventTable");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("TournamentHubFilterTabs");
    expect(source).toContain('aria-label="Tournament board views"');
    expect(source).toContain("<ButtonGroup");
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).not.toContain("<TabsTrigger");
    expect(source).toContain("filterTournamentHubEvents");
    expect(source).toContain('data-workbench-scope="tournament-events"');
    expect(source).toContain('exportTableId="tournament-events"');
    expect(source).toContain('data-workbench-export-table="tournament-events"');
    expect(source).toContain('mainTableLabel="Tournament event board table"');
    expect(source).toContain('mainTableLabel="Tournament event board table" stickyFirstColumn');
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

describe("tournaments mobile event state", () => {
  it("uses the selected tab's real event as the mobile headline and list source", () => {
    expect(source).toContain("const mobileFeatured = tournamentBoardEvents[0] ?? null;");
    expect(source).toContain("buildTournamentProofItems(mobileFeatured)");
    expect(source).toContain("tournamentMobileStatus(activeTab, tournamentBoardEvents)");
    expect(source).not.toContain("Spring Major Week");
  });

  it("keeps desktop composition behind lg and exposes real submission evidence", () => {
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden sm:contents"');
    expect(source).toContain("viewerSubmissionCount");
    expect(source).toContain("viewerVerifiedSubmissionCount");
  });

  it("applies and preserves the course filter supplied by a course tournament alias", () => {
    expect(courseAliasSource).toContain("courseId=${encodeURIComponent(courseId)}");
    expect(tournamentDataSource).toContain("courseId: input.tournament.courseId");
    expect(source).toContain("tournament.courseId === courseId");
    expect(source).toContain("tournamentHubHref");
    expect(source).toContain('label="Applied tournament filters"');
    expect(source).toContain('ariaLabel="Clear course tournament filter"');
  });
});
