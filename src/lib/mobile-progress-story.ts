import type { ProgressClub } from "@/lib/progress-summary";
import type { TrainingSessionMarker } from "@/lib/training/trainingData";
import { roundHistoryScore, type HistoryHole } from "@/lib/round-history-evidence";

/** Direction describes measured changes between distinct sessions, never trust alone. */
export function mobilePerformanceStory(clubs: ProgressClub[]) {
  const comparisons = clubs.flatMap((club) => {
    const {
      previousSession: previous,
      latestSession: latest,
      lastSessionDelta: change,
    } = club.analytics.progress;
    if (
      !previous ||
      !latest ||
      !change ||
      previous.shotCount < 3 ||
      latest.shotCount < 3 ||
      (change.offlineDeltaYd === null && change.carryDeltaYd === null)
    )
      return [];
    return [
      {
        clubId: club.clubId,
        clubType: club.clubType,
        brandModel: club.brandModel,
        previous,
        latest,
        change,
      },
    ];
  });
  const tighter = comparisons
    .filter((c) => c.change.offlineDeltaYd !== null && c.change.offlineDeltaYd <= -0.5)
    .sort((a, b) => a.change.offlineDeltaYd! - b.change.offlineDeltaYd!);
  const wider = comparisons
    .filter((c) => c.change.offlineDeltaYd !== null && c.change.offlineDeltaYd >= 0.5)
    .sort((a, b) => b.change.offlineDeltaYd! - a.change.offlineDeltaYd!);
  const distance = comparisons
    .filter((c) => c.change.carryDeltaYd !== null && Math.abs(c.change.carryDeltaYd) >= 1)
    .sort((a, b) => Math.abs(b.change.carryDeltaYd!) - Math.abs(a.change.carryDeltaYd!));
  const signal = tighter[0] ?? wider[0] ?? distance[0] ?? comparisons[0] ?? null;
  const hasDirection = tighter.length + wider.length > 0;
  const label = !comparisons.length
    ? "Building your baseline"
    : tighter.length && wider.length
      ? "Control is mixed"
      : tighter.length
        ? "Control is improving"
        : wider.length
          ? "Control needs attention"
          : distance.length
            ? "Distances are changing"
            : "Holding steady";
  return {
    label,
    tone: (tighter.length && !wider.length
      ? "positive"
      : wider.length
        ? "attention"
        : "neutral") as "positive" | "attention" | "neutral",
    comparisons,
    signal,
    improvement: tighter[0] ?? null,
    blocker: wider[0] ?? null,
    metric: hasDirection ? ("side" as const) : ("carry" as const),
    confidence: !signal
      ? "Not established"
      : Math.min(signal.previous.shotCount, signal.latest.shotCount) >= 10
        ? "Moderate"
        : "Early signal",
  };
}

export type MobilePerformanceComparison = ReturnType<
  typeof mobilePerformanceStory
>["comparisons"][number];
export type MobilePerformanceMeasure = "carry" | "side";

/** Preserve the analytics' session delta; absent measurements never become zero-length bars. */
export function mobileComparisonMeasure(
  comparison: MobilePerformanceComparison,
  measure: MobilePerformanceMeasure,
) {
  const previous =
    measure === "carry"
      ? comparison.previous.carryMedianYd
      : comparison.previous.absoluteOfflineAverageYd;
  const latest =
    measure === "carry"
      ? comparison.latest.carryMedianYd
      : comparison.latest.absoluteOfflineAverageYd;
  const delta =
    measure === "carry" ? comparison.change.carryDeltaYd : comparison.change.offlineDeltaYd;
  if (
    previous == null ||
    latest == null ||
    delta == null ||
    !Number.isFinite(previous) ||
    !Number.isFinite(latest) ||
    !Number.isFinite(delta) ||
    previous < 0 ||
    latest < 0
  )
    return null;
  return { previous, latest, delta, maximum: Math.max(1, previous, latest) };
}

export function mobileTrainingConsistency(markers: TrainingSessionMarker[], today: string) {
  const end = new Date(`${today}T00:00:00Z`).getTime();
  const start = end - 27 * 86_400_000;
  const valid = markers.filter(
    (m) => Number.isFinite(Date.parse(m.date)) && Date.parse(m.date) <= end,
  );
  const recent = valid.filter((m) => Date.parse(m.date) >= start);
  const last = [...valid].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
  return {
    days: new Set(recent.map((m) => m.date.slice(0, 10))).size,
    sessions: recent.reduce((sum, m) => sum + m.sessionCount, 0),
    last,
    daysSince: last ? Math.floor((end - Date.parse(last)) / 86_400_000) : null,
  };
}

type ScoringRound = {
  id: string;
  type: string;
  roundStatus: string;
  scorecardJson: (HistoryHole & { putts?: number | null })[];
};
export function mobileScoringStory<T extends ScoringRound>(rounds: T[]) {
  const completed = rounds.filter(
    (r) =>
      [9, 18].includes(r.scorecardJson.length) &&
      roundHistoryScore(r.scorecardJson, r.roundStatus).complete,
  );
  const latest = completed[0] ?? null;
  const context = latest?.type === "real_round" ? "Course" : "Simulator";
  const comparable = latest
    ? completed
        .filter(
          (r) =>
            (r.type === "real_round") === (latest.type === "real_round") &&
            r.scorecardJson.length === latest.scorecardJson.length,
        )
        .slice(0, 5)
    : [];
  if (!latest) return { latest, comparable, context, leak: null };
  const penalties = latest.scorecardJson.reduce((sum, h) => sum + Math.max(0, h.penalties ?? 0), 0);
  const threePutts = latest.scorecardJson.filter((h) => (h.putts ?? 0) >= 3).length;
  const costly = latest.scorecardJson.filter((h) => (h.score ?? h.par) - h.par >= 2);
  const leak =
    penalties > 0
      ? {
          title: `${penalties} penalty ${penalties === 1 ? "stroke" : "strokes"}`,
          detail: "Recorded in your latest completed round.",
          action: "Practise a safer tee shot",
          href: "/practice",
        }
      : threePutts > 0
        ? {
            title: `${threePutts} three-putt ${threePutts === 1 ? "hole" : "holes"}`,
            detail: "Putting is a clear place to review.",
            action: "Plan putting practice",
            href: "/practice",
          }
        : costly.length
          ? {
              title: `${costly.length} double bogey or worse`,
              detail: "Review these holes before assigning a cause.",
              action: "Review the costly holes",
              href: `/rounds/${latest.id}`,
            }
          : null;
  return { latest, comparable, context, leak };
}
