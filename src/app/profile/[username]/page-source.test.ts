import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/profile/[username]/page.tsx"),
  "utf8",
);

const bag = readFileSync(join(process.cwd(), "src/app/profile/public-profile-bag.tsx"), "utf8");

describe("public profile desktop route", () => {
  it("keeps public profiles as privacy-aware desktop tables without an AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain('await import("@/components/app/desktop-workbench")');
    expect(source).toContain("<PeopleActionMenu");
    expect(source).toContain('aria-label="Public profile stats rail"');
    expect(source).toContain('data-workbench-scope="profile-activity"');
    expect(source).toContain('data-workbench-export-table="profile-activity-ledger"');
    expect(source).toContain('mainTableLabel="Profile activity ledger table"');
    expect(source).toContain('mainTableLabel="Profile activity ledger table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="profile-bag-comparison"');
    expect(bag).toContain('data-workbench-export-table="profile-bag-comparison"');
    expect(source).toContain("Privacy-filtered activity");
    expect(bag).toContain(
      "No bag distances shared or available. This is not a zero-distance result.",
    );
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain('<PageShell size="6xl">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("labels unavailable statistics and the self-selected handicap band", () => {
    expect(source).toContain("Only profile-approved summary data appears here");
    expect(source).toContain("Not shared or unavailable");
    expect(source).toContain('detail: "Self-selected"');
    expect(source).toContain("data.stats.rounds");
    expect(source).toContain("data.stats.handicapBand");
  });

  it("keeps permitted activity ahead of responsive bag evidence", () => {
    expect(source.indexOf("data-profile-recent-feed")).toBeLessThan(
      source.indexOf("<PublicProfileBagComparison"),
    );
    expect(source).toContain("<PublicProfileBag rows={rows}");
    expect(bag).toContain("className={styles.mobile}");
    expect(bag).toContain("className={styles.desktop}");
    expect(bag).toContain("Permitted stock bag summaries only; no raw shots or session details");
  });

  it("keeps compact recent-feed cards out of an outer DataPanel card", () => {
    const feedStart = source.indexOf("data-profile-recent-feed");
    const feedEnd = source.indexOf("</section>", feedStart);

    expect(feedStart).toBeGreaterThan(0);
    expect(feedEnd).toBeGreaterThan(feedStart);

    const recentFeedSection = source.slice(feedStart, feedEnd);
    expect(recentFeedSection).toContain("Recent feed");
    expect(recentFeedSection).toContain("<FeedCardList items={data.recentFeed} compact />");
    expect(recentFeedSection).not.toContain("<DataPanel>");
    expect(recentFeedSection).not.toContain("<CardContent>");
    expect(recentFeedSection).not.toContain("<SectionHeader");
  });
});
