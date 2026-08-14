import { selectStockYardageShots, type StockShot } from "@/lib/stock-yardage";

export type ClubEvolutionClub<TShot extends StockShot = StockShot> = {
  id: string;
  type: string;
  shots: TShot[];
};

export type ClubEvolutionMeasuredPoint = {
  key: string;
  label: string;
  carryYd: number;
  sampleSize: number;
  medianAbsoluteOfflineYd: number | null;
  directionalSampleSize: number;
};

export type ClubEvolutionDisplayPoint = {
  key: string;
  label: string;
  carryYd: number | null;
  sampleSize: number;
  medianAbsoluteOfflineYd: number | null;
  directionalSampleSize: number;
};

export type ClubEvolutionRow<TClub extends ClubEvolutionClub = ClubEvolutionClub> = {
  club: TClub;
  points: ClubEvolutionDisplayPoint[];
  measuredPoints: ClubEvolutionMeasuredPoint[];
};

export type ClubEvolutionMovementKind =
  | "building"
  | "low-confidence"
  | "shorter-straighter"
  | "longer-wider"
  | "control-improved"
  | "control-wider"
  | "distance-down"
  | "carry-up"
  | "stable";

export type ClubEvolutionMovement = {
  kind: ClubEvolutionMovementKind;
  carryDeltaYd: number | null;
  controlDeltaYd: number | null;
};

type ClubEvolutionOptions = {
  maxShots?: number;
  monthCount?: number;
  monthFormatter?: Intl.DateTimeFormat;
};

const DEFAULT_RECENT_SHOTS_PER_CLUB = 200;
const DEFAULT_MONTH_COUNT = 3;
const MIN_TREND_SAMPLE_SIZE = 6;
const MIN_DIRECTIONAL_SAMPLE_SIZE = 6;
const MEANINGFUL_CARRY_CHANGE_YD = 5;
const MEANINGFUL_CONTROL_CHANGE_YD = 3;
const defaultMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
});

export function buildClubEvolutionRows<TClub extends ClubEvolutionClub>(
  clubs: TClub[],
  options: ClubEvolutionOptions = {},
): ClubEvolutionRow<TClub>[] {
  const maxShots = options.maxShots ?? DEFAULT_RECENT_SHOTS_PER_CLUB;
  const monthCount = options.monthCount ?? DEFAULT_MONTH_COUNT;
  const monthFormatter = options.monthFormatter ?? defaultMonthFormatter;
  const clubPointRows = clubs.map((club) => ({
    club,
    points: buildClubEvolutionMeasuredPoints(club, {
      maxShots,
      monthFormatter,
    }),
  }));
  const latestMonthKey = maxMonthKey(clubPointRows.flatMap((row) => row.points));

  if (!latestMonthKey) {
    return [];
  }

  const monthWindow = recentMonthWindow(latestMonthKey, monthCount, monthFormatter);

  return clubPointRows
    .map(({ club, points }) => {
      const pointByKey = new Map(points.map((point) => [point.key, point]));
      const displayPoints = monthWindow.map((month) => {
        const measuredPoint = pointByKey.get(month.key);

        return {
          ...month,
          carryYd: measuredPoint?.carryYd ?? null,
          sampleSize: measuredPoint?.sampleSize ?? 0,
          medianAbsoluteOfflineYd: measuredPoint?.medianAbsoluteOfflineYd ?? null,
          directionalSampleSize: measuredPoint?.directionalSampleSize ?? 0,
        };
      });
      const measuredPoints = displayPoints.filter(
        (point): point is ClubEvolutionMeasuredPoint => point.carryYd !== null,
      );

      return {
        club,
        points: displayPoints,
        measuredPoints,
      };
    })
    .filter((row) => row.measuredPoints.length >= 2);
}

function buildClubEvolutionMeasuredPoints<TClub extends ClubEvolutionClub>(
  club: TClub,
  {
    maxShots,
    monthFormatter,
  }: {
    maxShots: number;
    monthFormatter: Intl.DateTimeFormat;
  },
): ClubEvolutionMeasuredPoint[] {
  const grouped = new Map<string, { label: string; shots: StockShot[] }>();

  for (const shot of club.shots) {
    const date = shotDate(shot.shotAt);

    if (!date) {
      continue;
    }

    const key = monthKey(date);
    const current = grouped.get(key) ?? {
      label: monthFormatter.format(date),
      shots: [],
    };
    current.shots.push(shot);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const { filteredShots } = selectStockYardageShots(group.shots, maxShots, {
        clubType: club.type,
        averageSampleSize: maxShots,
      });
      const values = filteredShots.map((shot) => shot.carryYd).filter(isFiniteNumber);
      const absoluteOfflineValues = filteredShots
        .map((shot) => shot.sideCarryYd)
        .filter(isFiniteNumber)
        .map(Math.abs);

      return {
        key,
        label: group.label,
        carryYd: values.length > 0 ? roundOne(percentile(values, 0.5)) : null,
        sampleSize: values.length,
        medianAbsoluteOfflineYd:
          absoluteOfflineValues.length > 0
            ? roundOne(percentile(absoluteOfflineValues, 0.5))
            : null,
        directionalSampleSize: absoluteOfflineValues.length,
      };
    })
    .filter(
      (point): point is ClubEvolutionMeasuredPoint =>
        isFiniteNumber(point.carryYd) && point.sampleSize > 0,
    );
}

export function classifyClubEvolutionMovement(
  points: ClubEvolutionMeasuredPoint[],
): ClubEvolutionMovement {
  if (points.length < 2) {
    return { kind: "building", carryDeltaYd: null, controlDeltaYd: null };
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const carryDeltaYd = roundOne(latest.carryYd - first.carryYd);
  const firstOfflineYd = first.medianAbsoluteOfflineYd;
  const latestOfflineYd = latest.medianAbsoluteOfflineYd;
  const hasDirectionalEvidence =
    Math.min(first.directionalSampleSize, latest.directionalSampleSize) >=
      MIN_DIRECTIONAL_SAMPLE_SIZE &&
    isFiniteNumber(firstOfflineYd) &&
    isFiniteNumber(latestOfflineYd);
  const controlDeltaYd = hasDirectionalEvidence ? roundOne(latestOfflineYd - firstOfflineYd) : null;

  if (Math.min(first.sampleSize, latest.sampleSize) < MIN_TREND_SAMPLE_SIZE) {
    return { kind: "low-confidence", carryDeltaYd, controlDeltaYd };
  }

  if (
    carryDeltaYd <= -MEANINGFUL_CARRY_CHANGE_YD &&
    controlDeltaYd !== null &&
    controlDeltaYd <= -MEANINGFUL_CONTROL_CHANGE_YD
  ) {
    return { kind: "shorter-straighter", carryDeltaYd, controlDeltaYd };
  }

  if (
    carryDeltaYd >= MEANINGFUL_CARRY_CHANGE_YD &&
    controlDeltaYd !== null &&
    controlDeltaYd >= MEANINGFUL_CONTROL_CHANGE_YD
  ) {
    return { kind: "longer-wider", carryDeltaYd, controlDeltaYd };
  }

  if (controlDeltaYd !== null && controlDeltaYd <= -MEANINGFUL_CONTROL_CHANGE_YD) {
    return { kind: "control-improved", carryDeltaYd, controlDeltaYd };
  }

  if (controlDeltaYd !== null && controlDeltaYd >= MEANINGFUL_CONTROL_CHANGE_YD) {
    return { kind: "control-wider", carryDeltaYd, controlDeltaYd };
  }

  if (carryDeltaYd <= -MEANINGFUL_CARRY_CHANGE_YD) {
    return { kind: "distance-down", carryDeltaYd, controlDeltaYd };
  }

  if (carryDeltaYd >= MEANINGFUL_CARRY_CHANGE_YD) {
    return { kind: "carry-up", carryDeltaYd, controlDeltaYd };
  }

  return { kind: "stable", carryDeltaYd, controlDeltaYd };
}

function recentMonthWindow(
  latestMonthKey: string,
  monthCount: number,
  monthFormatter: Intl.DateTimeFormat,
) {
  const [year, month] = latestMonthKey.split("-").map(Number);
  const latestMonth = new Date(year, month - 1, 1);

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(
      latestMonth.getFullYear(),
      latestMonth.getMonth() - monthCount + index + 1,
      1,
    );

    return {
      key: monthKey(date),
      label: monthFormatter.format(date),
    };
  });
}

function maxMonthKey(points: ClubEvolutionMeasuredPoint[]) {
  return points.reduce<string | null>(
    (latest, point) => (latest === null || point.key > latest ? point.key : latest),
    null,
  );
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shotDate(value: StockShot["shotAt"]) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
