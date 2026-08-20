import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("secondary analytics shot lifecycle boundaries", () => {
  it("filters simulator lab queries and every in-memory derived builder", () => {
    const source = readSource("src/lib/simulator-lab.ts");

    expect(source).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(source).toContain('eq(shots.reviewStatus, "restored")');
    expect(source).toContain("return rows.filter(isShotEvidenceEligible)");
    expect(source.match(/filter\(isShotEvidenceEligible\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("filters conditions, post-round strategy and Quick Bag evidence at query and legacy layers", () => {
    const conditions = readSource("src/app/(app)/analyse/conditions/page.tsx");
    const strategy = readSource(
      "src/app/(app)/courses/strategy/course-strategy-workbench-page.tsx",
    );
    const quickBag = readSource("src/app/(app)/quick-bag/page.tsx");

    expect(conditions).toContain("shotEvidenceSqlPredicate()");
    expect(conditions).toContain("rows.filter(isShotEvidenceEligible)");
    expect(conditions).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(conditions).toContain('eq(shots.reviewStatus, "restored")');

    expect(strategy).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(strategy).toContain('eq(shots.reviewStatus, "restored")');
    expect(strategy.match(/shotEvidenceSqlPredicate\(\)/g)).toHaveLength(3);
    expect(strategy).toContain("currentShots: currentShots.filter(isShotEvidenceEligible)");
    expect(strategy).toContain("baselineShots: baselineShots.filter(isShotEvidenceEligible)");

    expect(quickBag).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(quickBag).toContain('eq(shots.reviewStatus, "restored")');
    expect(quickBag).toContain(".filter(isShotEvidenceEligible)");
    expect(quickBag).toContain('shot.reviewStatus === "restored" ? null : shot.qualityTag');
  });

  it("limits weekly personal-best windows to included or restored evidence", () => {
    const source = readSource("src/lib/weekly-change-review-data.ts");

    expect(source).toContain("${shots.reviewStatus} in ('included', 'restored')");
    expect(source).toContain("${shots.reviewStatus} = 'restored'");
    expect(source).toContain("${shots.reviewStatus} = 'included'");
    expect(source).toContain("${shots.qualityTag}");
    expect(source).toContain("${shots.shotCategory}");
  });
});
