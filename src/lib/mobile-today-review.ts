import { formatCompanionClubType } from "@/lib/club-format";
import { companionReviewRoute } from "@/lib/session-review-route";
import type { TodayPracticeData } from "@/lib/today-session-data";
import type { TodayPrimaryState } from "@/lib/today-sync-state";

export function practiceDateKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A completed upload is reviewable even when its shots cannot support a comparison. */
export function buildMobileTodayReview(data: TodayPracticeData | null, now: Date) {
  if (!data || data.dateKey !== practiceDateKey(now) || !data.rawShots.length) return null;

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
    eyebrow: "Practice complete · Today",
    title: "Your practice today",
    reason,
    status: "Review ready",
    tone: "positive",
    href: "#today-practice-review",
    action: "Review today’s practice",
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
