import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/challenges/page.tsx"), "utf8");
const challengeDataSource = readFileSync(join(process.cwd(), "src/lib/challenges.ts"), "utf8");

describe("challenge progression hub", () => {
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
    expect(source).not.toContain('className="hidden lg:contents"');
  });

  it("uses exactly the active, available and completed progression tabs", () => {
    expect(source).toContain('{ key: "active", label: "Active", href: "/challenges" }');
    expect(source).toContain(
      '{ key: "available", label: "Available", href: "/challenges?tab=available" }',
    );
    expect(source).toContain(
      '{ key: "completed", label: "Completed", href: "/challenges?tab=completed" }',
    );
    expect(source).not.toContain('label: "Seasons"');
    expect(source).not.toContain('label: "Templates"');
    expect(source).toContain('aria-label="Challenge status"');
    expect(source).toContain('aria-current={activeTab === tab.key ? "page" : undefined}');
  });

  it("makes active progress and the next attempt the primary hierarchy", () => {
    expect(source).toContain("data-active-challenge-card");
    expect(source).toContain("aria-label={`${challenge.title} progress`}");
    expect(source).toContain("h-4 bg-background/80");
    expect(source).toContain("Current value");
    expect(source).toContain("Time remaining");
    expect(source).toContain("Best attempt");
    expect(source).toContain("Next useful action");
    expect(source).toContain("nextChallengeAction(challenge)");
    expect(source).toContain("Attempts timeline");
  });

  it("keeps available cards compact and defers rules to a sheet", () => {
    expect(source).toContain("data-available-challenge-tile");
    expect(source).toContain('label="Evidence"');
    expect(source).toContain('label="Achievement"');
    expect(source).toContain("<RulesSheet challenge={challenge} />");
    expect(source).toContain("<SheetContent");
    expect(source).toContain("challenge.rulesBullets.map");
    expect(source).toContain("joinChallengeAction");
  });

  it("renders completed challenges as achievement cards", () => {
    expect(source).toContain("data-completed-challenge-card");
    expect(source).toContain("Achievement cabinet");
    expect(source).toContain("Challenge achievement");
    expect(source).toContain("Finished #");
    expect(source).toContain("viewerScoreLabel");
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

describe("challenge progression mobile", () => {
  it("puts the current active challenge before every secondary item", () => {
    expect(source).toContain("const [current, ...remaining] = challenges;");
    expect(source).toContain("<ActiveChallengeCard challenge={current} featured />");
    expect(source).toContain("remaining.map");
    expect(source).toContain("Current challenge");
    expect(source).toContain("Also in progress");
  });

  it("keeps the mobile composition active until the desktop surface takes over", () => {
    expect(source).toContain("<MobileAppShell>");
    expect(source).toContain("<MobileTabBar");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden sm:contents"');
  });
});
