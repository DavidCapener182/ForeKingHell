export const shotReviewStatuses = [
  "included",
  "suggested_exclusion",
  "user_excluded",
  "restored",
  "calibration",
  "warm_up",
  "launch_monitor_error",
] as const;

export type ShotReviewStatus = (typeof shotReviewStatuses)[number];
export type ShotReviewSource = "user" | "system" | "import" | "migration";

export const userShotReviewStatuses = [
  "user_excluded",
  "calibration",
  "warm_up",
  "launch_monitor_error",
  "restored",
] as const satisfies readonly ShotReviewStatus[];

export type UserShotReviewStatus = (typeof userShotReviewStatuses)[number];

export const MAX_SHOT_REVIEW_BATCH_SIZE = 50;

const statusSet = new Set<string>(shotReviewStatuses);
const userStatusSet = new Set<string>(userShotReviewStatuses);
const compatibilityQualityTags: Partial<Record<ShotReviewStatus, string>> = {
  user_excluded: "excluded",
  calibration: "calibration",
  warm_up: "warm-up",
  launch_monitor_error: "launch-monitor-error",
};

export type ShotReviewActionInput = {
  shotIds: string[];
  status: UserShotReviewStatus;
  reason: string;
  confidence: number;
};

export type ShotReviewState = {
  reviewStatus: ShotReviewStatus;
  qualityTag: string | null;
  reviewPreviousQualityTag: string | null;
};

export type ShotReviewMutation = ShotReviewState & {
  previousStatus: ShotReviewStatus;
  previousQualityTag: string | null;
};

export type ImportedShotReviewLifecycle = {
  reviewStatus: ShotReviewStatus;
  reviewReason: string | null;
  reviewConfidence: number | null;
  reviewSource: "import" | null;
  reviewPreviousQualityTag: null;
};

export function parseShotReviewActionInput(input: unknown): ShotReviewActionInput {
  if (!input || typeof input !== "object") {
    throw new Error("Review details are required.");
  }

  const record = input as Record<string, unknown>;
  const shotIds = Array.isArray(record.shotIds)
    ? [...new Set(record.shotIds.filter((value): value is string => typeof value === "string"))]
    : [];

  if (shotIds.length === 0) {
    throw new Error("Select at least one shot to review.");
  }
  if (shotIds.length > MAX_SHOT_REVIEW_BATCH_SIZE) {
    throw new Error(`Review no more than ${MAX_SHOT_REVIEW_BATCH_SIZE} shots at once.`);
  }
  if (shotIds.some((shotId) => !isUuid(shotId))) {
    throw new Error("One or more shots are invalid.");
  }
  if (!isUserShotReviewStatus(record.status)) {
    throw new Error("Choose a valid review status.");
  }

  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    throw new Error("Add a review reason between 3 and 500 characters.");
  }

  const confidence = typeof record.confidence === "number" ? record.confidence : Number.NaN;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Review confidence must be between 0 and 1.");
  }

  return {
    shotIds,
    status: record.status,
    reason,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export function buildShotReviewMutation(
  current: ShotReviewState,
  status: ShotReviewStatus,
): ShotReviewMutation {
  const previousStatus = current.reviewStatus;
  const previousQualityTag = current.qualityTag;

  if (status === "restored") {
    if (current.reviewStatus === "restored") {
      return {
        previousStatus,
        previousQualityTag,
        reviewStatus: "restored",
        qualityTag: current.reviewPreviousQualityTag,
        reviewPreviousQualityTag: current.reviewPreviousQualityTag,
      };
    }

    if (!isRestorableShotReviewStatus(current.reviewStatus)) {
      throw new Error("Only an excluded or classified shot can be restored.");
    }

    return {
      previousStatus,
      previousQualityTag,
      reviewStatus: "restored",
      qualityTag: current.reviewPreviousQualityTag,
      reviewPreviousQualityTag: current.reviewPreviousQualityTag,
    };
  }

  const compatibilityTag = compatibilityQualityTags[status];
  if (!compatibilityTag) {
    return {
      previousStatus,
      previousQualityTag,
      reviewStatus: status,
      qualityTag: current.qualityTag,
      reviewPreviousQualityTag: current.reviewPreviousQualityTag,
    };
  }

  return {
    previousStatus,
    previousQualityTag,
    reviewStatus: status,
    qualityTag: compatibilityTag,
    reviewPreviousQualityTag: isRestorableShotReviewStatus(current.reviewStatus)
      ? current.reviewPreviousQualityTag
      : current.qualityTag,
  };
}

export function isPersistedShotReviewNoOp(
  current: Pick<ShotReviewState, "reviewStatus" | "qualityTag" | "reviewPreviousQualityTag">,
  status: UserShotReviewStatus,
) {
  if (current.reviewStatus !== status) return false;
  if (status === "restored") {
    return current.qualityTag === current.reviewPreviousQualityTag;
  }
  const compatibilityTag = compatibilityQualityTags[status];
  return compatibilityTag ? current.qualityTag === compatibilityTag : true;
}

export function isShotReviewStatus(value: unknown): value is ShotReviewStatus {
  return typeof value === "string" && statusSet.has(value);
}

export function isUserShotReviewStatus(value: unknown): value is UserShotReviewStatus {
  return typeof value === "string" && userStatusSet.has(value);
}

export function effectiveShotReviewStatus(input: {
  reviewStatus: ShotReviewStatus;
  qualityTag?: string | null;
  shotCategory?: string | null;
}): ShotReviewStatus {
  if (input.reviewStatus !== "included") {
    return input.reviewStatus;
  }

  const qualityTag = normalizedReviewValue(input.qualityTag);
  const shotCategory = normalizedReviewValue(input.shotCategory);
  if (
    ["exclude", "excluded", "delete", "deleted"].includes(qualityTag ?? "") ||
    qualityTag?.startsWith("exclude")
  ) {
    return "user_excluded";
  }
  if (qualityTag === "calibration") {
    return "calibration";
  }
  if (
    ["warm-up", "warmup", "warm_up"].includes(qualityTag ?? "") ||
    ["warm-up", "warmup", "warm_up"].includes(shotCategory ?? "")
  ) {
    return "warm_up";
  }
  if (
    ["bad-data", "bad_data", "invalid", "launch-monitor-error", "misread"].includes(
      qualityTag ?? "",
    )
  ) {
    return "launch_monitor_error";
  }
  if (["fat", "mishit", "thin", "top", "needs_review"].includes(qualityTag ?? "")) {
    return "suggested_exclusion";
  }

  return input.reviewStatus;
}

export function buildImportedShotReviewLifecycle(input: {
  qualityTag?: string | null;
  shotCategory?: string | null;
}): ImportedShotReviewLifecycle {
  const reviewStatus = effectiveShotReviewStatus({
    reviewStatus: "included",
    qualityTag: input.qualityTag,
    shotCategory: input.shotCategory,
  });

  if (reviewStatus === "included") {
    return {
      reviewStatus,
      reviewReason: null,
      reviewConfidence: null,
      reviewSource: null,
      reviewPreviousQualityTag: null,
    };
  }
  if (reviewStatus === "restored") {
    throw new Error("An imported shot cannot begin in the restored review state.");
  }

  const qualityLabel = normalizedReviewValue(input.qualityTag) ?? "shot classification";
  const reviewDetails: Record<
    Exclude<ShotReviewStatus, "included" | "restored">,
    { reason: string; confidence: number }
  > = {
    suggested_exclusion: {
      reason: `Imported quality flag '${qualityLabel}' requires player review.`,
      confidence: 0.75,
    },
    user_excluded: {
      reason: `Import review marked quality flag '${qualityLabel}' as excluded.`,
      confidence: 1,
    },
    calibration: {
      reason: "Imported row is classified as a calibration shot.",
      confidence: 0.95,
    },
    warm_up: {
      reason: "Imported row is classified as a warm-up shot.",
      confidence: 0.95,
    },
    launch_monitor_error: {
      reason: `Imported quality flag '${qualityLabel}' indicates unreliable launch-monitor data.`,
      confidence: 0.9,
    },
  };
  const details = reviewDetails[reviewStatus];

  return {
    reviewStatus,
    reviewReason: details.reason,
    reviewConfidence: details.confidence,
    reviewSource: "import",
    reviewPreviousQualityTag: null,
  };
}

export function isExcludingShotReviewStatus(status: ShotReviewStatus | null | undefined) {
  return Boolean(status && compatibilityQualityTags[status]);
}

export function isRestorableShotReviewStatus(status: ShotReviewStatus | null | undefined) {
  return status === "suggested_exclusion" || isExcludingShotReviewStatus(status);
}

export function isShotEvidenceEligible(input: {
  reviewStatus?: ShotReviewStatus | null;
  qualityTag?: string | null;
  shotCategory?: string | null;
}) {
  const reviewStatus = input.reviewStatus ?? "included";
  const effectiveStatus = effectiveShotReviewStatus({
    reviewStatus,
    qualityTag: input.qualityTag,
    shotCategory: input.shotCategory,
  });

  return effectiveStatus === "included" || effectiveStatus === "restored";
}

export function shotReviewStatusLabel(status: ShotReviewStatus) {
  switch (status) {
    case "included":
      return "Included";
    case "suggested_exclusion":
      return "Suggested exclusion";
    case "user_excluded":
      return "User excluded";
    case "restored":
      return "Restored";
    case "calibration":
      return "Calibration";
    case "warm_up":
      return "Warm-up";
    case "launch_monitor_error":
      return "Launch-monitor error";
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizedReviewValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}
