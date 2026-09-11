export const ROUND_LOAD_MODEL = "round-duration-rpe-v2";
export const ROUND_LOAD_WEIGHT = 0.5;
export const LEGACY_ROUND_LOAD_MODEL = "round-duration-rpe-v1";
export function isManagedRoundLoad(model?: string) {
  return model === ROUND_LOAD_MODEL || model === LEGACY_ROUND_LOAD_MODEL;
}
export const ROUND_DEFAULT_RPE = 3;
export type RoundMovement = "unknown" | "carry" | "trolley" | "cart";
export type RoundLoadMetadata = {
  model?: string;
  rpeEstimated?: boolean;
  movement?: RoundMovement;
};

/** App workload estimate, not calories or a calibrated physiological measurement. */
export function calculateRoundLoad(holes: number, durationMinutes: number | null, rpe: number) {
  if (!Number.isInteger(holes) || holes < 1 || holes > 18) throw new Error("Invalid holes played");
  if (
    durationMinutes !== null &&
    (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)
  )
    throw new Error("Invalid round duration");
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) throw new Error("Invalid round effort");
  const minutes = durationMinutes ?? holes * (240 / 18);
  return {
    minutes,
    load: Math.round(minutes * rpe * ROUND_LOAD_WEIGHT),
    durationEstimated: durationMinutes === null,
  };
}
export function roundLoadExplanation(session: {
  holesPlayed: number | null;
  durationMinutes: number | null;
  rpe: number;
  loadMetadataJson?: RoundLoadMetadata;
}) {
  if (!isManagedRoundLoad(session.loadMetadataJson?.model) || !session.holesPlayed) return null;
  const result = calculateRoundLoad(session.holesPlayed, session.durationMinutes, session.rpe);
  const estimated = result.durationEstimated || session.loadMetadataJson?.rpeEstimated !== false;
  return `${estimated ? "Estimated" : "Recorded effort"}: ${Math.round(result.minutes)} min${result.durationEstimated ? " (estimated)" : ""} × effort ${session.rpe}${session.loadMetadataJson?.rpeEstimated !== false ? " (estimated)" : ""}${session.loadMetadataJson?.model === ROUND_LOAD_MODEL ? " × 0.5 round weighting" : ""}.`;
}
