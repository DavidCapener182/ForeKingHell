"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Flame,
  LineChart,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { DataTableFrame, SectionHeader, StatusPill, type Tone } from "@/components/premium";
import { RecentTrainingSessions } from "@/components/training/RecentTrainingSessions";
import { TrainingSessionForm } from "@/components/training/TrainingSessionForm";
import { TrainingSourceSuggestions } from "@/components/training/TrainingSourceSuggestions";
import { TrainingStatusCard } from "@/components/training/TrainingStatusCard";
import { TrainingSummaryCards } from "@/components/training/TrainingSummaryCards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import { TRAINING_RANGE_OPTIONS, type TrainingRangeKey } from "@/lib/training/ranges";
import type {
  TrainingEfficiencyCard,
  TrainingOverTimeData,
  TrainingSessionListItem,
} from "@/lib/training/trainingData";
import { cn } from "@/lib/utils";

const TrainingOverTimeChart = dynamic(
  () =>
    import("@/components/training/TrainingOverTimeChart").then(
      (module) => module.TrainingOverTimeChart,
    ),
  { ssr: false, loading: () => <DeferredChartLoading label="Training status chart" /> },
);
const TrainingLoadBars = dynamic(
  () => import("@/components/training/TrainingLoadBars").then((module) => module.TrainingLoadBars),
  { ssr: false, loading: () => <DeferredChartLoading label="Daily training load chart" /> },
);

type TrainingLoadRangeViewProps = {
  data: TrainingOverTimeData;
  initialRangeKey: TrainingRangeKey;
};

const integerFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
});
const ledgerDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const trainingSessionColumns: DesktopWorkbenchColumn[] = [
  { id: "date", label: "Date", locked: true },
  { id: "session", label: "Session", locked: true },
  { id: "source", label: "Source" },
  { id: "load", label: "Load" },
  { id: "rpe", label: "RPE" },
  { id: "volume", label: "Volume" },
  { id: "conditions", label: "Conditions" },
  { id: "notes", label: "Notes" },
];

const trainingSessionSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Heavy golf load",
    href: "/stats/training-over-time?range=90d#training-load-sessions",
    detail: "High-load rounds, range work and speed sessions",
  },
  {
    title: "Recent practice rhythm",
    href: "/stats/training-over-time?range=30d#training-load-sessions",
    detail: "Last month of logged golf workload",
  },
  {
    title: "Season build",
    href: "/stats/training-over-time?range=1y#training-load-sessions",
    detail: "Long-range fitness, fatigue and form evidence",
  },
];

function DeferredChartLoading({ label }: { label: string }) {
  return (
    <div
      className="chart-frame grid min-h-64 content-center gap-3 bg-muted/25 p-4"
      role="status"
      aria-label={`${label} loading`}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Loading {label.toLowerCase()}…</span>
    </div>
  );
}

export function TrainingLoadRangeView({ data, initialRangeKey }: TrainingLoadRangeViewProps) {
  const [activeRangeKey, setActiveRangeKey] = useState(initialRangeKey);
  const [logOpen, setLogOpen] = useState(false);
  const displayData = useMemo(
    () => selectTrainingRangeData(data, activeRangeKey),
    [activeRangeKey, data],
  );
  function handleRangeChange(rangeKey: TrainingRangeKey) {
    setActiveRangeKey(rangeKey);
    replaceBrowserRange(rangeKey);
  }

  return (
    <>
      <RangeControls activeKey={activeRangeKey} onRangeChange={handleRangeChange} />

      {!displayData.hasTrainingData ? (
        <TrainingEmptyState conditioningDays={displayData.conditioningDays} />
      ) : null}

      <div id="summary">
        <TrainingSummaryCards
          summary={displayData.summary}
          status={displayData.status}
          sessionFormSignal={displayData.sessionFormSignal}
        />
      </div>

      <Card id="chart" className="shadow-sm" data-training-status-chart-card>
        <SectionHeader
          title="Training Status"
          description="Golf Form is the trend signal. Session Quality shows how good each scored session was."
          action={
            <StatusPill tone={displayData.status.tone}>{displayData.status.label}</StatusPill>
          }
        />
        <CardContent>
          <TrainingOverTimeChart
            data={displayData.series}
            sessionMarkers={displayData.sessionMarkers}
          />
        </CardContent>
      </Card>

      <RecoveryWorkbench data={displayData} />

      <TrainingRhythmWorkbench data={displayData} streakData={data} />

      <Card id="load" className="shadow-sm" data-training-daily-load-chart>
        <SectionHeader
          title="Daily swing load"
          description="Each bar is the total session load logged for that day. Normal, heavy and very heavy bands keep workload changes easy to scan."
          action={<BarChart3 className="size-5 text-primary" aria-hidden="true" />}
        />
        <CardContent className="grid gap-3">
          <LoadLegend />
          <TrainingLoadBars data={displayData.series} />
        </CardContent>
      </Card>

      <TrainingSessionLedger sessions={displayData.sessions} rangeKey={activeRangeKey} />

      <TrainingStatusCard
        latest={displayData.latest}
        status={displayData.status}
        trend={displayData.trend}
        confidence={displayData.confidence}
        sessionFormSignal={displayData.sessionFormSignal}
      />

      <EfficiencyCards cards={displayData.efficiencyCards} />

      <TrainingSourceSuggestions
        suggestions={displayData.suggestions}
        rangeKey={activeRangeKey}
        idPrefix="desktop-suggested-rpe"
      />

      <Card id="log-load" className="shadow-sm" data-training-load-actions>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Update the evidence</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log a session here, or use Sessions for the full workload history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ResponsiveDetailPanel
              open={logOpen}
              onOpenChange={setLogOpen}
              title="Log golf training"
              description="Add a round, practice block, speed session or manual workload entry."
              trigger={
                <Button type="button">
                  <Plus className="size-4" aria-hidden />
                  Log training
                </Button>
              }
            >
              <TrainingSessionForm
                rangeKey={activeRangeKey}
                today={displayData.today}
                idPrefix="desktop-training-load"
              />
            </ResponsiveDetailPanel>
            <Button asChild variant="outline">
              <Link href="/sessions">View session history</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <RecentTrainingSessions sessions={displayData.recentSessions} />
    </>
  );
}

function RecoveryWorkbench({ data }: { data: TrainingOverTimeData }) {
  const recovery = buildRecoveryRecommendation(data);
  const next48Hours = buildNext48Plan(data);

  return (
    <Card id="recovery" className="scroll-mt-28 shadow-sm" data-training-recovery-workbench>
      <SectionHeader
        title="Recovery and next 48 hours"
        description="Turn today's workload and Golf Form into a specific next-session decision."
        action={<StatusPill tone={recovery.tone}>{recovery.label}</StatusPill>}
      />
      <CardContent className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border">
        <section aria-labelledby="recovery-recommendation-title" className="min-w-0 lg:pr-6">
          <div className={cn("rounded-lg border p-4", statusSurfaceClass(recovery.tone))}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">Tomorrow</p>
            <h3
              id="recovery-recommendation-title"
              className="mt-2 text-xl font-semibold tracking-normal"
            >
              {recovery.title}
            </h3>
            <p className="mt-2 text-sm leading-6 opacity-90">{recovery.summary}</p>
          </div>

          <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
            <RecoveryDecision label="Best" value={recovery.best} tone="green" />
            <RecoveryDecision label="Optional" value={recovery.acceptable} tone="amber" />
            <RecoveryDecision label="Avoid" value={recovery.avoid} tone="red" />
          </dl>

          <div className="mt-3 border-l-2 border-primary/35 pl-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Why
            </p>
            <ul className="mt-2 grid gap-1.5 text-sm leading-5 text-muted-foreground">
              {recovery.reasonLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="next-48-hours"
          aria-labelledby="next-48-hours-title"
          className="min-w-0 border-t border-border pt-6 lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="next-48-hours-title" className="text-lg font-semibold tracking-normal">
                Next 48 hours
              </h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                How the next two golf days should be paced.
              </p>
            </div>
            <StatusPill tone={next48Hours.tone}>Predictive</StatusPill>
          </div>

          <ol className="mt-4 divide-y divide-border rounded-lg border border-border">
            {next48Hours.items.map((item) => (
              <li key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-8 items-center justify-center rounded-full border",
                    statusSurfaceClass(item.tone),
                  )}
                >
                  <CalendarDays className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.activity}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}

function RecoveryDecision({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red";
}) {
  const Icon = tone === "red" ? AlertTriangle : CheckCircle2;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-2.5">
      <Icon className={cn("size-4", statusIconClass(tone))} aria-hidden="true" />
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </dt>
        <dd className="text-right text-sm font-semibold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function TrainingRhythmWorkbench({
  data,
  streakData,
}: {
  data: TrainingOverTimeData;
  streakData: TrainingOverTimeData;
}) {
  const score = buildWeeklyTrainingScore(data);
  const streak = buildTrainingStreak(streakData);
  const balance = data.trainingBalance;
  const ratio = buildTrainingRatio(data.latest);

  return (
    <Card id="weekly-score" className="scroll-mt-28 shadow-sm" data-training-rhythm-workbench>
      <SectionHeader
        title="Weekly training quality"
        description="Workload, recovery, consistency and practice balance in one weekly read."
        action={<StatusPill tone={score.tone}>{score.grade}</StatusPill>}
      />
      <CardContent className="grid gap-6 xl:grid-cols-[0.9fr_0.8fr_1.3fr] xl:gap-0 xl:divide-x xl:divide-border">
        <section aria-labelledby="weekly-quality-title" className="min-w-0 xl:pr-6">
          <div className={cn("rounded-lg border p-4", statusSurfaceClass(score.tone))}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
              Training quality
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h3 id="weekly-quality-title" className="text-5xl font-semibold tracking-normal">
                {score.grade}
              </h3>
              <p className="pb-1 text-sm font-semibold">{score.comparison}</p>
            </div>
            <p className="mt-2 text-sm leading-5 opacity-90">
              {score.sessions} session{score.sessions === 1 ? "" : "s"} · {formatMetric(score.load)}{" "}
              load · Golf Form {formatSigned(score.formChange)}.
            </p>
          </div>

          <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
            <GradeRow label="Practice quality" value={score.practiceQualityGrade} />
            <GradeRow label="Recovery" value={score.recoveryGrade} />
            <GradeRow label="Consistency" value={score.consistencyGrade} />
            <GradeRow label="Progress" value={score.progressGrade} />
          </dl>

          <ul className="mt-3 grid gap-1.5 text-sm leading-5 text-muted-foreground">
            {score.positiveLines.map((line) => (
              <ReasonLine key={line} tone="positive" line={line} />
            ))}
            {score.cautionLines.map((line) => (
              <ReasonLine key={line} tone="caution" line={line} />
            ))}
          </ul>
        </section>

        <section
          id="streak"
          aria-labelledby="training-streak-title"
          className="min-w-0 border-t border-border pt-6 xl:border-t-0 xl:px-6 xl:pt-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="training-streak-title" className="text-lg font-semibold tracking-normal">
                Training streak
              </h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Logged rounds, practice and speed work.
              </p>
            </div>
            <Flame className="size-5 text-primary" aria-hidden="true" />
          </div>

          <p className="mt-5 text-4xl font-semibold tracking-normal">
            {streak.currentStreak} day{streak.currentStreak === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Current streak · target 3 days
          </p>

          <dl className="mt-4 divide-y divide-border border-y border-border">
            <MetricRow label="Longest" value={`${streak.bestStreak} days`} />
            <MetricRow label="Consistency" value={`${streak.consistency}%`} />
          </dl>
        </section>

        <section
          id="balance"
          aria-labelledby="training-balance-title"
          className="min-w-0 border-t border-border pt-6 xl:border-t-0 xl:pl-6 xl:pt-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="training-balance-title" className="text-lg font-semibold tracking-normal">
                Training balance
              </h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Last {balance.windowDays} days by logged workload.
              </p>
            </div>
            <StatusPill tone={ratio.pillTone}>{ratio.status}</StatusPill>
          </div>

          <div className={cn("mt-4 rounded-lg border p-3", statusSurfaceClass(ratio.tone))}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
                  Workload ratio
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-normal">{ratio.label}</p>
              </div>
              <p className="text-xs font-medium opacity-85">
                Recent {ratio.recent} · Fitness {ratio.fitness}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {balance.segments.map((segment) => (
              <div key={segment.key} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{segment.label}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {segment.percent}%
                  </p>
                </div>
                <Progress
                  value={segment.percent}
                  aria-label={`${segment.label} ${segment.percent}% of training load`}
                  className="h-2"
                />
                <p className="text-xs leading-4 text-muted-foreground">
                  {segment.sessions} session{segment.sessions === 1 ? "" : "s"} ·{" "}
                  {formatMetric(segment.load)} load · target {balanceTargetLabel(segment.key)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function GradeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd>
        <StatusPill tone={gradeTone(value)}>{value}</StatusPill>
      </dd>
    </div>
  );
}

function ReasonLine({ tone, line }: { tone: "positive" | "caution"; line: string }) {
  const Icon = tone === "positive" ? CheckCircle2 : AlertTriangle;

  return (
    <li className="flex gap-2">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "positive" ? "text-primary" : "text-[var(--status-warning-foreground)]",
        )}
        aria-hidden="true"
      />
      <span>{line}</span>
    </li>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function LoadLegend() {
  return (
    <div
      className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"
      role="list"
      aria-label="Daily training load bands"
    >
      <LoadLegendItem tone="green" label="Normal" detail="Under 300 load" />
      <LoadLegendItem tone="amber" label="Heavy" detail="300–499 load" />
      <LoadLegendItem tone="pink" label="Very heavy" detail="500+ load" />
    </div>
  );
}

function LoadLegendItem({ tone, label, detail }: { tone: Tone; label: string; detail: string }) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
      role="listitem"
    >
      <StatusPill tone={tone}>{label}</StatusPill>
      <span>{detail}</span>
    </div>
  );
}

function EfficiencyCards({ cards }: { cards: TrainingEfficiencyCard[] }) {
  return (
    <Card id="training-response" className="scroll-mt-28 shadow-sm" data-training-response>
      <SectionHeader
        title="Training response"
        description="How carry, accuracy and scoring are responding to the logged workload evidence."
        action={<StatusPill tone="sky">{cards.length} signals</StatusPill>}
      />
      <CardContent className="p-0">
        <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {cards.map((card) => (
            <article key={card.title} className="min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                <StatusPill tone={card.tone}>Response</StatusPill>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-normal text-foreground">
                {card.metric}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.detail}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingSessionLedger({
  sessions,
  rangeKey,
}: {
  sessions: TrainingSessionListItem[];
  rangeKey: TrainingRangeKey;
}) {
  const rangeLabel =
    TRAINING_RANGE_OPTIONS.find((option) => option.key === rangeKey)?.label ?? rangeKey;

  return (
    <Card
      id="training-load-sessions"
      className="scroll-mt-28 gap-0 py-0 shadow-sm"
      data-workbench-scope="training-load-sessions"
    >
      <SectionHeader
        title="Training load ledger"
        description="Range, round, speed and manual workload rows behind the selected Training Status range."
        action={<StatusPill tone="sky">{rangeLabel}</StatusPill>}
      />
      <CardContent className="grid gap-3 p-3">
        <DesktopTableWorkbenchControls
          viewKey="training-load-sessions"
          scope="training-load-sessions"
          currentViewLabel={`${rangeLabel} training load`}
          resultLabel={`${integerFormatter.format(sessions.length)} session${sessions.length === 1 ? "" : "s"}`}
          columns={trainingSessionColumns}
          suggestedViews={trainingSessionSuggestedViews}
          exportTableId="training-load-sessions"
          exportFileName={`forekinghell-training-load-${rangeKey}.csv`}
        />
        <DataTableFrame mainTable mainTableLabel="Training load session table" stickyFirstColumn>
          <Table
            data-workbench-export-table="training-load-sessions"
            aria-describedby="training-load-sessions-summary"
          >
            <TableCaption id="training-load-sessions-summary" className="sr-only">
              Training load session table showing date, session, source, workload, RPE, volume,
              conditions and notes for the selected range.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead data-column="date" className="sticky left-0 z-20 min-w-28 bg-card">
                  Date
                </TableHead>
                <TableHead data-column="session" className="min-w-64">
                  Session
                </TableHead>
                <TableHead data-column="source">Source</TableHead>
                <TableHead data-column="load" className="text-right">
                  Load
                </TableHead>
                <TableHead data-column="rpe" className="text-right">
                  RPE
                </TableHead>
                <TableHead data-column="volume">Volume</TableHead>
                <TableHead data-column="conditions">Conditions</TableHead>
                <TableHead data-column="notes" className="min-w-72">
                  Notes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <TableRow key={session.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="date"
                      className="sticky left-0 z-10 border-r border-border bg-card font-semibold"
                    >
                      {formatLedgerDate(session.sessionDate)}
                    </TableCell>
                    <TableCell data-column="session">
                      <div className="min-w-0">
                        <p className="max-w-72 truncate font-semibold text-foreground">
                          {session.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.competition ? "Competition" : "Training"} ·{" "}
                          {session.sourceId ? session.sourceId.slice(0, 8) : "manual entry"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell data-column="source">
                      <StatusPill tone={trainingSourceTone(session.sourceType)}>
                        {formatTrainingSource(session.sourceType)}
                      </StatusPill>
                    </TableCell>
                    <TableCell data-column="load" className="text-right tabular-nums">
                      {integerFormatter.format(Math.round(session.sessionLoad))}
                    </TableCell>
                    <TableCell data-column="rpe" className="text-right tabular-nums">
                      {session.rpe}
                    </TableCell>
                    <TableCell data-column="volume">{formatTrainingVolume(session)}</TableCell>
                    <TableCell data-column="conditions">
                      {formatTrainingConditions(session)}
                    </TableCell>
                    <TableCell data-column="notes">
                      <span className="block max-w-80 truncate text-muted-foreground">
                        {session.notes?.trim() || "No notes"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No training load sessions are logged in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
  );
}

function RangeControls({
  activeKey,
  onRangeChange,
}: {
  activeKey: TrainingRangeKey;
  onRangeChange: (rangeKey: TrainingRangeKey) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={activeKey}
      onValueChange={(value) => {
        if (value) onRangeChange(value as TrainingRangeKey);
      }}
      aria-label="Training range"
      variant="outline"
      spacing={1}
      className="premium-command-surface flex w-full gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit"
    >
      {TRAINING_RANGE_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.key}
          value={option.key}
          aria-label={`Show ${option.label} training range`}
          className="min-h-9 min-w-12 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors motion-reduce:transition-none"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function TrainingEmptyState({ conditioningDays }: { conditioningDays: number }) {
  return (
    <Alert className="p-4" data-training-empty-state>
      <LineChart className="size-4" aria-hidden="true" />
      <AlertTitle>Start logging rounds or practice sessions</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>
          Build your golf training profile to see whether comparable sessions are moving the right
          way.
        </p>
        <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
          <div className="min-w-0 sm:pr-3">
            <dt className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              Golf Form
            </dt>
            <dd className="mt-1 leading-5">
              Indexed golf form. 100 is your baseline, 110+ is very good, and 120+ is peak form.
            </dd>
          </div>
          <div className="min-w-0 sm:px-3">
            <dt className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Training Fitness
            </dt>
            <dd className="mt-1 leading-5">
              {conditioningDays}-day golf workload capacity. It moves slowly so a short quiet spell
              does not look like your training base disappeared.
            </dd>
          </div>
          <div className="min-w-0 sm:pl-3">
            <dt className="flex items-center gap-2 font-medium text-foreground">
              <BarChart3 className="size-4" aria-hidden="true" />
              Recent Load
            </dt>
            <dd className="mt-1 leading-5">
              7-day golf workload. It moves quickly after hard practice, walking rounds or speed
              work.
            </dd>
          </div>
        </dl>
        <Button asChild>
          <Link href="#log-load">Log first session</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function buildWeeklyTrainingScore(data: TrainingOverTimeData) {
  const weekStart = addDays(data.today, -6);
  const weekSeries = data.series.filter((point) => point.date >= weekStart);
  const sessions = data.sessionMarkers
    .filter((marker) => marker.date >= weekStart)
    .reduce((total, marker) => total + marker.sessionCount, 0);
  const load = weekSeries.reduce((total, point) => total + point.load, 0);
  const firstPoint = weekSeries[0] ?? data.previousWeek;
  const latest = data.latest;
  const formChange = latest && firstPoint ? latest.form - firstPoint.form : 0;
  const score = weeklyScoreValue({ sessions, load, formChange });
  const grade = gradeFromScore(score);
  const consistencyGrade = gradeFromScore(consistencyScoreValue(sessions));
  const recoveryGrade = gradeFromScore(recoveryScoreValue(latest));
  const practiceQualityGrade = gradeFromScore(practiceQualityScoreValue(latest, formChange));
  const progressGrade = gradeFromScore(progressScoreValue(formChange));
  const tone: Tone = score >= 80 ? "green" : score >= 68 ? "sky" : score >= 55 ? "amber" : "slate";

  return {
    sessions,
    load,
    formChange,
    grade,
    tone,
    consistencyGrade,
    recoveryGrade,
    practiceQualityGrade,
    progressGrade,
    comparison: comparisonLabel(formChange),
    positiveLines: buildWeeklyPositiveLines({
      sessions,
      load,
      formChange,
      latest,
      practiceQualityGrade,
      recoveryGrade,
    }),
    cautionLines: buildWeeklyCautionLines({
      sessions,
      load,
      consistencyGrade,
      latest,
    }),
  };
}

function buildRecoveryRecommendation(data: TrainingOverTimeData) {
  const latest = data.latest;

  if (!latest) {
    return {
      label: "Build baseline",
      title: "Log first",
      summary: "Recovery advice unlocks once the page has workload and form data.",
      best: "Log a session",
      acceptable: "Light putting",
      avoid: "Speed training",
      reasonLines: [
        "Training Load needs at least one logged round, practice block or speed session.",
        "Comparison confidence will build once comparable sessions exist.",
      ],
      tone: "slate" as const,
    };
  }

  if (latest.load >= 500 || latest.fatigue >= 120 || latest.fatigue > latest.fitness * 1.8) {
    return {
      label: "Rest",
      title: "Rest or go light",
      summary: "Today's workload is high enough that more volume is the wrong lever.",
      best: "Putting + mobility",
      acceptable: "Short game",
      avoid: "Speed training",
      reasonLines: [
        "Recent Load is elevated.",
        "Allow recovery before adding intensity.",
        "Keep tomorrow technical, not heavy.",
      ],
      tone: "amber" as const,
    };
  }

  if (latest.fatigue <= latest.fitness * 1.2 && latest.form >= 100) {
    return {
      label: "Practice window",
      title: "Tomorrow: practise",
      summary: "Recent Load is controlled and Golf Form is holding above baseline.",
      best: "Driver practice",
      acceptable: "Short game",
      avoid: "Speed training",
      reasonLines: [
        "Recent Load is controlled.",
        "Golf Form remains high.",
        "Build skill before adding intensity.",
      ],
      tone: "green" as const,
    };
  }

  return {
    label: "Controlled",
    title: "Keep it specific",
    summary: "Workload is manageable, but the next session should have a clear job.",
    best: "Technical practice",
    acceptable: "Short game",
    avoid: "Speed training",
    reasonLines: [
      "Recent Load is manageable.",
      "Golf Form is not the limiting issue.",
      "Avoid adding volume without a practice target.",
    ],
    tone: "sky" as const,
  };
}

function buildNext48Plan(data: TrainingOverTimeData) {
  const latest = data.latest;
  const dayAfter = addDays(data.today, 2);

  if (!latest) {
    return {
      tone: "slate" as const,
      items: [
        {
          label: "Tomorrow",
          activity: "Log a baseline",
          reason: "Start with one round or practice block.",
          tone: "amber" as const,
        },
        {
          label: weekdayLabel(dayAfter),
          activity: "Light putting",
          reason: "Keep it simple until workload exists.",
          tone: "green" as const,
        },
      ],
    };
  }

  if (latest.load >= 500 || latest.fatigue >= 120 || latest.fatigue > latest.fitness * 1.8) {
    return {
      tone: "amber" as const,
      items: [
        {
          label: "Tomorrow",
          activity: "Recovery",
          reason: "Load is high enough to avoid more volume.",
          tone: "red" as const,
        },
        {
          label: weekdayLabel(dayAfter),
          activity: "Short game",
          reason: "Reintroduce skill work before intensity.",
          tone: "amber" as const,
        },
      ],
    };
  }

  if (latest.fatigue <= latest.fitness * 1.2 && latest.form >= 100) {
    return {
      tone: "green" as const,
      items: [
        {
          label: "Tomorrow",
          activity: "Driver practice",
          reason: "Golf Form is holding above baseline.",
          tone: "green" as const,
        },
        {
          label: weekdayLabel(dayAfter),
          activity: "Ideal for round",
          reason: "Workload is controlled.",
          tone: "green" as const,
        },
      ],
    };
  }

  return {
    tone: "sky" as const,
    items: [
      {
        label: "Tomorrow",
        activity: "Technical practice",
        reason: "Keep the session specific.",
        tone: "green" as const,
      },
      {
        label: weekdayLabel(dayAfter),
        activity: "Normal range",
        reason: "Add volume only if recovery feels good.",
        tone: "amber" as const,
      },
    ],
  };
}

function buildTrainingStreak(data: TrainingOverTimeData) {
  const activeDates = [
    ...new Set(
      data.sessionMarkers
        .filter((marker) => marker.totalLoad > 0 || marker.sessionCount > 0)
        .map((marker) => marker.date),
    ),
  ].sort();
  const currentStreak = [...data.series].reverse().reduce(
    (streak, point) => {
      if (streak.done || point.load <= 0) {
        return { ...streak, done: true };
      }

      return { count: streak.count + 1, done: false };
    },
    { count: 0, done: false },
  ).count;
  const recentStart = addDays(data.today, -29);
  const recentActiveDates = activeDates.filter((date) => date >= recentStart);
  const consistency = Math.min(100, Math.round((recentActiveDates.length / 12) * 100));

  return {
    currentStreak,
    bestStreak: longestDateStreak(activeDates),
    consistency,
  };
}

function buildWeeklyPositiveLines({
  sessions,
  load,
  formChange,
  latest,
  practiceQualityGrade,
  recoveryGrade,
}: {
  sessions: number;
  load: number;
  formChange: number;
  latest: TrainingOverTimeData["latest"];
  practiceQualityGrade: string;
  recoveryGrade: string;
}) {
  const lines: string[] = [];

  if (recoveryGrade !== "C" && recoveryGrade !== "D") {
    lines.push("Recovery managed.");
  }

  if (["A", "A-", "B+"].includes(practiceQualityGrade)) {
    lines.push("Practice quality high.");
  }

  if (formChange >= 1) {
    lines.push("Golf Form improving.");
  } else if ((latest?.form ?? 0) >= 110) {
    lines.push("Golf Form holding above baseline.");
  }

  if (load >= 250) {
    lines.push("Workload was meaningful.");
  }

  if (sessions > 1) {
    lines.push(`${sessions} sessions logged this week.`);
  }

  return lines.length > 0 ? lines.slice(0, 3) : ["Training data is building."];
}

function buildWeeklyCautionLines({
  sessions,
  load,
  consistencyGrade,
  latest,
}: {
  sessions: number;
  load: number;
  consistencyGrade: string;
  latest: TrainingOverTimeData["latest"];
}) {
  const lines: string[] = [];

  if (sessions <= 1) {
    lines.push("Only one session.");
  }

  if (consistencyGrade === "C" || consistencyGrade === "D") {
    lines.push("Consistency low.");
  }

  if (load > 1800 || (latest?.fatigue ?? 0) >= 120) {
    lines.push("Recent Load needs watching.");
  }

  return lines.slice(0, 3);
}

function weeklyScoreValue({
  sessions,
  load,
  formChange,
}: {
  sessions: number;
  load: number;
  formChange: number;
}) {
  if (sessions === 0) {
    return 45;
  }

  const frequencyScore = Math.min(24, sessions * 8);
  const loadScore = load >= 300 && load <= 1800 ? 18 : load > 1800 ? 10 : 8;
  const formScore = Math.max(-12, Math.min(22, formChange * 4));

  return Math.round(50 + frequencyScore + loadScore + formScore);
}

function consistencyScoreValue(sessions: number) {
  if (sessions >= 4) return 92;
  if (sessions === 3) return 84;
  if (sessions === 2) return 76;
  if (sessions === 1) return 62;
  return 45;
}

function recoveryScoreValue(latest: TrainingOverTimeData["latest"]) {
  if (!latest || latest.fitness <= 0) {
    return 55;
  }

  const ratio = latest.fatigue / latest.fitness;
  if (ratio <= 0.9) return 90;
  if (ratio <= 1.2) return 80;
  if (ratio <= 1.55) return 68;
  return 52;
}

function practiceQualityScoreValue(latest: TrainingOverTimeData["latest"], formChange: number) {
  const form = latest?.form ?? 100;
  return Math.max(45, Math.min(96, 70 + formChange * 3 + (form >= 115 ? 12 : form >= 105 ? 6 : 0)));
}

function progressScoreValue(formChange: number) {
  if (formChange >= 4) return 92;
  if (formChange >= 2) return 84;
  if (formChange >= 0) return 76;
  if (formChange >= -2) return 64;
  return 50;
}

function comparisonLabel(formChange: number) {
  if (formChange >= 2) return "Better";
  if (formChange <= -2) return "Lower";
  return "Steady";
}

function gradeFromScore(score: number) {
  if (score >= 92) return "A";
  if (score >= 84) return "A-";
  if (score >= 76) return "B+";
  if (score >= 68) return "B";
  if (score >= 55) return "C";
  return "D";
}

function gradeTone(grade: string): Tone {
  if (grade === "A" || grade === "A-" || grade === "B+") return "green";
  if (grade === "B") return "sky";
  if (grade === "C") return "amber";
  return "pink";
}

function buildTrainingRatio(latest: TrainingOverTimeData["latest"]) {
  if (!latest || latest.fitness <= 0) {
    return {
      label: "Need data",
      status: "Build baseline",
      recent: "0",
      fitness: "0",
      tone: "slate" as const,
      pillTone: "slate" as const,
    };
  }

  const ratio = latest.fatigue / latest.fitness;
  const label = ratio.toLocaleString("en-GB", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const recent = formatMetric(latest.fatigue);
  const fitness = formatMetric(latest.fitness);

  if (ratio > 1.6) {
    return {
      label,
      status: "High",
      recent,
      fitness,
      tone: "red" as const,
      pillTone: "amber" as const,
    };
  }

  if (ratio > 1.3) {
    return {
      label,
      status: "Watch",
      recent,
      fitness,
      tone: "amber" as const,
      pillTone: "amber" as const,
    };
  }

  if (ratio >= 0.9) {
    return {
      label,
      status: "Ideal",
      recent,
      fitness,
      tone: "green" as const,
      pillTone: "green" as const,
    };
  }

  return {
    label,
    status: "Low load",
    recent,
    fitness,
    tone: "sky" as const,
    pillTone: "sky" as const,
  };
}

function statusSurfaceClass(tone: Tone | "red") {
  switch (tone) {
    case "green":
      return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
    case "sky":
      return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
    case "amber":
      return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
    case "pink":
    case "red":
      return "border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-destructive";
    case "slate":
      return "border-border bg-muted/50 text-foreground";
  }
}

function statusIconClass(tone: "green" | "amber" | "red") {
  if (tone === "green") return "text-primary";
  if (tone === "amber") return "text-[var(--status-warning-foreground)]";
  return "text-destructive";
}

function formatLedgerDate(dateKey: string) {
  return ledgerDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatTrainingSource(sourceType: TrainingSessionListItem["sourceType"]) {
  switch (sourceType) {
    case "launch_monitor":
      return "Launch monitor";
    case "imported":
      return "Imported";
    case "practice":
      return "Practice";
    case "round":
      return "Round";
    case "manual":
      return "Manual";
  }
}

function trainingSourceTone(sourceType: TrainingSessionListItem["sourceType"]): Tone {
  switch (sourceType) {
    case "round":
      return "green";
    case "manual":
      return "amber";
    default:
      return "sky";
  }
}

function formatTrainingVolume(session: TrainingSessionListItem) {
  if (session.holesPlayed) return `${integerFormatter.format(session.holesPlayed)} holes`;
  if (session.totalSwings) return `${integerFormatter.format(session.totalSwings)} swings`;
  if (session.durationMinutes) return `${integerFormatter.format(session.durationMinutes)} min`;
  return "Manual";
}

function formatTrainingConditions(session: TrainingSessionListItem) {
  const conditions = [
    session.walked ? "Walked" : session.usedCart ? "Cart" : null,
    session.fullSwings ? `${integerFormatter.format(session.fullSwings)} full` : null,
    session.shortGameSwings ? `${integerFormatter.format(session.shortGameSwings)} short` : null,
    session.puttingSwings ? `${integerFormatter.format(session.puttingSwings)} putts` : null,
    session.mentalPressure ? `Pressure ${session.mentalPressure}` : null,
    session.physicalDemand ? `Demand ${session.physicalDemand}` : null,
  ].filter(Boolean);

  return conditions.length > 0 ? conditions.join(" / ") : "Not recorded";
}

function formatMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}

function formatSigned(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${integerFormatter.format(rounded)}`;
}

function longestDateStreak(dates: string[]) {
  if (dates.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1]!;
    const currentDate = dates[index]!;

    if (dateDiffDays(previous, currentDate) === 1) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
  }

  return longest;
}

function dateDiffDays(a: string, b: string) {
  const first = new Date(`${a}T00:00:00.000Z`).getTime();
  const second = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((second - first) / 86_400_000);
}

function weekdayLabel(dateKey: string) {
  return weekdayFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function balanceTargetLabel(
  key: TrainingOverTimeData["trainingBalance"]["segments"][number]["key"],
) {
  switch (key) {
    case "range":
      return "40-50%";
    case "rounds":
      return "30-40%";
    case "speed":
      return "10-20%";
  }
}

function replaceBrowserRange(rangeKey: TrainingRangeKey) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("range", rangeKey);
  url.searchParams.delete("saved");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
