import type {
  clubEquipmentHistory,
  clubs,
  courseTwinRounds,
  courses,
  holes,
  practicePlans,
  sessions,
  shots,
} from "@/db/schema";
import type { CourseTwinStrategyDocument } from "@/lib/course-twin-strategy";
import type { SeasonGoal } from "@/lib/product-preferences-model";

export type Shot = typeof shots.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type ClubVersion = typeof clubEquipmentHistory.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Hole = typeof holes.$inferSelect;
export type Strategy = CourseTwinStrategyDocument;
export type PracticePlan = typeof practicePlans.$inferSelect;
export type Round = typeof courseTwinRounds.$inferSelect;
export type Goal = SeasonGoal;

export type DomainEntityName =
  | "shot"
  | "session"
  | "club"
  | "clubVersion"
  | "course"
  | "hole"
  | "strategy"
  | "practicePlan"
  | "round"
  | "goal";

export type EvidenceReference = {
  sessionIds: string[];
  shotIds: string[];
  generatedAt: string;
  method: string;
  assumptions: string[];
};

export type Recommendation<TAction extends string = string> = {
  action: TAction;
  rationale: string;
  confidence: "high" | "medium" | "low";
  evidence: EvidenceReference;
};
