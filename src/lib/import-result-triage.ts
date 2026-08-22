export type PersistedImportShotTriageInput = {
  reviewStatus: string | null;
  qualityTag: string | null;
  shotCategory: string | null;
};

export type ImportShotTriageSummary = {
  totalShotCount: number;
  stockQualityCount: number;
  likelyMishitCount: number;
  needsReviewCount: number;
  pendingSuggestionCount: number;
  confirmationCount: number;
  partialShotCount: number;
  launchMonitorErrorCount: number;
  confirmedExcludedCount: number;
  otherNonStockCount: number;
};

type ImportShotTriageBucket =
  | "stock_quality"
  | "likely_mishit"
  | "needs_review"
  | "partial_shot"
  | "launch_monitor_error"
  | "confirmed_excluded"
  | "other_non_stock";

const FULL_LIKE_CATEGORIES = new Set(["", "full", "stock", "tee", "approach"]);
const PARTIAL_CATEGORIES = new Set(["pitch", "chip", "recovery"]);
const MISHIT_TAGS = new Set(["fat", "mishit", "thin", "top"]);
const NEEDS_REVIEW_TAGS = new Set(["needs-review", "needs_review"]);
const LAUNCH_MONITOR_ERROR_TAGS = new Set([
  "bad-data",
  "bad_data",
  "invalid",
  "launch-monitor-error",
  "misread",
]);

/**
 * Summarises the review state already persisted for one import session. The buckets are mutually
 * exclusive so the headline never double-counts a partial shot as a mishit. This is a readback,
 * not a second detector: import-time classification remains authoritative.
 */
export function summarizePersistedImportShots(
  rows: PersistedImportShotTriageInput[],
): ImportShotTriageSummary {
  const summary: ImportShotTriageSummary = {
    totalShotCount: rows.length,
    stockQualityCount: 0,
    likelyMishitCount: 0,
    needsReviewCount: 0,
    pendingSuggestionCount: 0,
    confirmationCount: 0,
    partialShotCount: 0,
    launchMonitorErrorCount: 0,
    confirmedExcludedCount: 0,
    otherNonStockCount: 0,
  };

  for (const row of rows) {
    const bucket = persistedImportShotBucket(row);
    if ((bucket === "likely_mishit" || bucket === "needs_review") && isPendingSuggestion(row)) {
      summary.pendingSuggestionCount += 1;
    }
    if (bucket === "likely_mishit" || bucket === "needs_review") {
      summary.confirmationCount += 1;
    }

    if (bucket === "stock_quality") summary.stockQualityCount += 1;
    if (bucket === "likely_mishit") summary.likelyMishitCount += 1;
    if (bucket === "needs_review") summary.needsReviewCount += 1;
    if (bucket === "partial_shot") summary.partialShotCount += 1;
    if (bucket === "launch_monitor_error") summary.launchMonitorErrorCount += 1;
    if (bucket === "confirmed_excluded") summary.confirmedExcludedCount += 1;
    if (bucket === "other_non_stock") summary.otherNonStockCount += 1;
  }

  return summary;
}

export function formatImportTriagePath(summary: ImportShotTriageSummary) {
  const parts = [
    `${summary.totalShotCount} shots imported`,
    `${summary.stockQualityCount} stock-quality`,
    `${summary.likelyMishitCount} likely ${plural(summary.likelyMishitCount, "mishit", "mishits")}`,
  ];

  if (summary.needsReviewCount > 0) {
    parts.push(
      `${summary.needsReviewCount} ${plural(summary.needsReviewCount, "shot needs", "shots need")} review`,
    );
  }

  parts.push(
    `${summary.partialShotCount} partial ${plural(summary.partialShotCount, "shot", "shots")}`,
  );

  if (summary.launchMonitorErrorCount > 0) {
    parts.push(
      `${summary.launchMonitorErrorCount} unusable ${plural(
        summary.launchMonitorErrorCount,
        "record",
        "records",
      )}`,
    );
  }

  if (summary.confirmedExcludedCount > 0) {
    parts.push(
      `${summary.confirmedExcludedCount} confirmed ${plural(
        summary.confirmedExcludedCount,
        "exclusion",
        "exclusions",
      )}`,
    );
  }

  if (summary.otherNonStockCount > 0) {
    parts.push(`${summary.otherNonStockCount} other non-stock`);
  }

  return parts.join(" → ");
}

export function importSuggestionReviewHref(sessionId: string) {
  const base = `/shots?sessionId=${encodeURIComponent(sessionId)}`;
  return `${base}&trust=untrusted`;
}

/** Field quarantine is orthogonal to shot quality, so it is read from the import receipt. */
export function importFieldIssueCount(metadata: unknown) {
  if (!isRecord(metadata) || !isRecord(metadata.qualityTriage)) {
    return 0;
  }

  const value = metadata.qualityTriage.fieldIssues;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function persistedImportShotBucket(row: PersistedImportShotTriageInput): ImportShotTriageBucket {
  const reviewStatus = normalize(row.reviewStatus);
  const qualityTag = normalize(row.qualityTag);
  const shotCategory = normalize(row.shotCategory);

  if (reviewStatus === "launch_monitor_error" || LAUNCH_MONITOR_ERROR_TAGS.has(qualityTag)) {
    return "launch_monitor_error";
  }

  if (reviewStatus === "user_excluded") {
    return "confirmed_excluded";
  }

  // Deliberate short-game work is its own useful category, never a bad-strike label.
  if (PARTIAL_CATEGORIES.has(shotCategory)) {
    return "partial_shot";
  }

  if (NEEDS_REVIEW_TAGS.has(qualityTag)) {
    return "needs_review";
  }

  if (reviewStatus === "suggested_exclusion" || MISHIT_TAGS.has(qualityTag)) {
    return "likely_mishit";
  }

  if (
    (reviewStatus === "included" || reviewStatus === "restored") &&
    FULL_LIKE_CATEGORIES.has(shotCategory)
  ) {
    return "stock_quality";
  }

  return "other_non_stock";
}

function isPendingSuggestion(row: PersistedImportShotTriageInput) {
  const reviewStatus = normalize(row.reviewStatus);
  const qualityTag = normalize(row.qualityTag);
  return (
    reviewStatus === "suggested_exclusion" ||
    (reviewStatus === "included" && MISHIT_TAGS.has(qualityTag))
  );
}

function normalize(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function plural(count: number, singular: string, pluralValue: string) {
  return count === 1 ? singular : pluralValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
