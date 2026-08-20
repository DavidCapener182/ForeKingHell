import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isShotEvidenceEligible } from "@/lib/shot-review";

const source = readFileSync(join(process.cwd(), "src/app/rounds/actions.ts"), "utf8");

describe("round recalculation lifecycle evidence", () => {
  it("filters the loaded round ledger before manual hole-count slicing", () => {
    const mapping = source.slice(
      source.indexOf("export async function resplitRoundAction"),
      source.indexOf("async function evaluateRoundAchievementsForSessionWithFlash"),
    );

    expect(mapping).toContain("const loadedSessionShots = await db");
    expect(mapping).toContain("reviewStatus: shots.reviewStatus");
    expect(mapping).toContain("qualityTag: shots.qualityTag");
    expect(mapping).toContain("shotCategory: shots.shotCategory");
    expect(mapping).toContain(
      "const sessionShots = loadedSessionShots.filter(isShotEvidenceEligible);",
    );
    expect(mapping.indexOf("filter(isShotEvidenceEligible)")).toBeLessThan(
      mapping.indexOf("sessionShots.slice(cursor, cursor + count)"),
    );
  });

  it("filters the loaded round ledger before deriving hole assignments and progress", () => {
    const recalculation = source.slice(
      source.indexOf("async function recalculateRoundAssignments"),
      source.indexOf("function inferUnmappedShotHoles"),
    );

    expect(recalculation).toContain("const loadedSessionShots = await db");
    expect(recalculation).toContain("reviewStatus: shots.reviewStatus");
    expect(recalculation).toContain("qualityTag: shots.qualityTag");
    expect(recalculation).toContain("shotCategory: shots.shotCategory");
    expect(recalculation).toContain(
      "const sessionShots = loadedSessionShots.filter(isShotEvidenceEligible);",
    );
    expect(recalculation.indexOf("filter(isShotEvidenceEligible)")).toBeLessThan(
      recalculation.indexOf("inferUnmappedShotHoles"),
    );
    expect(recalculation.indexOf("filter(isShotEvidenceEligible)")).toBeLessThan(
      recalculation.indexOf("const shotsByHole"),
    );
  });

  it("excludes legacy-flagged included shots but lets an explicit restoration override the flag", () => {
    expect(
      isShotEvidenceEligible({
        reviewStatus: "included",
        qualityTag: "exclude:mishit",
        shotCategory: "full",
      }),
    ).toBe(false);
    expect(
      isShotEvidenceEligible({
        reviewStatus: "restored",
        qualityTag: "exclude:mishit",
        shotCategory: "warm_up",
      }),
    ).toBe(true);
  });
});
