export type QuickBagRankableClub = {
  id: string;
  trustedCarryYd: number | null;
  playNumberYd: number | null;
  lowYd: number | null;
  highYd: number | null;
  confidence: number;
  sampleSize: number;
};

export type TargetPreference = "carry" | "finish";

export function rankQuickBagForTarget<T extends QuickBagRankableClub>(
  clubs: T[],
  target: number,
  preference: TargetPreference,
) {
  if (!Number.isFinite(target) || target <= 0) return clubs;
  return [...clubs].sort((left, right) => {
    const leftInside = targetInsideRange(left, target);
    const rightInside = targetInsideRange(right, target);
    if (leftInside !== rightInside) return leftInside ? -1 : 1;
    const leftPrimary = preference === "carry" ? left.trustedCarryYd : left.playNumberYd;
    const rightPrimary = preference === "carry" ? right.trustedCarryYd : right.playNumberYd;
    const primaryDifference =
      distanceFrom(leftPrimary, target) - distanceFrom(rightPrimary, target);
    if (primaryDifference !== 0) return primaryDifference;
    const playDifference =
      distanceFrom(left.playNumberYd, target) - distanceFrom(right.playNumberYd, target);
    if (playDifference !== 0) return playDifference;
    if (left.confidence !== right.confidence) return right.confidence - left.confidence;
    return right.sampleSize - left.sampleSize;
  });
}

export function targetInsideRange(club: QuickBagRankableClub, target: number) {
  if (club.lowYd === null || club.highYd === null) return false;
  return target >= Math.min(club.lowYd, club.highYd) && target <= Math.max(club.lowYd, club.highYd);
}

function distanceFrom(value: number | null, target: number) {
  return value === null ? Number.POSITIVE_INFINITY : Math.abs(value - target);
}
