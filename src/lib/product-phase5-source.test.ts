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
    const primaryState = source("src/lib/today-primary-state.ts");

    expect(companion).toContain("TodayPrimaryAnswer");
    expect(primaryAnswer).toContain("data-primary-recommendation");
    expect(companion).toContain("resolveTodayPrimaryState");
    expect(primaryState).toContain("Plan range session");
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
    expect(filters).toContain("ClubCombobox");
    expect(filters).toContain("<Sheet");
    expect(shots).toContain("DesktopTableWorkbenchControls");
    expect(shots).toContain("ShotsMasterDetailTable");
    expect(filters).toContain('<SelectItem value="club">Club</SelectItem>');
    expect(filters).toContain('<SelectItem value="session">Session</SelectItem>');
    expect(filters).toContain('params.set("trust", filters.trust)');
    expect(shots).not.toContain("MobileFilterSheet");
  });

  it("keeps Bag centred on stock, dependable ranges, gapping and sample trust", () => {
    const bag = source("src/app/(app)/bag/page.tsx");

    expect(bag).toContain("function BagConfidenceLadder");
    expect(bag).toContain("data-bag-distance-ladder");
    expect(bag).toContain("Full bag gapping");
    expect(bag).toContain("stock carry");
    expect(bag).toContain("latestReliableCarryP25Yd");
    expect(bag).toContain("latestReliableCarryP75Yd");
    expect(bag).toContain("personal best");
    expect(bag).toContain("sample size");
  });

  it("requires Coach recommendations to expose evidence and success criteria", () => {
    const coach = source("src/app/(app)/coach/page.tsx");

    expect(coach).toContain("data-primary-diagnosis");
    for (const label of ["What I see", "Why it matters", "Confidence", "Next action"]) {
      expect(coach).toContain(`label="${label}"`);
    }
    expect(coach).toContain("Supporting evidence");
    expect(coach).toContain('practiceHref("latest_weakness")');
    expect(coach).toContain("topClub.drill");
    expect(coach).not.toContain('label="Expected gain"');
  });

  it("separates progress dimensions and does not equate volume with improvement", () => {
    const progress = source("src/app/(app)/progress/page.tsx");

    for (const [value, label] of [
      ["performance", "Performance"],
      ["goals", "Goals"],
      ["load", "Load"],
      ["timeline", "Timeline"],
    ]) {
      expect(progress).toContain(`<TabsTrigger value="${value}"`);
      expect(progress).toMatch(
        new RegExp(`<TabsTrigger value="${value}"[\\s\\S]*?>\\s*${label}\\s*</TabsTrigger>`),
      );
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
    expect(feed).toContain("data.profile.feedVisibilityDefault");
    expect(feed).toContain("<FeedCardList items={filteredItems} />");
    expect(feed).not.toContain("FeedActivityLedger");
    expect(feedCards).toContain("item.verificationLabel");
    expect(feedCards).toContain("item.visibility");
    expect(feedCards).toContain("VisibilityIcon");
    expect(today).toContain("Social comparison is on demand");
    expect(companion).not.toContain("getChallengesPageData");
  });
});
