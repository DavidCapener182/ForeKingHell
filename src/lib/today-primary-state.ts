import type { PracticePlannerContext } from "@/lib/practice-planner";
import { classifyTodayRecommendationIssue } from "@/lib/today-recommendation-issue";
import type { TodayPrimaryState } from "@/lib/today-sync-state";

type CurrentPracticePlan = {
  id: string;
  title: string;
  status: string;
  timeMinutes: number;
  sourceSessionId?: string | null;
} | null;

type ActiveRound = {
  id: string;
  courseName: string | null;
} | null;

type LatestPracticeReview = {
  dateLabel: string;
  sessions: Array<{ id: string }>;
  shots: unknown[];
  overall: { title: string; summary: string };
} | null;

export type TodayRecommendation = ReturnType<typeof buildTodayRecommendation>;

export function buildTodayRecommendation(context: PracticePlannerContext) {
  const opportunity = context.latestPractice.biggestOpportunity;
  const club =
    context.latestPractice.clubs.find((item) => item.clubType === opportunity) ??
    [...context.latestPractice.clubs].sort((left, right) => left.score - right.score)[0] ??
    null;
  const bagClub = context.bag.clubs.find((item) => item.clubType === club?.clubType) ?? null;
  const confidence =
    (club?.shotCount ?? 0) >= 12 ? "High" : (club?.shotCount ?? 0) >= 6 ? "Moderate" : "Low";
  const minutes = context.trainingLoad.highRecentLoad ? 20 : 45;
  const clubLabel = club?.label ?? "Baseline";
  const issue = classifyTodayRecommendationIssue({
    club,
    bagClub,
    priority:
      context.progress.priorities.find((priority) => priority.clubType === club?.clubType) ?? null,
    bagIssues: context.bag.issues,
    scoring: context.scoring,
    speed: context.speed,
  });
  const title = club
    ? `Practise ${clubLabel} ${issue.label.toLowerCase()}`
    : "Build a measured baseline";
  const reason = club
    ? `${clubLabel} is the clearest current opportunity. ${club.shotCount} measured shots show ${formatDirectionEvidence(club)}. Begin with a short calibration block before adding pressure.`
    : "There is not enough measured evidence to isolate a weakness yet. Start with a short baseline session so the next recommendation is evidence-led.";

  return {
    title,
    reason,
    clubLabel,
    clubType: club?.clubType ?? null,
    issue: issue.label,
    confidence,
    minutes,
    evidenceLabel: club ? `${club.shotCount} measured shots` : "Baseline needed",
    bagConfidence: bagClub?.confidenceLabel ?? "Not established",
    explanation: club
      ? `The latest measured weakness, ${bagClub?.confidenceLabel?.toLowerCase() ?? "unsettled"} bag confidence and ${context.trainingLoad.statusLabel.toLowerCase()} training load point to a ${minutes}-minute ${clubLabel} session.`
      : "The app needs a fresh measured sample before it can make a club-specific claim.",
  };
}

export function resolveTodayPrimaryState({
  currentPlan,
  activeRound,
  recommendation,
  latestData,
}: {
  currentPlan: CurrentPracticePlan;
  activeRound: ActiveRound;
  recommendation: TodayRecommendation;
  latestData: LatestPracticeReview;
}): TodayPrimaryState {
  if (currentPlan?.status === "active") {
    return {
      eyebrow: "Active Range Mode",
      title: currentPlan.title,
      reason: "Your practice is still active. Continue at the current block.",
      status: "In progress",
      tone: "positive",
      href: "/practice",
      action: "Continue practice",
    };
  }
  if (currentPlan?.status === "awaiting_import") {
    return {
      eyebrow: "Practice finished",
      title: "Add the measured session",
      reason: "Choose R-Cloud or a CSV to replace activity tracking with measured evidence.",
      status: "Evidence needed",
      tone: "attention",
      href: `/import?practicePlanId=${encodeURIComponent(currentPlan.id)}`,
      action: "Import session",
    };
  }
  if (
    latestData?.sessions[0]?.id &&
    latestData.shots.length > 0 &&
    isReviewReadyDate(currentPlan?.sourceSessionId ? null : latestData.dateLabel)
  ) {
    return {
      eyebrow: "New session ready",
      title: latestData.overall.title,
      reason: latestData.overall.summary,
      status: "Review ready",
      tone: "positive",
      href: `/sessions/${latestData.sessions[0].id}`,
      action: "Review session",
    };
  }
  if (activeRound) {
    return {
      eyebrow: "Round in progress",
      title: activeRound.courseName ?? "Continue your round",
      reason: "Your scorecard is still open and ready at the current hole.",
      status: "In progress",
      tone: "positive",
      href: `/rounds/${activeRound.id}`,
      action: "Continue round",
    };
  }
  if (currentPlan?.status === "planned") {
    return {
      eyebrow: "Saved practice plan",
      title: currentPlan.title,
      reason: `${currentPlan.timeMinutes} minutes planned and ready to start.`,
      status: "Ready",
      tone: "info",
      href: "/practice",
      action: "Start plan",
    };
  }
  return {
    eyebrow: "Today’s recommendation",
    title: recommendation.title,
    reason: recommendation.reason,
    status: recommendation.confidence,
    tone: recommendation.confidence === "Low" ? "attention" : "positive",
    href: `/practice?intent=latest_weakness&club=${encodeURIComponent(recommendation.clubType ?? "")}&time=${recommendation.minutes}&source=today`,
    action: "Plan range session",
  };
}

export function todayConfidencePercent(confidence: string) {
  if (/high|ready|progress/i.test(confidence)) return 88;
  if (/moderate|info/i.test(confidence)) return 64;
  return 38;
}

function isReviewReadyDate(dateLabel: string | null) {
  if (dateLabel === null) return true;
  const date = new Date(dateLabel);
  if (Number.isNaN(date.getTime())) return false;
  const age = Date.now() - date.getTime();
  return age >= 0 && age <= 36 * 60 * 60 * 1_000;
}

function formatDirectionEvidence(club: PracticePlannerContext["latestPractice"]["clubs"][number]) {
  if (club.straightRate !== null) {
    return `${Math.round(club.straightRate)}% finished in the straight window`;
  }
  if (club.offlineAverageYd !== null) {
    return `${Math.round(club.offlineAverageYd)} yd average offline dispersion`;
  }
  return "an incomplete control sample";
}
