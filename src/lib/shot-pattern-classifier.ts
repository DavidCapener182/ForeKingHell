import { finiteNumbers, interquartileRange, median } from "@/lib/analysis-statistics";
import type { Handedness } from "@/lib/units";

export type PatternShot = {
  launchDirectionDeg?: number | null;
  spinAxisDeg?: number | null;
  clubPathDeg?: number | null;
  faceAngleDeg?: number | null;
  sideYd?: number | null;
  smashFactor?: number | null;
  ballSpeedMph?: number | null;
  shotShape?: string | null;
};

export type ClassifiedPattern = {
  label: string;
  source: "measured" | "inferred";
  evidence: string;
};

export function classifyShotPattern(shots: PatternShot[], handedness: Handedness = "right") {
  const launch = finiteNumbers(shots.map((shot) => shot.launchDirectionDeg));
  const spin = finiteNumbers(shots.map((shot) => shot.spinAxisDeg));
  const path = finiteNumbers(shots.map((shot) => shot.clubPathDeg));
  const face = finiteNumbers(shots.map((shot) => shot.faceAngleDeg));
  const sides = finiteNumbers(shots.map((shot) => shot.sideYd));
  const smash = finiteNumbers(shots.map((shot) => shot.smashFactor));
  const speeds = finiteNumbers(shots.map((shot) => shot.ballSpeedMph));
  const patterns: ClassifiedPattern[] = [];
  const twoWay = isTwoWay(sides);

  if (twoWay) {
    patterns.push({
      label: "two-way miss",
      source: "inferred",
      evidence: "The core offline range contains repeated misses on both sides of the target line.",
    });
  } else {
    const start = startPattern(median(launch.length ? launch : face));
    const curve = curvePattern(median(spin), handedness);
    const label = combinePattern(start, curve);
    if (label) {
      patterns.push({
        label,
        source: spin.length || path.length || face.length ? "measured" : "inferred",
        evidence:
          spin.length || path.length || face.length
            ? "Classification uses available launch, face, path or spin-axis measurements."
            : "Classification is inferred from landing-side outcomes because delivery metrics are unavailable.",
      });
    } else if (sides.length >= 5 && Math.abs(median(sides) ?? 0) >= 8) {
      patterns.push({
        label: (median(sides) ?? 0) < 0 ? "pull" : "push",
        source: "inferred",
        evidence: "Direction is inferred from the median landing side; curve is not claimed.",
      });
    }
  }

  if ((interquartileRange(smash) ?? 0) >= 0.12) {
    patterns.push({
      label: "strike inconsistency",
      source: "measured",
      evidence: "The smash-factor interquartile range is at least 0.12.",
    });
  }
  const speedMedian = median(speeds);
  if (speedMedian && (interquartileRange(speeds) ?? 0) / speedMedian >= 0.08) {
    patterns.push({
      label: "speed inconsistency",
      source: "measured",
      evidence: "The central ball-speed range is at least 8% of median speed.",
    });
  }

  return patterns;
}

function startPattern(value: number | null) {
  return value === null || Math.abs(value) < 1.5 ? null : value < 0 ? "pull" : "push";
}

function curvePattern(spinAxis: number | null, handedness: Handedness) {
  if (spinAxis === null || Math.abs(spinAxis) < 3) return null;
  const curvesLeft = spinAxis < 0;
  const draws = handedness === "right" ? curvesLeft : !curvesLeft;
  const severity = Math.abs(spinAxis) >= 12 ? "strong" : "controlled";
  return draws
    ? severity === "strong"
      ? "hook"
      : "draw"
    : severity === "strong"
      ? "slice"
      : "fade";
}

function combinePattern(start: string | null, curve: string | null) {
  if (!start) return curve;
  if (!curve) return start;
  if (start === "pull" && (curve === "draw" || curve === "hook")) return "pull-draw";
  if (start === "push" && (curve === "fade" || curve === "slice")) return "push-fade";
  return `${start}-${curve}`;
}

function isTwoWay(sides: number[]) {
  return (
    sides.filter((value) => value <= -8).length >= 2 &&
    sides.filter((value) => value >= 8).length >= 2
  );
}
