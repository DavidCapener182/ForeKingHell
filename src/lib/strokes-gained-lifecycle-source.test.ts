import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";
import { performanceObservationExclusionReason } from "@/lib/performance-intelligence";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function isStrokesGainedEvidenceEligible(input: {
  shotId: string | null;
  reviewStatus?: ShotReviewStatus | null;
  qualityTag?: string | null;
  shotCategory?: string | null;
}) {
  return input.shotId === null || isShotEvidenceEligible(input);
}

describe("strokes-gained lifecycle evidence", () => {
  it.each([
    "src/app/(app)/strokes-gained/page.tsx",
    "src/lib/practice-planner.ts",
    "src/lib/coach-sql-context.ts",
    "src/lib/ai/user-data-chat-context.ts",
  ])("keeps manual events but filters linked shot events in %s", (path) => {
    const consumer =
      source(path) +
      (path === "src/app/(app)/strokes-gained/page.tsx"
        ? source("src/lib/strokes-gained-history.ts") +
          source("src/lib/strokes-gained-practice-data.ts")
        : "");

    const link = consumer.indexOf("eq(shots.id, strokesGainedShotEvents.shotId)");
    const limit = consumer.indexOf(".limit(", link);
    const groupBy = consumer.indexOf(".groupBy(", link);
    const queryEnd = [limit, groupBy].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    const linkedEventQuery = consumer.slice(link, queryEnd);

    expect(link).toBeGreaterThanOrEqual(0);
    expect(linkedEventQuery).toContain("isNull(strokesGainedShotEvents.shotId)");
    expect(linkedEventQuery).toContain("shotEvidenceSqlPredicate()");
    expect(consumer).toMatch(
      /eq\(shots\.reviewStatus, "restored"\)|\$\{shots\.reviewStatus\} = 'restored'/,
    );
    if (path === "src/lib/practice-planner.ts") {
      // Practice keeps unconfirmed suggestions and genuine poor attempts; confirmed errors/user exclusions remain out.
      expect(consumer).toContain("${shots.reviewStatus} in ('included', 'suggested_exclusion')");
      const predicate = consumer.slice(
        consumer.indexOf("function shotEvidenceSqlPredicate()"),
        consumer.indexOf("function evaluateOrderedPracticeBlocks"),
      );
      expect(predicate).not.toContain("'user_excluded'");
      expect(predicate).not.toContain("'launch_monitor_error'");
      for (const genuine of ["'fat'", "'mishit'", "'thin'", "'top'"])
        expect(predicate).not.toContain(genuine);
      expect(consumer).toContain("performanceObservationExclusionReason(row) === null");
    } else {
      expect(consumer).toMatch(
        /eq\(shots\.reviewStatus, "included"\)|\$\{shots\.reviewStatus\} = 'included'/,
      );
    }
    expect(consumer).toContain("not like 'exclude%'");
    expect(consumer).toContain("'bad-data', 'bad_data'");
    expect(consumer).toContain("'warm-up', 'warmup', 'warm_up'");
  });

  it.each([
    {
      label: "excludes a linked included shot carrying a legacy bad-data tag",
      input: {
        shotId: "shot-1",
        reviewStatus: "included" as const,
        qualityTag: "bad_data",
        shotCategory: "full",
      },
      expected: false,
    },
    {
      label: "retains a linked restored shot despite its legacy tag",
      input: {
        shotId: "shot-2",
        reviewStatus: "restored" as const,
        qualityTag: "bad_data",
        shotCategory: "warm_up",
      },
      expected: true,
    },
    {
      label: "retains an unlinked manually entered event",
      input: {
        shotId: null,
        reviewStatus: "user_excluded" as const,
        qualityTag: "excluded",
        shotCategory: "warm_up",
      },
      expected: true,
    },
  ])("$label", ({ input, expected }) => {
    expect(isStrokesGainedEvidenceEligible(input)).toBe(expected);
  });

  it("practice retains genuine poor attempts while excluding explicit user and invalid states", () => {
    for (const qualityTag of ["top", "thin", "fat", "mishit"]) {
      expect(
        performanceObservationExclusionReason({
          reviewStatus: "included",
          qualityTag,
          shotCategory: "full",
        }),
      ).toBeNull();
      expect(
        performanceObservationExclusionReason({
          reviewStatus: "suggested_exclusion",
          qualityTag,
          shotCategory: "full",
        }),
      ).toBeNull();
      expect(
        performanceObservationExclusionReason({
          reviewStatus: "user_excluded",
          qualityTag,
          shotCategory: "full",
        }),
      ).not.toBeNull();
    }
    expect(
      performanceObservationExclusionReason({ reviewStatus: "included", qualityTag: "bad_data" }),
    ).not.toBeNull();
    expect(
      performanceObservationExclusionReason({
        reviewStatus: "launch_monitor_error",
        qualityTag: "top",
      }),
    ).not.toBeNull();
    expect(
      performanceObservationExclusionReason({ reviewStatus: "warm_up", qualityTag: "top" }),
    ).not.toBeNull();
  });

  it("links imported course events back to the inserted shot lifecycle", () => {
    const importer = source("src/lib/imports/save-rapsodo-import.ts");

    expect(importer).toContain("shotIdByRowNumber.set(shot.rowNumber, insertedShot.id)");
    expect(importer).toContain("shotIdByRowNumber,");
  });
});
