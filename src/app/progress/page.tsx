import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Flag,
  Gauge,
  LineChart,
  ListChecks,
  Sparkles,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  DataPanel,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatClubType } from "@/lib/club-format";
import type { ClubAnalytics } from "@/lib/club-analytics";
import { getProgressData } from "@/lib/progress-data";
import {
  buildProgressSummary,
  type BestSignal,
  type CoachSummaryGroup,
  type DataGap,
  type JourneyEvent,
  type PracticePriority,
  type ProgressClubRow,
  type ProgressSummary,
  type ProgressTrend,
  type TrustLadderItem,
} from "@/lib/progress-summary";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ProgressPage() {
  const data = await getProgressData();
  const summary = buildProgressSummary(data.clubs);
  const mostImproved = summary.rankings.mostImproved;
  const needsWork = summary.rankings.needsWork;

  return (
    <PageShell>
      <MobileRouteHeader title="Dashboard" group="dashboard" activeKey="progress" />

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowRight className="size-4 rotate-180" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/bag" prefetch={false}>
              <Target className="size-4" />
              Bag
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="sky">Personal baseline</StatusPill>}
        title="Bag progress"
        description={bagVerdict(summary)}
        visual={<PageArtwork variant="progress" alt="" className="h-full min-h-44" />}
        actions={
          mostImproved ? (
            <Button asChild size="lg" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href={`/bag/${mostImproved.clubId}/analytics`} prefetch={false}>
                <Brain className="size-4" />
                View supporting shots
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import first CSV
              </Link>
            </Button>
          )
        }
        metrics={[
          {
            label: "Clean stock shots",
            value: integerFormatter.format(summary.totals.trackedCleanShots),
            detail: "Used for progress checks",
          },
          {
            label: "Tracked clubs",
            value: integerFormatter.format(summary.totals.clubs),
            detail: `${integerFormatter.format(summary.totals.shots)} launch monitor rows`,
          },
          {
            label: "Average trust",
            value: `${summary.totals.averageTrust}%`,
            detail: "Distance, direction, strike, and sample depth",
          },
          {
            label: "Playable rate",
            value: formatRate(summary.totals.averagePlayableRate),
            detail: "Average across clubs with enough directional data",
          },
        ]}
      />

      {data.clubs.length === 0 ? (
        <DataPanel>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Sparkles className="size-9 text-emerald-500" />
            <div>
              <p className="text-xl font-semibold">No progress baseline yet</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Import a Rapsodo CSV and ForeKingHell will build first-vs-latest club
                comparisons automatically.
              </p>
            </div>
            <Button asChild>
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </CardContent>
        </DataPanel>
      ) : (
        <>
          <ComparisonBar />

          <section className="grid gap-3 sm:grid-cols-2">
            <InsightStrip
              icon={TrendingUp}
              label="Best movement"
              value={mostImproved ? `${formatClubType(mostImproved.clubType)} ${improvementDetail(mostImproved)}` : "Need comparable baselines"}
              tone="green"
            />
            <InsightStrip
              icon={AlertTriangle}
              label="Main concern"
              value={needsWork ? `${formatClubType(needsWork.clubType)} is still ${needsWork.trustIndex}% trust with a ${needsWork.primaryMiss.toLowerCase()} miss.` : "No weak signal has separated yet."}
              tone="amber"
            />
          </section>

          <section className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Strongest improvement"
              value={mostImproved ? formatClubType(mostImproved.clubType) : "--"}
              detail={mostImproved ? improvementDetail(mostImproved) : "Need comparable baselines"}
              href={mostImproved ? `/bag/${mostImproved.clubId}/analytics` : undefined}
              icon={TrendingUp}
              tone="green"
            />
            <MetricCard
              label="Most reliable"
              value={summary.rankings.mostTrusted ? formatClubType(summary.rankings.mostTrusted.clubType) : "--"}
              detail={
                summary.rankings.mostTrusted
                  ? `${summary.rankings.mostTrusted.trustIndex}% trust / ${summary.rankings.mostTrusted.sampleSize} clean shots`
                  : "Need more shots"
              }
              href={summary.rankings.mostTrusted ? `/bag/${summary.rankings.mostTrusted.clubId}/analytics` : undefined}
              icon={Gauge}
              tone="sky"
            />
            <MetricCard
              label="Needs attention"
              value={needsWork ? formatClubType(needsWork.clubType) : "--"}
              detail={needsWork ? `${needsWork.trustIndex}% trust / ${needsWork.primaryMiss.toLowerCase()} miss pattern` : "No weak signal yet"}
              href={needsWork ? `/bag/${needsWork.clubId}/analytics` : undefined}
              icon={ListChecks}
              tone="amber"
            />
            <MetricCard
              label="Most volatile"
              value={summary.rankings.mostVolatile ? formatClubType(summary.rankings.mostVolatile.clubType) : "--"}
              detail={
                summary.rankings.mostVolatile
                  ? `${formatRate(findAnalytics(data.clubs, summary.rankings.mostVolatile.clubId)?.accuracy.bigMissRate ?? null)} big miss rate`
                  : "Need side-carry data"
              }
              href={summary.rankings.mostVolatile ? `/bag/${summary.rankings.mostVolatile.clubId}/analytics` : undefined}
              icon={TrendingDown}
              tone="amber"
            />
          </section>

          <DataPanel>
            <SectionHeader
              title="Progress trends"
              description="Movement from the first clean baseline to the latest clean baseline."
              action={<LineChart className="size-5 text-sky-500" />}
            />
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {summary.trends.map((trend) => (
                  <TrendCard key={trend.label} trend={trend} />
                ))}
              </div>
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Practice plan"
              description="The next actions ranked by trust gap, big misses, launch window, and strike quality."
              action={<Brain className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-4">
                {summary.practicePlan.map((priority, index) => (
                  <PracticePriorityCard key={priority.clubId} priority={priority} index={index} />
                ))}
              </div>
            </CardContent>
          </DataPanel>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <CoachSummaryPanel groups={summary.coachSummary} />

            <div className="grid gap-4">
              {summary.bestSignal ? <BestSignalPanel signal={summary.bestSignal} /> : null}
              <DataGapsPanel gaps={summary.dataGaps} />
            </div>
          </section>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <BagMovementPanel rows={summary.clubRows} />
            <TrustLadderPanel items={summary.trustLadder} />
          </section>

          <JourneyPanel events={summary.journey} />
        </>
      )}
    </PageShell>
  );
}

type Tone = "green" | "sky" | "pink" | "amber" | "slate";

function ComparisonBar() {
  return (
    <section className="grid gap-3 rounded-lg border border-[#D9DED8] bg-white px-4 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Compared with</p>
        <p className="mt-1 font-semibold">Personal baseline</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Period</p>
        <p className="mt-1 font-semibold">All saved data</p>
      </div>
      <Tabs defaultValue="all" className="sm:justify-self-end">
        <TabsList>
          <TabsTrigger value="all">All data</TabsTrigger>
          <TabsTrigger value="30d">Last 30 days</TabsTrigger>
          <TabsTrigger value="10s">Last 10 sessions</TabsTrigger>
        </TabsList>
      </Tabs>
    </section>
  );
}

function InsightStrip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-[#D9DED8] bg-white p-4">
      <div className={cn("grid size-9 place-items-center rounded-md ring-1", toneClasses[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-6">{value}</p>
      </div>
    </div>
  );
}

function TrendCard({ trend }: { trend: ProgressTrend }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {trend.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-normal">{trend.value}</p>
        </div>
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md ring-1", toneClasses[trend.tone])}>
          <BarChart3 className="size-4" />
        </div>
      </div>
      <Sparkline points={trend.points} tone={trend.tone} />
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{trend.detail}</p>
    </div>
  );
}

function Sparkline({ points, tone }: { points: number[]; tone: Tone }) {
  if (points.length < 2) {
    return (
      <div className="mt-4 grid h-14 place-items-center rounded-md bg-slate-50 text-xs text-muted-foreground">
        More data needed
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 140;
  const height = 52;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point - min) / range) * (height - 10) - 5;

    return `${roundForSvg(x)},${roundForSvg(y)}`;
  });
  const lastPoint = coordinates[coordinates.length - 1]?.split(",").map(Number) ?? [width, height / 2];

  return (
    <svg className="mt-4 h-14 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend line">
      <line x1="0" x2={width} y1={height - 5} y2={height - 5} stroke="#E5E7EB" strokeWidth="1" />
      <polyline
        fill="none"
        points={coordinates.join(" ")}
        stroke={strokeForTone(tone)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill={strokeForTone(tone)} />
    </svg>
  );
}

function PracticePriorityCard({
  priority,
  index,
}: {
  priority: PracticePriority;
  index: number;
}) {
  return (
    <Link
      href={`/bag/${priority.clubId}/analytics`}
      prefetch={false}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline">Priority {index + 1}</Badge>
          <h2 className="mt-3 text-lg font-semibold leading-6 tracking-normal">{priority.title}</h2>
        </div>
        <StatusPill tone={priority.tone}>{priority.priorityLabel}</StatusPill>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{priority.reason}</p>
      <div className="mt-4 rounded-md bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Task</p>
        <p className="mt-1 text-sm font-medium leading-6">{priority.drill}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <StatusPill tone="slate">Coach score {priority.score}</StatusPill>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <Target className="size-4" />
          Start practice
        </span>
      </div>
    </Link>
  );
}

function CoachSummaryPanel({ groups }: { groups: CoachSummaryGroup[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Coach summary"
        description="Grouped signals so gains, warnings, and data gaps do not compete with each other."
        action={<CheckCircle2 className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title} className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full ring-4", compactToneClasses[group.tone])} />
                <h2 className="font-semibold tracking-normal">{group.title}</h2>
              </div>
              <div className="space-y-3">
                {group.items.map((item, index) => {
                  const content = (
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium leading-5">{item.label}</p>
                      {item.detail ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p> : null}
                    </div>
                  );

                  return item.clubId ? (
                    <Link key={`${group.title}-${index}`} href={`/bag/${item.clubId}/analytics`} prefetch={false} className="block hover:text-emerald-700">
                      {content}
                    </Link>
                  ) : (
                    <div key={`${group.title}-${index}`}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function BestSignalPanel({ signal }: { signal: BestSignal }) {
  const content = (
    <>
      <SectionHeader
        title={signal.title}
        description="The clearest positive movement in the current comparison."
        action={<Zap className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <p className="text-lg font-semibold leading-7">{signal.value}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
        <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
          <span className="font-semibold">Why it matters: </span>
          {signal.why}
        </div>
      </CardContent>
    </>
  );

  return signal.clubId ? (
    <Link href={`/bag/${signal.clubId}/analytics`} prefetch={false} className="block">
      <DataPanel className="transition-colors hover:border-emerald-300">{content}</DataPanel>
    </Link>
  ) : (
    <DataPanel>{content}</DataPanel>
  );
}

function DataGapsPanel({ gaps }: { gaps: DataGap[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Data gaps"
        description="Clubs that need more clean stock shots before strong conclusions."
        action={<Activity className="size-5 text-slate-500" />}
      />
      <CardContent className="space-y-3">
        {gaps.length > 0 ? (
          gaps.map((gap) => (
            <Link
              key={gap.clubId}
              href={`/bag/${gap.clubId}/analytics`}
              prefetch={false}
              className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-300"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{formatClubType(gap.clubType)}</p>
                <StatusPill tone="slate">{gap.cleanShots} clean</StatusPill>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{gap.detail}</p>
              <p className="mt-2 text-sm font-medium">{gap.recommendation}</p>
            </Link>
          ))
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-muted-foreground">
            No club is currently blocked by sample depth.
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function BagMovementPanel({ rows }: { rows: ProgressClubRow[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Bag movement"
        description="Latest clean baseline vs first clean baseline. Offline going down is good."
        action={<Table2 className="size-5 text-sky-600" />}
      />
      <CardContent>
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow>
              <TableHead>Club</TableHead>
              <TableHead>Trust</TableHead>
              <TableHead>Clean shots</TableHead>
              <TableHead>Stock carry</TableHead>
              <TableHead>Meaningful movement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.clubId}>
                <TableCell>
                  <Link href={`/bag/${row.clubId}/analytics`} prefetch={false} className="font-semibold hover:text-emerald-700">
                    {formatClubType(row.clubType)}
                  </Link>
                  <p className="mt-0.5 max-w-44 truncate text-xs text-muted-foreground">{row.brandModel}</p>
                </TableCell>
                <TableCell>
                  <StatusPill tone={row.trustIndex >= 68 ? "green" : row.trustIndex >= 62 ? "sky" : "amber"}>
                    {row.trustIndex}% trust
                  </StatusPill>
                </TableCell>
                <TableCell>{row.sampleSize}</TableCell>
                <TableCell>{formatYards(row.stockCarryYd)}</TableCell>
                <TableCell>
                  <MovementPills row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </DataPanel>
  );
}

function MovementPills({ row }: { row: ProgressClubRow }) {
  const items = movementItems(row);

  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">No meaningful movement detected</span>;
  }

  return (
    <div className="flex min-w-64 flex-wrap gap-2">
      {items.map((item) => (
        <StatusPill key={item.label} tone={item.tone}>
          {item.label}
        </StatusPill>
      ))}
    </div>
  );
}

function TrustLadderPanel({ items }: { items: TrustLadderItem[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Trust ladder"
        description="Trust considers distance, direction, strike quality, and clean-shot sample depth."
        action={<Gauge className="size-5 text-emerald-600" />}
      />
      <CardContent className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.clubId}
            href={`/bag/${item.clubId}/analytics`}
            prefetch={false}
            title="Based on distance consistency, direction, strike quality, and clean-shot sample depth."
            className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 bg-white p-3 hover:border-emerald-300"
          >
            <p className="font-semibold">{formatClubType(item.clubType)}</p>
            <div className="min-w-0">
              <Progress value={item.trustIndex ?? 8} className="h-2" />
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.note}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{item.trustIndex === null ? "--" : `${item.trustIndex}%`}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </DataPanel>
  );
}

function JourneyPanel({ events }: { events: JourneyEvent[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Journey"
        description="Dated milestones and notable movement from the current data."
        action={<Flag className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <div className="relative space-y-0 pl-5 before:absolute before:left-[0.3rem] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200">
          {events.map((event, index) => (
            <Link
              key={`${event.title}-${index}`}
              href={`/bag/${event.clubId}/analytics`}
              prefetch={false}
              className="relative block pb-5 last:pb-0"
            >
              <span className={cn("absolute -left-[1.02rem] top-1 size-3 rounded-full ring-4", compactToneClasses[event.tone])} />
              <div className="rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-300">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="slate">
                    <CalendarDays className="mr-1 size-3" />
                    {event.dateLabel}
                  </StatusPill>
                  <StatusPill tone={event.tone}>{formatClubType(event.clubType)}</StatusPill>
                </div>
                <p className="mt-3 font-semibold">{event.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function movementItems(row: ProgressClubRow) {
  const items: Array<{ label: string; tone: Tone }> = [];

  if (isMeaningful(row.carryDeltaYd, 0.5)) {
    items.push({
      label: `Carry ${formatSigned(row.carryDeltaYd)} yd`,
      tone: row.carryDeltaYd >= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.offlineDeltaYd, 0.5)) {
    items.push({
      label: `Offline ${Math.abs(row.offlineDeltaYd)} yd ${row.offlineDeltaYd <= 0 ? "tighter" : "wider"}`,
      tone: row.offlineDeltaYd <= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.ballSpeedDeltaMph, 0.3)) {
    items.push({
      label: `Ball speed ${formatSigned(row.ballSpeedDeltaMph)} mph`,
      tone: row.ballSpeedDeltaMph >= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.launchDeltaDeg, 0.3)) {
    items.push({
      label: `Launch ${formatSigned(row.launchDeltaDeg)} deg`,
      tone: "sky",
    });
  }

  return items;
}

function bagVerdict(summary: ProgressSummary) {
  if (summary.totals.trackedCleanShots === 0) {
    return "Import clean stock shots to build your first progress baseline.";
  }

  const improvingControl = summary.clubRows.some((row) => row.offlineDeltaYd !== null && row.offlineDeltaYd <= -2);
  const trustValues = summary.clubRows.filter((row) => row.sampleSize >= 3).map((row) => row.trustIndex);
  const trustSpread = trustValues.length > 1 ? Math.max(...trustValues) - Math.min(...trustValues) : 0;
  const controlClause = improvingControl ? "your control is improving" : "your comparison baseline is building";
  const trustClause = trustSpread >= 8 ? "but trust is still uneven" : "and trust is starting to stabilise";

  return `Compared with your personal baseline, ${controlClause} ${trustClause}.`;
}

function isMeaningful(value: number | null, threshold: number): value is number {
  return value !== null && Math.abs(value) >= threshold;
}

function roundForSvg(value: number) {
  return Math.round(value * 10) / 10;
}

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  slate: "bg-slate-50 text-slate-700 ring-slate-200",
};

const compactToneClasses: Record<Tone, string> = {
  green: "bg-emerald-500 ring-emerald-100",
  sky: "bg-sky-500 ring-sky-100",
  pink: "bg-pink-500 ring-pink-100",
  amber: "bg-amber-500 ring-amber-100",
  slate: "bg-slate-400 ring-slate-200",
};

function strokeForTone(tone: Tone) {
  const strokes: Record<Tone, string> = {
    green: "#0B7A3B",
    sky: "#0284C7",
    pink: "#BE185D",
    amber: "#B45309",
    slate: "#64748B",
  };

  return strokes[tone];
}

function findAnalytics(
  clubs: Array<{ clubId: string; analytics: ClubAnalytics }>,
  clubId: string,
) {
  return clubs.find((club) => club.clubId === clubId)?.analytics;
}

function improvementDetail(row: ProgressClubRow) {
  const parts = [
    row.carryDeltaYd === null ? null : `${formatSigned(row.carryDeltaYd)} yd carry`,
    row.offlineDeltaYd === null
      ? null
      : `${Math.abs(row.offlineDeltaYd)} yd ${row.offlineDeltaYd <= 0 ? "tighter" : "wider"}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : `${row.trustIndex}% trust`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}
