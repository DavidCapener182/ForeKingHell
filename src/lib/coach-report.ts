import type { CoachClubCard, CoachSummary } from "@/lib/coach";
import type { SeasonGoal, SeasonPlan } from "@/lib/product-preferences";

export const coachReportSectionIds = [
  "profile_summary",
  "goals",
  "bag_numbers",
  "recent_sessions",
  "key_trends",
  "bag_gaps",
  "practice_adherence",
  "course_performance",
  "personal_bests",
  "saved_comparisons",
  "notes",
  "raw_evidence",
] as const;

export type CoachReportSectionId = (typeof coachReportSectionIds)[number];

export type CoachReportRecentSession = {
  id: string;
  date: string;
  label: string;
  source: string;
  shotCount: number;
};

export type CoachReportPracticeAdherence = {
  lookbackDays: number;
  targetSessions: number;
  plannedSessions: number;
  completedSessions: number;
  completionRate: number | null;
  measuredSessions: number;
};

export type CoachReportNote = {
  date: string;
  source: "session" | "practice";
  text: string;
};

export type CoachReportRawShot = {
  sessionId: string;
  sessionDate: string;
  club: string;
  shotNumber: number | null;
  carryYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  launchAngleDeg: number | null;
  quality: string | null;
};

export type CoachReportSavedComparison = {
  id: string;
  name: string;
  capturedAt: string;
  notes: string | null;
  focusLabel: string;
  baselineLabel: string;
  focusShots: number;
  baselineShots: number;
  verdict: string;
  summary: string;
  delta: Record<string, number | null>;
};

export type CoachReportProfileSummary = {
  displayName: string;
  homeCourse: string | null;
  handicapBand: string | null;
  primaryLaunchMonitor: string | null;
};

export type CoachReportBagNumber = {
  club: string;
  stockCarryYd: number | null;
  playableRate: number | null;
  sampleSize: number;
  confidence: string;
};

export type CoachReportCoursePerformance = {
  date: string;
  course: string;
  grossScore: number | null;
  holesRecorded: number;
};

export type CoachReportPersonalBest = {
  club: string;
  carryYd: number;
  evidenceShots: number;
};

export type CoachReportSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  title: string;
  sections: {
    profileSummary?: CoachReportProfileSummary;
    goals?: SeasonPlan;
    seasonGoals?: SeasonGoal[];
    bagNumbers?: CoachReportBagNumber[];
    recentSessions?: CoachReportRecentSession[];
    keyTrends?: Array<{ label: string; value: string; detail: string; confidence: string }>;
    bagGaps?: Array<{
      longerClub: string;
      shorterClub: string;
      gapYd: number;
      confidence: string;
      sampleSize: number;
    }>;
    practiceAdherence?: CoachReportPracticeAdherence;
    coursePerformance?: CoachReportCoursePerformance[];
    personalBests?: CoachReportPersonalBest[];
    savedComparisons?: CoachReportSavedComparison[];
    notes?: CoachReportNote[];
    rawEvidence?: CoachReportRawShot[];
  };
  disclosure: {
    selectedSections: CoachReportSectionId[];
    omittedSections: CoachReportSectionId[];
    statement: string;
  };
};

export type BuildCoachReportInput = {
  generatedAt: Date;
  selectedSections: Iterable<CoachReportSectionId>;
  seasonPlan: SeasonPlan;
  seasonGoals?: SeasonGoal[];
  profileSummary?: CoachReportProfileSummary;
  bagNumbers?: CoachReportBagNumber[];
  coach: CoachSummary;
  recentSessions: CoachReportRecentSession[];
  practiceAdherence: CoachReportPracticeAdherence;
  coursePerformance?: CoachReportCoursePerformance[];
  personalBests?: CoachReportPersonalBest[];
  savedComparisons: CoachReportSavedComparison[];
  notes: CoachReportNote[];
  rawEvidence: CoachReportRawShot[];
};

export function parseCoachReportSections(values: Iterable<FormDataEntryValue | string>) {
  const allowed = new Set<string>(coachReportSectionIds);
  return [
    ...new Set([...values].map(String).filter((value) => allowed.has(value))),
  ] as CoachReportSectionId[];
}

export function buildCoachReportSnapshot(input: BuildCoachReportInput): CoachReportSnapshot {
  const selected = parseCoachReportSections(input.selectedSections);
  const selectedSet = new Set(selected);
  const sections: CoachReportSnapshot["sections"] = {};

  if (selectedSet.has("profile_summary") && input.profileSummary)
    sections.profileSummary = input.profileSummary;
  if (selectedSet.has("goals")) {
    sections.goals = input.seasonPlan;
    sections.seasonGoals = (input.seasonGoals ?? []).slice(0, 12);
  }
  if (selectedSet.has("bag_numbers")) sections.bagNumbers = (input.bagNumbers ?? []).slice(0, 18);
  if (selectedSet.has("recent_sessions"))
    sections.recentSessions = input.recentSessions.slice(0, 8);
  if (selectedSet.has("key_trends")) sections.keyTrends = buildTrends(input.coach);
  if (selectedSet.has("bag_gaps")) sections.bagGaps = buildBagGaps(input.coach.clubCards);
  if (selectedSet.has("practice_adherence")) sections.practiceAdherence = input.practiceAdherence;
  if (selectedSet.has("course_performance"))
    sections.coursePerformance = (input.coursePerformance ?? []).slice(0, 8);
  if (selectedSet.has("personal_bests"))
    sections.personalBests = (input.personalBests ?? []).slice(0, 12);
  if (selectedSet.has("saved_comparisons"))
    sections.savedComparisons = input.savedComparisons.slice(0, 12);
  if (selectedSet.has("notes")) sections.notes = input.notes.slice(0, 12);
  if (selectedSet.has("raw_evidence")) sections.rawEvidence = input.rawEvidence.slice(0, 20);

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt.toISOString(),
    title: `Coach report · ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(input.generatedAt)}`,
    sections,
    disclosure: {
      selectedSections: selected,
      omittedSections: coachReportSectionIds.filter((section) => !selectedSet.has(section)),
      statement:
        "This frozen report contains only the sections selected by the golfer when the link was created.",
    },
  };
}

export function isCoachReportSnapshot(value: unknown): value is CoachReportSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<CoachReportSnapshot>;
  return (
    snapshot.schemaVersion === 1 &&
    typeof snapshot.generatedAt === "string" &&
    typeof snapshot.title === "string" &&
    Boolean(snapshot.sections) &&
    typeof snapshot.sections === "object" &&
    Boolean(snapshot.disclosure) &&
    Array.isArray(snapshot.disclosure?.selectedSections)
  );
}

function buildTrends(coach: CoachSummary) {
  return coach.signals.slice(0, 5).map((signal) => ({
    label: signal.label,
    value: signal.value,
    detail: signal.detail,
    confidence: confidenceForSignal(signal.detail, coach.clubCards, signal.clubId),
  }));
}

function confidenceForSignal(detail: string, cards: CoachClubCard[], clubId?: string) {
  const card = cards.find((item) => item.clubId === clubId);
  if (!card)
    return detail.toLowerCase().includes("baseline") ? "Building evidence" : "Context only";
  if (card.sampleSize >= 20 && card.trustIndex >= 70) return "High confidence";
  if (card.sampleSize >= 8) return "Moderate confidence";
  return "Low confidence";
}

function buildBagGaps(cards: CoachClubCard[]) {
  const stocked = cards
    .filter((card) => typeof card.stockCarryYd === "number")
    .sort((left, right) => (right.stockCarryYd ?? 0) - (left.stockCarryYd ?? 0));

  return stocked.slice(0, -1).map((longer, index) => {
    const shorter = stocked[index + 1]!;
    const sampleSize = Math.min(longer.sampleSize, shorter.sampleSize);
    return {
      longerClub: longer.clubName,
      shorterClub: shorter.clubName,
      gapYd: Math.round((longer.stockCarryYd ?? 0) - (shorter.stockCarryYd ?? 0)),
      confidence:
        sampleSize >= 20
          ? "High confidence"
          : sampleSize >= 8
            ? "Moderate confidence"
            : "Low confidence",
      sampleSize,
    };
  });
}
