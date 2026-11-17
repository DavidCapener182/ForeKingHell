import { finiteNumbers, mean, median, percentile } from "@/lib/analysis-statistics";
import type { BagIntelligenceShot } from "@/lib/bag-intelligence";
import { calculateFaceToPathDeg, resolveClubFaceAngleDeg } from "@/lib/club-face-angle";
import { normaliseSourceRawJson } from "@/lib/source-raw-json";
import { curvePattern } from "@/lib/shot-pattern-classifier";
import { lateralDirection, type Handedness } from "@/lib/units";

export function deliveryObservation(shot: BagIntelligenceShot) {
  const raw = normaliseSourceRawJson(shot.sourceRawJson);
  let metadata: Record<
    string,
    { comparable?: boolean; unit?: string; value?: number; status?: string; source?: string }
  > | null;
  try {
    metadata = JSON.parse(raw.__lmwtMetricProvenance ?? "{}");
  } catch {
    metadata = null;
  }
  const face = resolveClubFaceAngleDeg(shot);
  function status(key: string, value: number | null | undefined) {
    const reading = metadata?.[key];
    return value != null &&
      reading?.comparable === true &&
      reading.unit === "deg" &&
      reading.value === value
      ? (reading.status ?? "unverified")
      : "unverified";
  }
  const faceStatus = status("faceAngleDeg", face);
  const source =
    face === null
      ? "missing"
      : shot.faceAngleDeg == null || ["estimated", "derived", "reconstructed"].includes(faceStatus)
        ? "estimated"
        : faceStatus === "measured"
          ? "measured"
          : "unverified";
  const impact = Object.entries(raw)
    .find(([header]) => /^(strike|impact)[ _-]?location$/i.test(header.trim()))?.[1]
    ?.trim();
  // A numeric MLM2PRO CSV spin field alone does not confirm tracked spin.
  const spinConfirmed =
    metadata?.spinAxisDeg?.source !== "rapsodo-csv" ||
    Object.entries(raw).some(
      ([key, value]) =>
        /^spin[ _-]?(measured|verified)$/i.test(key) && /^(true|yes|1)$/i.test(value.trim()),
    );
  return {
    strike:
      impact && /^(heel|toe|centre|center|high|low)([ -](heel|toe|centre|center))?$/i.test(impact)
        ? impact.toLowerCase()
        : null,
    pathMeasured: status("pathDeg", shot.clubPathDeg) === "measured",
    id: shot.id ?? null,
    path: shot.clubPathDeg ?? null,
    face,
    delta: calculateFaceToPathDeg(shot),
    source,
    launch: shot.launchDirectionDeg ?? null,
    side: shot.sideCarryYd,
    carry: shot.carryYd,
    axis:
      spinConfirmed && status("spinAxisDeg", shot.spinAxis) === "measured"
        ? (shot.spinAxis ?? null)
        : null,
  };
}
export type DeliveryObservation = ReturnType<typeof deliveryObservation>;

export function deliverySummary(rows: DeliveryObservation[]) {
  const paired = rows.filter((row) => row.delta !== null);
  const deltas = finiteNumbers(paired.map((row) => row.delta));
  // Both arrows describe the same impacts. Path-only cohorts still get a path arrow.
  const path = mean(finiteNumbers((paired.length ? paired : rows).map((row) => row.path)));
  const face = mean(finiteNumbers(paired.map((row) => row.face)));
  return {
    path,
    face,
    delta: face !== null && path !== null ? face - path : null,
    deltas,
    median: median(deltas),
    low: percentile(deltas, 0.2),
    high: percentile(deltas, 0.8),
  };
}

export function targetSide(value: number | null) {
  return value === null
    ? "Unavailable"
    : value === 0
      ? "On target line"
      : value > 0
        ? "Right of target"
        : "Left of target";
}

export function deliveryTendency(face: number | null, delta: number | null, hand: Handedness) {
  if (face === null || delta === null)
    return { label: "Partial delivery", reference: "Unavailable" };
  const start = lateralDirection(face, "golfer-relative", hand);
  const relative = hand === "right" ? delta : -delta;
  const curve = relative < 0 ? "draw" : relative > 0 ? "fade" : "straight";
  const label =
    start === "straight" ? curve : curve === "straight" ? "straight " + start : start + "-" + curve;
  return {
    label: label[0]!.toUpperCase() + label.slice(1) + " tendency",
    reference: (relative < 0 ? "Closed" : relative > 0 ? "Open" : "Square") + " relative to path",
  };
}

export function observedCurve(axis: number, hand: Handedness) {
  return curvePattern(axis, hand) ?? "straight";
}
