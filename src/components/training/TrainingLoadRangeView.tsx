"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Dumbbell,
  Flame,
  LineChart,
  Plus,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  ChartAccessibleFallback,
  type ChartFallbackColumn,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  DataPanel,
  DataTableFrame,
  EmptyState,
  MobileSectionChips,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { RecentTrainingSessions } from "@/components/training/RecentTrainingSessions";
import { TrainingLoadBars } from "@/components/training/TrainingLoadBars";
import { TrainingOverTimeChart } from "@/components/training/TrainingOverTimeChart";
import { TrainingSessionForm } from "@/components/training/TrainingSessionForm";
import { TrainingSourceSuggestions } from "@/components/training/TrainingSourceSuggestions";
import { TrainingStatusCard } from "@/components/training/TrainingStatusCard";
import { TrainingSummaryCards } from "@/components/training/TrainingSummaryCards";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import { TRAINING_RANGE_OPTIONS, type TrainingRangeKey } from "@/lib/training/ranges";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";
import type {
  TrainingEfficiencyCard,
  TrainingOverTimeData,
  TrainingSessionListItem,
} from "@/lib/training/trainingData";
import { cn } from "@/lib/utils";

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
const chartDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const trainingStatusChartColumns: ChartFallbackColumn[] = [
  { key: "date", label: "Date" },
  { key: "form", label: "Golf Form" },
  { key: "sessionQuality", label: "Session Quality" },
  { key: "fitness", label: "Training Fitness" },
  { key: "fatigue", label: "Recent Load" },
];

const dailyLoadChartColumns: ChartFallbackColumn[] = [
  { key: "date", label: "Date" },
  { key: "load", label: "Session load" },
  { key: "band", label: "Load band" },
];

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

export function TrainingLoadRangeView({ data, initialRangeKey }: TrainingLoadRangeViewProps) {
  const [activeRangeKey, setActiveRangeKey] = useState(initialRangeKey);
  const displayData = useMemo(
    () => selectTrainingRangeData(data, activeRangeKey),
    [activeRangeKey, data],
  );
  const trainingStatusSummary = buildTrainingStatusChartSummary(displayData.series);
  const dailyLoadSummary = buildDailyLoadChartSummary(displayData.series);
  const trainingStatusRows = buildTrainingStatusChartRows(displayData.series);
  const dailyLoadRows = buildDailyLoadChartRows(displayData.series);

  function handleRangeChange(rangeKey: TrainingRangeKey) {
    setActiveRangeKey(rangeKey);
    replaceBrowserRange(rangeKey);
  }

  return (
    <>
      <RangeControls activeKey={activeRangeKey} onRangeChange={handleRangeChange} />

      <MobileSectionChips
        items={[
          { label: "Summary", href: "#summary" },
          { label: "Status", href: "#chart" },
          { label: "Recovery", href: "#recovery" },
          { label: "Balance", href: "#balance" },
          { label: "Streak", href: "#streak" },
          { label: "Load", href: "#load" },
          { label: "Ledger", href: "#training-load-sessions" },
          { label: "Log", href: "#log-load" },
          { label: "Recent", href: "#recent" },
        ]}
      />

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

      <DataPanel id="chart">
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
          <ChartAccessibleFallback
            title="Training Status"
            summary={trainingStatusSummary}
            columns={trainingStatusChartColumns}
            rows={trainingStatusRows}
            className="mt-3"
          />
        </CardContent>
      </DataPanel>

      <section className="grid items-stretch gap-3 lg:grid-cols-2 2xl:grid-cols-5">
        <RecoveryRecommendation data={displayData} />
        <Next48HoursCard data={displayData} />
        <WeeklyTrainingScore data={displayData} />
        <TrainingStreakCard data={data} />
        <TrainingBalanceCard data={displayData} />
      </section>

      <DataPanel id="load">
        <SectionHeader
          title="Daily swing load"
          description="Each bar is the total session load logged for that day. Green is normal, amber is heavy, red is very high."
          action={<BarChart3 className="size-5 text-emerald-700" aria-hidden="true" />}
        />
        <CardContent className="grid gap-3">
          <LoadLegend />
          <TrainingLoadBars data={displayData.series} />
          <ChartAccessibleFallback
            title="Daily swing load"
            summary={dailyLoadSummary}
            columns={dailyLoadChartColumns}
            rows={dailyLoadRows}
          />
        </CardContent>
      </DataPanel>

      <TrainingSessionLedger sessions={displayData.sessions} rangeKey={activeRangeKey} />

      <TrainingStatusCard
        latest={displayData.latest}
        status={displayData.status}
        trend={displayData.trend}
        confidence={displayData.confidence}
        sessionFormSignal={displayData.sessionFormSignal}
      />

      <EfficiencyCards cards={displayData.efficiencyCards} />

      <TrainingSourceSuggestions suggestions={displayData.suggestions} rangeKey={activeRangeKey} />

      <LogGolfLoadPanel rangeKey={activeRangeKey} today={displayData.today} />

      <RecentTrainingSessions sessions={displayData.recentSessions} />
    </>
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
    <nav
      aria-label="Training range"
      className="premium-command-surface flex w-full gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit"
    >
      {TRAINING_RANGE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={option.key === activeKey}
          onClick={() => onRangeChange(option.key)}
          className={cn(
            "min-h-9 min-w-12 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors",
            option.key === activeKey
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}

function TrainingEmptyState({ conditioningDays }: { conditioningDays: number }) {
  return (
    <DataPanel>
      <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <EmptyState
          icon={<LineChart className="size-5" aria-hidden="true" />}
          title="Start logging rounds or practice sessions to build your golf training profile."
          description="Golf Form shows whether comparable sessions are moving the right way. Training Fitness is your long-term golf load, and Recent Load is your short-term workload."
          action={
            <Button asChild>
              <Link href="#log-load">Log first session</Link>
            </Button>
          }
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PrimerCard
            icon={<Sparkles className="size-4" aria-hidden="true" />}
            title="Golf Form"
            detail="Indexed golf form. 100 is your baseline, 110+ is very good, and 120+ is peak form."
          />
          <PrimerCard
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            title="Training Fitness"
            detail={`${conditioningDays}-day golf workload capacity. It moves slowly so short quiet spells do not look like your training base disappeared.`}
          />
          <PrimerCard
            icon={<BarChart3 className="size-4" aria-hidden="true" />}
            title="Recent Load"
            detail="7-day golf workload. It moves quickly after hard practice, walking rounds or speed work."
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function PrimerCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function EfficiencyCards({ cards }: { cards: TrainingEfficiencyCard[] }) {
  return (
    <section id="overlays" className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.title}
          className={cn("rounded-lg border p-4", overlayToneClass(card.tone))}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
            Training response
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-normal">{card.metric}</p>
          <p className="mt-1 text-sm font-semibold">{card.title}</p>
          <p className="mt-2 text-sm leading-5 opacity-80">{card.detail}</p>
        </article>
      ))}
    </section>
  );
}

function RecoveryRecommendation({ data }: { data: TrainingOverTimeData }) {
  const recovery = buildRecoveryRecommendation(data);

  return (
    <DataPanel id="recovery" className="h-full">
      <SectionHeader
        title="Recovery recommendation"
        description="What tomorrow can sensibly handle from today's workload and Golf Form."
        action={<StatusPill tone={recovery.tone}>{recovery.label}</StatusPill>}
      />
      <CardContent className="grid gap-3">
        <div className={cn("rounded-lg border p-3", recoveryToneClass(recovery.tone))}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">Tomorrow</p>
          <p className="mt-2 text-xl font-semibold tracking-normal">{recovery.title}</p>
          <p className="mt-2 text-sm leading-6 opacity-85">{recovery.summary}</p>
        </div>
        <div className="grid gap-2">
          <RecoveryRow label="Best" value={recovery.best} tone="green" />
          <RecoveryRow label="Optional" value={recovery.acceptable} tone="amber" />
          <RecoveryRow label="Avoid" value={recovery.avoid} tone="red" />
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Reason
            </p>
            <div className="mt-2 grid gap-1">
              {recovery.reasonLines.map((line) => (
                <p key={line} className="text-sm leading-5 text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function RecoveryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red";
}) {
  const icon =
    tone === "green" ? (
      <CheckCircle2 className="size-4 text-emerald-700" aria-hidden="true" />
    ) : tone === "amber" ? (
      <Circle className="size-4 text-amber-700" aria-hidden="true" />
    ) : (
      <XCircle className="size-4 text-red-700" aria-hidden="true" />
    );

  return (
    <div
      className={cn(
        "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2",
        recoveryRowClass(tone),
      )}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/70">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Next48HoursCard({ data }: { data: TrainingOverTimeData }) {
  const plan = buildNext48Plan(data);

  return (
    <DataPanel className="h-full">
      <SectionHeader
        title="Next 48 Hours"
        description="How the next two golf days should be paced."
        action={<StatusPill tone={plan.tone}>Predictive</StatusPill>}
      />
      <CardContent>
        <div className="grid gap-2">
          {plan.items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2",
                recoveryRowClass(item.tone),
              )}
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/70">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-foreground">{item.activity}</p>
                <p className="text-xs leading-4 text-muted-foreground">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function WeeklyTrainingScore({ data }: { data: TrainingOverTimeData }) {
  const score = buildWeeklyTrainingScore(data);

  return (
    <DataPanel id="weekly-score" className="h-full">
      <SectionHeader
        title="Weekly Training Quality"
        description="This week's workload, form movement and training quality."
        action={<StatusPill tone={score.tone}>{score.grade}</StatusPill>}
      />
      <CardContent>
        <div className="grid gap-3">
          <div className={cn("rounded-lg border p-4", recoveryToneClass(score.tone))}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
              Training Quality
            </p>
            <p className="mt-1 text-6xl font-semibold tracking-normal sm:text-7xl">{score.grade}</p>
            <p className="mt-2 text-sm leading-5 opacity-85">
              {score.sessions} session{score.sessions === 1 ? "" : "s"} - {formatMetric(score.load)}{" "}
              load - Golf Form {formatSigned(score.formChange)}.
            </p>
          </div>
          <div className="grid gap-2">
            <ReportGrade label="Practice Quality" value={score.practiceQualityGrade} />
            <ReportGrade label="Recovery" value={score.recoveryGrade} />
            <ReportGrade label="Consistency" value={score.consistencyGrade} />
            <ReportGrade label="Progress" value={score.progressGrade} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Because
            </p>
            <div className="mt-2 grid gap-1.5">
              {score.positiveLines.map((line) => (
                <ReasonLine key={line} icon="check" line={line} />
              ))}
              {score.cautionLines.map((line) => (
                <ReasonLine key={line} icon="warn" line={line} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function ReportGrade({ label, value }: { label: string; value: string }) {
  const tone = gradeTone(value);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
        reportGradeClass(tone),
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", reportGradeDotClass(tone))} />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-2xl font-semibold tracking-normal text-foreground">{value}</p>
    </div>
  );
}

function ReasonLine({ icon, line }: { icon: "check" | "warn"; line: string }) {
  return (
    <div className="flex gap-2 text-sm leading-5 text-muted-foreground">
      {icon === "check" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
      )}
      <span>{line}</span>
    </div>
  );
}

function TrainingStreakCard({ data }: { data: TrainingOverTimeData }) {
  const streak = buildTrainingStreak(data);

  return (
    <DataPanel id="streak" className="h-full">
      <SectionHeader
        title="Training streak"
        description="Current rhythm from logged rounds, practice and speed work."
        action={<StatusPill tone={streak.tone}>Target 3d</StatusPill>}
      />
      <CardContent>
        <div className="grid gap-3">
          <div className={cn("rounded-lg border p-4", recoveryToneClass(streak.tone))}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
              <Flame className="size-4" aria-hidden="true" />
              Current streak
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-normal">
              {streak.currentStreak} day{streak.currentStreak === 1 ? "" : "s"}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
            <MiniMetric label="Target" value="3 days" />
            <MiniMetric label="Longest" value={`${streak.bestStreak} days`} />
            <MiniMetric label="Consistency" value={`${streak.consistency}%`} />
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function TrainingBalanceCard({ data }: { data: TrainingOverTimeData }) {
  const balance = data.trainingBalance;
  const ratio = buildTrainingRatio(data.latest);

  return (
    <DataPanel id="balance" className="h-full">
      <SectionHeader
        title="Training Balance"
        description={`Last ${balance.windowDays} days by logged workload.`}
        action={<StatusPill tone={ratio.pillTone}>{ratio.status}</StatusPill>}
      />
      <CardContent>
        <div className="grid gap-3">
          <div className={cn("rounded-lg border p-3", ratioToneClass(ratio.tone))}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                  Workload ratio
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-normal">{ratio.label}</p>
              </div>
              <p className="text-sm font-semibold">{ratio.status}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs leading-4 opacity-80">
              <span>Recent {ratio.recent}</span>
              <span>Fitness {ratio.fitness}</span>
            </div>
          </div>
          {balance.segments.map((segment) => (
            <div key={segment.key} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{segment.label}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {segment.percent}%
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Target {balanceTargetLabel(segment.key)}
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", balanceBarClass(segment.key))}
                  style={{ width: `${segment.percent}%` }}
                />
              </div>
              <p className="text-xs leading-4 text-muted-foreground">
                {segment.sessions} session{segment.sessions === 1 ? "" : "s"} -{" "}
                {formatMetric(segment.load)} load
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function LoadLegend() {
  return (
    <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid-cols-3">
      <LegendItem className="bg-emerald-500" label="Normal" detail="< 300 load" />
      <LegendItem className="bg-amber-500" label="Heavy" detail="300-499" />
      <LegendItem className="bg-red-500" label="Very heavy" detail="500+" />
    </div>
  );
}

function LegendItem({
  className,
  label,
  detail,
}: {
  className: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white/70 px-2 py-1.5">
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-2.5 rounded-full", className)} />
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground">{detail}</span>
    </div>
  );
}

function LogGolfLoadPanel({ rangeKey, today }: { rangeKey: TrainingRangeKey; today: string }) {
  return (
    <DataPanel id="log-load" className="overflow-hidden">
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-semibold tracking-normal text-foreground">
              <Dumbbell className="size-5 text-emerald-700" aria-hidden="true" />
              Log Training
            </div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Add a round, practice block, speed session or manual workload entry.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
            <Plus className="size-4" aria-hidden="true" />
            Log Training
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className="border-t border-border/70">
          <TrainingSessionForm rangeKey={rangeKey} today={today} />
        </div>
      </details>
    </DataPanel>
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
    <section
      id="training-load-sessions"
      className="hidden scroll-mt-28 gap-3 sm:grid"
      data-workbench-scope="training-load-sessions"
    >
      <DataPanel className="gap-0 py-0">
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
            resultLabel={`${integerFormatter.format(sessions.length)} session${
              sessions.length === 1 ? "" : "s"
            }`}
            columns={trainingSessionColumns}
            suggestedViews={trainingSessionSuggestedViews}
            exportTableId="training-load-sessions"
            exportFileName={`forekinghell-training-load-${rangeKey}.csv`}
          />
          <DataTableFrame mainTable mainTableLabel="Training load session table">
            <Table
              data-workbench-export-table="training-load-sessions"
              aria-describedby="training-load-sessions-summary"
            >
              <TableCaption id="training-load-sessions-summary" className="sr-only">
                Training load session table showing date, session, source, workload, RPE, volume,
                conditions and notes for the selected range.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <TableHead
                    data-column="date"
                    className="sticky left-0 z-20 min-w-28 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
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
                        className="sticky left-0 z-10 bg-white font-semibold shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        {formatLedgerDate(session.sessionDate)}
                      </TableCell>
                      <TableCell data-column="session">
                        <div className="min-w-0">
                          <p className="max-w-72 truncate font-semibold text-foreground">
                            {session.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.competition ? "Competition" : "Training"} -{" "}
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
      </DataPanel>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-foreground">{value}</p>
    </div>
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
  const tone: "green" | "sky" | "amber" | "slate" =
    score >= 80 ? "green" : score >= 68 ? "sky" : score >= 55 ? "amber" : "slate";
  const positiveLines = buildWeeklyPositiveLines({
    sessions,
    load,
    formChange,
    latest,
    practiceQualityGrade,
    recoveryGrade,
  });
  const cautionLines = buildWeeklyCautionLines({
    sessions,
    load,
    consistencyGrade,
    latest,
  });

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
    positiveLines,
    cautionLines,
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
  const last30Start = addDays(data.today, -29);
  const bestStreak = longestDateStreak(activeDates);
  const recentActiveDates = activeDates.filter((date) => date >= last30Start);
  const activeDaysLast28 = recentActiveDates.length;
  const consistency = Math.min(100, Math.round((activeDaysLast28 / 12) * 100));
  const tone: "green" | "sky" | "amber" | "slate" =
    consistency >= 85 ? "green" : consistency >= 60 ? "sky" : consistency >= 35 ? "amber" : "slate";

  return {
    currentStreak,
    bestStreak,
    consistency,
    tone,
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

  if (
    practiceQualityGrade === "A" ||
    practiceQualityGrade === "A-" ||
    practiceQualityGrade === "B+"
  ) {
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
  if (sessions >= 4) {
    return 92;
  }

  if (sessions === 3) {
    return 84;
  }

  if (sessions === 2) {
    return 76;
  }

  if (sessions === 1) {
    return 62;
  }

  return 45;
}

function recoveryScoreValue(latest: TrainingOverTimeData["latest"]) {
  if (!latest || latest.fitness <= 0) {
    return 55;
  }

  const ratio = latest.fatigue / latest.fitness;

  if (ratio <= 0.9) {
    return 90;
  }

  if (ratio <= 1.2) {
    return 80;
  }

  if (ratio <= 1.55) {
    return 68;
  }

  return 52;
}

function practiceQualityScoreValue(latest: TrainingOverTimeData["latest"], formChange: number) {
  const form = latest?.form ?? 100;
  return Math.max(45, Math.min(96, 70 + formChange * 3 + (form >= 115 ? 12 : form >= 105 ? 6 : 0)));
}

function progressScoreValue(formChange: number) {
  if (formChange >= 4) {
    return 92;
  }

  if (formChange >= 2) {
    return 84;
  }

  if (formChange >= 0) {
    return 76;
  }

  if (formChange >= -2) {
    return 64;
  }

  return 50;
}

function comparisonLabel(formChange: number) {
  if (formChange >= 2) {
    return "Better";
  }

  if (formChange <= -2) {
    return "Lower";
  }

  return "Steady";
}

function gradeFromScore(score: number) {
  if (score >= 92) {
    return "A";
  }

  if (score >= 84) {
    return "A-";
  }

  if (score >= 76) {
    return "B+";
  }

  if (score >= 68) {
    return "B";
  }

  if (score >= 55) {
    return "C";
  }

  return "D";
}

function gradeTone(grade: string) {
  if (grade === "A" || grade === "A-" || grade === "B+") {
    return "green";
  }

  if (grade === "B") {
    return "sky";
  }

  if (grade === "C") {
    return "amber";
  }

  return "red";
}

function reportGradeClass(tone: ReturnType<typeof gradeTone>) {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50/80";
    case "sky":
      return "border-sky-200 bg-sky-50/80";
    case "amber":
      return "border-amber-200 bg-amber-50/80";
    case "red":
      return "border-red-200 bg-red-50/80";
  }
}

function reportGradeDotClass(tone: ReturnType<typeof gradeTone>) {
  switch (tone) {
    case "green":
      return "bg-emerald-500";
    case "sky":
      return "bg-sky-500";
    case "amber":
      return "bg-amber-500";
    case "red":
      return "bg-red-500";
  }
}

function formatLedgerDate(dateKey: string) {
  return chartDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
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

function trainingSourceTone(sourceType: TrainingSessionListItem["sourceType"]) {
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
  if (session.holesPlayed) {
    return `${integerFormatter.format(session.holesPlayed)} holes`;
  }

  if (session.totalSwings) {
    return `${integerFormatter.format(session.totalSwings)} swings`;
  }

  if (session.durationMinutes) {
    return `${integerFormatter.format(session.durationMinutes)} min`;
  }

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

function buildTrainingStatusChartSummary(series: FitnessFreshnessPoint[]) {
  const latest = series.at(-1);

  if (!latest) {
    return "No Training Status chart data is available yet.";
  }

  const comparison = series[Math.max(0, series.length - 8)];
  const formChange = latest.form - comparison.form;
  const latestQuality = latestSessionQualityPoint(series);
  const qualityCopy = latestQuality
    ? ` Latest scored session quality is ${formatMetric(latestQuality.sessionQuality)}/100 on ${formatChartDate(
        latestQuality.date,
      )}.`
    : " No scored session quality is visible in this range.";

  return `Latest ${formatChartDate(latest.date)}: Golf Form ${formatMetric(latest.form)}, Training Fitness ${formatMetric(latest.fitness)}, Recent Load ${formatMetric(latest.fatigue)}. Golf Form is ${formatSigned(
    formChange,
  )} versus the nearest 7-day comparison point.${qualityCopy}`;
}

function buildDailyLoadChartSummary(series: FitnessFreshnessPoint[]) {
  if (series.length === 0) {
    return "No Daily swing load chart data is available yet.";
  }

  const activeDays = series.filter((point) => point.load > 0);
  const totalLoad = series.reduce((total, point) => total + point.load, 0);
  const peak = series.reduce<FitnessFreshnessPoint | null>(
    (highest, point) => (!highest || point.load > highest.load ? point : highest),
    null,
  );

  if (!peak || activeDays.length === 0) {
    return `This range has no logged swing load across ${series.length} chart day${series.length === 1 ? "" : "s"}.`;
  }

  return `${activeDays.length} active day${activeDays.length === 1 ? "" : "s"} in this chart, ${formatMetric(
    totalLoad,
  )} total load. The highest day is ${formatChartDate(peak.date)} at ${formatMetric(
    peak.load,
  )} load, marked ${loadBand(peak.load).toLowerCase()}.`;
}

function buildTrainingStatusChartRows(series: FitnessFreshnessPoint[]): ChartFallbackRow[] {
  return series.slice(-10).map((point) => ({
    date: formatChartDate(point.date),
    form: formatMetric(point.form),
    sessionQuality: formatOptionalMetric(point.sessionQuality),
    fitness: formatMetric(point.fitness),
    fatigue: formatMetric(point.fatigue),
  }));
}

function latestSessionQualityPoint(series: FitnessFreshnessPoint[]) {
  return [...series].reverse().find(
    (
      point,
    ): point is FitnessFreshnessPoint & {
      sessionQuality: number;
    } => typeof point.sessionQuality === "number" && Number.isFinite(point.sessionQuality),
  );
}

function buildDailyLoadChartRows(series: FitnessFreshnessPoint[]): ChartFallbackRow[] {
  return series.slice(-10).map((point) => ({
    date: formatChartDate(point.date),
    load: formatMetric(point.load),
    band: loadBand(point.load),
  }));
}

function loadBand(load: number) {
  if (load >= 500) {
    return "Very heavy";
  }

  if (load >= 300) {
    return "Heavy";
  }

  if (load > 0) {
    return "Normal";
  }

  return "No load";
}

function formatChartDate(dateKey: string) {
  return chartDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}

function formatOptionalMetric(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not scored";
  }

  return formatMetric(value);
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

function overlayToneClass(tone: TrainingEfficiencyCard["tone"]) {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-950";
    default:
      return "border-slate-200 bg-white/80 text-foreground";
  }
}

function recoveryToneClass(tone: "green" | "amber" | "sky" | "slate") {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-950";
  }
}

function recoveryRowClass(tone: "green" | "amber" | "red") {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50/80";
    case "amber":
      return "border-amber-200 bg-amber-50/80";
    case "red":
      return "border-red-200 bg-red-50/80";
  }
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

function ratioToneClass(tone: "green" | "amber" | "red" | "sky" | "slate") {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "red":
      return "border-red-200 bg-red-50 text-red-950";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-950";
  }
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

function balanceBarClass(key: TrainingOverTimeData["trainingBalance"]["segments"][number]["key"]) {
  switch (key) {
    case "range":
      return "bg-emerald-500";
    case "rounds":
      return "bg-sky-500";
    case "speed":
      return "bg-amber-500";
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
