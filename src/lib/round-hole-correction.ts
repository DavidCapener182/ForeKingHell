type ScorecardHole = {
  holeNumber: number;
  par: number;
  score?: number | null;
  netScore?: number | null;
};

export function applyRoundHoleCorrection<T extends ScorecardHole>(
  hole: T,
  form: FormData,
  complete: boolean,
) {
  const read = (key: string, minimum = 0, required = false) => {
    const raw = String(form.get(key) ?? "").trim();
    if (!raw && !required) return null;
    const value = raw ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < minimum)
      throw new Error(
        `Hole ${hole.holeNumber}: ${key} must be a whole number of ${minimum} or more.`,
      );
    return value;
  };
  const readBoolean = (key: string) =>
    form.get(key) === "true" ? true : form.get(key) === "false" ? false : null;
  const score = read("score", 1, complete);
  const changes = {
    score,
    putts: read("putts"),
    ...(form.has("putts") ? { puttsSource: "manual" as const } : {}),
    penalties: read("penalties"),
    fairwayHit: hole.par === 3 ? null : readBoolean("fairwayHit"),
    gir: readBoolean("gir"),
    ...(form.has("chipShots") ? { chipShots: read("chipShots") } : {}),
    ...(form.has("greensideSandShots") ? { greensideSandShots: read("greensideSandShots") } : {}),
    ...(form.has("notes")
      ? {
          notes:
            String(form.get("notes") ?? "")
              .trim()
              .slice(0, 500) || null,
        }
      : {}),
    netScore:
      typeof hole.netScore === "number" &&
      Number.isFinite(hole.netScore) &&
      typeof hole.score === "number" &&
      Number.isFinite(hole.score) &&
      typeof score === "number"
        ? Math.max(0, hole.netScore + score - hole.score)
        : null,
  };
  return { ...hole, ...changes };
}

export function roundPuttsAfterRecalculation(
  hole: {
    score?: number | null;
    putts?: number | null;
    penalties?: number | null;
    puttsSource?: "manual";
  },
  launchShotCount: number,
) {
  if (hole.puttsSource === "manual") return hole.putts ?? null;
  return typeof hole.score === "number" && launchShotCount > 0
    ? Math.max(0, hole.score - launchShotCount - (hole.penalties ?? 0))
    : (hole.putts ?? null);
}
