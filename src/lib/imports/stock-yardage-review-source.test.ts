import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/imports/save-rapsodo-import.ts"), "utf8");

describe("import stock-yardage lifecycle evidence", () => {
  it("selects lifecycle state before recalculating persisted stock", () => {
    const stockRecompute = source.slice(
      source.indexOf("const clubShots = await tx"),
      source.indexOf("const stock = calculateStockYardage"),
    );

    expect(stockRecompute).toContain("reviewStatus: shots.reviewStatus");
  });

  it("recomputes a snapshot from the imported play context only", () => {
    const stockRecompute = source.slice(
      source.indexOf("const clubShots = await tx"),
      source.indexOf("const stock = calculateStockYardage"),
    );

    expect(stockRecompute).toContain("eq(shots.playContext, playContext)");
  });
});
