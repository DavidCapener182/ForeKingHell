import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/tournaments/[tournamentId]/page.tsx"),
  "utf8",
);

describe("active tournament event product", () => {
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

  it("builds the desktop detail around the requested event hierarchy", () => {
    expect(source).toContain('className="premium-hero overflow-hidden p-0"');
    expect(source).toContain("Round progress");
    expect(source).toContain("Leaderboard");
    expect(source).toContain("Your current result");
    expect(source).toContain("Submission status");
    expect(source).toContain("TournamentRulesSheet");
    expect(source.match(/<OperationStepper/g)).toHaveLength(2);
  });

  it("uses a proper event leaderboard table", () => {
    expect(source).toContain("TournamentStandingsTable");
    expect(source).toContain('mainTableLabel="Tournament leaderboard"');
    expect(source).toContain("<TableCaption");
    for (const label of ["Pos", "Player", "Thru", "Gross", "Net", "Points", "Status"]) {
      expect(source).toContain(`>${label}<`);
    }
    expect(source).toContain('<Badge variant="secondary">You</Badge>');
  });

  it("puts rules in a Sheet and round submission in a Dialog", () => {
    expect(source).toMatch(/<SheetTrigger\s+type="button"[\s\S]*?buttonVariants\(\{/);
    expect(source).toMatch(/<DialogTrigger\s+type="button"[\s\S]*?buttonVariants\(\{/);
    expect(source).toContain("<DialogTitle>Submit round {data.nextRoundNumber}</DialogTitle>");
    expect(source).toContain("<SheetTitle>{data.tournament.title} rules</SheetTitle>");
  });

  it("does not offer entry or submission actions once an event is completed", () => {
    expect(source).toContain('if (tournamentStatus(data.tournament) === "Completed")');
    expect(source).toContain('data.viewerEntered ? "Open result" : "View result"');
    expect(source).toContain("Submissions are closed");
    expect(source).toContain("const eventCompleted");
    expect(source).toContain('eventCompleted\n          ? ("upcoming" as const)');
  });

  it("delivers the mobile event, position, next round, action and leaderboard preview", () => {
    expect(source).toContain('<MobileTopBar\n            title="Tournament"'.replace("\\n", "\n"));
    expect(source).toContain('label="Your position"');
    expect(source).toContain('<NativeListSection title="Next round">');
    expect(source).toContain("<TournamentPrimaryAction");
    expect(source).toContain('<NativeListSection title="Leaderboard preview">');
    expect(source).toContain("visibleStandings.slice(0, 5)");
    expect(source).toContain("LeaderboardSheet");
  });

  it("keeps semantic surfaces and the full-width layout contract", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-muted");
    expect(source).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose|sky)-\d+/,
    );
    expect(source).not.toMatch(/max-w-(?:6xl|7xl)|max-w-\[1500px\]/);
  });
});
