import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isShotEvidenceEligible } from "@/lib/shot-review";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("safe lifecycle selectors", () => {
  it("keeps raw session counts while filtering pattern-point evidence", () => {
    const history = source("src/lib/session-history.ts");

    expect(history).toContain("shotCount: sql<number>`count(${shots.id})::int`");
    expect(history).toContain("reviewStatus: shots.reviewStatus");
    expect(history).toContain("shotCategory: shots.shotCategory");
    expect(history).toContain("shotRows.filter(isShotEvidenceEligible)");
  });

  it("keeps raw activation import completion separate from eligible trust", () => {
    const activation = source("src/lib/activation-journey.ts");

    expect(activation).toContain("raw: count()");
    expect(activation).toContain("count(*) filter (where ${shotEvidenceSqlPredicate()})");
    expect(activation).toContain("sessionTotal > 0 && rawShotTotal > 0");
    expect(activation).toContain("hasClubs && eligibleShotTotal >= 12");
    expect(activation).toContain('eq(shots.reviewStatus, "restored")');
    expect(activation).toContain('eq(shots.reviewStatus, "included")');
  });

  it.each([
    "suggested_exclusion",
    "user_excluded",
    "calibration",
    "warm_up",
    "launch_monitor_error",
  ] as const)("rejects %s from derived selector evidence", (reviewStatus) => {
    expect(isShotEvidenceEligible({ reviewStatus })).toBe(false);
  });

  it("lets an explicit restoration override a legacy exclusion tag", () => {
    expect(isShotEvidenceEligible({ reviewStatus: "restored", qualityTag: "mishit" })).toBe(true);
  });

  it.each([
    "scripts/backfill-practice-achievements.mjs",
    "scripts/backfill-training-over-time.mjs",
  ])("uses the effective lifecycle rule in %s", (path) => {
    const script = source(path);

    expect(script).toContain("coalesce(");
    expect(script).toContain("review_status");
    expect(script).toContain("= 'restored'");
    expect(script).toContain("= 'included'");
    expect(script).toContain("not like 'exclude%'");
    expect(script).toContain("'launch-monitor-error'");
    expect(script).toContain("'mishit'");
    expect(script).toContain("shot_category");
  });
});
