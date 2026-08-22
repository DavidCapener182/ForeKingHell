import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function expectPredicateBeforeLimit(consumer: string, startMarker: string, limitMarker: string) {
  const start = consumer.indexOf(startMarker);
  const limit = consumer.indexOf(limitMarker, start);
  const predicate = consumer.indexOf("shotEvidenceSqlPredicate()", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(limit).toBeGreaterThan(start);
  expect(predicate).toBeGreaterThan(start);
  expect(predicate).toBeLessThan(limit);
}

describe("course, coaching and import lifecycle evidence boundaries", () => {
  it.each([
    "src/lib/course-twin-data.ts",
    "src/lib/coach-sql-context.ts",
    "src/lib/ai/user-data-chat-context.ts",
    "src/lib/feature-ideas.ts",
    "src/app/rapsodo/actions.ts",
  ])("uses the effective lifecycle SQL predicate in %s", (path) => {
    const consumer = source(path);

    expect(consumer).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(consumer).toContain('eq(shots.reviewStatus, "restored")');
    expect(consumer).toContain('eq(shots.reviewStatus, "included")');
    expect(consumer).toContain(
      "lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'",
    );
    expect(consumer).toContain("lower(trim(coalesce(${shots.qualityTag}, ''))) not in");
    expect(consumer).toContain("lower(trim(coalesce(${shots.shotCategory}, ''))) not in");
  });

  it("filters Course Twin replay selection and recent shape evidence", () => {
    const data = source("src/lib/course-twin-data.ts");
    const selector = source("src/lib/course-twin-recent-shots.ts");

    expectPredicateBeforeLimit(data, "const [session] = await db", ".limit(1)");
    expectPredicateBeforeLimit(data, "const recentShotCutoff", ".limit(2_000)");
    expect(data).toContain("loadedShotRows.filter(isShotEvidenceEligible)");
    expect(selector).toContain("if (!isShotEvidenceEligible(shot)) return false");
  });

  it("filters both coach shot samples before their limits and again in memory", () => {
    const coach = source("src/lib/coach-sql-context.ts");

    expectPredicateBeforeLimit(coach, "id: shots.id", ".limit(40)");
    const driverStart = coach.indexOf(
      "shotAt: shots.shotAt,\n        clubSpeedMph: shots.clubSpeedMph",
    );
    const driverPredicate = coach.indexOf("shotEvidenceSqlPredicate()", driverStart);
    expect(driverStart).toBeGreaterThanOrEqual(0);
    expect(driverPredicate).toBeGreaterThan(driverStart);
    expect(coach).toContain("recentShotRows.filter(isShotEvidenceEligible)");
    expect(coach).toContain("driverSpeedRows.filter(isShotEvidenceEligible)");
    expect(coach).toContain('eq(speedTrainingSessions.handedness, "dominant")');
    expect(coach).toContain('eq(speedTrainingSessions.implementKind, "club")');
    expect(coach).toContain('eq(clubs.type, "driver")');
    expect(coach).toContain("latestDriverSpeedRows[0]?.avgSpeedMph");
  });

  it("filters AI, feature-idea and Rapsodo inference samples before limits", () => {
    const ai = source("src/lib/ai/user-data-chat-context.ts");
    const features = source("src/lib/feature-ideas.ts");
    const rapsodo = source("src/app/rapsodo/actions.ts");

    expectPredicateBeforeLimit(ai, 'scopes.has("shots")', ".limit(120)");
    expectPredicateBeforeLimit(features, "loadedShotRows,", ".limit(FEATURE_SHOT_SAMPLE_LIMIT)");
    expectPredicateBeforeLimit(
      rapsodo,
      "const loadedRecentShotRows = await db",
      ".limit(RAPSODO_BAG_SHOT_SAMPLE_LIMIT)",
    );
    expect(ai).toContain("recentShotRows.filter(isShotEvidenceEligible)");
    expect(features).toContain("loadedShotRows.filter(isShotEvidenceEligible)");
    expect(rapsodo).toContain("loadedRecentShotRows.filter(isShotEvidenceEligible)");
  });
});
