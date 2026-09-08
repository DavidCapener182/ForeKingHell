import { isTrackedClubType } from "@/lib/club-format";
import { isShotEvidenceEligible } from "@/lib/shot-review";
import type { TodayPracticeShot } from "@/lib/today-session-data";

export function isComparisonShot(shot: TodayPracticeShot) {
  if (!isCleanPracticeShot(shot)) {
    return false;
  }

  return isRawComparisonShot(shot);
}

export function isRawComparisonShot(shot: TodayPracticeShot) {
  if (!isTrackedClubType(shot.clubType)) {
    return false;
  }

  if (shot.shotCategory === "chip" || shot.shotCategory === "recovery") {
    return false;
  }

  return isNumber(shot.carryYd) || isNumber(shot.sideCarryYd) || isNumber(shot.ballSpeedMph);
}

export function isCleanPracticeShot(
  shot: Pick<
    TodayPracticeShot,
    "reviewStatus" | "qualityTag" | "shotCategory" | "dataIntegrityIssue"
  >,
) {
  if (!isShotEvidenceEligible(shot)) {
    return false;
  }

  return shot.reviewStatus === "restored" || shot.dataIntegrityIssue === null;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
