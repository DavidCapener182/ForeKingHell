export type SeasonPlan = {
  outcome: string;
  targetDate: string;
  focus: string;
  weeklySessions: number;
  successMeasure: string;
};

export const goalTypes = [
  "handicap",
  "carry",
  "dispersion",
  "speed",
  "practice_frequency",
  "course_record",
  "tournament",
] as const;

export type GoalType = (typeof goalTypes)[number];

export type SeasonGoal = {
  id: string;
  type: GoalType;
  title: string;
  club: string;
  startingValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  targetDate: string;
  evidenceSource: string;
  nextAction: string;
};

export function goalTypeLabel(type: GoalType) {
  return {
    handicap: "Handicap target",
    carry: "Carry target",
    dispersion: "Dispersion target",
    speed: "Speed target",
    practice_frequency: "Practice-frequency target",
    course_record: "Course-record target",
    tournament: "Tournament target",
  }[type];
}
