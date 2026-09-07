type ReviewHole = {
  holeNumber: number;
  par: number;
  score?: number | null;
  putts?: number | null;
  penalties?: number | null;
  fairwayHit?: boolean | null;
  gir?: boolean | null;
};

/** Scorecard observations only: a score does not establish why a shot was lost. */
export function buildRoundLearningReview({ holes }: { holes: ReviewHole[] }) {
  const scored = holes
    .filter((hole) => Number.isFinite(hole.score) && hole.score! > 0 && hole.par > 0)
    .map((hole) => ({ ...hole, difference: hole.score! - hole.par }));
  const bestDifference = Math.min(...scored.map((hole) => hole.difference));
  const worstDifference = Math.max(...scored.map((hole) => hole.difference));
  const best = scored.filter((hole) => hole.difference === bestDifference);
  const worst = scored.filter((hole) => hole.difference === worstDifference);
  const overPar = scored.filter((hole) => hole.difference > 0).length;
  const underPar = scored.filter((hole) => hole.difference < 0).length;
  const pars = scored.length - overPar - underPar;
  const putting = scored.filter((hole) => Number.isFinite(hole.putts) && hole.putts! >= 0);
  const totalPutts = putting.reduce((sum, hole) => sum + hole.putts!, 0);
  const penalties = scored.filter(
    (hole) => Number.isFinite(hole.penalties) && hole.penalties! >= 0,
  );
  const totalPenalties = penalties.reduce((sum, hole) => sum + hole.penalties!, 0);
  const fairways = scored.filter((hole) => typeof hole.fairwayHit === "boolean");
  const greens = scored.filter((hole) => typeof hole.gir === "boolean");
  const scope = `${scored.length}/${holes.length} holes scored`;

  const nextPractice =
    totalPenalties >= 2
      ? `Review the decisions behind ${totalPenalties} recorded penalties`
      : putting.length >= 3 && totalPutts / putting.length >= 2
        ? `Check putting pace: ${totalPutts} putts across ${putting.length} recorded holes`
        : greens.length >= 3 && greens.filter((hole) => hole.gir).length / greens.length < 0.4
          ? `Review approach misses across ${greens.length} holes with green stats`
          : overPar > 0
            ? "Add notes to the over-par holes before choosing a drill"
            : scored.length > 0
              ? "Record what worked and any decisions to practise next"
              : "Add hole scores before choosing a practice priority";

  return {
    strongestArea: best.length ? describeTiedHoles(best, bestDifference) : "No scored holes yet",
    costliestArea:
      overPar > 0
        ? describeTiedHoles(worst, worstDifference)
        : scored.length
          ? "No scored holes over par"
          : "No scored holes yet",
    scorePattern: scored.length
      ? `${scope} · ${underPar} under par · ${pars} par · ${overPar} over par`
      : "No scoring pattern yet",
    strategyResult:
      fairways.length || greens.length
        ? [
            fairways.length
              ? `${fairways.filter((hole) => hole.fairwayHit).length}/${fairways.length} recorded fairways hit`
              : "Fairways not recorded",
            greens.length
              ? `${greens.filter((hole) => hole.gir).length}/${greens.length} recorded greens hit`
              : "Greens not recorded",
          ].join(" · ")
        : "Scorecard only; decisions and shot outcomes were not recorded",
    nextPractice,
  };
}

function describeTiedHoles(holes: { holeNumber: number }[], difference: number) {
  const result = difference === 0 ? "par" : `${difference > 0 ? "+" : ""}${difference} vs par`;
  if (holes.length > 3) return `${holes.length} holes at ${result}`;
  return `${holes.length === 1 ? "Hole" : "Holes"} ${holes.map((hole) => hole.holeNumber).join(", ")} · ${result}`;
}
