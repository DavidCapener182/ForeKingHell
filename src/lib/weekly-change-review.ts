import { formatClubType } from "@/lib/club-format";
import type { PracticePriority, ProgressClubRow } from "@/lib/progress-summary";

export type WeeklyChangeReview = {
  largestImprovement: ChangeSignal;
  largestDecline: ChangeSignal;
  completedVolume: { value: string; detail: string; tone: "green" | "sky" | "slate" };
  dataQuality: { value: string; detail: string; tone: "green" | "amber" | "slate" };
  personalBests: { value: string; detail: string; tone: "green" | "sky" | "slate" };
  dataFreshness: { value: string; detail: string; tone: "green" | "amber" | "slate" };
  practiceCompleted: { value: string; detail: string; tone: "green" | "sky" | "slate" };
  bagNumberChange: { value: string; detail: string; tone: "green" | "amber" | "slate" };
  nextAction: { value: string; detail: string; href: string; tone: "sky" | "amber" | "slate" };
};

type ChangeSignal = {
  value: string;
  detail: string;
  href?: string;
  tone: "green" | "amber" | "slate";
};

export function buildWeeklyChangeReview(input: {
  clubRows: ProgressClubRow[];
  latestSessionAt: Date | null;
  completedPracticeCount: number;
  completedSessionCount?: number;
  completedRoundCount?: number;
  dataQualityIssueCount?: number;
  personalBestCount?: number;
  topPriority?: PracticePriority;
  now?: Date;
}): WeeklyChangeReview {
  const now = input.now ?? new Date();
  const comparable = input.clubRows
    .filter((row) => row.sampleSize >= 6)
    .map((row) => ({ row, score: changeScore(row) }));
  const improvement = [...comparable].sort((left, right) => right.score - left.score)[0];
  const decline = [...comparable].sort((left, right) => left.score - right.score)[0];
  const carryDeltas = comparable
    .map(({ row }) => row.carryDeltaYd)
    .filter((value): value is number => value !== null);
  const bagCarryDelta = average(carryDeltas);
  const freshness = freshnessRead(input.latestSessionAt, now);
  const largestDecline = decline && decline.score < -0.5 ? changeSignal(decline.row, false) : null;
  const completedSessionCount = input.completedSessionCount ?? 0;
  const completedRoundCount = input.completedRoundCount ?? 0;
  const dataQualityIssueCount = input.dataQualityIssueCount ?? 0;
  const personalBestCount = input.personalBestCount ?? 0;

  return {
    largestImprovement:
      improvement && improvement.score > 0.5
        ? changeSignal(improvement.row, true)
        : {
            value: "No clear mover",
            detail: "No club has a positive change large enough to call with the available sample.",
            tone: "slate",
          },
    largestDecline: largestDecline ?? {
      value: "No clear decline",
      detail: "No sampled club has crossed the deterministic decline threshold.",
      tone: "slate",
    },
    completedVolume: {
      value: `${completedSessionCount} session${completedSessionCount === 1 ? "" : "s"}`,
      detail: `${completedRoundCount} completed round${completedRoundCount === 1 ? "" : "s"} in the same seven-day review window.`,
      tone: completedSessionCount > 0 ? "green" : "slate",
    },
    dataQuality: {
      value: dataQualityIssueCount === 0 ? "No open blockers" : `${dataQualityIssueCount} open`,
      detail:
        dataQualityIssueCount === 0
          ? "No unmapped, suspicious, stale or failed-sync evidence is blocking this review."
          : "Current unmapped, suspicious, stale or failed-sync evidence still needs review.",
      tone: dataQualityIssueCount === 0 ? "green" : "amber",
    },
    personalBests: {
      value: `${personalBestCount} new`,
      detail:
        personalBestCount > 0
          ? "New measured carry bests set during the seven-day review window."
          : "No new measured carry best crossed the previous personal baseline this week.",
      tone: personalBestCount > 0 ? "sky" : "slate",
    },
    dataFreshness: freshness,
    practiceCompleted: {
      value: `${input.completedPracticeCount} completed`,
      detail:
        input.completedPracticeCount > 0
          ? "Measured practice plans completed in the last seven days."
          : "No measured practice plan was completed in the last seven days.",
      tone: input.completedPracticeCount > 0 ? "green" : "slate",
    },
    bagNumberChange:
      bagCarryDelta === null
        ? {
            value: "Needs baselines",
            detail: "Comparable first and latest stock-carry samples are not available yet.",
            tone: "slate",
          }
        : {
            value: Math.abs(bagCarryDelta) < 1 ? "Within 1 yd" : `${signed(bagCarryDelta)} yd`,
            detail: "Bag-average stock carry, latest clean baseline versus first clean baseline.",
            tone: bagCarryDelta >= -1 ? "green" : "amber",
          },
    nextAction: largestDecline
      ? {
          value: `Review ${largestDecline.value}`,
          detail: "Start with the largest evidence-backed decline before changing the wider plan.",
          href: largestDecline.href ?? "/progress#bag-movement",
          tone: "amber",
        }
      : freshness.tone === "amber" || freshness.tone === "slate"
        ? {
            value: "Refresh the evidence",
            detail: "Import one comparable measured session before making a new performance call.",
            href: "/import",
            tone: "amber",
          }
        : input.topPriority
          ? {
              value: input.topPriority.title,
              detail: input.topPriority.reason,
              href: `/bag/${input.topPriority.clubId}/analytics`,
              tone: "sky",
            }
          : {
              value: "Build the next baseline",
              detail: "A clean comparable session will unlock the next deterministic action.",
              href: "/import",
              tone: "slate",
            },
  };
}

function changeScore(row: ProgressClubRow) {
  return (
    (row.carryDeltaYd ?? 0) * 0.3 + (row.ballSpeedDeltaMph ?? 0) * 0.6 - (row.offlineDeltaYd ?? 0)
  );
}

function changeSignal(row: ProgressClubRow, positive: boolean): ChangeSignal {
  const parts: string[] = [];
  if (row.offlineDeltaYd !== null && Math.abs(row.offlineDeltaYd) >= 1) {
    parts.push(
      `${Math.abs(row.offlineDeltaYd).toFixed(1)} yd ${row.offlineDeltaYd < 0 ? "tighter" : "wider"}`,
    );
  }
  if (row.carryDeltaYd !== null && Math.abs(row.carryDeltaYd) >= 0.5) {
    parts.push(`${signed(row.carryDeltaYd)} yd carry`);
  }
  if (row.ballSpeedDeltaMph !== null && Math.abs(row.ballSpeedDeltaMph) >= 0.5) {
    parts.push(`${signed(row.ballSpeedDeltaMph)} mph ball speed`);
  }

  return {
    value: formatClubType(row.clubType),
    detail: `${parts.join(" · ") || "Composite baseline movement"} · ${row.sampleSize} clean shots.`,
    href: `/bag/${row.clubId}/analytics`,
    tone: positive ? "green" : "amber",
  };
}

function freshnessRead(latestSessionAt: Date | null, now: Date) {
  if (!latestSessionAt) {
    return {
      value: "No session yet",
      detail: "Import a measured session to establish freshness.",
      tone: "slate" as const,
    };
  }

  const days = Math.max(
    0,
    Math.floor(
      (startOfUtcDay(now).getTime() - startOfUtcDay(latestSessionAt).getTime()) / 86_400_000,
    ),
  );
  return {
    value: days === 0 ? "Updated today" : `${days} day${days === 1 ? "" : "s"} old`,
    detail: `Latest measured session: ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(latestSessionAt)}.`,
    tone: days <= 7 ? ("green" as const) : days <= 21 ? ("amber" as const) : ("slate" as const),
  };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function signed(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
