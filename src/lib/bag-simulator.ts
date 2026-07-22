export type BagSimulatorClub = {
  id: string;
  label: string;
  carryYd: number;
  p25Yd: number;
  p75Yd: number;
  leftYd: number;
  rightYd: number;
  confidence: number;
};
export type BagSimulation = {
  currentCoverage: number;
  projectedCoverage: number;
  coverageChange: number;
  currentGaps: string[];
  projectedGaps: string[];
  warning: string;
};

export function simulateBagChange(input: {
  clubs: BagSimulatorClub[];
  removeId?: string;
  candidate?: Omit<BagSimulatorClub, "id" | "confidence"> | null;
}): BagSimulation {
  const current = coverage(input.clubs);
  const projectedClubs = input.clubs.filter((club) => club.id !== input.removeId);
  if (input.candidate) projectedClubs.push({ ...input.candidate, id: "candidate", confidence: 35 });
  const projected = coverage(projectedClubs);
  return {
    currentCoverage: current.score,
    projectedCoverage: projected.score,
    coverageChange: projected.score - current.score,
    currentGaps: current.gaps,
    projectedGaps: projected.gaps,
    warning: input.candidate
      ? "Candidate dispersion is a projection from the values entered. Confirm it with at least 15 measured shots before changing equipment."
      : "Removing a club uses the remaining measured carry and dispersion windows only.",
  };
}

function coverage(clubs: BagSimulatorClub[]) {
  const targets = Array.from({ length: 23 }, (_, index) => 40 + index * 10);
  const covered = targets.filter((target) =>
    clubs.some(
      (club) =>
        club.confidence >= 30 &&
        target >= club.p25Yd - 3 &&
        target <= club.p75Yd + 3 &&
        Math.max(club.leftYd, club.rightYd) <= 35,
    ),
  );
  const gaps = targets
    .filter((target) => !covered.includes(target))
    .map((target) => `${target} yd`);
  return { score: Math.round((covered.length / targets.length) * 100), gaps };
}
