import { formatCompanionClubType } from "@/lib/club-format";
import { companionReviewRoute } from "@/lib/session-review-route";
import type { TodayPracticeData } from "@/lib/today-session-data";
import type { TodayPrimaryState } from "@/lib/today-sync-state";
import { todayReviewTakeaway } from "@/lib/mobile-today-briefing";

export function practiceDateKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A completed upload is reviewable even when its shots cannot support a comparison. */
export function buildMobileTodayReview(
  data: TodayPracticeData | null,
  now: Date,
  selectedDateKey?: string,
  reviewContext: "today" | "selected" | "latest" = "today",
) {
  if (!data || data.dateKey !== (selectedDateKey ?? practiceDateKey(now)) || !data.rawShots.length)
    return null;
  const isToday = data.dateKey === practiceDateKey(now);

  const includedIds = new Set(data.rawShots.map((shot) => shot.sessionId));
  const sessions = data.sessions
    .filter((session) => includedIds.has(session.id))
    .map((session) => ({
      ...session,
      href: companionReviewRoute(session),
      clubs: data.clubs
        .filter((club) =>
          data.rawShots.some(
            (shot) => shot.sessionId === session.id && shot.clubType === club.type,
          ),
        )
        .map((club) => formatCompanionClubType(club.type))
        .join(" · "),
    }));
  if (!sessions.length) return null;
  const shotCount = data.rawShots.length;
  const summary = `${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${shotCount} shots · ${data.clubs.length} club${data.clubs.length === 1 ? "" : "s"}`;
  const reason = data.comparisonShots.length
    ? data.overall.verdict === "new"
      ? "Your shots are saved. This is a new baseline; there is not enough comparable evidence to judge improvement yet."
      : data.overall.title
    : "Your shots are saved. Review the uploads below; there are no comparable trusted full shots to judge improvement yet.";
  const state: TodayPrimaryState = {
    eyebrow: isToday
      ? "Practice complete · Today"
      : `${reviewContext === "latest" ? "Latest practice" : "Practice review"} · ${data.dateLabel}`,
    title: isToday
      ? "Your practice today"
      : reviewContext === "latest"
        ? "Your latest practice"
        : "Your selected practice",
    reason: todayReviewTakeaway(data)?.title ?? reason,
    status: "Review ready",
    tone: "positive",
    href: "#today-practice-review",
    action: isToday ? "Review today’s practice" : "Review this practice",
  };
  return {
    state,
    summary,
    dateLabel: data.dateLabel,
    shotCount,
    trustedCount: data.shots.length,
    comparisonCount: data.comparisonShots.length,
    excludedCount: data.dataCleaning.excludedShotCount,
    sessions,
    clubs: data.clubs.map((club) => ({
      ...club,
      label: formatCompanionClubType(club.type),
      comparison:
        data.clubComparisons.find((comparison) => comparison.clubType === club.type) ?? null,
    })),
  };
}

export type MobileTodayReview = NonNullable<ReturnType<typeof buildMobileTodayReview>>;
