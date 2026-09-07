import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/tournaments/[tournamentId]/page.tsx"),
  "utf8",
);

describe("active tournament event product", () => {
  it("preserves tournament section drafts and browser history on both surfaces", () => {
    const sections = readFileSync(
      join(process.cwd(), "src/app/tournaments/tournament-detail-sections.tsx"),
      "utf8",
    );
    expect(source).toContain("<TournamentDetailSections");
    expect(sections).toContain("keepMounted");
    expect(sections).toContain('window.addEventListener("popstate", onPop)');
    expect(sections).toContain('url.searchParams.set("tab", key)');
    expect(sections).toContain('tab === "rounds" ? "submit"');
    expect(source).toContain("getTournamentDetailData(tournamentId)");
  });

  it("builds the desktop detail around the requested event hierarchy", () => {
    expect(source).toContain("<TournamentRoundProgress steps={buildProgressSteps(data)} />");
    expect(source).toContain("Your current result");
    expect(source).toContain("submissionStatusDetail(data, latestSubmission)");
    expect(source).toContain("<TournamentRulesSheet data={data} />");
    expect(source).toContain("Accepted scores only");
    expect(source).toContain("Submission is not a guarantee of acceptance into the standings.");
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

  it("keeps rules reachable and submissions reviewed with stable retry identity", () => {
    expect(source).toMatch(/<SheetTrigger\s+type="button"[\s\S]*?buttonVariants\(\{/);
    expect(source).toContain("<SheetTitle>{data.tournament.title} rules</SheetTitle>");
    expect(source).toContain("<TournamentSubmissionForm");
    const form = readFileSync(
      join(process.cwd(), "src/app/tournaments/tournament-submission-form.tsx"),
      "utf8",
    );
    expect(form).toContain("if (busy.current || uploading || disabled || receipt) return");
    expect(form).toContain("if (!review)");
    expect(form).toContain("const signature = JSON.stringify([...data.entries()])");
    expect(form).toContain('data.set("requestId", request.current.id)');
    expect(form).toContain("Your draft is retained");
  });

  it("does not offer entry or submission actions once an event is completed", () => {
    expect(source).toContain('if (tournamentStatus(data.tournament) === "Completed")');
    expect(source).toContain('data.viewerEntered ? "Open result" : "View result"');
    expect(source).toContain("Submissions are closed");
    expect(source).toContain("const eventCompleted");
    expect(source).toContain('eventCompleted\n          ? ("upcoming" as const)');
  });

  it("keeps the current result, full standings and eligible next action available", () => {
    expect(source).toContain("<TournamentPrimaryAction");
    expect(source).toContain("viewerStanding");
    expect(source).toContain("<TournamentStandingsTable");
    expect(source).toContain("rows={visibleStandings}");
    expect(source).toContain(
      "hasCurrentTournamentEntryTermsMetadata(data.viewerEntry.metadataJson)",
    );
    expect(source).toContain("data.viewerEntered &&");
    expect(source).toContain("viewerTermsCurrent &&");
    expect(source).toContain("!!data.nextRoundNumber &&");
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
