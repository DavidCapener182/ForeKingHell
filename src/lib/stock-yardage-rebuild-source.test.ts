import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "scripts/rebuild-current-stock-yardages.ts"),
  "utf8",
);

describe("current stock-yardage rebuild operation", () => {
  it("is dry-run by default and requires an explicit apply flag", () => {
    expect(source).toContain('process.argv.includes("--apply")');
    expect(source).toContain('mode: apply ? "apply" : "dry-run"');
    expect(source).toContain("if (mutate)");
  });

  it("defaults to lifecycle-affected groups and requires an explicit all-data scope", () => {
    expect(source).toContain('process.argv.includes("--all")');
    expect(source).toContain("shot.review_status <> 'included'");
    expect(source).toContain('scope: rebuildAll ? "all" : "lifecycle-affected"');
  });

  it("rebuilds lifecycle-aware snapshots per owner, club, and play context", () => {
    expect(source).toContain('shot.review_status as "reviewStatus"');
    expect(source).toContain("and shot.play_context = ${group.playContext}");
    expect(source).toContain("calculateStockYardage(shotRows, 50");
  });

  it("is idempotent by updating only the latest context row or inserting when absent", () => {
    expect(source).toContain("order by calculated_at desc, created_at desc, id desc");
    expect(source).toContain("update fkh_stock_yardages");
    expect(source).toContain("where id = ${latest.id}");
    expect(source).toContain("insert into fkh_stock_yardages");
    expect(source).not.toContain("delete from fkh_stock_yardages");
  });
});
