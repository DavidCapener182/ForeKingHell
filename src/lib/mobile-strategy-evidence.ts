import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import type { StrategyClub } from "./course-strategy";

/** Course decisions use the same full-swing window as the companion Bag. */
export function mobileStrategyClubs(bag: QuickBagClub[]): StrategyClub[] {
  return bag.flatMap((club) => {
    if (
      club.evidenceKind !== "full" ||
      !club.clubType ||
      club.trustedCarryYd == null ||
      !Number.isFinite(club.trustedCarryYd) ||
      club.trustedCarryYd <= 0 ||
      club.lowYd == null ||
      club.highYd == null ||
      club.sampleSize < 5
    )
      return [];
    const dispersionAvailable =
      club.patternSampleSize >= 5 && club.observedLeftYd != null && club.observedRightYd != null;
    return [
      {
        clubId: club.id,
        clubType: club.clubType,
        label: club.label,
        carryYd: club.trustedCarryYd,
        minCarryYd: club.lowYd,
        maxCarryYd: club.highYd,
        carryRangeMeasured: true,
        dispersionAvailable,
        leftYd: dispersionAvailable ? club.observedLeftYd! : 0,
        rightYd: dispersionAvailable ? club.observedRightYd! : 0,
        confidence: club.confidence / 100,
        sampleSize: club.sampleSize,
        evidenceWindow: {
          basis: "latest-reliable" as const,
          latestShotAt: club.latestEvidenceDate,
          lateralSampleSize: club.patternSampleSize,
        },
      },
    ];
  });
}
