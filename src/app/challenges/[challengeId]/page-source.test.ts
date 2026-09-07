import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/challenges/[challengeId]/page.tsx"),
  "utf8",
);

describe("challenge detail desktop route", () => {
  it("preserves section drafts and history in one challenge detail", () => {
    const sections = readFileSync(
      join(process.cwd(), "src/app/challenges/challenge-detail-sections.tsx"),
      "utf8",
    );
    expect(source).toContain("<ChallengeDetailSections");
    expect(sections).toContain("keepMounted");
    expect(sections).toContain('window.addEventListener("popstate", onPop)');
    expect(sections).toContain('tab === "shots" ? "attempts"');
    expect(sections).toContain('url.searchParams.set("tab", key)');
    expect(source.match(/<PageShell>/g)).toHaveLength(1);
  });

  it("uses semantic theme tokens for detail cards, controls and sticky tables", () => {
    expect(source).toContain("bg-muted");
    expect(source).toContain("bg-card");
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

  it("keeps complete standings, attempts and a creator-only reviewed invitation", () => {
    const invite = readFileSync(
      join(process.cwd(), "src/app/challenges/challenge-invite-review.tsx"),
      "utf8",
    );
    expect(source).toContain("<ChallengeLeaderboardTable");
    expect(source).toContain('id: "attempts", label: "Attempts", content: attempts');
    expect(source).toContain("c.creatorUserId === data.viewerUserId");
    expect(source).toContain("<ChallengeInviteReview");
    expect(source).toContain("challengeId={c.id}");
    expect(source).toContain("friends={data.friendOptions}");
    expect(source).toContain("disabled={closed}");
    expect(invite).toContain("friends.find((item) => item.userId === selected)");
    expect(invite).toContain('data.set("challengeId", challengeId)');
    expect(invite).toContain('data.set("inviteeUserId", friend.userId)');
    expect(invite).toContain("Send reviewed invitation");
  });
});
