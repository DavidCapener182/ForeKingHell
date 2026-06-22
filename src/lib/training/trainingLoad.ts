export type TrainingLoadInput = {
  durationMinutes?: number | null;
  holesPlayed?: number | null;
  totalSwings?: number | null;
  fullSwings?: number | null;
  shortGameSwings?: number | null;
  puttingSwings?: number | null;
  walked?: boolean | null;
  competition?: boolean | null;
  rpe: number;
  mentalPressure?: number | null;
};

export type SessionVolumeBreakdown = {
  baseVolume: number;
  source: "swing_breakdown" | "total_swings" | "duration_minutes" | "holes_played" | "fallback";
};

const FULL_SWING_WEIGHT = 1;
const SHORT_GAME_WEIGHT = 0.6;
const PUTTING_WEIGHT = 0.3;
const FALLBACK_VOLUME = 30;

export function calculateSessionVolume(session: TrainingLoadInput): number {
  return calculateSessionVolumeBreakdown(session).baseVolume;
}

export function calculateSessionVolumeBreakdown(
  session: TrainingLoadInput,
): SessionVolumeBreakdown {
  const fullSwings = positiveNumber(session.fullSwings);
  const shortGameSwings = positiveNumber(session.shortGameSwings);
  const puttingSwings = positiveNumber(session.puttingSwings);
  const hasSwingBreakdown =
    fullSwings !== null || shortGameSwings !== null || puttingSwings !== null;

  if (hasSwingBreakdown) {
    return {
      baseVolume:
        (fullSwings ?? 0) * FULL_SWING_WEIGHT +
        (shortGameSwings ?? 0) * SHORT_GAME_WEIGHT +
        (puttingSwings ?? 0) * PUTTING_WEIGHT,
      source: "swing_breakdown",
    };
  }

  const totalSwings = positiveNumber(session.totalSwings);
  if (totalSwings !== null) {
    return {
      baseVolume: totalSwings,
      source: "total_swings",
    };
  }

  const durationMinutes = positiveNumber(session.durationMinutes);
  if (durationMinutes !== null) {
    return {
      baseVolume: durationMinutes,
      source: "duration_minutes",
    };
  }

  const holesPlayed = positiveNumber(session.holesPlayed);
  if (holesPlayed !== null) {
    return {
      baseVolume: holesVolume(holesPlayed),
      source: "holes_played",
    };
  }

  return {
    baseVolume: FALLBACK_VOLUME,
    source: "fallback",
  };
}

export function calculateSessionModifier(session: TrainingLoadInput): number {
  let modifier = 1;

  if (session.walked) {
    modifier += 0.15;
  }

  if (session.competition) {
    modifier += 0.1;
  }

  if ((session.mentalPressure ?? 0) >= 8) {
    modifier += 0.05;
  }

  return modifier;
}

export function calculateSessionLoad(session: TrainingLoadInput): number {
  const volume = calculateSessionVolume(session);
  const rpe = clampRpe(session.rpe);
  const modifier = calculateSessionModifier(session);

  return Math.round(volume * rpe * modifier);
}

export function clampRpe(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.round(value)));
}

function holesVolume(holesPlayed: number) {
  if (holesPlayed >= 18) {
    return 120;
  }

  if (holesPlayed >= 9) {
    return 60;
  }

  return Math.max(FALLBACK_VOLUME, Math.round((holesPlayed / 9) * 60));
}

function positiveNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}
