import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/tournaments/page.tsx"), "utf8");
const tournamentDataSource = readFileSync(join(process.cwd(), "src/lib/tournaments.ts"), "utf8");
const courseAliasSource = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/tournaments/page.tsx"),
  "utf8",
);

describe("tournaments event index", () => {
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
  });

  it("uses the requested event states and removes promotional event-card grids", () => {
    expect(source).toContain('type TournamentIndexTab = "upcoming" | "active" | "completed"');
    expect(source).toContain('{ key: "upcoming", label: "Upcoming" }');
    expect(source).toContain('{ key: "active", label: "Active" }');
    expect(source).toContain('{ key: "completed", label: "Completed" }');
    expect(source).toContain('aria-label="Tournament status"');
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
    expect(source).toContain("<TournamentMobileList events={visibleTournaments}");
    expect(source).toContain("<MobileTabBar");
    expect(source).toContain("tournamentYourState(event)");
    expect(source).toContain("formatTournamentWindow(event)");
  });

  it("preserves course-scoped tournament aliases and clearing", () => {
    expect(courseAliasSource).toContain("courseId=${encodeURIComponent(courseId)}");
    expect(tournamentDataSource).toContain("courseId: input.tournament.courseId");
    expect(source).toContain("tournament.courseId === courseId");
    expect(source).toContain("tournamentIndexHref");
    expect(source).toContain("Clear course filter");
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
