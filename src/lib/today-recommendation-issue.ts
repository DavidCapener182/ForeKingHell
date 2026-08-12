export type TodayRecommendationIssue = {
  key:
    | "start-line"
    | "directional-dispersion"
    | "strike-efficiency"
    | "carry-consistency"
    | "distance-gap"
    | "speed"
    | "low-confidence-baseline"
    | "round-preparation"
    | "control";
  label: string;
};

type IssueInput = {
  club: {
    shotCount: number;
    straightRate: number | null;
    offlineAverageYd: number | null;
  } | null;
  bagClub?: {
    volatilityScore: number;
    playableRate: number | null;
  } | null;
  priority?: { title: string; reason: string } | null;
  bagIssues?: string[];
  scoring?: { weakestCategory: string | null; penaltyPattern: string | null };
  speed?: { priority: string; recommendation: string };
};

export function classifyTodayRecommendationIssue(input: IssueInput): TodayRecommendationIssue {
  if (!input.club || input.club.shotCount < 6) {
    return { label: "Control", key: "low-confidence-baseline" };
  }

  const evidence = [input.priority?.title, input.priority?.reason, ...(input.bagIssues ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(round|course|scoring)\b|penalt/.test(evidence)) {
    return { label: "Round preparation", key: "round-preparation" };
  }
  if (/\b(speed|mph|overspeed)\b/.test(evidence)) {
    return { label: "Speed", key: "speed" };
  }
  if (/start[ -]?line/.test(evidence)) {
    return { label: "Start-line control", key: "start-line" };
  }
  if (/\b(strike|smash|contact)\b/.test(evidence)) {
    return { label: "Strike efficiency", key: "strike-efficiency" };
  }
  if (/\b(gap|gapping|overlap)\b/.test(evidence)) {
    return { label: "Distance gap", key: "distance-gap" };
  }
  if (
    /\b(direction|dispersion|shot cone|left miss|right miss)\b/.test(evidence) ||
    (input.club.straightRate !== null && input.club.straightRate < 35) ||
    (input.club.offlineAverageYd !== null && input.club.offlineAverageYd >= 18)
  ) {
    return { label: "Directional dispersion", key: "directional-dispersion" };
  }
  if (input.bagClub && input.bagClub.volatilityScore >= 65) {
    return { label: "Carry consistency", key: "carry-consistency" };
  }
  if (
    input.speed &&
    /high|urgent/i.test(input.speed.priority) &&
    !/wait|avoid|max-speed work should wait/i.test(input.speed.recommendation)
  ) {
    return { label: "Speed", key: "speed" };
  }
  if (input.scoring?.penaltyPattern || input.scoring?.weakestCategory) {
    return { label: "Round preparation", key: "round-preparation" };
  }
  return { label: "Control", key: "control" };
}
