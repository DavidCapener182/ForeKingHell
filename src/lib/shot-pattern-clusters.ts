export const shotPatternGroupings = [
  "club",
  "shape",
  "start",
  "finish",
  "strike",
  "session",
  "date",
  "equipment",
  "ball",
  "context",
  "measurement",
] as const;

export type ShotPatternGrouping = (typeof shotPatternGroupings)[number];

export type PatternExplorerShot = {
  id: string;
  shotAt: string;
  sessionId: string;
  sessionLabel: string;
  clubType: string;
  carryYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg: number | null;
  spinAxis: number | null;
  ballSpeedMph: number | null;
  smashFactor: number | null;
  shotShape: string | null;
  qualityTag: string | null;
  playContext: string;
  measuredStatus: string;
  equipment: string;
  ball: string;
};

export type ShotPatternCluster = {
  key: string;
  label: string;
  count: number;
  averageCarry: number | null;
  patternLabel: string;
  shots: Array<{
    id: string;
    date: string;
    club: string;
    carry: string;
    finish: string;
    start: string;
    evidence: string;
  }>;
};

export function buildShotPatternGroups(shots: PatternExplorerShot[]) {
  return Object.fromEntries(
    shotPatternGroupings.map((grouping) => [grouping, buildClusters(shots, grouping)]),
  ) as Record<ShotPatternGrouping, ShotPatternCluster[]>;
}

function buildClusters(shots: PatternExplorerShot[], groupBy: ShotPatternGrouping) {
  const grouped = new Map<string, PatternExplorerShot[]>();
  for (const shot of shots) {
    const key = groupKey(shot, groupBy);
    grouped.set(key, [...(grouped.get(key) ?? []), shot]);
  }
  return [...grouped.entries()]
    .map(([key, rows]) => ({
      key,
      label: formatLabel(key),
      count: rows.length,
      averageCarry: average(rows.map((shot) => shot.carryYd)),
      patternLabel: patternLabel(rows),
      shots: rows.map((shot) => ({
        id: shot.id,
        date: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
          new Date(shot.shotAt),
        ),
        club: formatLabel(shot.clubType),
        carry: metric(shot.carryYd, "yd"),
        finish: signed(shot.sideCarryYd, "yd"),
        start: signed(shot.launchDirectionDeg, "°"),
        evidence: formatLabel(shot.measuredStatus),
      })),
    }))
    .sort((left, right) => right.count - left.count);
}

function groupKey(shot: PatternExplorerShot, groupBy: ShotPatternGrouping) {
  if (groupBy === "club") return shot.clubType;
  if (groupBy === "shape") return shot.shotShape ?? inferredShape(shot);
  if (groupBy === "start") return direction(shot.launchDirectionDeg);
  if (groupBy === "finish") return direction(shot.sideCarryYd);
  if (groupBy === "strike")
    return (
      shot.qualityTag ??
      (shot.smashFactor !== null && shot.smashFactor >= 1.42 ? "solid" : "unclassified")
    );
  if (groupBy === "session") return shot.sessionLabel;
  if (groupBy === "date") return shot.shotAt.slice(0, 10);
  if (groupBy === "equipment") return shot.equipment;
  if (groupBy === "ball") return shot.ball;
  if (groupBy === "context") return shot.playContext;
  return shot.measuredStatus;
}

function patternLabel(shots: PatternExplorerShot[]) {
  const side = averageRaw(shots.map((shot) => shot.sideCarryYd));
  const start = averageRaw(shots.map((shot) => shot.launchDirectionDeg));
  const spin = averageRaw(shots.map((shot) => shot.spinAxis));
  if (side !== null && side < -10 && start !== null && start < -1) return "Consistent pull cluster";
  if (side !== null && side > 10 && start !== null && start > 1 && (spin ?? 0) > 0)
    return "Push-fade tendency";
  if (side !== null && side < -10) return "Short-left or left-finish cluster";
  if (shots.some((shot) => (shot.ballSpeedMph ?? 0) > 150 && (shot.carryYd ?? 0) < 220))
    return "Speed without carry transfer";
  if (spin !== null && Math.abs(spin) > 10) return "Spin inconsistency worth checking";
  return shots.length >= 8 ? "Repeatable measured cluster" : "Early pattern — add evidence";
}

function direction(value: number | null) {
  if (value === null) return "unknown";
  if (value < -5) return "left";
  if (value > 5) return "right";
  return "centre";
}

function inferredShape(shot: PatternExplorerShot) {
  const start = direction(shot.launchDirectionDeg);
  const finish = direction(shot.sideCarryYd);
  return start === finish ? start : `${start} to ${finish}`;
}

function average(values: Array<number | null>) {
  const value = averageRaw(values);
  return value === null ? null : Math.round(value * 10) / 10;
}

function averageRaw(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function metric(value: number | null, unit: string) {
  return value === null ? "—" : `${Math.round(value * 10) / 10}${unit}`;
}

function signed(value: number | null, unit: string) {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}${unit}`;
}
