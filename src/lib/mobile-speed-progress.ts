export type MobileSpeedReading = { value: number; warmup: boolean; blockKey?: string };

export function speedElapsedMs(accumulated: number, runningSince: number | null, now: number) {
  return accumulated + (runningSince === null ? 0 : Math.max(0, now - runningSince));
}

/** Use the existing plan's two-readings / 4% stop rule; warm-up is not maximum evidence. */
export function speedFatigueStop(readings: MobileSpeedReading[]) {
  const measured = readings.filter((item) => !item.warmup && Number.isFinite(item.value));
  if (measured.length < 3) return false;
  let peak = 0;
  let consecutiveDrops = 0;
  for (const item of measured) {
    peak = Math.max(peak, item.value);
    consecutiveDrops = item.value <= peak * 0.96 ? consecutiveDrops + 1 : 0;
    if (consecutiveDrops >= 2) return true;
  }
  return false;
}

/** The second maximum block prescribes 60–90 seconds before starting. */
export function speedBlockRecoverySeconds(key: string) {
  return key === "speed-2" ? 75 : 0;
}
