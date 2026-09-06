import type { ShotMasterDetailRow } from "./shots-master-detail-table";

/** Desktop labels use several missing-value sentinels; none is a phone metric. */
export function hasShotMetric(value: string | null | undefined): value is string {
  return Boolean(
    value?.trim() && !/^(?:[-–—]+|n\/a|null|undefined|NaN|[+-]?Infinity)$/i.test(value.trim()),
  );
}

export function mobileShotMetrics(shot: ShotMasterDetailRow) {
  const metrics = [
    ["Total", shot.totalLabel, "yd"],
    ["Side", shot.sideLabel, "yd"],
    ["Ball speed", shot.ballSpeedLabel, "mph"],
    ["Club speed", shot.clubSpeedLabel, "mph"],
    ["Launch", shot.launchLabel, "°"],
    ["Launch direction", shot.launchDirectionLabel, "°"],
    ["Path", shot.pathLabel, "°"],
    [
      shot.flightEvidence?.faceSource === "modelled" ? "Modelled face" : "Face",
      shot.faceLabel,
      "°",
    ],
    ["Attack", shot.attackLabel, "°"],
    ["Apex", shot.apexLabel, "ft"],
    [
      "Smash",
      shot.smashFactor != null && Number.isFinite(shot.smashFactor)
        ? shot.smashFactor.toFixed(2)
        : shot.smashLabel,
      "",
    ],
    ["Spin", shot.spinRateLabel, "rpm"],
    ["Spin axis", shot.spinAxisLabel, "°"],
  ] as const;
  return metrics
    .filter(([, value]) => hasShotMetric(value))
    .map(
      ([label, value, unit]) =>
        [label, `${value}${unit === "°" ? unit : unit ? ` ${unit}` : ""}`] as const,
    );
}

export function visibleShotSelection(selected: string[], rows: Array<{ id: string }>) {
  const visible = new Set(rows.map((row) => row.id));
  return [...new Set(selected)].filter((id) => visible.has(id)).slice(0, 50);
}
