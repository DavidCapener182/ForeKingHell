import { formatCompanionClubType } from "@/lib/club-format";
import { companionReviewRoute } from "@/lib/session-review-route";
import type { TodayPracticeData, TodayPracticeShot } from "@/lib/today-session-data";

export type TodayPlanActivity = { id: string; title: string; status: string };

/** Completion and measured review are separate steps; never resume finished activity. */
export function todayPlanAction(
  plan: TodayPlanActivity | null,
  localActivity: "unfinished" | "finished" | null = null,
) {
  if (!plan) return null;
  const planHref = `/practice?planId=${encodeURIComponent(plan.id)}`;
  if (
    (plan.status === "active" && localActivity !== "finished") ||
    (plan.status === "awaiting_import" && localActivity === "unfinished")
  )
    return {
      kind: "active" as const,
      label: "Resume Range Mode",
      detail: plan.title,
      href: planHref,
    };
  if (["match_found", "analysed"].includes(plan.status))
    return {
      kind: "next" as const,
      label: "Review your practice",
      detail: plan.title,
      href: planHref,
    };
  if (
    ["awaiting_import", "completed"].includes(plan.status) ||
    (plan.status === "active" && localActivity === "finished")
  )
    return {
      kind: "next" as const,
      label: "Add measured shots",
      detail: `${plan.title} · activity saved`,
      href: `/import?practicePlanId=${encodeURIComponent(plan.id)}`,
    };
  if (plan.status === "planned")
    return {
      kind: "next" as const,
      label: "Your saved practice",
      detail: plan.title,
      href: planHref,
    };
  return null;
}

/** Reuse the day comparison and its exact trusted evidence, not an arbitrary upload. */
export function buildMobileTodayChange(
  data: Pick<
    TodayPracticeData,
    "clubComparisons" | "comparisonShots" | "previousComparisonShots" | "dateLabel"
  > | null,
) {
  const comparison = data?.clubComparisons
    .filter(
      (c) =>
        c.today.shotCount >= 6 &&
        c.previous.shotCount >= 6 &&
        c.verdict !== "new" &&
        c.carryDeltaYd !== null &&
        Math.abs(c.carryDeltaYd) >= 1,
    )
    .sort((a, b) => Math.abs(b.carryDeltaYd ?? 0) - Math.abs(a.carryDeltaYd ?? 0))[0];
  if (
    !data ||
    !comparison ||
    comparison.today.carryAverageYd === null ||
    comparison.previous.carryAverageYd === null
  )
    return null;
  const latest = data.comparisonShots.filter(
    (s) => s.clubType === comparison.clubType && s.carryYd !== null,
  );
  const previous = (data.previousComparisonShots ?? []).filter(
    (s) => s.clubType === comparison.clubType && s.carryYd !== null,
  );
  if (!latest.length || !previous.length) return null;
  return {
    clubLabel: formatCompanionClubType(comparison.clubType),
    delta: Math.round(comparison.carryDeltaYd!),
    latest: {
      value: comparison.today.carryAverageYd,
      count: latest.length,
      dateLabel: data.dateLabel,
      sessions: evidenceSessions(latest),
    },
    previous: {
      value: comparison.previous.carryAverageYd,
      count: previous.length,
      sessions: evidenceSessions(previous),
    },
  };
}
function evidenceSessions(shots: TodayPracticeShot[]) {
  const grouped = new Map<
    string,
    { id: string; label: string; href: string; count: number; date: string }
  >();
  for (const shot of shots) {
    const existing = grouped.get(shot.sessionId);
    if (existing) existing.count++;
    else
      grouped.set(shot.sessionId, {
        id: shot.sessionId,
        label: shot.courseName || "Measured practice",
        href: companionReviewRoute({ id: shot.sessionId, type: shot.sessionType }),
        count: 1,
        date: new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Europe/London",
        }).format(shot.sessionDate),
      });
  }
  return [...grouped.values()];
}
export type MobileTodayChange = NonNullable<ReturnType<typeof buildMobileTodayChange>>;
