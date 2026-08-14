import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = readFileSync(join(root, "src/app/share/[token]/page.tsx"), "utf8");
const companion = readFileSync(
  join(root, "src/app/share/[token]/shared-round-companion.tsx"),
  "utf8",
);
const workbench = readFileSync(
  join(root, "src/app/share/[token]/shared-round-workbench.tsx"),
  "utf8",
);

describe("shared round request-surface composition", () => {
  it("chooses exactly one isolated presentation graph after resolving the request surface", () => {
    expect(source).toContain("getRequestAppSurface()");
    expect(source).toContain('surface === "companion"');
    expect(source.match(/import\("\.\/shared-round-companion"\)/g)).toHaveLength(1);
    expect(source.match(/import\("\.\/shared-round-workbench"\)/g)).toHaveLength(1);
    expect(source.indexOf("getRequestAppSurface()")).toBeLessThan(
      source.indexOf('import("./shared-round-companion")'),
    );
    expect(source).not.toContain("MobileSharedRound");
    expect(source).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("IOSDisclosureGroup");
    expect(source).not.toContain('from "@/components/');
    expect(source).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);
  });

  it("keeps the public companion scorecard and privacy journey in its own graph", () => {
    expect(companion).toContain("MobileSharedRound");
    expect(companion).toContain("MobileSharedHoleRows");
    expect(companion).toContain("IOSDisclosureGroup");
    expect(companion).toContain("ios-public-auth");
    expect(companion).toContain("Shot data and private account details are not exposed");
    expect(companion).not.toContain("DesktopTableWorkbenchControls");
    expect(companion).not.toContain('from "@/components/ui/table"');
    expect(companion).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);
  });

  it("keeps the complete scorecard workbench visible for an explicit phone choice", () => {
    expect(workbench).toContain("data-desktop-shared-round");
    expect(workbench).toContain('className="grid gap-6"');
    expect(workbench).toContain("DesktopTableWorkbenchControls");
    expect(workbench).toContain("sharedScorecardColumns");
    expect(workbench).toContain("sharedScorecardSuggestedViews(token)");
    expect(workbench).toContain('viewKey="shared-scorecard"');
    expect(workbench).toContain('scope="shared-scorecard"');
    expect(workbench).toContain('exportTableId="shared-scorecard"');
    expect(workbench).toContain('exportFileName="forekinghell-shared-scorecard.csv"');
    expect(workbench).toContain("TableCaption");
    expect(workbench).toContain("mainTable");
    expect(workbench).toContain('mainTableLabel="Shared scorecard table"');
    expect(workbench).toContain("stickyFirstColumn");
    expect(workbench).toContain('id="shared-scorecard"');
    expect(workbench).toContain('aria-describedby="shared-scorecard-summary"');
    expect(workbench).toContain('id="shared-scorecard-summary"');
    expect(workbench).toContain('data-workbench-scope="shared-scorecard"');
    expect(workbench).toContain('data-workbench-export-table="shared-scorecard"');
    expect(workbench).toContain("Shared round scorecard");
    expect(workbench).toContain("sticky left-0 z-20");
    expect(workbench).toContain("tabIndex={0}");
    expect(workbench).toContain("focus-aaa outline-none");
    expect(workbench).not.toContain("MobileSharedRound");
    expect(workbench).not.toContain("IOSDisclosureGroup");
    expect(workbench).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);

    for (const column of ["hole", "par", "yards", "score", "putts", "penalties", "fir", "gir"]) {
      expect(workbench).toContain(`data-column="${column}"`);
    }
  });

  it("preserves the private round query, scorecard totals and semantic theme chrome", () => {
    expect(source).toContain("hashShareToken(token)");
    expect(source).toContain('eq(shareLinks.resourceType, "round")');
    expect(source).toContain("isNull(shareLinks.revokedAt)");
    expect(source).toContain("gt(shareLinks.expiresAt, now)");
    expect(source).toContain("eq(sessions.id, link.resourceId)");
    expect(source).toContain("eq(sessions.userId, link.userId)");
    expect(source).toContain("calculateRoundDifferential");
    expect(source).toContain("scorecardJson: sessions.scorecardJson");
    expect(companion).toContain("formatHandicapValue(round.handicapDifferential)");
    expect(workbench).toContain("formatHandicapValue(round.handicapDifferential)");
    expect(workbench).toContain("[&_th]:bg-muted");
    expect(workbench).toContain("min-w-28 bg-muted");
    expect(workbench).toContain("min-w-28 bg-card");
    expect(workbench).toContain("color-mix(in_srgb,var(--border)_72%,transparent)");
    expect(workbench).toContain("bg-muted/55");
    expect(workbench).not.toMatch(/\bbg-white(?:\/\d+)?\b/);
    expect(workbench).not.toContain("rgba(15,23,42,0.08)");
  });
});
