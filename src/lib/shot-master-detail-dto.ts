import type { ShotMasterDetailRow } from "@/app/shots/shots-master-detail-table";
import { formatClubModelName, formatClubType } from "@/lib/club-format";
import { isPermanentShotDeletionRestricted } from "@/lib/shot-deletion";
import { recordEligibility, type RecordEligibilityReason } from "@/lib/shot-records";
import {
  effectiveShotReviewStatus,
  shotReviewStatusLabel,
  type ShotReviewSource,
  type ShotReviewStatus,
} from "@/lib/shot-review";

export type ShotMasterDetailReviewEventSource = {
  id: string;
  previousStatus: ShotReviewStatus;
  status: ShotReviewStatus;
  reason: string;
  confidence: number;
  source: ShotReviewSource;
  previousQualityTag: string | null;
  resultingQualityTag: string | null;
  createdAt: Date;
};

export type ShotMasterDetailSource = {
  id: string;
  sessionId: string;
  sessionSource: string;
  sessionType: string;
  sessionPlayContext: string | null;
  sessionCourseId: string | null;
  providerKind: string | null;
  providerSessionMode: string | null;
  fileName: string | null;
  shotAt: Date;
  shotNumber: number | null;
  courseHoleNumber: number | null;
  courseHoleShotNumber: number | null;
  clubType: string;
  clubBrand: string | null;
  clubModel: string | null;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  sideCarryYd: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  shotShape: string | null;
  shotCategory: string;
  qualityTag: string | null;
  reviewStatus: ShotReviewStatus;
  reviewReason: string | null;
  reviewConfidence: number | null;
  reviewSource: ShotReviewSource | null;
  reviewedAt: Date | null;
  clubDataEstType: string | null;
  sourceRawJson: Record<string, unknown>;
  reviewEvents: ShotMasterDetailReviewEventSource[];
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

/**
 * Builds the deliberately small, serialisable detail contract used by shot-inspection clients.
 * Ownership must be checked by the data-access function before calling this builder.
 */
export function buildShotMasterDetailDto(shot: ShotMasterDetailSource): ShotMasterDetailRow {
  const reviewStatus = effectiveShotReviewStatus({
    reviewStatus: shot.reviewStatus,
    qualityTag: shot.qualityTag,
    shotCategory: shot.shotCategory,
  });
  const eligibility = recordEligibility({
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    qualityTag: shot.qualityTag,
    reviewStatus,
    shotCategory: shot.shotCategory,
    sessionSource: shot.sessionSource,
  });

  return {
    id: shot.id,
    sessionId: shot.sessionId,
    shotAtLabel: formatDate(shot.shotAt),
    fileNameLabel: shot.fileName ?? "Untitled session",
    shotNumberLabel: shot.shotNumber?.toString() ?? "--",
    holeLabel: formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber),
    clubLabel: formatClubModelName({
      type: shot.clubType,
      brand: shot.clubBrand,
      model: shot.clubModel,
    }),
    clubTypeLabel: formatClubType(shot.clubType),
    clubType: shot.clubType,
    shotCategoryLabel: formatSessionType(shot.shotCategory),
    carryLabel: formatMetric(shot.carryYd),
    totalLabel: formatMetric(shot.totalYd),
    sideLabel: formatMetric(shot.sideCarryYd),
    launchLabel: formatMetric(shot.launchAngleDeg),
    ballSpeedLabel: formatMetric(shot.ballSpeedMph),
    clubSpeedLabel: formatMetric(shot.clubSpeedMph),
    launchDirectionLabel: formatMetric(shot.launchDirectionDeg),
    apexLabel: formatMetric(shot.apexFt),
    attackLabel: formatMetric(shot.attackAngleDeg),
    pathLabel: formatMetric(shot.clubPathDeg),
    faceLabel: formatMetric(shot.faceAngleDeg),
    descentLabel: formatMetric(shot.descentAngleDeg),
    smashLabel: formatMetric(shot.smashFactor),
    spinRateLabel: formatMetric(shot.spinRate),
    spinAxisLabel: formatMetric(shot.spinAxis),
    estimateLabel: shot.clubDataEstType ? formatSessionType(shot.clubDataEstType) : "Measured",
    shotShapeLabel: shot.shotShape
      ? formatSessionType(shot.shotShape)
      : inferShotShape(shot.sideCarryYd),
    qualityTagLabel: shot.qualityTag ? formatSessionType(shot.qualityTag) : "--",
    reviewStatus,
    reviewStatusLabel: shotReviewStatusLabel(reviewStatus),
    reviewReason: shot.reviewReason,
    reviewConfidenceLabel: formatConfidence(shot.reviewConfidence),
    reviewSourceLabel: shot.reviewSource ? formatSessionType(shot.reviewSource) : "--",
    reviewedAtLabel: shot.reviewedAt ? formatDateTime(shot.reviewedAt) : "--",
    reviewEvents: shot.reviewEvents.map((event) => ({
      id: event.id,
      previousStatusLabel: shotReviewStatusLabel(event.previousStatus),
      statusLabel: shotReviewStatusLabel(event.status),
      reason: event.reason,
      confidenceLabel: formatConfidence(event.confidence),
      sourceLabel: formatSessionType(event.source),
      previousQualityTagLabel: event.previousQualityTag
        ? formatSessionType(event.previousQualityTag)
        : "None",
      resultingQualityTagLabel: event.resultingQualityTag
        ? formatSessionType(event.resultingQualityTag)
        : "None",
      createdAtLabel: formatDateTime(event.createdAt),
    })),
    evidenceStatus: eligibility.trustedEligible ? "trusted" : "untrusted",
    evidenceReasons: eligibility.reasons.map(formatEligibilityReason),
    sideTone: sideCarryTone(shot.sideCarryYd),
    carryYd: shot.carryYd,
    sideCarryYd: shot.sideCarryYd,
    apexFt: shot.apexFt,
    sourceEntries: Object.entries(shot.sourceRawJson ?? {})
      .map(([key, value]) => ({ key, value: String(value) }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    canDeletePermanently: !isPermanentShotDeletionRestricted({
      sessionType: shot.sessionType,
      sessionPlayContext: shot.sessionPlayContext,
      sessionCourseId: shot.sessionCourseId,
      courseHoleNumber: shot.courseHoleNumber,
      providerKind: shot.providerKind,
      providerSessionMode: shot.providerSessionMode,
    }),
  };
}

function formatEligibilityReason(reason: RecordEligibilityReason) {
  switch (reason) {
    case "missing-distance":
      return "No usable carry or total distance";
    case "non-positive-distance":
      return "Distance is zero or negative";
    case "review-status":
      return "Review status excludes this row";
    case "quality-tag":
      return "Quality flag excludes this row";
    case "shot-category":
      return "Shot type is outside trusted stock evidence";
    case "manual-source":
      return "Manual source requires review";
  }
}

function sideCarryTone(value: number | null): ShotMasterDetailRow["sideTone"] {
  if (value === null) return "slate";
  const offline = Math.abs(value);
  if (offline <= 8) return "green";
  if (offline <= 20) return "amber";
  return "red";
}

function inferShotShape(sideCarryYd: number | null) {
  if (sideCarryYd === null || Math.abs(sideCarryYd) < 4) return "Straight";
  return sideCarryYd < 0 ? "Finishes left" : "Finishes right";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatConfidence(value: number | null) {
  return value === null ? "--" : `${Math.round(value * 100)}%`;
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatSessionType(value: string) {
  if (value === "real_round") return "Real round";
  if (value === "simulated_course") return "Sim course";
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) return "--";
  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}
