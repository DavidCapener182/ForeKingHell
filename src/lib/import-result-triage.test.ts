import { describe, expect, it } from "vitest";

import {
  formatImportTriagePath,
  importFieldIssueCount,
  importSuggestionReviewHref,
  summarizePersistedImportShots,
} from "@/lib/import-result-triage";

describe("summarizePersistedImportShots", () => {
  it("builds mutually exclusive stock, mishit, partial, and unusable counts", () => {
    const summary = summarizePersistedImportShots([
      { reviewStatus: "included", qualityTag: null, shotCategory: "full" },
      { reviewStatus: "restored", qualityTag: null, shotCategory: "approach" },
      { reviewStatus: "suggested_exclusion", qualityTag: "mishit", shotCategory: "full" },
      { reviewStatus: "included", qualityTag: "thin", shotCategory: "full" },
      { reviewStatus: "included", qualityTag: null, shotCategory: "pitch" },
      { reviewStatus: "suggested_exclusion", qualityTag: "mishit", shotCategory: "chip" },
      { reviewStatus: "launch_monitor_error", qualityTag: "bad_data", shotCategory: "full" },
      { reviewStatus: "user_excluded", qualityTag: "excluded", shotCategory: "full" },
    ]);

    expect(summary).toEqual({
      totalShotCount: 8,
      stockQualityCount: 2,
      likelyMishitCount: 2,
      needsReviewCount: 0,
      pendingSuggestionCount: 2,
      confirmationCount: 2,
      partialShotCount: 2,
      launchMonitorErrorCount: 1,
      confirmedExcludedCount: 1,
      otherNonStockCount: 0,
    });
  });

  it("does not treat tee and approach shots as non-stock or short-game partials as bad", () => {
    expect(
      summarizePersistedImportShots([
        { reviewStatus: "included", qualityTag: null, shotCategory: "tee" },
        { reviewStatus: "included", qualityTag: null, shotCategory: "approach" },
        { reviewStatus: "included", qualityTag: "mishit", shotCategory: "recovery" },
      ]),
    ).toMatchObject({ stockQualityCount: 2, likelyMishitCount: 0, partialShotCount: 1 });
  });

  it("keeps a soft low-tail suggestion separate from likely mishits and stock-quality", () => {
    expect(
      summarizePersistedImportShots([
        {
          reviewStatus: "suggested_exclusion",
          qualityTag: "needs_review",
          shotCategory: "full",
        },
      ]),
    ).toMatchObject({
      stockQualityCount: 0,
      likelyMishitCount: 0,
      needsReviewCount: 1,
      pendingSuggestionCount: 1,
      confirmationCount: 1,
    });
  });
});

describe("import result triage presentation", () => {
  it("formats the requested confirmation-first path with exact counts", () => {
    expect(
      formatImportTriagePath({
        totalShotCount: 82,
        stockQualityCount: 76,
        likelyMishitCount: 4,
        needsReviewCount: 0,
        pendingSuggestionCount: 4,
        confirmationCount: 4,
        partialShotCount: 2,
        launchMonitorErrorCount: 0,
        confirmedExcludedCount: 0,
        otherNonStockCount: 0,
      }),
    ).toBe("82 shots imported → 76 stock-quality → 4 likely mishits → 2 partial shots");
  });

  it("builds an encoded session-scoped untrusted-shot review link", () => {
    expect(importSuggestionReviewHref("session/id + 1")).toBe(
      "/shots?sessionId=session%2Fid%20%2B%201&trust=untrusted",
    );
  });

  it("keeps soft-review rows in the same session-scoped untrusted queue", () => {
    expect(importSuggestionReviewHref("session-1")).toBe(
      "/shots?sessionId=session-1&trust=untrusted",
    );
  });

  it("reads an orthogonal field-quarantine count from a structured import receipt", () => {
    expect(importFieldIssueCount({ qualityTriage: { fieldIssues: 1 } })).toBe(1);
    expect(importFieldIssueCount({ qualityTriage: { fieldIssues: -1 } })).toBe(0);
    expect(importFieldIssueCount({ qualityTriage: { fieldIssues: "1" } })).toBe(0);
    expect(importFieldIssueCount(null)).toBe(0);
  });
});
