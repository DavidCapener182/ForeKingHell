import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/rounds/page.tsx"), "utf8");
const indexSource = readFileSync(
  join(process.cwd(), "src/app/rounds/rounds-scoring-index.tsx"),
  "utf8",
);

describe("rounds scoring index", () => {
  it("uses surface-specific chronological scoring lists", () => {
    expect(pageSource).toContain("getRequestAppSurface()");
    expect(pageSource).toContain("<RoundsScoringIndex rounds={indexRounds} />");
    expect(pageSource).toContain("<RoundsMobileList rounds={indexRounds} />");
    expect(pageSource).toContain("data-rounds-workbench");
    expect(pageSource).toContain("<MobileLargeTitle");
    expect(pageSource).not.toContain("RoundsHero");
    expect(pageSource).not.toContain("RoundTasks");
    expect(pageSource).not.toContain("RoundOpportunityFeaturePanel");
  });

  it("includes the requested chronological round fields", () => {
    for (const label of [
      "Date",
      "Course",
      "Tee",
      "Score",
      "To par",
      "Handicap impact",
      "Main verdict",
    ]) {
      expect(indexSource).toContain(`>${label}<`);
    }

    expect(pageSource).toContain("teeName: teeSets.name");
    expect(pageSource).toContain("handicapImpactForRound");
    expect(pageSource).toContain("mainRoundVerdict");
  });

  it("puts one compact scoring trend above the list without a metric-card wall", () => {
    expect(indexSource).toContain("<ScoringTrend rounds={rounds} />");
    expect(indexSource).toContain("data-scoring-trend");
    expect(indexSource).toContain("Lower bars are better");
    expect(indexSource).not.toContain("@/components/ui/card");
  });
});
