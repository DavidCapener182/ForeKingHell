import type { SpeedCentreSession } from "./speed-training-data";
/** Presentation selection only; averages remain the authoritative session calculations. */
export function selectMobileSpeedTrend(sessions: readonly SpeedCentreSession[], now = Date.now()) {
  const recent = sessions
    .filter((session) => {
      const time = Date.parse(session.sessionDateIso);
      return (
        time <= now &&
        time >= now - 7 * 86400000 &&
        session.avgSpeedMph !== null &&
        Number.isFinite(session.avgSpeedMph)
      );
    })
    .sort((a, b) => Date.parse(a.sessionDateIso) - Date.parse(b.sessionDateIso));
  const latest = recent.at(-1);
  const identity = (session: SpeedCentreSession) =>
    JSON.stringify([
      session.clubId,
      session.implementKind,
      session.implementLabel,
      session.source,
      session.speedSystem,
      session.handedness,
    ]);
  return {
    label: latest?.implementLabel ?? null,
    points: latest
      ? recent
          .filter((session) => identity(session) === identity(latest))
          .map((session) => ({
            id: session.id,
            time: Date.parse(session.sessionDateIso),
            value: session.avgSpeedMph!,
          }))
      : [],
  };
}
