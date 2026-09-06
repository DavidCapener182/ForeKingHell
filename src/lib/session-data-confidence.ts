/** Evidence labels, not calibrated probabilities. Raw measurements are never rewritten. */
export const ALIGNMENT_STATUSES = [
  "aligned",
  "possibly_misaligned",
  "misaligned",
  "unknown",
] as const;
export type AlignmentStatus = (typeof ALIGNMENT_STATUSES)[number];
export type DirectionReview = "unreviewed" | "confirmed" | "questionable";
export type SessionDataConfidence = {
  alignment?: AlignmentStatus;
  updatedAt?: string;
  directionReviews?: Record<string, { status: DirectionReview; updatedAt: string }>;
};
export const alignmentLabels: Record<AlignmentStatus, string> = {
  aligned: "Correctly aligned",
  possibly_misaligned: "Possibly misaligned",
  misaligned: "Misaligned",
  unknown: "Alignment unknown",
};
export function alignmentStatus(value: unknown): AlignmentStatus {
  return ALIGNMENT_STATUSES.includes(value as AlignmentStatus)
    ? (value as AlignmentStatus)
    : "unknown";
}
export function directionIsUsable(confidence?: SessionDataConfidence | null, shotId?: string) {
  const alignment = alignmentStatus(confidence?.alignment);
  return (
    alignment !== "possibly_misaligned" &&
    alignment !== "misaligned" &&
    (!shotId || confidence?.directionReviews?.[shotId]?.status !== "questionable")
  );
}
export type FlightEvidenceInput = {
  id?: string;
  carryYd?: number | null;
  sideCarryYd?: number | null;
  launchDirectionDeg?: number | null;
  faceAngleDeg?: number | null;
  clubPathDeg?: number | null;
  spinRate?: number | null;
  spinAxis?: number | null;
  sourceRawJson?: Record<string, unknown> | null;
  dataConfidence?: SessionDataConfidence | null;
};
export type FlightEvidence = {
  endpointSource: "source_reported" | "unknown" | "unavailable";
  faceSource: "source_reported" | "modelled" | "unknown" | "unavailable";
  directionUsable: boolean;
  directionConfidence: "limited" | "developing" | "supported" | "unavailable";
  reviewStatus: DirectionReview;
  needsReview: boolean;
  reasons: string[];
  faceToPathDeg: number | null;
  curvatureResidualYd: number | null;
};
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function hasSourceNumber(raw: Record<string, unknown> | null | undefined, keys: string[]) {
  return Object.entries(raw ?? {}).some(([key, value]) => {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    return (
      keys.some(
        (k) =>
          normalized === k ||
          normalized === k + "yd" ||
          normalized === k + "yards" ||
          normalized === k + "deg",
      ) &&
      value !== null &&
      String(value).trim() !== "" &&
      Number.isFinite(Number(value))
    );
  });
}
export function assessFlightEvidence(shot: FlightEvidenceInput): FlightEvidence {
  const endpointSource = !finite(shot.sideCarryYd)
    ? "unavailable"
    : hasSourceNumber(shot.sourceRawJson, [
          "side",
          "sidecarry",
          "sidecarrydistance",
          "offline",
          "offlineyards",
          "sidedistance",
        ])
      ? "source_reported"
      : "unknown";
  const faceSource = !finite(shot.faceAngleDeg)
    ? "unavailable"
    : hasSourceNumber(shot.sourceRawJson, ["face", "faceangle", "clubfaceangle"])
      ? "source_reported"
      : finite(shot.launchDirectionDeg) &&
          finite(shot.clubPathDeg) &&
          Math.abs(shot.faceAngleDeg - (shot.launchDirectionDeg - shot.clubPathDeg * 0.2) / 0.8) <
            0.11
        ? "modelled"
        : "unknown";
  const reviewStatus = shot.id
    ? (shot.dataConfidence?.directionReviews?.[shot.id]?.status ?? "unreviewed")
    : "unreviewed";
  const usable = directionIsUsable(shot.dataConfidence, shot.id);
  const hasSpin = finite(shot.spinRate) && shot.spinRate > 0 && finite(shot.spinAxis);
  // A review cue, not a ball-flight simulation or a physical impossibility test.
  const residual =
    finite(shot.carryYd) &&
    shot.carryYd > 0 &&
    finite(shot.sideCarryYd) &&
    finite(shot.launchDirectionDeg) &&
    Math.abs(shot.launchDirectionDeg) < 45
      ? shot.sideCarryYd - shot.carryYd * Math.tan((shot.launchDirectionDeg * Math.PI) / 180)
      : null;
  const unusualFinish =
    residual !== null && Math.abs(residual) >= Math.max(30, (shot.carryYd ?? 0) * 0.15) && !hasSpin;
  const reasons: string[] = [];
  if (!usable)
    reasons.push(
      reviewStatus === "questionable"
        ? "You marked this shot’s direction as questionable. Directional calculations omit it; carry and speed retain their own eligibility checks."
        : "Session alignment is uncertain. Target-relative direction and club delivery are omitted from directional calculations; carry and speed retain their own eligibility checks.",
    );
  if (unusualFinish)
    reasons.push(
      "The reported finish differs substantially from the initial start line. Spin rate/axis are incomplete, so the curvature magnitude cannot be independently checked. This does not prove a misread.",
    );
  if (endpointSource === "source_reported")
    reasons.push(
      "SIDE is supplied by the source export. This does not establish whether the device measured or modelled the landing position.",
    );
  else if (endpointSource === "unknown")
    reasons.push(
      "A stored endpoint is available, but its measurement method is not established by the source fields.",
    );
  if (faceSource === "modelled")
    reasons.push(
      "Face is modelled from launch direction and path (80/20 approximation); face-to-path is not independent measured evidence.",
    );
  return {
    endpointSource,
    faceSource,
    directionUsable: usable && finite(shot.sideCarryYd),
    reviewStatus,
    directionConfidence: !finite(shot.sideCarryYd)
      ? "unavailable"
      : !usable || (unusualFinish && reviewStatus !== "confirmed")
        ? "limited"
        : reviewStatus === "confirmed" ||
            alignmentStatus(shot.dataConfidence?.alignment) === "aligned"
          ? "supported"
          : "developing",
    needsReview: unusualFinish && reviewStatus === "unreviewed",
    reasons,
    faceToPathDeg:
      finite(shot.faceAngleDeg) && finite(shot.clubPathDeg)
        ? Math.round((shot.faceAngleDeg - shot.clubPathDeg) * 10) / 10
        : null,
    curvatureResidualYd: residual,
  };
}
/** Mask only explicitly questioned data. Missing spin alone is not grounds to discard SIDE. */
export function withDirectionalConfidence<T extends FlightEvidenceInput>(shot: T): T {
  if (directionIsUsable(shot.dataConfidence, shot.id)) return shot;
  return {
    ...shot,
    sideCarryYd: null,
    launchDirectionDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
  };
}
