export const COURSE_TWIN_SHAPE_LOOKBACK_DAYS = 30;
export const COURSE_TWIN_SHAPE_SHOTS_PER_CLUB = 50;

const DAY_MS = 24 * 60 * 60 * 1_000;

type CourseTwinRecentShot = {
  clubId: string | null;
  qualityTag: string | null;
  shotAt: Date;
  shotCategory: string | null;
};

export function selectCourseTwinRecentShots<T extends CourseTwinRecentShot>(
  shots: T[],
  options: {
    now?: Date;
    lookbackDays?: number;
    maxPerClub?: number;
  } = {},
) {
  const now = options.now ?? new Date();
  const lookbackDays = options.lookbackDays ?? COURSE_TWIN_SHAPE_LOOKBACK_DAYS;
  const maxPerClub = options.maxPerClub ?? COURSE_TWIN_SHAPE_SHOTS_PER_CLUB;
  const cutoff = now.getTime() - lookbackDays * DAY_MS;
  const counts = new Map<string, number>();

  return [...shots]
    .sort((left, right) => right.shotAt.getTime() - left.shotAt.getTime())
    .filter((shot) => {
      if (!shot.clubId || shot.shotCategory?.toLowerCase() !== "full") return false;
      if (shot.qualityTag?.toLowerCase().includes("exclude")) return false;
      const shotAt = shot.shotAt.getTime();
      if (!Number.isFinite(shotAt) || shotAt < cutoff || shotAt > now.getTime()) return false;
      const count = counts.get(shot.clubId) ?? 0;
      if (count >= maxPerClub) return false;
      counts.set(shot.clubId, count + 1);
      return true;
    });
}
