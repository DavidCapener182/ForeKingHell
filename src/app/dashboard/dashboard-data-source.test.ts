import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard data source", () => {
  it("does not block the command-centre route on an all-time raw import row scan", () => {
    const source = readFileSync(join(process.cwd(), "src/app/dashboard/dashboard-data.ts"), "utf8");

    expect(source).not.toMatch(
      /select\(\{\s*value:\s*count\(\)\s*\}\)\s*\.from\(importRows\)\s*\.where\(eq\(importRows\.userId,\s*userId\)\)/,
    );
    expect(source).toContain("inArray(importRows.sessionId, recentSessionIds)");
  });

  it("filters lifecycle evidence before the recent-shot limit and derived trends", () => {
    const source = readFileSync(join(process.cwd(), "src/app/dashboard/dashboard-data.ts"), "utf8");

    expect(source).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(source).toContain("shotEvidenceSqlPredicate()");
    expect(source).toContain("${shots.reviewStatus} = 'restored'");
    expect(source).toContain("recentStockShots.filter(isShotEvidenceEligible)");
    expect(source).toContain("stockShots: evidenceStockShots");
    expect(source.match(/shotEvidenceSqlPredicate\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain(".groupBy(shots.clubId)");
    expect(source).toContain(".groupBy(shots.playContext)");
  });
});
