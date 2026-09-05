import type { HoleStrategy } from "@/lib/course-strategy";
import { formatClubType } from "@/lib/club-format";

export type LiveRoundClubEvidence = Record<
  number,
  { plan: string[]; actual: string[]; actualOrderKnown?: boolean }
>;

export function buildLiveRoundClubEvidence(
  strategies: Array<
    Pick<HoleStrategy, "holeNumber" | "personalCarryYd" | "recommendedClub" | "followUpClubs">
  >,
  shots: Array<{
    courseHoleNumber: number | null;
    courseHoleShotNumber: number | null;
    shotNumber: number | null;
    clubType: string;
  }>,
): LiveRoundClubEvidence {
  return Object.fromEntries(
    strategies
      .filter((hole) => hole.personalCarryYd !== null && Number.isFinite(hole.personalCarryYd))
      .map((hole) => {
        const linked = shots.filter((shot) => shot.courseHoleNumber === hole.holeNumber);
        const holeOrder = linked.every((shot) => shot.courseHoleShotNumber !== null);
        const globalOrder = linked.every((shot) => shot.shotNumber !== null);
        const ordered =
          holeOrder || globalOrder
            ? linked.sort((a, b) =>
                holeOrder
                  ? a.courseHoleShotNumber! - b.courseHoleShotNumber!
                  : a.shotNumber! - b.shotNumber!,
              )
            : linked;
        return [
          hole.holeNumber,
          {
            plan: [hole.recommendedClub, ...hole.followUpClubs.map((club) => club.label)],
            actual: ordered.map((shot) => formatClubType(shot.clubType)),
            actualOrderKnown: holeOrder || globalOrder,
          },
        ];
      }),
  );
}
