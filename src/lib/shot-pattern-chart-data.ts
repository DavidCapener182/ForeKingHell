import { bigMissOfflineLimitYd } from "@/lib/today-club-scoring";

export type ShotPatternInput = {
  id: string;
  clubType: string;
  clubLabel?: string | null;
  carryYd: number | null;
  totalYd?: number | null;
  sideCarryYd: number | null;
  apexFt: number | null;
  launchAngleDeg?: number | null;
  launchDirectionDeg?: number | null;
  ballSpeedMph?: number | null;
  shotNumber?: number | null;
  shotAt?: Date | string | null;
  qualityTag?: string | null;
  dataIntegrityIssue?: unknown | null;
};

export type ShotPatternPoint = {
  id: string;
  clubType: string;
  clubLabel: string;
  carryYd: number | null;
  totalYd?: number | null;
  sideCarryYd: number | null;
  apexFt: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg?: number | null;
  ballSpeedMph?: number | null;
  shotNumber: number | null;
  shotAt: string | null;
  trusted: boolean;
};

export type ShotPatternClub = {
  type: string;
  label: string;
  shotCount: number;
  trustedShotCount: number;
  flightShotCount: number;
};

const excludedQualityTags = new Set([
  "mishit",
  "top",
  "thin",
  "fat",
  "bad_data",
  "bad-data",
  "misread",
  "delete",
  "deleted",
]);

export function buildShotPatternPoints(
  shots: ShotPatternInput[],
  options: { trustedShotIds?: ReadonlySet<string> } = {},
): ShotPatternPoint[] {
  return shots.map((shot) => ({
    id: shot.id,
    clubType: shot.clubType,
    clubLabel: shot.clubLabel?.trim() || formatClubLabel(shot.clubType),
    carryYd: finiteOrNull(shot.carryYd),
    totalYd: finiteOrNull(shot.totalYd),
    sideCarryYd: finiteOrNull(shot.sideCarryYd),
    apexFt: finiteOrNull(shot.apexFt),
    launchAngleDeg: finiteOrNull(shot.launchAngleDeg),
    launchDirectionDeg: finiteOrNull(shot.launchDirectionDeg),
    ballSpeedMph: finiteOrNull(shot.ballSpeedMph),
    shotNumber: finiteOrNull(shot.shotNumber),
    shotAt:
      shot.shotAt instanceof Date
        ? shot.shotAt.toISOString()
        : typeof shot.shotAt === "string"
          ? shot.shotAt
          : null,
    // A service's reviewed selection takes precedence, including explicit restores.
    // Keep every raw point available to the chart's All shots view.
    trusted: options.trustedShotIds
      ? options.trustedShotIds.has(shot.id)
      : !shot.dataIntegrityIssue &&
        !excludedQualityTags.has((shot.qualityTag ?? "").trim().toLowerCase()),
  }));
}

export function shotPatternClubs(points: ShotPatternPoint[]): ShotPatternClub[] {
  const clubs = new Map<string, ShotPatternClub>();

  for (const point of points) {
    const current = clubs.get(point.clubType) ?? {
      type: point.clubType,
      label: point.clubLabel,
      shotCount: 0,
      trustedShotCount: 0,
      flightShotCount: 0,
    };
    current.shotCount += 1;
    if (point.trusted) current.trustedShotCount += 1;
    if (point.carryYd !== null && point.apexFt !== null) current.flightShotCount += 1;
    clubs.set(point.clubType, current);
  }

  return [...clubs.values()].sort(
    (left, right) =>
      right.trustedShotCount - left.trustedShotCount || left.label.localeCompare(right.label),
  );
}

export function defaultShotPatternClub(clubs: ShotPatternClub[], preferredClub?: string | null) {
  if (preferredClub && clubs.some((club) => club.type === preferredClub)) return preferredClub;
  return clubs[0]?.type ?? "";
}

export function filterShotPatternPoints({
  points,
  club,
  trustedOnly,
}: {
  points: ShotPatternPoint[];
  club: string;
  trustedOnly: boolean;
}) {
  return points.filter(
    (point) =>
      (!club || club === "all" || point.clubType === club) && (!trustedOnly || point.trusted),
  );
}

export function shotPatternConfidence(points: ShotPatternPoint[]) {
  const landing = points.filter((point) => point.carryYd !== null && point.sideCarryYd !== null);
  const availability = points.length === 0 ? 0 : landing.length / points.length;
  const sample = landing.length;
  const score = Math.round(Math.min(100, sample * 5 + availability * 30));
  return {
    score,
    label: score >= 80 ? "High" : score >= 55 ? "Moderate" : "Low",
    sampleSize: sample,
  } as const;
}

export function summarizeShotPattern(points: ShotPatternPoint[]) {
  const landing = points.filter(
    (point): point is ShotPatternPoint & { carryYd: number; sideCarryYd: number } =>
      point.carryYd !== null && point.sideCarryYd !== null,
  );
  const sides = landing.map((point) => point.sideCarryYd).sort(numberAscending);
  const carries = landing.map((point) => point.carryYd).sort(numberAscending);
  const medianSideYd = percentile(sides, 0.5);
  const medianCarryYd = percentile(carries, 0.5);
  const sideLowYd = percentile(sides, 0.1);
  const sideHighYd = percentile(sides, 0.9);
  const carryLowYd = percentile(carries, 0.1);
  const carryHighYd = percentile(carries, 0.9);
  const representativeClub = landing[0]?.clubType ?? "club";
  const corridorYd = bigMissOfflineLimitYd(representativeClub);
  const insideCorridor = landing.filter(
    (point) => Math.abs(point.sideCarryYd) <= bigMissOfflineLimitYd(point.clubType),
  ).length;
  const left = landing.filter((point) => point.sideCarryYd < -5).length;
  const central = landing.filter((point) => Math.abs(point.sideCarryYd) <= 5).length;
  const right = landing.filter((point) => point.sideCarryYd > 5).length;
  const typicalMiss = typicalMissDirection({ left, central, right, sampleSize: landing.length });

  return {
    sampleSize: landing.length,
    medianSideYd,
    medianCarryYd,
    sideLowYd,
    sideHighYd,
    carryLowYd,
    carryHighYd,
    insideCorridor,
    corridorYd,
    left,
    central,
    right,
    typicalMiss,
    widerSide:
      medianSideYd === null || sideLowYd === null || sideHighYd === null
        ? null
        : Math.abs(sideLowYd - medianSideYd) > Math.abs(sideHighYd - medianSideYd)
          ? "Left"
          : "Right",
  };
}

export function deterministicShotSample<T extends ShotPatternPoint>(points: T[], limit = 160) {
  if (points.length <= limit) return { points, downsampled: false, total: points.length };

  const selected = new Map<string, T>();
  const extremes = [...points]
    .sort(
      (left, right) =>
        Math.abs(right.sideCarryYd ?? 0) - Math.abs(left.sideCarryYd ?? 0) ||
        (right.carryYd ?? 0) - (left.carryYd ?? 0),
    )
    .slice(0, Math.min(12, Math.floor(limit / 5)));
  extremes.forEach((point) => selected.set(point.id, point));

  const remaining = limit - selected.size;
  const stride = Math.max(1, points.length / remaining);
  for (let index = 0; selected.size < limit && index < remaining; index += 1) {
    const point = points[Math.min(points.length - 1, Math.floor(index * stride + stride / 2))];
    if (point) selected.set(point.id, point);
  }

  for (const point of points) {
    if (selected.size >= limit) break;
    selected.set(point.id, point);
  }

  return {
    points: points.filter((point) => selected.has(point.id)),
    downsampled: true,
    total: points.length,
  };
}

function typicalMissDirection({
  left,
  central,
  right,
  sampleSize,
}: {
  left: number;
  central: number;
  right: number;
  sampleSize: number;
}) {
  if (sampleSize < 8) return null;
  const strongest = Math.max(left, right);
  if (strongest / sampleSize < 0.45 || Math.abs(left - right) < Math.max(2, sampleSize * 0.15)) {
    return central / sampleSize >= 0.5 ? "Central" : null;
  }
  return left > right ? "Left" : "Right";
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const position = (values.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower] ?? null;
  const lowerValue = values[lower] ?? 0;
  const upperValue = values[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

function numberAscending(left: number, right: number) {
  return left - right;
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatClubLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
