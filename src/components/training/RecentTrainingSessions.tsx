import Link from "next/link";
import {
  ArrowRight,
  Flag,
  ListChecks,
  Minus,
  PencilLine,
  RadioTower,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataPanel, EmptyState, SectionHeader, StatusPill } from "@/components/premium";
import {
  groupRecentTrainingSessions,
  type DisplayTrainingSessionListItem,
} from "@/lib/training/recentSessions";
import type { TrainingSessionListItem } from "@/lib/training/trainingData";

type RecentTrainingSessionsProps = {
  sessions: TrainingSessionListItem[];
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

export function RecentTrainingSessions({ sessions }: RecentTrainingSessionsProps) {
  const displaySessions = groupRecentTrainingSessions(sessions);

  return (
    <DataPanel id="recent">
      <SectionHeader
        title="Recent training sessions"
        description="Golf load entries used by Golf Form, Training Fitness and Recent Load. Same-day launch-monitor splits are grouped into one range block."
        action={<StatusPill tone="sky">{displaySessions.length} shown</StatusPill>}
      />
      <CardContent>
        {displaySessions.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" aria-hidden="true" />}
            title="No golf load sessions yet"
            description="Log a round or practice session to start building the workload timeline."
          />
        ) : (
          <div className="grid gap-2 xl:grid-cols-2">
            {displaySessions.map((session, index) => {
              const comparison = sessionComparison(session, displaySessions[index + 1] ?? null);

              return (
                <article
                  key={session.id}
                  className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white/80 p-3"
                >
                  <div className="rounded-md bg-slate-50 px-2 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {formatDate(session.sessionDate)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold leading-none tracking-normal text-foreground">
                      {integerFormatter.format(Math.round(session.sessionLoad))}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      load
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill tone={sessionTone(session)}>
                        <span className="inline-flex items-center gap-1.5">
                          {sessionIcon(session)}
                          {formatSourceType(session.sourceType)}
                        </span>
                      </StatusPill>
                      {session.entryCount > 1 ? (
                        <StatusPill tone="slate">{session.entryCount} imports</StatusPill>
                      ) : null}
                      <p className="text-sm font-semibold text-foreground">
                        {sessionQualityLabel(session)}
                      </p>
                      {comparison ? (
                        <StatusPill tone={comparison.tone}>
                          <span className="inline-flex items-center gap-1.5">
                            {comparison.icon}
                            {comparison.label}
                          </span>
                        </StatusPill>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold tracking-normal text-foreground">
                      {session.title}
                    </p>
                    {comparison ? (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        Compared with previous: {comparison.detail}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Metric label="Volume" value={compactVolume(session)} />
                      <Metric label="RPE" value={session.rpe.toString()} />
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="icon-sm"
                    className="self-center justify-self-end"
                  >
                    <Link href={reviewHref(session)}>
                      <span className="sr-only">Review {session.title}</span>
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="text-xs font-semibold leading-tight text-foreground">{value}</p>
    </div>
  );
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatSourceType(value: string) {
  return value.replace(/_/g, " ");
}

function compactVolume(session: TrainingSessionListItem) {
  if (session.totalSwings) {
    return `${integerFormatter.format(session.totalSwings)} swings`;
  }

  if (session.durationMinutes) {
    return `${integerFormatter.format(session.durationMinutes)} min`;
  }

  if (session.holesPlayed) {
    return `${integerFormatter.format(session.holesPlayed)} holes`;
  }

  return "Manual";
}

function sessionQualityLabel(session: TrainingSessionListItem) {
  if (session.sessionLoad >= 500) {
    return "Heavy";
  }

  if (session.sessionLoad >= 250) {
    return "Productive";
  }

  if (session.sessionLoad > 0) {
    return "Light";
  }

  return "Logged";
}

function sessionTone(session: TrainingSessionListItem) {
  if (session.sourceType === "round") {
    return "green";
  }

  if (session.sourceType === "manual") {
    return "amber";
  }

  return "sky";
}

function sessionIcon(session: TrainingSessionListItem) {
  if (session.title.toLowerCase().includes("speed")) {
    return <Zap className="size-3.5" aria-hidden="true" />;
  }

  if (session.sourceType === "round") {
    return <Flag className="size-3.5" aria-hidden="true" />;
  }

  if (session.sourceType === "manual") {
    return <PencilLine className="size-3.5" aria-hidden="true" />;
  }

  return <RadioTower className="size-3.5" aria-hidden="true" />;
}

function sessionComparison(
  session: DisplayTrainingSessionListItem,
  previous: DisplayTrainingSessionListItem | null,
) {
  if (!previous || previous.sessionLoad <= 0) {
    return null;
  }

  const ratio = session.sessionLoad / previous.sessionLoad;
  const loadDelta = Math.round(session.sessionLoad - previous.sessionLoad);
  const detail =
    Math.abs(loadDelta) < 10
      ? "similar load"
      : `${loadDelta > 0 ? "+" : ""}${integerFormatter.format(loadDelta)} load`;

  if (ratio >= 1.15 && session.sessionLoad < 500) {
    return {
      label: "Better",
      detail,
      tone: "green" as const,
      icon: <TrendingUp className="size-3.5" aria-hidden="true" />,
    };
  }

  if (ratio <= 0.85) {
    return {
      label: "Worse",
      detail,
      tone: "amber" as const,
      icon: <TrendingDown className="size-3.5" aria-hidden="true" />,
    };
  }

  return {
    label: "Similar",
    detail,
    tone: "slate" as const,
    icon: <Minus className="size-3.5" aria-hidden="true" />,
  };
}

function reviewHref(session: DisplayTrainingSessionListItem) {
  if (session.sourceType === "round" && session.sourceId) {
    return `/rounds/${session.sourceId}`;
  }

  if (session.sourceType === "launch_monitor" || session.sourceType === "imported") {
    return "/today";
  }

  return "/stats/training-over-time#log-load";
}
