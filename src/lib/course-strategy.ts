export type StrategyClub = {
  clubId: string;
  clubType?: string;
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

export type HoleStrategyMode = {
  id: "safe" | "normal" | "aggressive";
  label: "Safe" | "Normal" | "Aggressive";
  club: string;
  carryRange: string;
  target: string;
  expectedLeave: string;
  rationale: string;
};

export type HoleStrategy = {
  holeNumber: number;
  par: number;
  yards: number;
  recommendedClub: string;
  expectedCarryRange: string;
  personalCarryYd: number | null;
  dispersionLeftYd: number | null;
  dispersionRightYd: number | null;
  commonMiss: string;
  safeTarget: string;
  hazards: string[];
  hazardWarning: string;
  conservativeAlternative: string;
  expectedLeave: string;
  expectedLeaveYd: number | null;
  followUpClubs: Array<{
    label: string;
    expectedCarryRange: string;
  }>;
  followUpFit: "In measured range" | "Closest measured sequence" | null;
  followUpTotalRange: string | null;
  confidence: "High" | "Moderate" | "Low";
  caveat: string;
  strategyModes: HoleStrategyMode[];
};

export function buildHoleStrategies(input: {
  holes: StrategyHole[];
  clubs: StrategyClub[];
  hazardsByHole: Map<number, string[]>;
}): HoleStrategy[] {
  const clubs = uniqueClubsByIdentity(
    [...input.clubs].sort((left, right) => right.carryYd - left.carryYd),
  );
  return input.holes.map((hole) => {
    const selected = selectClub(hole, clubs);
    const selectedIndex = selected
      ? clubs.findIndex((club) => club.clubId === selected.clubId)
      : -1;
    const alternative = selectedIndex >= 0 ? clubs[selectedIndex + 1] : null;
    const aggressive = selectedIndex > 0 ? clubs[selectedIndex - 1] : null;
    const hazards = input.hazardsByHole.get(hole.holeNumber) ?? [];
    const expectedLeaveYd = selected
      ? Math.max(0, Math.round(hole.yards - selected.carryYd))
      : null;
    const followUpPlan =
      expectedLeaveYd !== null && expectedLeaveYd > 0
        ? selectClubsForLeave(expectedLeaveYd, clubs, selected)
        : null;
    const miss = selected
      ? selected.leftYd > selected.rightYd
        ? "left"
        : selected.rightYd > selected.leftYd
          ? "right"
          : "balanced"
      : "unknown";
    const confidence = selected ? confidenceLabel(selected) : "Low";
    const normalMode = selected
      ? strategyMode({
          id: "normal",
          club: selected,
          hole,
          target:
            miss === "left"
              ? "Right-centre"
              : miss === "right"
                ? "Left-centre"
                : "Centre of the widest playable area",
          rationale: "Best fit from the trusted measured bag range.",
        })
      : null;
    const safeMode = alternative
      ? strategyMode({
          id: "safe",
          club: alternative,
          hole,
          target: "Widest playable area",
          rationale: "Shorter measured club to keep the next shot comfortable.",
        })
      : null;
    const aggressiveMode =
      aggressive &&
      selected &&
      hazards.length > 0 &&
      confidenceLabel(aggressive) !== "Low" &&
      confidenceLabel(selected) !== "Low"
        ? strategyMode({
            id: "aggressive",
            club: aggressive,
            hole,
            target:
              miss === "left" ? "Right-centre" : miss === "right" ? "Left-centre" : "Centre line",
            rationale:
              "Longer measured option. Confirm every mapped hazard distance in Course Twin before committing.",
          })
        : null;
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      recommendedClub: selected?.label ?? "Build bag evidence",
      expectedCarryRange: selected
        ? `${Math.round(selected.minCarryYd)}–${Math.round(selected.maxCarryYd)} yd`
        : "Not available",
      personalCarryYd: selected ? Math.round(selected.carryYd) : null,
      dispersionLeftYd: selected ? Math.round(selected.leftYd) : null,
      dispersionRightYd: selected ? Math.round(selected.rightYd) : null,
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
      hazards: unique(hazards).map(titleCase),
      hazardWarning: hazards.length
        ? `${unique(hazards).map(titleCase).join(" and ")} mapped on this hole; confirm the live line and distance.`
        : "No mapped hazard evidence; confirm the course view before committing.",
      conservativeAlternative: alternative
        ? `${alternative.label} (${Math.round(alternative.minCarryYd)}–${Math.round(alternative.maxCarryYd)} yd)`
        : "Use the shortest club that keeps the next shot comfortable.",
      expectedLeave:
        expectedLeaveYd !== null ? `${expectedLeaveYd} yd after the first shot` : "Unknown",
      expectedLeaveYd,
      followUpClubs:
        followUpPlan?.clubs.map((club) => ({
          label: club.label,
          expectedCarryRange: carryRange(club),
        })) ?? [],
      followUpFit: followUpPlan
        ? distanceFromPlanRange(expectedLeaveYd!, followUpPlan.clubs) === 0
          ? "In measured range"
          : "Closest measured sequence"
        : null,
      followUpTotalRange: followUpPlan ? combinedCarryRange(followUpPlan.clubs) : null,
      confidence,
      caveat: `${confidence} confidence from ${selected?.sampleSize ?? 0} measured shots. Historical dispersion informs this recommendation; wind, lie, pin and current hazards can change it.`,
      strategyModes: [safeMode, normalMode, aggressiveMode].filter(
        (mode): mode is HoleStrategyMode => mode !== null,
      ),
    };
  });
}

function strategyMode({
  id,
  club,
  hole,
  target,
  rationale,
}: {
  id: HoleStrategyMode["id"];
  club: StrategyClub;
  hole: StrategyHole;
  target: string;
  rationale: string;
}): HoleStrategyMode {
  return {
    id,
    label: id === "safe" ? "Safe" : id === "normal" ? "Normal" : "Aggressive",
    club: club.label,
    carryRange: carryRange(club),
    target,
    expectedLeave: `${Math.max(0, Math.round(hole.yards - club.carryYd))} yd after the first shot`,
    rationale,
  };
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

function selectClubsForLeave(
  leaveYd: number,
  clubs: StrategyClub[],
  openingClub?: StrategyClub | null,
) {
  const openingClubIdentity = openingClub ? clubIdentity(openingClub) : null;
  const trusted = uniqueClubsByIdentity(
    clubs.filter(
      (club) =>
        club.sampleSize >= 5 &&
        club.carryYd > 0 &&
        !isDriverClub(club) &&
        clubIdentity(club) !== openingClubIdentity,
    ),
  );
  const minimumClubCount = leaveYd > 200 ? 2 : 1;
  for (let clubCount = minimumClubCount; clubCount <= 3; clubCount += 1) {
    const plan = bestPlanForDistance(leaveYd, clubCombinations(trusted, clubCount));
    if (plan && isAcceptablePlan(leaveYd, plan)) return { clubs: plan };
  }
  return null;
}

function clubCombinations(clubs: StrategyClub[], count: number): StrategyClub[][] {
  if (count === 1) return clubs.map((club) => [club]);
  const combinations: StrategyClub[][] = [];
  const visit = (startIndex: number, selected: StrategyClub[]) => {
    if (selected.length === count) {
      combinations.push(selected);
      return;
    }
    for (let index = startIndex; index < clubs.length; index += 1) {
      visit(index + 1, [...selected, clubs[index]!]);
    }
  };
  visit(0, []);
  return combinations;
}

function bestPlanForDistance(targetYd: number, plans: StrategyClub[][]) {
  return (
    [...plans].sort((left, right) => {
      const rangeDifference =
        distanceFromPlanRange(targetYd, left) - distanceFromPlanRange(targetYd, right);
      if (rangeDifference !== 0) return rangeDifference;
      return Math.abs(totalCarry(left) - targetYd) - Math.abs(totalCarry(right) - targetYd);
    })[0] ?? null
  );
}

function isAcceptablePlan(targetYd: number, clubs: StrategyClub[]) {
  return distanceFromPlanRange(targetYd, clubs) <= Math.max(12, targetYd * 0.1);
}

function distanceFromPlanRange(targetYd: number, clubs: StrategyClub[]) {
  const minCarryYd = clubs.reduce((total, club) => total + club.minCarryYd, 0);
  const maxCarryYd = clubs.reduce((total, club) => total + club.maxCarryYd, 0);
  if (targetYd < minCarryYd) return minCarryYd - targetYd;
  if (targetYd > maxCarryYd) return targetYd - maxCarryYd;
  return 0;
}

function totalCarry(clubs: StrategyClub[]) {
  return clubs.reduce((total, club) => total + club.carryYd, 0);
}

function carryRange(club: StrategyClub) {
  return `${Math.round(club.minCarryYd)}–${Math.round(club.maxCarryYd)} yd`;
}

function combinedCarryRange(clubs: StrategyClub[]) {
  const minCarryYd = clubs.reduce((total, club) => total + club.minCarryYd, 0);
  const maxCarryYd = clubs.reduce((total, club) => total + club.maxCarryYd, 0);
  return `${Math.round(minCarryYd)}–${Math.round(maxCarryYd)} yd`;
}

function uniqueClubsByIdentity(clubs: StrategyClub[]) {
  const uniqueClubs = new Map<string, StrategyClub>();
  for (const club of clubs) {
    const identity = clubIdentity(club);
    if (!uniqueClubs.has(identity)) uniqueClubs.set(identity, club);
  }
  return [...uniqueClubs.values()];
}

function isDriverClub(club: StrategyClub) {
  return ["driver", "1w", "1wood"].includes(clubIdentity(club));
}

function clubIdentity(club: StrategyClub) {
  return (club.clubType ?? club.label)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");
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
