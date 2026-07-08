export type DailyTrainingLoad = {
  date: string | Date;
  load: number;
};

export type DailyFormAdjustment = {
  date: string | Date;
  adjustment: number;
};

export type FitnessFreshnessPoint = {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  readiness: number;
  form: number;
  sessionQuality?: number | null;
};

export type FitnessFreshnessOptions = {
  startDate?: string | Date;
  endDate?: string | Date;
  fitnessDays?: number;
  fatigueDays?: number;
  formAcuteLoadWeight?: number;
  formAdjustments?: DailyFormAdjustment[];
  formDailyDecay?: number;
  formDecayGraceDays?: number;
  formSmoothingAlpha?: number;
  minimumDays?: number;
};

const DEFAULT_FITNESS_DAYS = 42;
const DEFAULT_FATIGUE_DAYS = 7;
const DEFAULT_MINIMUM_DAYS = 90;
const DEFAULT_GOLF_FORM_ACUTE_LOAD_WEIGHT = 0;
const BASELINE_FORM_INDEX = 100;
const FORM_SIGNAL_INDEX_MULTIPLIER = 1.5;
const FORM_SMOOTHING_ALPHA = 0.35;
const MAX_DAILY_FORM_MOVEMENT = 6;
const MAX_PERFORMANCE_FORM_ADJUSTMENT = 30;
const QUIET_DAYS_BEFORE_FORM_DECAY = 10;
const DAILY_FORM_DECAY = 0.03;
const MIN_FORM_INDEX = 70;
const MAX_FORM_INDEX = 130;
const READINESS_FATIGUE_WEIGHT = 0.16;
const MIN_READINESS = 55;
const MAX_READINESS = 100;

export function calculateFitnessFreshnessSeries(
  dailyLoads: DailyTrainingLoad[],
  options: FitnessFreshnessOptions = {},
): FitnessFreshnessPoint[] {
  const fitnessDays = options.fitnessDays ?? DEFAULT_FITNESS_DAYS;
  const fatigueDays = options.fatigueDays ?? DEFAULT_FATIGUE_DAYS;
  const minimumDays = Math.max(1, options.minimumDays ?? DEFAULT_MINIMUM_DAYS);
  const fitnessAlpha = alphaForDays(fitnessDays);
  const fatigueAlpha = alphaForDays(fatigueDays);
  const formDailyDecay = Math.max(0, options.formDailyDecay ?? DAILY_FORM_DECAY);
  const formDecayGraceDays = Math.max(
    0,
    Math.round(options.formDecayGraceDays ?? QUIET_DAYS_BEFORE_FORM_DECAY),
  );
  const formSmoothingAlpha = clamp(options.formSmoothingAlpha ?? FORM_SMOOTHING_ALPHA, 0, 1);
  const loadsByDate = new Map<string, number>();
  const formAdjustmentsByDate = new Map<string, number>();

  for (const row of dailyLoads) {
    const date = toDateKey(row.date);
    const load = finiteNumber(row.load);
    loadsByDate.set(date, (loadsByDate.get(date) ?? 0) + load);
  }

  for (const row of options.formAdjustments ?? []) {
    const date = toDateKey(row.date);
    const adjustment = finiteNumber(row.adjustment);
    formAdjustmentsByDate.set(date, (formAdjustmentsByDate.get(date) ?? 0) + adjustment);
  }

  const sortedDates = [...loadsByDate.keys()].sort();
  const endDate = toDateKey(options.endDate ?? sortedDates.at(-1) ?? new Date());
  const minimumStart = addDays(endDate, -(minimumDays - 1));
  const firstLoadDate = sortedDates[0] ?? minimumStart;
  const startDate = minDateKey(
    toDateKey(options.startDate ?? firstLoadDate),
    sortedDates.length > 0 ? firstLoadDate : minimumStart,
  );
  const effectiveStartDate = minDateKey(startDate, minimumStart);
  const series: FitnessFreshnessPoint[] = [];
  let fitness = 0;
  let fatigue = 0;
  let formIndex = BASELINE_FORM_INDEX;
  let quietDays = 0;

  for (let date = effectiveStartDate; date <= endDate; date = addDays(date, 1)) {
    const load = loadsByDate.get(date) ?? 0;
    const formAdjustment = formAdjustmentsByDate.get(date) ?? 0;
    fatigue = fatigue + fatigueAlpha * (load - fatigue);
    fitness = fitness + fitnessAlpha * (load - fitness);

    if (formAdjustment !== 0) {
      const indexedAdjustment = formAdjustment * FORM_SIGNAL_INDEX_MULTIPLIER;
      const dailyMovement = clamp(
        indexedAdjustment * formSmoothingAlpha,
        -MAX_DAILY_FORM_MOVEMENT,
        MAX_DAILY_FORM_MOVEMENT,
      );
      formIndex = clamp(formIndex + dailyMovement, MIN_FORM_INDEX, MAX_FORM_INDEX);
      quietDays = 0;
    } else if (load > 0) {
      quietDays = 0;
    } else {
      quietDays += 1;

      if (quietDays > formDecayGraceDays) {
        formIndex = formIndex + (BASELINE_FORM_INDEX - formIndex) * formDailyDecay;
        formIndex = clamp(formIndex, MIN_FORM_INDEX, MAX_FORM_INDEX);
      }
    }

    series.push({
      date,
      load,
      fitness,
      fatigue,
      readiness: calculateReadiness(fatigue),
      form: formIndex,
    });
  }

  return series;
}

export function calculateGolfForm(
  _fitness: number,
  _fatigue: number,
  _acuteLoadWeight = DEFAULT_GOLF_FORM_ACUTE_LOAD_WEIGHT,
  performanceAdjustment = 0,
) {
  void _acuteLoadWeight;

  const performanceMovement = clamp(
    performanceAdjustment * FORM_SIGNAL_INDEX_MULTIPLIER,
    -MAX_PERFORMANCE_FORM_ADJUSTMENT,
    MAX_PERFORMANCE_FORM_ADJUSTMENT,
  );
  const form = clamp(BASELINE_FORM_INDEX + performanceMovement, MIN_FORM_INDEX, MAX_FORM_INDEX);

  return Object.is(form, -0) ? 0 : form;
}

export function calculateReadiness(fatigue: number) {
  return clamp(
    MAX_READINESS - finiteNumber(fatigue) * READINESS_FATIGUE_WEIGHT,
    MIN_READINESS,
    MAX_READINESS,
  );
}

export function alphaForDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("EMA days must be a positive number.");
  }

  return 2 / (days + 1);
}

export function sliceTrainingSeries(
  series: FitnessFreshnessPoint[],
  days: number,
): FitnessFreshnessPoint[] {
  return series.slice(Math.max(0, series.length - days));
}

export function toDateKey(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minDateKey(a: string, b: string) {
  return a <= b ? a : b;
}

function finiteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
