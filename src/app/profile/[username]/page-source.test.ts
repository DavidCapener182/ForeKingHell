import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/profile/[username]/page.tsx"),
  "utf8",
);

describe("public profile desktop route", () => {
  it("keeps public profiles as privacy-aware desktop tables without an AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="public-profile" className="hidden lg:grid">',
    );
    expect(source).toContain('aria-label="Public profile summary"');
    expect(source).toContain('aria-label="Public profile stats rail"');
    expect(source).toContain('data-workbench-scope="profile-activity"');
    expect(source).toContain('data-workbench-export-table="profile-activity-ledger"');
    expect(source).toContain('mainTableLabel="Profile activity ledger table"');
    expect(source).toContain('mainTableLabel="Profile activity ledger table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="profile-bag-comparison"');
    expect(source).toContain('data-workbench-export-table="profile-bag-comparison"');
    expect(source).toContain('label="Profile visible bag comparison table" stickyFirstColumn');
    expect(source).toContain("Privacy-filtered activity");
    expect(source).toContain("Bag numbers are private or do not have enough trusted shots yet.");
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain('<PageShell size="6xl">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("uses a native mobile profile summary with activity first and bag detail disclosed", () => {
    expect(source).toContain("<MobileAppShell>");
    expect(source).toContain("MobilePublicProfileSummary");
    expect(source).toContain("MobileProfileActivity");
    expect(source).toContain("MobileProfileDetails");
    expect(source).toContain("data.recentFeed.slice(0, mobileProfileActivityLimit)");
    expect(source).toContain("IOSDisclosureGroup");
  });
});
