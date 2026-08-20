import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("core analysis lifecycle boundaries", () => {
  it("filters progress and every comparison loader before deriving evidence", () => {
    const progress = source("src/lib/progress-data.ts");
    const compare = source("src/lib/compare-data.ts");

    expect(progress).toContain("reviewStatus: shots.reviewStatus");
    expect(progress).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(progress).toContain("shotRows.filter(isShotEvidenceEligible)");

    expect(
      compare.match(/inArray\(shots\.reviewStatus, \["included", "restored"\]\)/g),
    ).toHaveLength(3);
    expect(compare.match(/reviewStatus: shots\.reviewStatus/g)).toHaveLength(3);
    expect(compare.match(/isShotEvidenceEligible\(shot\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(compare).toContain("selection.shots.filter(isShotEvidenceEligible)");
  });

  it("keeps Analyse aggregates and saved snapshots on trusted lifecycle evidence", () => {
    const analyse = source("src/app/(app)/analyse/page.tsx");
    const actions = source("src/app/analyse/workspace/actions.ts");

    for (const consumer of [analyse, actions]) {
      expect(consumer).toContain("${shots.reviewStatus} = 'restored'");
      expect(consumer).toContain("${shots.reviewStatus} = 'included'");
      expect(consumer).toContain("lower(trim(coalesce(${shots.qualityTag}, ''))) not in");
      expect(consumer).toContain("lower(trim(coalesce(${shots.shotCategory}, ''))) not in");
    }
    expect(analyse).toContain("filter (where ${trustedEvidence})");
    expect(actions).toContain(
      "const clauses = [eq(shots.userId, userId), shotEvidenceSqlPredicate()]",
    );
  });

  it("uses trusted evidence for equipment counts, impact, and stock inputs", () => {
    const equipment = source("src/app/(app)/equipment/page.tsx");
    const analysis = source("src/lib/equipment-change-analysis.ts");

    expect(equipment.match(/shotEvidenceSqlPredicate\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(equipment).toContain("reviewStatus: shots.reviewStatus");
    expect(equipment).toContain("recentShotRows.filter(isShotEvidenceEligible)");
    expect(equipment).toContain("isShotEvidenceEligible(shot)");
    expect(equipment).toContain("reviewStatus: row.reviewStatus");
    expect(analysis).toContain("reviewStatus: shot.reviewStatus");
  });

  it("preserves the raw data-quality ledger while filtering derived workspace samples", () => {
    const workspace = source("src/app/(app)/analyse/workspace/page.tsx");
    const rawSummaryStart = workspace.indexOf("total: count(shots.id)");
    const rawSummaryEnd = workspace.indexOf("total: count(importFiles.id)", rawSummaryStart);
    const rawSummary = workspace.slice(rawSummaryStart, rawSummaryEnd);

    expect(rawSummary).toContain(".where(eq(shots.userId, userId))");
    expect(rawSummary).not.toContain("shotEvidenceSqlPredicate");
    expect(workspace).toContain("reviewStatus: shots.reviewStatus");
    expect(workspace.match(/shotEvidenceSqlPredicate\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
