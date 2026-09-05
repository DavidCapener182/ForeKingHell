export type MobileSpeedReading = { value: number; warmup: boolean; blockKey?: string };

export function speedElapsedMs(accumulated: number, runningSince: number | null, now: number) {
  return accumulated + (runningSince === null ? 0 : Math.max(0, now - runningSince));
}

/** Use the existing plan's two-readings / 4% stop rule; warm-up is not maximum evidence. */
export function speedFatigueStop(readings: MobileSpeedReading[]) {
  const measured = readings.filter((item) => !item.warmup && Number.isFinite(item.value));
  if (measured.length < 3) return false;
  const peak = Math.max(...measured.map((item) => item.value));
  return measured.slice(-2).every((item) => item.value <= peak * 0.96);
}

/** The second maximum block prescribes 60–90 seconds before starting. */
export function speedBlockRecoverySeconds(key: string) {
  return key === "speed-2" ? 75 : 0;
}
