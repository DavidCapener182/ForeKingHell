import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/stock-yardage-refresh.ts"), "utf8");

describe("stock-yardage refresh boundary", () => {
  it("updates only the current owner/context snapshot and preserves history", () => {
    expect(source).toContain("eq(stockYardages.userId, input.userId)");
    expect(source).toContain("eq(stockYardages.playContext, context.playContext)");
    expect(source).toContain("desc(stockYardages.calculatedAt)");
    expect(source).toContain(".update(stockYardages)");
    expect(source).not.toContain(".delete(stockYardages)");
  });

  it("rebuilds from owner-scoped lifecycle-aware shot evidence", () => {
    expect(source).toContain("reviewStatus: shots.reviewStatus");
    expect(source).toContain("eq(shots.userId, input.userId)");
    expect(source).toContain("eq(sessions.userId, input.userId)");
    expect(source).toContain("eq(shots.playContext, context.playContext)");
    expect(source).toContain("calculateStockYardage(clubShots, 50");
    expect(source).toContain("await tx.insert(stockYardages)");
    expect(source).not.toContain("if (stock.sampleSize === 0)");
  });
});
