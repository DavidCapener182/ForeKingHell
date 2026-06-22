import { ListChecks } from "lucide-react";

import { CardContent } from "@/components/ui/card";
import { DataPanel, EmptyState, SectionHeader, StatusPill } from "@/components/premium";
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
  return (
    <DataPanel id="recent">
      <SectionHeader
        title="Recent training sessions"
        description="Golf load entries used by the conditioning, acute-load and Golf Form model."
        action={<StatusPill tone="sky">{sessions.length} shown</StatusPill>}
      />
      <CardContent>
        {sessions.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" aria-hidden="true" />}
            title="No golf load sessions yet"
            description="Log a round or practice session to start building the workload timeline."
          />
        ) : (
          <div className="grid gap-2">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 sm:grid-cols-[120px_minmax(0,1fr)_120px_90px_110px] sm:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDate(session.sessionDate)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {formatSourceType(session.sourceType)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{session.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {volumeLabel(session)}
                  </p>
                </div>
                <Metric label="Volume" value={compactVolume(session)} />
                <Metric label="RPE" value={session.rpe.toString()} />
                <Metric
                  label="Load"
                  value={integerFormatter.format(Math.round(session.sessionLoad))}
                  strong
                />
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 sm:bg-transparent sm:p-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className={strong ? "text-lg font-semibold text-foreground" : "text-sm font-medium"}>
        {value}
      </p>
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

function volumeLabel(session: TrainingSessionListItem) {
  const parts = [
    session.durationMinutes ? `${integerFormatter.format(session.durationMinutes)} min` : null,
    session.holesPlayed ? `${integerFormatter.format(session.holesPlayed)} holes` : null,
    session.totalSwings ? `${integerFormatter.format(session.totalSwings)} swings` : null,
    session.walked ? "walked" : session.usedCart ? "cart" : null,
    session.competition ? "competition" : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return "Manual workload entry";
  }

  return parts.join(" · ");
}
