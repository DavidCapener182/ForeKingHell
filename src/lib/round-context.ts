type CompletionHole = { holeNumber: number; score?: number | null };

export function roundCompletionIssue(holes: readonly CompletionHole[] | null | undefined) {
  if (!holes?.length) return "Add the scorecard before marking this round complete.";
  const unscored = holes.filter((hole) => !Number.isInteger(hole.score) || (hole.score ?? 0) < 1);
  if (unscored.length)
    return `Enter a valid score for ${unscored.length} remaining ${unscored.length === 1 ? "hole" : "holes"} before marking this round complete.`;
  if (
    holes.length > 18 ||
    new Set(holes.map((hole) => hole.holeNumber)).size !== holes.length ||
    holes.some(
      (hole) => !Number.isInteger(hole.holeNumber) || hole.holeNumber < 1 || hole.holeNumber > 18,
    )
  )
    return "Review the scorecard hole numbers before marking this round complete.";
  return null;
}

export function contextRoundStatus(value: FormDataEntryValue | null) {
  if (value !== "in_progress" && value !== "complete")
    throw new Error("Choose a valid round status.");
  return value;
}

type TeeHole = { holeNumber: number; par: number; yards: number; strokeIndex: number | null };
type ExistingHole = Omit<TeeHole, "strokeIndex"> & {
  name: string | null;
  strokeIndex?: number | null;
  fairwayHit?: boolean | null;
};

export function relinkRoundScorecard<T extends ExistingHole>(
  existing: readonly T[],
  teeHoles: readonly TeeHole[],
) {
  if (!teeHoles.length)
    throw new Error("This tee needs a saved hole-by-hole scorecard before linking it.");
  const byNumber = new Map(teeHoles.map((hole) => [hole.holeNumber, hole]));
  if (existing.some((hole) => !byNumber.has(hole.holeNumber)))
    throw new Error(
      "This tee is missing holes from your recorded scorecard. Choose a tee with matching holes.",
    );
  const facts = (hole: TeeHole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    yards: hole.yards,
    strokeIndex: hole.strokeIndex,
  });
  if (!existing.length) return teeHoles.map((hole) => ({ ...facts(hole), name: null }));
  return existing.map((hole) => ({
    ...hole,
    ...facts(byNumber.get(hole.holeNumber)!),
    fairwayHit: byNumber.get(hole.holeNumber)!.par === 3 ? null : (hole.fairwayHit ?? null),
  }));
}
