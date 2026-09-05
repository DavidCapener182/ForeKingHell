import type { CourseTwinManifest } from "./course-twin-contract";
import type { CourseTwinStrategyClub, CourseTwinStrategyDocument } from "./course-twin-strategy";

export type MobilePlanIntent = "safe" | "normal" | "aggressive";
export function modelledHazardChance(club: CourseTwinStrategyClub) {
  const p = club.probabilities;
  return p.bunker + p.water + p.trees + p.out_of_bounds;
}

/** Options are comparisons of existing simulations, never invented safer/longer results. */
export function mobileCourseTwinPlanOptions(document: CourseTwinStrategyDocument) {
  const normal = document.recommended;
  if (!normal) return { safe: null, normal: null, aggressive: null };
  const other = document.clubs.filter((club) => club.clubId !== normal.clubId);
  const safe =
    other
      .filter(
        (club) =>
          club.carryMedianYd < normal.carryMedianYd &&
          modelledHazardChance(club) <= modelledHazardChance(normal),
      )
      .sort(
        (a, b) =>
          modelledHazardChance(a) - modelledHazardChance(b) ||
          a.averageRemainingYd - b.averageRemainingYd,
      )[0] ?? null;
  const aggressive =
    other
      .filter(
        (club) =>
          club.carryMedianYd > normal.carryMedianYd &&
          club.averageRemainingYd < normal.averageRemainingYd,
      )
      .sort(
        (a, b) =>
          a.averageRemainingYd - b.averageRemainingYd ||
          a.expectedRiskStrokes - b.expectedRiskStrokes,
      )[0] ?? null;
  return { safe, normal, aggressive };
}

/** Two standard deviations of the modelled landing cloud, not a measured confidence interval. */
export function projectedLandingEllipse(points: [number, number][]) {
  const valid = points.filter((point) => point.every(Number.isFinite));
  if (valid.length < 3) return null;
  const cx = valid.reduce((sum, p) => sum + p[0], 0) / valid.length;
  const cy = valid.reduce((sum, p) => sum + p[1], 0) / valid.length;
  const xx = valid.reduce((sum, p) => sum + (p[0] - cx) ** 2, 0) / (valid.length - 1);
  const yy = valid.reduce((sum, p) => sum + (p[1] - cy) ** 2, 0) / (valid.length - 1);
  const xy = valid.reduce((sum, p) => sum + (p[0] - cx) * (p[1] - cy), 0) / (valid.length - 1);
  const delta = Math.hypot(xx - yy, 2 * xy);
  return {
    cx,
    cy,
    rx: 2 * Math.sqrt(Math.max(0, (xx + yy + delta) / 2)),
    ry: 2 * Math.sqrt(Math.max(0, (xx + yy - delta) / 2)),
    angle: (Math.atan2(2 * xy, xx - yy) * 90) / Math.PI,
  };
}

/** Estimated corridors cannot substantiate hazard-avoidance recommendations. */
export function mobilePlanHasMappedSurfaces(
  manifest: Pick<CourseTwinManifest, "features">,
  holeNumber: number,
) {
  const features = manifest.features.filter(
    (feature) => feature.holeNumber === holeNumber || feature.holeNumber === null,
  );
  return (
    features.some((feature) => feature.type !== "course_boundary") &&
    features.every((feature) => !/estimated|prototype/i.test(feature.source))
  );
}
