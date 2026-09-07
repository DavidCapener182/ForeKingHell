import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/challenges/page.tsx"), "utf8");
const challengeDataSource = readFileSync(join(process.cwd(), "src/lib/challenges.ts"), "utf8");

const workspace = readFileSync(
  join(process.cwd(), "src/app/challenges/challenge-workspace.tsx"),
  "utf8",
);
describe("challenge progression hub", () => {
  it("uses one responsive workspace with URL-selected state", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("<ChallengeWorkspace");
    expect(source).toContain('initialTab={params?.tab ?? "active"}');
    expect(workspace).toContain("<UntitledTabs");
    expect(workspace).toContain('label="Challenge status"');
    expect(workspace).toContain('url.searchParams.set("tab", tab)');
    expect(workspace).toContain("key === active");
  });
  it("separates joined progress from open entry and closed history", () => {
    expect(workspace).toContain("active: challenges.filter((c) => c.viewerJoined && !finished(c))");
    expect(workspace).toContain('!c.viewerJoined && c.status === "open" && !finished(c)');
    expect(workspace).toContain('!c.viewerJoined && (c.status !== "open" || finished(c))');
    expect(workspace).toContain("c.viewerJoined && finished(c)");
    expect(workspace).toContain("Closed to entry");
  });
  it("shows qualifying progress and the next measured action", () => {
    expect(workspace).toContain("<progress");
    expect(workspace).toContain("htmlFor={`evidence-${c.id}`}");
    expect(workspace).toContain("c.viewerEvidenceCount");
    expect(workspace).toContain("c.evidenceTargetCount");
    expect(workspace).toContain("href={`/import?challengeId=${c.id}`}");
    expect(workspace).toContain("View attempts and evidence");
  });
  it("keeps rules inspectable and closed entries unavailable", () => {
    expect(workspace).toContain("<ResponsiveDetailPanel");
    expect(workspace).toContain("rules.rulesBullets.map");
    expect(workspace).toContain("rules.evidenceRequirement");
    expect(workspace).toContain("joinChallengeAction(data)");
    expect(workspace).toContain('finished(challenge) || challenge.status !== "open"');
    expect(workspace).toContain("disabled={unavailable || pending || !ready}");
  });
  it("distinguishes recorded outcomes from provisional rank and participation", () => {
    expect(workspace).toContain("Recorded result after close");
    expect(workspace).toContain("Provisional rank");
    expect(workspace).toContain("c.viewerScoreLabel");
    expect(workspace).toContain("c.viewerVerificationLabel");
    expect(workspace).toContain("A joined entry is not a completed result");
  });
  it("uses verified imported evidence for progress fields", () => {
    for (const field of [
      "viewerScoreLabel",
      "viewerVerificationLabel",
      "viewerEvidenceCount",
      "evidenceTargetCount",
      "evidenceRequirement",
      "rulesBullets",
    ]) {
      expect(challengeDataSource).toContain(field);
    }
    expect(challengeDataSource).toContain(
      "const viewerEvidenceCount = evidenceCounts.get(viewerUserId) ?? 0",
    );
    expect(challengeDataSource).toContain("const evidenceCounts = new Map<string, number>()");
    expect(challengeDataSource).toContain("eligibleRows.length");
  });
});
