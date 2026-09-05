import {
  buildEstablishedClubProfile,
  triageImportedShotQuality,
  type EstablishedClubProfile,
  type RobustMetricProfile,
} from "@/lib/imports/shot-quality-triage";
import { recordEligibility } from "@/lib/shot-records";
import type { ShotReviewStatus } from "@/lib/shot-review";

export type ReviewEvidenceShot = {
  id: string;
  sessionId: string;
  clubId: string;
  clubType: string;
  playContext: string;
  sessionSource: string;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  shotCategory: string;
  qualityTag: string | null;
  reviewStatus: ShotReviewStatus;
  reviewSource: string | null;
};
export type AutomaticShotSuggestion = {
  classification:
    | "Possible wrong club"
    | "Partial swing"
    | "Sensor anomaly"
    | "Suggested exclusion";
  reason: string;
  confidence: "High" | "Moderate";
  suggestedClubId?: string;
  sampleSize?: number;
  actionable?: boolean;
};

/** Advisory only. The caller supplies owned history; profiles never include the candidate's session. */
export function createAutomaticShotReviewer(history: readonly ReviewEvidenceShot[]) {
  const cache = new Map<string, Array<EstablishedClubProfile & { clubId: string }>>();
  return (shot: ReviewEvidenceShot): AutomaticShotSuggestion | null => {
    if (
      shot.reviewSource === "user" ||
      !["included", "suggested_exclusion"].includes(shot.reviewStatus)
    )
      return null;
    const key = JSON.stringify([shot.playContext, shot.sessionSource, shot.sessionId]);
    let profiles = cache.get(key);
    if (!profiles) {
      const grouped = new Map<string, ReviewEvidenceShot[]>();
      for (const row of history) {
        if (
          row.sessionId === shot.sessionId ||
          row.playContext !== shot.playContext ||
          row.sessionSource !== shot.sessionSource ||
          !recordEligibility(row).trustedEligible ||
          row.reviewStatus === "suggested_exclusion"
        )
          continue;
        if (
          !["full", "tee", "approach"].includes(row.shotCategory) ||
          !positive(row.carryYd) ||
          !positive(row.ballSpeedMph)
        )
          continue;
        const rows = grouped.get(row.clubId) ?? [];
        rows.push(row);
        grouped.set(row.clubId, rows);
      }
      profiles = [];
      for (const [clubId, rows] of grouped) {
        if (new Set(rows.map((row) => row.sessionId)).size < 2) continue;
        const profile = buildEstablishedClubProfile(rows[0].clubType, rows);
        if (profile) profiles.push({ ...profile, clubId });
      }
      cache.set(key, profiles);
    }
    const own = profiles.find((profile) => profile.clubId === shot.clubId);
    const triage = triageImportedShotQuality(
      {
        club: { type: shot.clubType, rawLabel: null, provenance: "source" },
        carryYd: shot.carryYd,
        totalYd: shot.totalYd,
        ballSpeedMph: shot.ballSpeedMph,
        clubSpeedMph: shot.clubSpeedMph,
        smashFactor: shot.smashFactor,
        shotCategory: shot.shotCategory,
      },
      own,
    );
    if (triage.classification === "bad_data_field")
      return {
        classification: "Sensor anomaly",
        confidence: "High",
        reason: triage.evidence.map((e) => e.explanation).join(" "),
      };
    if (triage.classification === "partial_shot")
      return {
        classification: "Partial swing",
        actionable: ["full", "tee", "approach"].includes(shot.shotCategory),
        confidence: shot.shotCategory === "full" ? "Moderate" : "High",
        reason: triage.evidence.map((e) => e.explanation).join(" "),
      };
    // Shorter carries may be intentional partials or poor strikes. Only unusually LONG and FAST
    // full swings can suggest another club, and exactly one independently established club must fit.
    if (
      own?.ballSpeedMph &&
      ["full", "tee", "approach"].includes(shot.shotCategory) &&
      positive(shot.carryYd) &&
      positive(shot.ballSpeedMph) &&
      aboveOuterFence(shot.carryYd, own.carryYd, 8) &&
      aboveOuterFence(shot.ballSpeedMph, own.ballSpeedMph, 4)
    ) {
      const matches = profiles.filter(
        (profile) =>
          profile.clubId !== shot.clubId &&
          profile.clubType !== shot.clubType &&
          profile.ballSpeedMph &&
          inside(shot.carryYd!, profile.carryYd, 4) &&
          inside(shot.ballSpeedMph!, profile.ballSpeedMph, 2),
      );
      if (matches.length === 1)
        return {
          classification: "Possible wrong club",
          confidence: "Moderate",
          suggestedClubId: matches[0].clubId,
          sampleSize: matches[0].sampleSize,
          reason: `Carry and ball speed are unusually high for the recorded club, but both match the middle range of ${matches[0].sampleSize} trusted ${matches[0].clubType} shots from other sessions. Confirm the club; this is not proof of a labelling error.`,
        };
    }
    if (["likely_mishit", "needs_review"].includes(triage.classification))
      return {
        classification: "Suggested exclusion",
        confidence: "Moderate",
        reason:
          triage.evidence.map((e) => e.explanation).join(" ") +
          " A poor strike can be real performance evidence; keep it if it represents your game.",
      };
    if (shot.reviewStatus === "suggested_exclusion")
      return {
        classification: "Suggested exclusion",
        confidence: "Moderate",
        reason: "The imported quality flag needs your review. Raw measurements are retained.",
      };
    return null;
  };
}
function positive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}
function aboveOuterFence(value: number, profile: RobustMetricProfile, floor: number) {
  const low = profile.p25 ?? profile.median;
  const high = profile.p75 ?? profile.median;
  return value > high + 3 * Math.max(floor, high - low);
}
function inside(value: number, profile: RobustMetricProfile, floor: number) {
  return (
    value >= Math.min(profile.p25 ?? profile.median, profile.median - floor) &&
    value <= Math.max(profile.p75 ?? profile.median, profile.median + floor)
  );
}
