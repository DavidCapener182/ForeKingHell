import { isShortGameTouchClubType } from "@/lib/club-format";
import { quarantineIncompatibleTotalDistance } from "@/lib/imports/shot-metric-integrity";

export type ShotQualityClassification =
  | "stock_quality"
  | "likely_mishit"
  | "needs_review"
  | "partial_shot"
  | "bad_data_field";

export type ClubIdentityProvenance = "source" | "mapped_source" | "inferred" | "unknown";

export type ImportedShotClubIdentity = {
  type: string | null;
  rawLabel: string | null;
  provenance: ClubIdentityProvenance;
};

export type ImportedShotForTriage = {
  rowNumber?: number;
  club: ImportedShotClubIdentity;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  shotCategory?: string | null;
};

export type RobustMetricProfile = {
  median: number;
  medianAbsoluteDeviation?: number | null;
  p05?: number | null;
  p25?: number | null;
  p75?: number | null;
};

/**
 * Robust evidence for exactly one club. Established history remains the default; callers may mark
 * a smaller profile as import-session scoped when it was built conservatively from that one file.
 */
export type EstablishedClubProfile = {
  clubType: string;
  sampleSize: number;
  scope?: "established_history" | "import_session";
  carryYd: RobustMetricProfile;
  ballSpeedMph?: RobustMetricProfile | null;
  smashFactor?: RobustMetricProfile | null;
};

export type ShotQualityMetricField =
  | "carryYd"
  | "totalYd"
  | "ballSpeedMph"
  | "clubSpeedMph"
  | "smashFactor";

export type ShotQualityEvidenceCode =
  | "total_below_carry"
  | "non_finite_metric"
  | "negative_metric"
  | "invalid_smash_factor"
  | "smash_speed_mismatch"
  | "impossible_speed_ratio"
  | "explicit_partial_category"
  | "short_game_partial_distance"
  | "carry_far_below_profile"
  | "ball_speed_far_below_profile"
  | "smash_far_below_profile";

export type ShotQualityEvidence = {
  code: ShotQualityEvidenceCode;
  fields: ShotQualityMetricField[];
  explanation: string;
};

export type ShotFieldQuarantine = {
  field: ShotQualityMetricField;
  value: number;
  code: ShotQualityEvidenceCode;
  explanation: string;
};

export type ShotQualityTriage = {
  /** Advisory only: this value must not be treated as an automatic review-status mutation. */
  classification: ShotQualityClassification;
  evidence: ShotQualityEvidence[];
  fieldQuarantines: ShotFieldQuarantine[];
  profileUsed: boolean;
};

const MINIMUM_ESTABLISHED_PROFILE_SAMPLE = 20;
const MINIMUM_IMPORT_SESSION_PROFILE_SAMPLE = 5;
const MINIMUM_OPTIONAL_METRIC_SAMPLE = 5;
const SHORT_GAME_PARTIAL_WITHOUT_PROFILE_MAX_YD = 60;
const SCORING_WEDGE_TYPES = new Set(["pw", "gw", "aw", "sw", "lw", "wedge"]);
const PARTIAL_CATEGORIES = new Set([
  "chip",
  "pitch",
  "partial",
  "half",
  "half-shot",
  "three-quarter",
  "three-quarter-shot",
]);
const TRUSTED_CLUB_PROVENANCE = new Set<ClubIdentityProvenance>(["source", "mapped_source"]);

/**
 * Produces an explainable, review-only suggestion. It never mutates the shot, applies a quality
 * tag, or changes review status. `stock_quality` means no conservative rule fired; it is not a
 * guarantee that the shot was a stock swing.
 */
export function triageImportedShotQuality(
  shot: ImportedShotForTriage,
  profile?: EstablishedClubProfile | null,
): ShotQualityTriage {
  const badData = detectBadDataFields(shot);
  const matchedProfile = matchingEstablishedProfile(shot, profile);

  if (badData.evidence.length > 0) {
    return {
      classification: "bad_data_field",
      evidence: badData.evidence,
      fieldQuarantines: badData.fieldQuarantines,
      profileUsed: matchedProfile !== null,
    };
  }

  const partialEvidence = detectPartialShot(shot, matchedProfile);

  if (partialEvidence) {
    return {
      classification: "partial_shot",
      evidence: [partialEvidence],
      fieldQuarantines: [],
      profileUsed: matchedProfile !== null,
    };
  }

  const mishitEvidence = matchedProfile ? detectLikelyMishit(shot, matchedProfile) : [];

  if (mishitEvidence.length > 0) {
    return {
      classification: "likely_mishit",
      evidence: mishitEvidence,
      fieldQuarantines: [],
      profileUsed: true,
    };
  }

  const reviewEvidence = matchedProfile ? detectNeedsReview(shot, matchedProfile) : [];

  return {
    classification: reviewEvidence.length > 0 ? "needs_review" : "stock_quality",
    evidence: reviewEvidence,
    fieldQuarantines: [],
    profileUsed: matchedProfile !== null,
  };
}

/** Builds an equipment/context profile from rows the caller has already restricted to trusted evidence. */
export function buildEstablishedClubProfile(
  clubType: string,
  rows: ReadonlyArray<{
    carryYd: number | null;
    ballSpeedMph: number | null;
    smashFactor: number | null;
  }>,
  options: { scope?: "established_history" | "import_session" } = {},
): EstablishedClubProfile | null {
  const carryValues = finitePositiveValues(rows.map((row) => row.carryYd));
  const scope = options.scope ?? "established_history";
  const minimumSampleSize =
    scope === "import_session"
      ? MINIMUM_IMPORT_SESSION_PROFILE_SAMPLE
      : MINIMUM_ESTABLISHED_PROFILE_SAMPLE;

  if (carryValues.length < minimumSampleSize) {
    return null;
  }

  return {
    clubType: normalizedClubType(clubType),
    sampleSize: carryValues.length,
    scope,
    carryYd: buildRobustMetricProfile(carryValues),
    ballSpeedMph: optionalMetricProfile(rows.map((row) => row.ballSpeedMph)),
    smashFactor: optionalMetricProfile(rows.map((row) => row.smashFactor)),
  };
}

function detectBadDataFields(shot: ImportedShotForTriage) {
  const evidence: ShotQualityEvidence[] = [];
  const fieldQuarantines: ShotFieldQuarantine[] = [];
  const metrics: Array<[ShotQualityMetricField, number | null]> = [
    ["carryYd", shot.carryYd],
    ["totalYd", shot.totalYd],
    ["ballSpeedMph", shot.ballSpeedMph],
    ["clubSpeedMph", shot.clubSpeedMph],
    ["smashFactor", shot.smashFactor],
  ];

  for (const [field, value] of metrics) {
    if (value === null) {
      continue;
    }

    if (!Number.isFinite(value)) {
      addQuarantine({
        evidence,
        fieldQuarantines,
        field,
        value,
        code: "non_finite_metric",
        explanation: `${metricLabel(field)} is not a finite number.`,
      });
      continue;
    }

    if (value < 0 && field !== "smashFactor") {
      addQuarantine({
        evidence,
        fieldQuarantines,
        field,
        value,
        code: "negative_metric",
        explanation: `${metricLabel(field)} cannot be negative in this import context.`,
      });
    }
  }

  if (isPositiveFinite(shot.carryYd) && isFiniteNumber(shot.totalYd) && shot.totalYd >= 0) {
    const totalCheck = quarantineIncompatibleTotalDistance({
      carryYd: shot.carryYd,
      totalYd: shot.totalYd,
      rowNumber: shot.rowNumber ?? 0,
    });

    if (totalCheck.warning) {
      addQuarantine({
        evidence,
        fieldQuarantines,
        field: "totalYd",
        value: shot.totalYd,
        code: "total_below_carry",
        explanation: `Total distance ${formatNumber(shot.totalYd)} yd is grossly below carry ${formatNumber(shot.carryYd)} yd; quarantine total only.`,
      });
    }
  }

  if (isFiniteNumber(shot.smashFactor) && (shot.smashFactor <= 0 || shot.smashFactor > 1.8)) {
    addQuarantine({
      evidence,
      fieldQuarantines,
      field: "smashFactor",
      value: shot.smashFactor,
      code: "invalid_smash_factor",
      explanation: `Reported smash factor ${formatNumber(shot.smashFactor)} is outside the conservative 0-1.80 integrity range.`,
    });
  }

  if (isPositiveFinite(shot.ballSpeedMph) && isPositiveFinite(shot.clubSpeedMph)) {
    const calculatedSmash = shot.ballSpeedMph / shot.clubSpeedMph;

    if (calculatedSmash > 1.8) {
      evidence.push({
        code: "impossible_speed_ratio",
        fields: ["ballSpeedMph", "clubSpeedMph"],
        explanation: `Ball speed divided by club speed is ${formatNumber(calculatedSmash)}, so at least one speed field needs review.`,
      });
    }

    if (isPositiveFinite(shot.smashFactor)) {
      const mismatch = Math.abs(shot.smashFactor - calculatedSmash);
      const mismatchThreshold = Math.max(0.12, calculatedSmash * 0.1);

      if (mismatch >= mismatchThreshold) {
        addQuarantine({
          evidence,
          fieldQuarantines,
          field: "smashFactor",
          value: shot.smashFactor,
          code: "smash_speed_mismatch",
          explanation: `Reported smash ${formatNumber(shot.smashFactor)} conflicts with ${formatNumber(calculatedSmash)} calculated from ball and club speed.`,
        });
      }
    }
  }

  return { evidence, fieldQuarantines };
}

function detectPartialShot(
  shot: ImportedShotForTriage,
  profile: EstablishedClubProfile | null,
): ShotQualityEvidence | null {
  const category = shot.shotCategory?.trim().toLowerCase() ?? "";

  if (PARTIAL_CATEGORIES.has(category)) {
    return {
      code: "explicit_partial_category",
      fields: [],
      explanation: `The source categorises this as a ${category} rather than a stock swing.`,
    };
  }

  if (
    !hasTrustedClubIdentity(shot.club) ||
    !isShortGameTouchClubType(shot.club.type) ||
    !isPositiveFinite(shot.carryYd)
  ) {
    return null;
  }

  const profileMedian =
    profile && validDistribution(profile.carryYd) ? profile.carryYd.median : null;
  const profileRelativePartial =
    profileMedian !== null &&
    shot.carryYd <= profileMedian * 0.75 &&
    profileMedian - shot.carryYd >= 10;
  const noProfilePartial =
    profileMedian === null && shot.carryYd <= SHORT_GAME_PARTIAL_WITHOUT_PROFILE_MAX_YD;

  if (!profileRelativePartial && !noProfilePartial) {
    return null;
  }

  return {
    code: "short_game_partial_distance",
    fields: ["carryYd"],
    explanation:
      profileMedian === null
        ? `${formatNumber(shot.carryYd)} yd with a source-identified ${normalizedClubType(shot.club.type).toUpperCase()} is treated as short-game intent, not a mishit.`
        : `${formatNumber(shot.carryYd)} yd is well below this short-game club's established ${formatNumber(profileMedian)} yd full-shot centre.`,
  };
}

function detectLikelyMishit(
  shot: ImportedShotForTriage,
  profile: EstablishedClubProfile,
): ShotQualityEvidence[] {
  const evidence: ShotQualityEvidence[] = [];
  const carrySignal = highConfidenceCarrySignal(shot.carryYd, profile.carryYd);

  if (carrySignal) {
    evidence.push({
      code: "carry_far_below_profile",
      fields: ["carryYd"],
      explanation: `${formatNumber(shot.carryYd)} yd carry is below the conservative ${formatNumber(carrySignal.threshold)} yd review boundary for this club's ${profile.sampleSize}-shot profile.`,
    });
  }

  const ballSpeedSignal = lowProfileSignal(shot.ballSpeedMph, profile.ballSpeedMph, {
    minimumDelta: 8,
    minimumRatioDelta: 0.12,
    extremeRatio: 0.78,
  });

  if (ballSpeedSignal) {
    evidence.push({
      code: "ball_speed_far_below_profile",
      fields: ["ballSpeedMph"],
      explanation: `${formatNumber(shot.ballSpeedMph)} mph ball speed is below the conservative ${formatNumber(ballSpeedSignal.threshold)} mph review boundary.`,
    });
  }

  const smashSignal = lowProfileSignal(shot.smashFactor, profile.smashFactor, {
    minimumDelta: 0.1,
    minimumRatioDelta: 0.08,
    extremeRatio: 0.82,
  });

  if (smashSignal) {
    evidence.push({
      code: "smash_far_below_profile",
      fields: ["smashFactor"],
      explanation: `Smash ${formatNumber(shot.smashFactor)} is below the conservative ${formatNumber(smashSignal.threshold)} review boundary.`,
    });
  }

  if (!carrySignal) {
    return [];
  }

  return evidence;
}

function detectNeedsReview(
  shot: ImportedShotForTriage,
  profile: EstablishedClubProfile,
): ShotQualityEvidence[] {
  if (
    SCORING_WEDGE_TYPES.has(normalizedClubType(shot.club.type)) ||
    !isPositiveFinite(shot.carryYd) ||
    !isFiniteNumber(profile.carryYd.p05) ||
    shot.carryYd > profile.carryYd.median * 0.9 ||
    shot.carryYd > profile.carryYd.p05
  ) {
    return [];
  }

  const lowBallSpeed = atOrBelowLowerQuartile(shot.ballSpeedMph, profile.ballSpeedMph);
  const lowSmash = atOrBelowLowerQuartile(shot.smashFactor, profile.smashFactor);

  if (!lowBallSpeed && !lowSmash) {
    return [];
  }

  const evidence: ShotQualityEvidence[] = [
    {
      code: "carry_far_below_profile",
      fields: ["carryYd"],
      explanation: `${formatNumber(shot.carryYd)} yd carry sits in the extreme low tail of this club's ${profile.sampleSize}-shot profile and needs player review.`,
    },
  ];

  if (lowBallSpeed) {
    evidence.push({
      code: "ball_speed_far_below_profile",
      fields: ["ballSpeedMph"],
      explanation: `${formatNumber(shot.ballSpeedMph)} mph ball speed is at or below this club's lower quartile.`,
    });
  }
  if (lowSmash) {
    evidence.push({
      code: "smash_far_below_profile",
      fields: ["smashFactor"],
      explanation: `Smash ${formatNumber(shot.smashFactor)} is at or below this club's lower quartile.`,
    });
  }

  return evidence;
}

function highConfidenceCarrySignal(value: number | null, distribution: RobustMetricProfile) {
  if (!isPositiveFinite(value) || value >= distribution.median) {
    return null;
  }

  const robustScale = distributionScale(distribution);
  const ratioBoundary = distribution.median * 0.75;
  const threshold =
    robustScale === null
      ? ratioBoundary
      : Math.min(ratioBoundary, distribution.median - robustScale * 3);
  return value <= threshold ? { threshold } : null;
}

function matchingEstablishedProfile(
  shot: ImportedShotForTriage,
  profile: EstablishedClubProfile | null | undefined,
) {
  const minimumSampleSize =
    profile?.scope === "import_session"
      ? MINIMUM_IMPORT_SESSION_PROFILE_SAMPLE
      : MINIMUM_ESTABLISHED_PROFILE_SAMPLE;

  if (
    !profile ||
    !Number.isFinite(profile.sampleSize) ||
    profile.sampleSize < minimumSampleSize ||
    !hasTrustedClubIdentity(shot.club) ||
    normalizedClubType(profile.clubType) !== normalizedClubType(shot.club.type) ||
    !validDistribution(profile.carryYd)
  ) {
    return null;
  }

  return profile;
}

function lowProfileSignal(
  value: number | null,
  distribution: RobustMetricProfile | null | undefined,
  thresholds: {
    minimumDelta: number;
    minimumRatioDelta: number;
    extremeRatio: number;
  },
) {
  if (
    !isPositiveFinite(value) ||
    !validDistribution(distribution) ||
    value >= distribution.median
  ) {
    return null;
  }

  const robustScale = distributionScale(distribution);
  const requiredDelta = Math.max(
    thresholds.minimumDelta,
    distribution.median * thresholds.minimumRatioDelta,
    robustScale === null ? 0 : robustScale * 3.5,
  );
  const threshold = Math.max(
    distribution.median - requiredDelta,
    distribution.median * thresholds.extremeRatio,
  );

  return value <= threshold ? { threshold } : null;
}

function atOrBelowLowerQuartile(
  value: number | null,
  distribution: RobustMetricProfile | null | undefined,
) {
  return Boolean(
    isPositiveFinite(value) &&
    distribution &&
    isPositiveFinite(distribution.p25) &&
    value <= distribution.p25,
  );
}

function optionalMetricProfile(values: Array<number | null>) {
  const finiteValues = finitePositiveValues(values);
  return finiteValues.length >= MINIMUM_OPTIONAL_METRIC_SAMPLE
    ? buildRobustMetricProfile(finiteValues)
    : null;
}

function finitePositiveValues(values: Array<number | null>) {
  return values.filter(isPositiveFinite).sort((left, right) => left - right);
}

function buildRobustMetricProfile(sortedValues: number[]): RobustMetricProfile {
  const median = percentile(sortedValues, 0.5);
  const absoluteDeviations = sortedValues
    .map((value) => Math.abs(value - median))
    .sort((left, right) => left - right);

  return {
    median,
    medianAbsoluteDeviation: percentile(absoluteDeviations, 0.5),
    p05: percentile(sortedValues, 0.05),
    p25: percentile(sortedValues, 0.25),
    p75: percentile(sortedValues, 0.75),
  };
}

function percentile(sortedValues: number[], quantile: number) {
  const index = (sortedValues.length - 1) * quantile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sortedValues[lowerIndex] ?? sortedValues[0] ?? 0;
  const upper = sortedValues[upperIndex] ?? lower;
  return lower + (upper - lower) * (index - lowerIndex);
}

function distributionScale(distribution: RobustMetricProfile) {
  const scales: number[] = [];

  if (
    isPositiveFinite(distribution.medianAbsoluteDeviation) &&
    distribution.medianAbsoluteDeviation > 0
  ) {
    scales.push(distribution.medianAbsoluteDeviation * 1.4826);
  }

  if (
    isFiniteNumber(distribution.p25) &&
    isFiniteNumber(distribution.p75) &&
    distribution.p75 > distribution.p25
  ) {
    scales.push((distribution.p75 - distribution.p25) / 1.349);
  }

  return scales.length > 0 ? Math.max(...scales) : null;
}

function validDistribution(
  distribution: RobustMetricProfile | null | undefined,
): distribution is RobustMetricProfile {
  return Boolean(distribution && isPositiveFinite(distribution.median));
}

function hasTrustedClubIdentity(club: ImportedShotClubIdentity) {
  const type = normalizedClubType(club.type);
  return (
    TRUSTED_CLUB_PROVENANCE.has(club.provenance) &&
    type.length > 0 &&
    !["unknown", "other", "ot"].includes(type)
  );
}

function normalizedClubType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function addQuarantine({
  evidence,
  fieldQuarantines,
  field,
  value,
  code,
  explanation,
}: {
  evidence: ShotQualityEvidence[];
  fieldQuarantines: ShotFieldQuarantine[];
  field: ShotQualityMetricField;
  value: number;
  code: ShotQualityEvidenceCode;
  explanation: string;
}) {
  evidence.push({ code, fields: [field], explanation });

  if (!fieldQuarantines.some((quarantine) => quarantine.field === field)) {
    fieldQuarantines.push({ field, value, code, explanation });
  }
}

function metricLabel(field: ShotQualityMetricField) {
  const labels: Record<ShotQualityMetricField, string> = {
    carryYd: "Carry distance",
    totalYd: "Total distance",
    ballSpeedMph: "Ball speed",
    clubSpeedMph: "Club speed",
    smashFactor: "Smash factor",
  };
  return labels[field];
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null) {
  return value === null ? "missing" : Number(value.toFixed(2)).toString();
}
