export type StrategyClub = {
  clubId: string;
  label: string;
  carryYd: number;
  minCarryYd: number;
  maxCarryYd: number;
  leftYd: number;
  rightYd: number;
  confidence: number;
  sampleSize: number;
};

export type StrategyHole = { holeNumber: number; par: number; yards: number };

export type HoleStrategy = {
  holeNumber: number;
  par: number;
  yards: number;
  recommendedClub: string;
  expectedCarryRange: string;
  commonMiss: string;
  safeTarget: string;
  hazardWarning: string;
  conservativeAlternative: string;
  expectedLeave: string;
  confidence: "High" | "Moderate" | "Low";
  caveat: string;
};

export function buildHoleStrategies(input: {
  holes: StrategyHole[];
  clubs: StrategyClub[];
  hazardsByHole: Map<number, string[]>;
}): HoleStrategy[] {
  const clubs = [...input.clubs].sort((left, right) => right.carryYd - left.carryYd);
  return input.holes.map((hole) => {
    const selected = selectClub(hole, clubs);
    const selectedIndex = selected
      ? clubs.findIndex((club) => club.clubId === selected.clubId)
      : -1;
    const alternative = selectedIndex >= 0 ? clubs[selectedIndex + 1] : null;
    const hazards = input.hazardsByHole.get(hole.holeNumber) ?? [];
    const miss = selected
      ? selected.leftYd > selected.rightYd
        ? "left"
        : selected.rightYd > selected.leftYd
          ? "right"
          : "balanced"
      : "unknown";
    const confidence = selected ? confidenceLabel(selected) : "Low";
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      recommendedClub: selected?.label ?? "Build bag evidence",
      expectedCarryRange: selected
        ? `${Math.round(selected.minCarryYd)}–${Math.round(selected.maxCarryYd)} yd`
        : "Not available",
      commonMiss:
        miss === "unknown"
          ? "No measured pattern"
          : miss === "balanced"
            ? "Balanced pattern"
            : `${miss[0]!.toUpperCase()}${miss.slice(1)} miss`,
      safeTarget:
        miss === "left"
          ? "Right-centre"
          : miss === "right"
            ? "Left-centre"
            : "Centre of the widest playable area",
      hazardWarning: hazards.length
        ? `${unique(hazards).map(titleCase).join(" and ")} mapped on this hole; confirm the live line and distance.`
        : "No mapped hazard evidence; confirm the course view before committing.",
      conservativeAlternative: alternative
        ? `${alternative.label} (${Math.round(alternative.minCarryYd)}–${Math.round(alternative.maxCarryYd)} yd)`
        : "Use the shortest club that keeps the next shot comfortable.",
      expectedLeave: selected
        ? `${Math.max(0, Math.round(hole.yards - selected.carryYd - (hole.par >= 5 ? selected.carryYd : 0)))} yd after the planned long shot${hole.par >= 5 ? "s" : ""}`
        : "Unknown",
      confidence,
      caveat: `${confidence} confidence from ${selected?.sampleSize ?? 0} measured shots. Historical dispersion informs this recommendation; wind, lie, pin and current hazards can change it.`,
    };
  });
}

function selectClub(hole: StrategyHole, clubs: StrategyClub[]) {
  const trusted = clubs.filter((club) => club.sampleSize >= 5 && club.carryYd > 0);
  if (hole.par <= 3)
    return (
      [...trusted].sort(
        (left, right) => Math.abs(left.carryYd - hole.yards) - Math.abs(right.carryYd - hole.yards),
      )[0] ?? null
    );
  const ceiling = hole.par >= 5 ? hole.yards * 0.48 : hole.yards * 0.66;
  return trusted.find((club) => club.maxCarryYd <= ceiling) ?? trusted[0] ?? null;
}

function confidenceLabel(club: StrategyClub): HoleStrategy["confidence"] {
  if (club.sampleSize >= 20 && club.confidence >= 0.7) return "High";
  if (club.sampleSize >= 8 && club.confidence >= 0.4) return "Moderate";
  return "Low";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
