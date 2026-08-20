import { describe, expect, it } from "vitest";

import {
  buildImportedShotReviewLifecycle,
  buildShotReviewMutation,
  effectiveShotReviewStatus,
  isExcludingShotReviewStatus,
  isShotEvidenceEligible,
  isRestorableShotReviewStatus,
  MAX_SHOT_REVIEW_BATCH_SIZE,
  parseShotReviewActionInput,
  shotReviewStatuses,
  userShotReviewStatuses,
} from "@/lib/shot-review";

const shotId = "5e7eced9-eac8-49d0-a78f-9a3c6d14fb5e";

describe("shot review lifecycle", () => {
  it("defines every supported current status", () => {
    expect(shotReviewStatuses).toEqual([
      "included",
      "suggested_exclusion",
      "user_excluded",
      "restored",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ]);
  });

  it("limits user-authored transitions to reversible review decisions", () => {
    expect(userShotReviewStatuses).toEqual([
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
      "restored",
    ]);
  });

  it("distinguishes a reversible suggestion from an accepted exclusion", () => {
    expect(isRestorableShotReviewStatus("suggested_exclusion")).toBe(true);
    expect(isExcludingShotReviewStatus("suggested_exclusion")).toBe(false);
    expect(isRestorableShotReviewStatus("user_excluded")).toBe(true);
    expect(isExcludingShotReviewStatus("user_excluded")).toBe(true);
  });

  it("preserves the prior quality tag while setting an exclusion compatibility tag", () => {
    expect(
      buildShotReviewMutation(
        {
          reviewStatus: "included",
          qualityTag: "mishit",
          reviewPreviousQualityTag: null,
        },
        "user_excluded",
      ),
    ).toEqual({
      previousStatus: "included",
      previousQualityTag: "mishit",
      reviewStatus: "user_excluded",
      qualityTag: "excluded",
      reviewPreviousQualityTag: "mishit",
    });
  });

  it("restores the exact ordinary quality tag saved before explicit user exclusion", () => {
    const excluded = buildShotReviewMutation(
      {
        reviewStatus: "included",
        qualityTag: "manual-review-note",
        reviewPreviousQualityTag: null,
      },
      "user_excluded",
    );
    const restored = buildShotReviewMutation(excluded, "restored");

    expect(excluded).toMatchObject({
      previousQualityTag: "manual-review-note",
      qualityTag: "excluded",
      reviewPreviousQualityTag: "manual-review-note",
    });
    expect(restored).toMatchObject({
      previousQualityTag: "excluded",
      reviewStatus: "restored",
      qualityTag: "manual-review-note",
      reviewPreviousQualityTag: "manual-review-note",
    });
  });

  it.each([
    ["calibration", "calibration"],
    ["warm_up", "warm-up"],
    ["launch_monitor_error", "launch-monitor-error"],
  ] as const)("maps %s to the compatibility tag %s", (status, qualityTag) => {
    expect(
      buildShotReviewMutation(
        { reviewStatus: "included", qualityTag: null, reviewPreviousQualityTag: null },
        status,
      ).qualityTag,
    ).toBe(qualityTag);
  });

  it("keeps suggestions non-destructive until a user accepts them", () => {
    expect(
      buildShotReviewMutation(
        { reviewStatus: "included", qualityTag: null, reviewPreviousQualityTag: null },
        "suggested_exclusion",
      ),
    ).toMatchObject({ reviewStatus: "suggested_exclusion", qualityTag: null });
  });

  it("rejects restore for a shot that has not been excluded or classified", () => {
    expect(() =>
      buildShotReviewMutation(
        { reviewStatus: "included", qualityTag: null, reviewPreviousQualityTag: null },
        "restored",
      ),
    ).toThrow("Only an excluded or classified shot can be restored.");
  });

  it("restores an imported bad-data fallback even when stored status is still included", () => {
    const effectiveStatus = effectiveShotReviewStatus({
      reviewStatus: "included",
      qualityTag: "bad_data",
      shotCategory: "full",
    });

    expect(
      buildShotReviewMutation(
        {
          reviewStatus: effectiveStatus,
          qualityTag: "bad_data",
          reviewPreviousQualityTag: null,
        },
        "restored",
      ),
    ).toMatchObject({
      previousStatus: "launch_monitor_error",
      previousQualityTag: "bad_data",
      reviewStatus: "restored",
      qualityTag: null,
    });
  });

  it("keeps an imported mishit in history when accepted, then restores a trusted tag", () => {
    const sourceRawJson = { "Club Type": "7 Iron", Result: "mishit" };
    const effectiveStatus = effectiveShotReviewStatus({
      reviewStatus: "included",
      qualityTag: "mishit",
      shotCategory: "full",
    });
    const accepted = buildShotReviewMutation(
      {
        reviewStatus: effectiveStatus,
        qualityTag: "mishit",
        reviewPreviousQualityTag: null,
      },
      "user_excluded",
    );
    const restored = buildShotReviewMutation(accepted, "restored");

    expect(accepted).toMatchObject({
      previousStatus: "suggested_exclusion",
      previousQualityTag: "mishit",
      reviewStatus: "user_excluded",
      qualityTag: "excluded",
      reviewPreviousQualityTag: null,
    });
    expect(restored).toMatchObject({
      previousStatus: "user_excluded",
      previousQualityTag: "excluded",
      reviewStatus: "restored",
      qualityTag: null,
    });
    expect(sourceRawJson).toEqual({ "Club Type": "7 Iron", Result: "mishit" });
  });

  it.each([
    ["bad_data", null, "launch_monitor_error"],
    ["calibration", null, "calibration"],
    ["warm_up", null, "warm_up"],
    [null, "warm-up", "warm_up"],
    ["mishit", null, "suggested_exclusion"],
  ] as const)(
    "derives %s / %s as %s instead of displaying included",
    (qualityTag, shotCategory, expected) => {
      expect(
        effectiveShotReviewStatus({
          reviewStatus: "included",
          qualityTag,
          shotCategory,
        }),
      ).toBe(expected);
    },
  );

  it("does not overwrite an explicit restored state with a legacy tag fallback", () => {
    expect(
      effectiveShotReviewStatus({
        reviewStatus: "restored",
        qualityTag: "mishit",
      }),
    ).toBe("restored");
  });

  it("uses only included and restored shots as derived evidence", () => {
    expect(isShotEvidenceEligible({ reviewStatus: "included" })).toBe(true);
    expect(isShotEvidenceEligible({ reviewStatus: "restored", qualityTag: "mishit" })).toBe(true);

    for (const reviewStatus of [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ] as const) {
      expect(isShotEvidenceEligible({ reviewStatus })).toBe(false);
    }
  });

  it("keeps the legacy quality and category fallback for rows without a lifecycle decision", () => {
    expect(isShotEvidenceEligible({ reviewStatus: "included", qualityTag: "mishit" })).toBe(false);
    expect(isShotEvidenceEligible({ reviewStatus: "included", qualityTag: "exclude:mishit" })).toBe(
      false,
    );
    expect(isShotEvidenceEligible({ reviewStatus: null, qualityTag: "bad_data" })).toBe(false);
    expect(isShotEvidenceEligible({ shotCategory: "warm_up" })).toBe(false);
    expect(isShotEvidenceEligible({ reviewStatus: null, qualityTag: "manual-note" })).toBe(true);
  });

  it.each([
    ["bad_data", "launch_monitor_error", 0.9],
    ["mishit", "suggested_exclusion", 0.75],
    ["calibration", "calibration", 0.95],
    ["warm_up", "warm_up", 0.95],
  ] as const)("initializes imported %s provenance as %s", (qualityTag, status, confidence) => {
    expect(buildImportedShotReviewLifecycle({ qualityTag, shotCategory: "full" })).toMatchObject({
      reviewStatus: status,
      reviewReason: expect.any(String),
      reviewConfidence: confidence,
      reviewSource: "import",
      reviewPreviousQualityTag: null,
    });
  });

  it("leaves an ordinary imported shot included without fabricating review provenance", () => {
    expect(buildImportedShotReviewLifecycle({ qualityTag: null, shotCategory: "full" })).toEqual({
      reviewStatus: "included",
      reviewReason: null,
      reviewConfidence: null,
      reviewSource: null,
      reviewPreviousQualityTag: null,
    });
  });
});

describe("shot review action validation", () => {
  it("deduplicates valid IDs and normalizes reason and confidence", () => {
    expect(
      parseShotReviewActionInput({
        shotIds: [shotId, shotId],
        status: "user_excluded",
        reason: "  Launch monitor double-read  ",
        confidence: 0.876,
      }),
    ).toEqual({
      shotIds: [shotId],
      status: "user_excluded",
      reason: "Launch monitor double-read",
      confidence: 0.88,
    });
  });

  it("rejects an oversized batch", () => {
    const shotIds = Array.from(
      { length: MAX_SHOT_REVIEW_BATCH_SIZE + 1 },
      (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );

    expect(() =>
      parseShotReviewActionInput({
        shotIds,
        status: "user_excluded",
        reason: "Reviewed batch",
        confidence: 1,
      }),
    ).toThrow(`Review no more than ${MAX_SHOT_REVIEW_BATCH_SIZE} shots at once.`);
  });

  it.each([
    { status: "unknown", reason: "Valid reason", confidence: 1 },
    { status: "included", reason: "Valid reason", confidence: 1 },
    { status: "suggested_exclusion", reason: "Valid reason", confidence: 1 },
    { status: "user_excluded", reason: "", confidence: 1 },
    { status: "user_excluded", reason: "Valid reason", confidence: 1.1 },
  ])("rejects invalid review input %#", (input) => {
    expect(() => parseShotReviewActionInput({ shotIds: [shotId], ...input })).toThrow();
  });
});
