import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const training = readSource("src/lib/training/trainingData.ts");
const reality = readSource("src/lib/reality-handicap.ts");
const distanceLoss = readSource("src/lib/distance-loss-diagnosis-data.ts");
const shotPatterns = readSource("src/lib/shot-patterns.ts");
const sessionImpactPage = readSource("src/app/(app)/analyse/session-impact/page.tsx");
const goals = readSource("src/app/(app)/goals/page.tsx");
const speedTraining = readSource("src/lib/speed-training-data.ts");

const lifecycleSqlConsumers = [
  training,
  reality,
  distanceLoss,
  shotPatterns,
  sessionImpactPage,
  goals,
  speedTraining,
];

describe("training and diagnostics lifecycle source contracts", () => {
  it("enforces included/restored lifecycle state with restored legacy-tag precedence", () => {
    for (const source of lifecycleSqlConsumers) {
      expect(source).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
      expect(source).toContain('eq(shots.reviewStatus, "restored")');
      expect(source).toContain('eq(shots.reviewStatus, "included")');
      expect(source).toContain("coalesce(${shots.qualityTag}, '')");
      expect(source).toContain("coalesce(${shots.shotCategory}, '')");
      expect(source).toContain("not like 'exclude%'");
    }
  });

  it("filters lifecycle evidence before bounded diagnostic result sets", () => {
    expect(reality.indexOf("shotEvidenceSqlPredicate()")).toBeLessThan(
      reality.indexOf(".limit(MAX_REALITY_SHOTS)"),
    );
    expect(shotPatterns.indexOf("shotEvidenceSqlPredicate()")).toBeLessThan(
      shotPatterns.indexOf(".limit(limit)"),
    );

    const sessionShotQuery = sessionImpactPage.slice(sessionImpactPage.indexOf("const rows ="));
    expect(sessionShotQuery.indexOf("shotEvidenceSqlPredicate()")).toBeLessThan(
      sessionShotQuery.indexOf(".limit(5_000)"),
    );
    expect(speedTraining.indexOf("shotEvidenceSqlPredicate()")).toBeLessThan(
      speedTraining.indexOf(".limit(80)"),
    );
  });

  it("keeps lifecycle state in projections used by in-memory evidence guards", () => {
    expect(training).toContain("reviewStatus: shots.reviewStatus");
    expect(training).toContain("rows.filter(isShotEvidenceEligible)");
    expect(reality).toContain("reviewStatus: shots.reviewStatus");
    expect(reality).toContain("inputShots.filter(isShotEvidenceEligible)");
    expect(distanceLoss).toContain("reviewStatus: shots.reviewStatus");
    expect(distanceLoss).toContain("distanceLossRows.filter(isShotEvidenceEligible)");
    expect(shotPatterns).toContain("reviewStatus: shots.reviewStatus");
    expect(shotPatterns).toContain("isShotEvidenceEligible(shot)");
    expect(sessionImpactPage).toContain("reviewStatus: shots.reviewStatus");
  });

  it("uses lifecycle-eligible shots for weekly goal volume", () => {
    const weeklyShotQuery = goals.slice(goals.indexOf(".select({ total: count(shots.id) })"));
    expect(weeklyShotQuery).toContain("shotEvidenceSqlPredicate()");
  });
});
