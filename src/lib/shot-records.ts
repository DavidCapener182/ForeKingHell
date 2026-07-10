export const excludedRecordQualityTags = [
  "bad-data",
  "bad_data",
  "delete",
  "deleted",
  "exclude",
  "excluded",
  "fat",
  "invalid",
  "mishit",
  "misread",
  "thin",
  "top",
] as const;

export const excludedRecordShotCategories = [
  "bunker",
  "chip",
  "pitch",
  "putt",
  "recovery",
  "warm-up",
  "warmup",
] as const;

const excludedQualityTagSet = new Set<string>(excludedRecordQualityTags);
const excludedShotCategorySet = new Set<string>(excludedRecordShotCategories);
const manualSessionSources = new Set(["manual", "manual_edit"]);

export type RecordDistanceMetric = "carry" | "total";
export type RecordEvidenceScope = "raw" | "trusted";
export type RecordEligibilityReason =
  | "missing-distance"
  | "non-positive-distance"
  | "quality-tag"
  | "shot-category"
  | "manual-source";

export type RecordShot = {
  carryYd: number | null;
  totalYd: number | null;
  qualityTag?: string | null;
  shotCategory?: string | null;
  sessionSource?: string | null;
};

export function recordEligibility(shot: RecordShot) {
  const distance = recordDistance(shot, "total");

  if (distance === null) {
    return {
      rawEligible: false,
      trustedEligible: false,
      reasons: ["missing-distance"] satisfies RecordEligibilityReason[],
    };
  }

  if (distance <= 0) {
    return {
      rawEligible: false,
      trustedEligible: false,
      reasons: ["non-positive-distance"] satisfies RecordEligibilityReason[],
    };
  }

  const reasons: RecordEligibilityReason[] = [];
  const qualityTag = normalizedValue(shot.qualityTag);
  const shotCategory = normalizedValue(shot.shotCategory);
  const sessionSource = normalizedValue(shot.sessionSource);

  if (qualityTag && excludedQualityTagSet.has(qualityTag)) {
    reasons.push("quality-tag");
  }

  if (shotCategory && excludedShotCategorySet.has(shotCategory)) {
    reasons.push("shot-category");
  }

  if (!sessionSource || manualSessionSources.has(sessionSource)) {
    reasons.push("manual-source");
  }

  return {
    rawEligible: true,
    trustedEligible: reasons.length === 0,
    reasons,
  };
}

export function selectAllTimeRecord<T extends RecordShot>(
  shots: T[],
  metric: RecordDistanceMetric,
  scope: RecordEvidenceScope,
) {
  return shots.reduce<T | null>((best, shot) => {
    const eligibility = recordEligibility(shot);
    const eligible = scope === "trusted" ? eligibility.trustedEligible : eligibility.rawEligible;
    const distance = recordDistance(shot, metric);

    if (!eligible || distance === null || distance <= 0) {
      return best;
    }

    const bestDistance = best ? recordDistance(best, metric) : null;
    return bestDistance === null || distance > bestDistance ? shot : best;
  }, null);
}

export function recordDistance(
  shot: Pick<RecordShot, "carryYd" | "totalYd">,
  metric: RecordDistanceMetric,
) {
  return metric === "carry" ? shot.carryYd : (shot.totalYd ?? shot.carryYd);
}

function normalizedValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}
