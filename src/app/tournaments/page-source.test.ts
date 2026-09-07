import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/tournaments/page.tsx"), "utf8");
const controls = readFileSync(
  join(process.cwd(), "src/app/tournaments/tournament-index-controls.tsx"),
  "utf8",
);
const tournamentDataSource = readFileSync(join(process.cwd(), "src/lib/tournaments.ts"), "utf8");
const courseAliasSource = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/tournaments/page.tsx"),
  "utf8",
);

describe("tournaments event index", () => {
  it("shares the filtered event population across responsive compositions", () => {
    expect(source).toContain("className={boardStyles.desktop}");
    expect(source).toContain("className={boardStyles.mobile}");
    expect(source).toContain("<TournamentEventTable events={events}");
    expect(source).toContain("<TournamentMobileList events={events}");
    expect(source).toContain("filterTournamentEvents(filtered, tab)");
    expect(source).toContain("<TournamentIndexControls");
  });

  it("uses the requested event states and removes promotional event-card grids", () => {
    expect(source).toContain('type TournamentIndexTab = "upcoming" | "active" | "completed"');
    expect(source).toContain('filterTournamentEvents(filtered, "upcoming")');
    expect(source).toContain('filterTournamentEvents(filtered, "active")');
    expect(source).toContain('filterTournamentEvents(filtered, "completed")');
    expect(controls).toContain('label="Tournament status"');
    expect(source).toContain("tournamentEventState");
    expect(source).not.toContain("ScheduledTournamentCard");
    expect(source).not.toContain("EventHeroCard");
    expect(source).not.toContain('label: "Majors"');
  });

  it("renders a row-led tournament product with the required event fields", () => {
    expect(source).toContain("TournamentEventTable");
    expect(source).toContain("data-tournament-event-row");
    expect(source).toContain('mainTableLabel="Tournament event list"');
    expect(source).toContain("<TableCaption");
    for (const label of [
      "Event",
      "Venue / course",
      "Dates",
      "Format",
      "Status",
      "Entries",
      "Your state",
    ]) {
      expect(source).toContain(`>${label}<`);
    }
  });

  it("uses the same real event collection for the mobile status tabs and list", () => {
    expect(source).toContain("<TournamentMobileList events={events}");
    expect(controls).toContain("<UntitledTabs");
    expect(controls).toContain('url.searchParams.set("tab", key)');
    expect(source).not.toContain("MobileRouteTabs");
    expect(source).toContain("tournamentYourState(event)");
    expect(source).toContain("formatTournamentWindow(event)");
  });

  it("preserves course-scoped tournament aliases and clearing", () => {
    expect(courseAliasSource).toContain(
      'canonicalRouteHref("/tournaments", await searchParams, { courseId })',
    );
    expect(tournamentDataSource).toContain("courseId: input.tournament.courseId");
    expect(source).toContain("event.courseId === courseId");
    expect(controls).toContain("new URL(window.location.href)");
    expect(controls).toContain("Clear filters");
    expect(controls).toContain("router.push(`/tournaments?tab=${active}`");
  });

  it("keeps full-width and semantic app surfaces", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("bg-muted");
    expect(source).toContain("bg-card");
    expect(source).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose|sky)-\d+/,
    );
    expect(source).not.toMatch(/max-w-(?:6xl|7xl)|max-w-\[1500px\]/);
  });
});
