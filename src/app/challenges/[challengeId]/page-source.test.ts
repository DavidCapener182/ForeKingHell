import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/challenges/[challengeId]/page.tsx"),
  "utf8",
);

describe("challenge detail desktop route", () => {
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
      '<DesktopWorkbenchLayout scope="challenge-detail" className="hidden',
    );
  });

  it("uses semantic theme tokens for detail cards, controls and sticky tables", () => {
    expect(source).toContain("bg-muted");
    expect(source).toContain("bg-card");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose|sky)-\d+/,
    );
  });

  it("renders server-authored rules in the persistent detail sections", () => {
    expect(source).toContain("<ChallengeDetailSections");
    expect(source).toContain('id: "rules"');
    expect(source).toContain("{c.rulesSummary}");
    expect(source).toContain("c.rulesBullets.map");
    expect(source).toContain('c.scoringDirection === "asc" ? "Lower" : "Higher"');
    const sections = readFileSync(
      join(process.cwd(), "src/app/challenges/challenge-detail-sections.tsx"),
      "utf8",
    );
    expect(sections).toContain("keepMounted");
    expect(sections).toContain("items={items}");
  });

  it("keeps the leaderboard exportable and presents attempts as a timeline", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("<ChallengeDetailSections");
    expect(source).toContain('data-workbench-scope="challenge-leaderboard"');
    expect(source).toContain('data-workbench-export-table="challenge-leaderboard"');
    expect(source).toContain('mainTableLabel="Challenge leaderboard table"');
    expect(source).toContain('mainTableLabel="Challenge leaderboard table" stickyFirstColumn');
    expect(source).toContain('id: "attempts"');
    expect(source).toContain("Qualifying attempt ledger");
    expect(source).toContain(
      ".sort((a, b) => a.attempt.attemptedAt.getTime() - b.attempt.attemptedAt.getTime())",
    );
    expect(source).toContain("attemptMetadataLabel(attempt.metadataJson)");
    expect(source).toContain("attempt.userId === data.viewerUserId && attempt.sourceId");
    expect(source).toContain("href={`/sessions/${attempt.sourceId}`}");
    expect(source).not.toContain('data-workbench-scope="challenge-attempts"');
    expect(source).not.toContain('data-workbench-export-table="challenge-attempts"');
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps a complete mobile board, attempt timeline and invite flow", () => {
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain('label="Full challenge leaderboard"');
    expect(source).toContain("data.results.map");
    expect(source).toContain("ChallengeInviteSheet");
    expect(source).toContain('title="Invite to this challenge"');
    expect(source).toContain('label: "Attempts"');
    expect(source).toContain('title="Attempt timeline"');
    expect(source).toContain('label="Challenge attempt timeline"');
    expect(source).not.toContain(
      '<DesktopWorkbenchLayout scope="challenge-detail" className="hidden',
    );
    expect(source).not.toContain('className="hidden sm:grid"');
    expect(source).not.toContain("viewAllHref={`/challenges/${data.challenge.id}#board`}");
  });
});
