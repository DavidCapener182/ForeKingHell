import { finiteNumbers, median } from "@/lib/analysis-statistics";

/** Carry availability is independent of direction; retain the service's reviewed selection. */
export function sessionCarryMedian(
  shots: Array<{ id: string; clubType: string; carryYd: number | null }>,
  includedShotIds: ReadonlySet<string>,
  clubType: string | null,
) {
  return median(
    finiteNumbers(
      shots
        .filter((shot) => includedShotIds.has(shot.id) && (!clubType || shot.clubType === clubType))
        .map((shot) => shot.carryYd),
    ),
  );
}
