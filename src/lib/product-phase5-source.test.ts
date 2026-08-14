import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase 5 product-page contract", () => {
  it("keeps Today focused on the latest evidence, next action and reversible review controls", () => {
    const today = source("src/app/(app)/today/today-workbench-page.tsx");
    const companion = source("src/app/(app)/today/today-companion-page.tsx");
    const primaryAnswer = source("src/components/app/today-primary-answer.tsx");

    expect(companion).toContain("TodayPrimaryAnswer");
    expect(primaryAnswer).toContain("data-primary-recommendation");
    expect(companion).toContain("Plan range session");
    expect(companion).toContain("Why this recommendation?");
    expect(companion).not.toContain("TodayMobileEvidence");
    expect(today).toContain("TodayDesktopFilterBar");
    expect(today).toContain("<ToggleGroup");
    expect(today).toContain("Trusted shots");
    expect(today).toContain("All imported");
    expect(today).toContain("Simulate outlier exclusions");
    expect(today).toContain("Data cleaning impact");
  });

  it("keeps the desktop-only Shot Explorer compact, URL-filtered and progressively disclosed", () => {
    const shots = source("src/app/(app)/shots/page.tsx");
    const filters = source("src/app/shots/shot-filter-toolbar.tsx");

    expect(shots).toContain("ShotFilterToolbar");
    expect(filters).toContain("DataToolbar");
    expect(filters).toContain("ResponsiveFilterPanel");
    expect(shots).toContain("SavedShotViewsPanel");
    expect(shots).toContain("ShotsMasterDetailTable");
    expect(filters).toContain("Group by club");
    expect(filters).toContain("Group by session");
    expect(filters).toContain("params.set(key, value)");
    expect(shots).not.toContain("MobileFilterSheet");
  });

  it("keeps Bag centred on stock, dependable ranges, gapping and sample trust", () => {
    const bag = source("src/app/(app)/bag/page.tsx");

    expect(bag).toContain("Bag confidence ladder");
    expect(bag).toContain("Full bag gapping");
    expect(bag).toContain("stock carry");
    expect(bag).toContain("latestReliableCarryP25Yd");
    expect(bag).toContain("latestReliableCarryP75Yd");
    expect(bag).toContain("personal best");
    expect(bag).toContain("sample size");
  });

  it("requires Coach recommendations to expose evidence and success criteria", () => {
    const coach = source("src/app/(app)/coach/page.tsx");

    for (const label of [
      "Observation",
      "Evidence",
      "Confidence",
      "Why it matters",
      "Suggested drill",
      "Success measure",
      "Reassess when",
    ]) {
      expect(coach).toContain(`label: "${label}"`);
    }
    expect(coach).not.toContain('label="Expected gain"');
  });

  it("separates progress dimensions and does not equate volume with improvement", () => {
    const progress = source("src/app/(app)/progress/page.tsx");

    for (const [value, label] of [
      ["performance", "Performance"],
      ["goals", "Goals"],
      ["load", "Training load"],
      ["timeline", "Timeline"],
    ]) {
      expect(progress).toContain(`<TabsTrigger value="${value}">${label}</TabsTrigger>`);
    }
    expect(progress).not.toContain('label: "Training volume"');
  });

  it("labels Handicap as unofficial and explains eligibility failures", () => {
    const handicap = source("src/app/(app)/handicap/page.tsx");
    const calculations = source("src/lib/round-handicap.ts");

    expect(handicap).toContain("not an official Handicap Index");
    expect(handicap).toContain("Eligible with defaults");
    expect(handicap).toContain("Needs 9 or 18 holes");
    expect(handicap).toContain("hole score");
    expect(calculations).toContain('typeof input.holesPlayed === "number"');
  });

  it("keeps social secondary, proof-labelled and privacy-aware", () => {
    const feed = source("src/app/(app)/feed/page.tsx");
    const feedCards = source("src/components/social/feed-card-list.tsx");
    const today = source("src/app/(app)/today/today-workbench-page.tsx");
    const companion = source("src/app/(app)/today/today-companion-page.tsx");

    expect(feed).toContain("StatusUpdateComposerSheet");
    expect(feed).toContain("Privacy state");
    expect(feed).toContain("data.profile.feedVisibilityDefault");
    expect(feed).toContain("<FeedCardList items={filteredItems} />");
    expect(feed).not.toContain("FeedActivityLedger");
    expect(feedCards).toContain("item.verificationLabel");
    expect(feedCards).toContain("item.visibility");
    expect(today).toContain("Social comparison is on demand");
    expect(companion).not.toContain("getChallengesPageData");
  });
});
