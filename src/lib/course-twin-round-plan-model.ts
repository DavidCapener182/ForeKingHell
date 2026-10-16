import type { CourseTwinStrategyClub } from "./course-twin-strategy";
import type { MobilePlanIntent } from "./course-twin-mobile-plan";

export type RoundPlanHole = {
  holeNumber: number;
  intent: MobilePlanIntent;
  status: "ready" | "unavailable";
  clubId: string | null;
  clubType: string | null;
  carryMedianYd: number | null;
  confidence: CourseTwinStrategyClub["confidence"] | null;
  hazardChance: number | null;
  modelVersion: "dispersion-monte-carlo-v1";
  disclosure: string;
  reason: string | null;
};
