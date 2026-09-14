import type { CourseTwinHole, CourseTwinManifest, CourseTwinPoint } from "./course-twin-contract";

export type PlanTees = Record<number, { id: string; point: CourseTwinPoint }>;

export function planTeeStorageKey(manifest: CourseTwinManifest) {
  return `course-plan-tees-v1:${manifest.course.id}:${manifest.packageVersion}:${manifest.origin.latitude}:${manifest.origin.longitude}`;
}

/** Reject stale, malformed or out-of-package locations rather than moving a player's origin. */
export function parsePlanTees(raw: string | null, manifest: CourseTwinManifest): PlanTees {
  try {
    const value = JSON.parse(raw ?? "{}");
    const result: PlanTees = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const hole of manifest.holes) {
      const entry = value[hole.holeNumber];
      if (
        !entry ||
        typeof entry.id !== "string" ||
        entry.id.length > 200 ||
        !Array.isArray(entry.point) ||
        entry.point.length !== 3 ||
        !entry.point.every((n: unknown) => typeof n === "number" && Number.isFinite(n))
      )
        continue;
      const [x, , z] = entry.point;
      if (
        x < manifest.bounds.minX ||
        x > manifest.bounds.maxX ||
        z < manifest.bounds.minZ ||
        z > manifest.bounds.maxZ
      )
        continue;
      result[hole.holeNumber] = { id: entry.id, point: entry.point };
    }
    return result;
  } catch {
    return {};
  }
}

/** Join the remaining route at its nearest segment; never route a forward tee backwards. */
export function planHoleFromTee(hole: CourseTwinHole, tee?: CourseTwinPoint): CourseTwinHole {
  if (!tee) return hole;
  const route = hole.centerline.length > 1 ? hole.centerline : [hole.tee, hole.green];
  let nearest = Infinity;
  let segment = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i],
      b = route[i + 1];
    const dx = b[0] - a[0],
      dz = b[2] - a[2];
    const t = Math.max(
      0,
      Math.min(1, ((tee[0] - a[0]) * dx + (tee[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)),
    );
    const distance = Math.hypot(tee[0] - a[0] - t * dx, tee[2] - a[2] - t * dz);
    if (distance < nearest) {
      nearest = distance;
      segment = i;
    }
  }
  const remaining = route
    .slice(segment + 1)
    .filter((p) => Math.hypot(p[0] - tee[0], p[2] - tee[2]) > 1);
  const centerline = [tee, ...(remaining.length ? remaining : [hole.green])];
  return { ...hole, tee, centerline };
}
