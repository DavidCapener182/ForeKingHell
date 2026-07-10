import { finiteNumbers, interquartileRange, median } from "@/lib/analysis-statistics";
import { calculateRepeatabilityScore, type RepeatabilityShot } from "@/lib/repeatability-score";

export type TrendShot = RepeatabilityShot & {
  ballSpeedMph?: number | null;
  smashFactor?: number | null;
};

export type TrendChange = {
  kind: "trade-off" | "improvement" | "decline" | "pattern-shift";
  headline: string;
  evidence: string;
};

export function detectTrendChanges(baseline: TrendShot[], recent: TrendShot[]) {
  if (baseline.length < 5 || recent.length < 5) return [];
  const base = summarize(baseline);
  const current = summarize(recent);
  const carryDelta = difference(current.carry, base.carry);
  const spreadDelta = difference(current.sideIqr, base.sideIqr);
  const speedDelta = difference(current.ballSpeed, base.ballSpeed);
  const smashDelta = difference(current.smash, base.smash);
  const changes: TrendChange[] = [];

  if (carryDelta !== null && carryDelta >= 4 && spreadDelta !== null && spreadDelta >= 5) {
    changes.push({
      kind: "trade-off",
      headline: "Carry increased, but directional spread widened",
      evidence: `${signed(carryDelta)} yd median carry and ${signed(spreadDelta)} yd central offline spread.`,
    });
  } else if (carryDelta !== null && carryDelta <= -4) {
    changes.push({
      kind: "decline",
      headline: "Median carry has moved down",
      evidence: `${signed(carryDelta)} yd against the comparable baseline sample.`,
    });
  }

  if (speedDelta !== null && speedDelta >= 2 && (smashDelta === null || smashDelta < 0.01)) {
    changes.push({
      kind: "trade-off",
      headline: "Speed improved without a matching strike gain",
      evidence: `${signed(speedDelta)} mph median ball speed and ${signed(smashDelta ?? 0)} smash.`,
    });
  }

  if (
    current.repeatability.score - base.repeatability.score >= 8 &&
    Math.abs(carryDelta ?? 0) < 4
  ) {
    changes.push({
      kind: "improvement",
      headline: "Consistency improved while distance stayed stable",
      evidence: `Repeatability ${signed(current.repeatability.score - base.repeatability.score)} points; carry ${signed(carryDelta ?? 0)} yd.`,
    });
  }

  if (!base.repeatability.twoWayMiss && current.repeatability.twoWayMiss) {
    changes.push({
      kind: "pattern-shift",
      headline: "The miss changed into a two-way pattern",
      evidence: "The recent core sample now contains repeated misses on both sides.",
    });
  }

  return changes;
}

function summarize(shots: TrendShot[]) {
  return {
    carry: median(finiteNumbers(shots.map((shot) => shot.carryYd))),
    sideIqr: interquartileRange(finiteNumbers(shots.map((shot) => shot.sideYd))),
    ballSpeed: median(finiteNumbers(shots.map((shot) => shot.ballSpeedMph))),
    smash: median(finiteNumbers(shots.map((shot) => shot.smashFactor))),
    repeatability: calculateRepeatabilityScore(shots),
  };
}

function difference(current: number | null, baseline: number | null) {
  return current === null || baseline === null ? null : current - baseline;
}

function signed(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
