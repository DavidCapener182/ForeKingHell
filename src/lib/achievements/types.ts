import type { ShotReviewStatus } from "@/lib/shot-review";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "hidden";

export type AchievementCategory =
  | "data"
  | "power"
  | "accuracy"
  | "launch"
  | "strike"
  | "driver"
  | "fiveWood"
  | "gapping"
  | "consistency"
  | "coach"
  | "progress"
  | "speed"
  | "mileage"
  | "scoring"
  | "putting"
  | "shortGame"
  | "roundStats"
  | "hidden";

export type AchievementTriggerType =
  | "singleShot"
  | "session"
  | "stockYardage"
  | "rollingWindow"
  | "progress"
  | "speedTraining"
  | "roundScorecard";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  xp: number;
  repeatable: boolean;
  hidden: boolean;
  triggerType: AchievementTriggerType;
  targetValue?: number;
  clubTypes?: string[];
};

export type AchievementUnlockCandidate = {
  achievementId: string;
  sourceSessionId?: string | null;
  sourceShotId?: string | null;
  unlockedAt?: Date;
  metadata?: Record<string, unknown>;
};

export type AchievementUnlockNotification = {
  achievementId: string;
  name: string;
  description: string;
  tier: AchievementTier;
  xpAwarded: number;
  unlockedAt: string;
};

export type AchievementProgressCandidate = {
  achievementId: string;
  progressValue: number;
  targetValue: number;
  metadata?: Record<string, unknown>;
};

export type AchievementShot = {
  id: string;
  userId?: string;
  sessionId: string;
  sessionType?: string | null;
  clubId?: string;
  shotAt: Date;
  clubType: string;
  shotNumber: number | null;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  sideCarryYd: number | null;
  courseHoleNumber?: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
  reviewStatus?: ShotReviewStatus | null;
};

export type AchievementSession = {
  id: string;
  source: string;
  type: string;
  date: Date;
  scorecardJson?: RoundScorecardHole[] | null;
};

export type RoundScorecardHole = {
  holeNumber: number;
  par: number;
  yards: number;
  name?: string | null;
  putts?: number | null;
  penalties?: number | null;
  score?: number | null;
  netScore?: number | null;
  fairwayHit?: boolean | null;
  gir?: boolean | null;
  strokeIndex?: number | null;
  chipShots?: number | null;
  greensideSandShots?: number | null;
};

export type AchievementClub = {
  id: string;
  type: string;
  active: boolean;
};

export type AchievementStockYardage = {
  clubId: string;
  clubType: string;
  calculatedAt: Date;
  sampleSize: number;
  carryMedianYd: number | null;
  carryMeanYd: number | null;
  totalMedianYd: number | null;
  dispersionLeftYd: number | null;
  dispersionRightYd: number | null;
  confidenceScore: number | null;
};

export type AchievementSpeedTrainingSession = {
  id: string;
  source: string;
  sessionDate: Date;
  title: string | null;
  clubId: string | null;
  clubType: string | null;
  implementKind: string;
  implementLabel: string | null;
  speedSystem: string | null;
  handedness: string;
  swingCount: number;
  minSpeedMph: number | null;
  avgSpeedMph: number | null;
  maxSpeedMph: number | null;
  targetSpeedMph: number | null;
};

export type AchievementSpeedTrainingGoal = {
  id: string;
  goalKey: string;
  clubId: string | null;
  clubType: string | null;
  targetSpeedMph: number;
  targetDate: string | null;
  notes: string | null;
};

export type AchievementEvaluationResult = {
  unlocks: AchievementUnlockCandidate[];
  progress: AchievementProgressCandidate[];
};
