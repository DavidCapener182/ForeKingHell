import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Crosshair,
  Database,
  Minus,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";

import {
  ActiveFilterChips,
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MetricCard,
  MobileAccordionSection,
  MobileFilterSheet,
  MobileDataCard,
  MobileDataList,
  MobileHorizontalRail,
  MobileSectionChips,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TodayShotCharts,
  type TodayChartShot,
} from "@/app/today/today-shot-charts";
import { formatClubType } from "@/lib/club-format";
import {
  type ClubDayComparison,
  type ClubMainStatMetric,
  type ClubMainStats,
  type TodayPracticeData,
  type TodayPracticeShot,
  getTodayPracticeData,
} from "@/lib/today-session-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");
const smashFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
});

type MetricUnit = "yd" | "mph" | "deg" | "ft" | "ratio";
type HighlightDirection = "higher" | "lower";
type HighlightKind = "record" | "tie" | "close";

type ClubHighlight = {
  id: string;
  kind: HighlightKind;
  clubLabel: string;
  metricLabel: string;
  value: string;
  detail: string;
  target?: string;
  priority: number;
  closeness: number;
};

type ClubHighlightDescriptor = {
  key: string;
  label: string;
  metric: ClubMainStatMetric;
  unit: MetricUnit;
  direction: HighlightDirection;
  closeThreshold: number;
  priority: number;
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Setup</StatusPill>}
          title="Today"
          description="Database connection required before today’s shot analysis can load."
        />
      </PageShell>
    );
  }

  const params = await searchParams;
  const data = await getTodayPracticeData({
    date: first(params.date),
    sessionId: first(params.session),
    club: first(params.club),
  });
  const shotDatabaseHref = shotDatabaseLink(data);
  const chartShots = toChartShots(data.shots);
  const activeFilterChips = buildTodayFilterChips(data);

  return (
    <PageShell size="full" contentClassName="pb-4 sm:pb-5">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowRight className="size-4 rotate-180" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={shotDatabaseHref} prefetch={false}>
              <Database className="size-4" />
              Shot rows
            </Link>
          </Button>
          <Button
            asChild
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={
          <StatusPill tone={verdictTone(data.overall.verdict)}>
            Today’s practice
          </StatusPill>
        }
        title="Today"
        description={data.overall.summary}
        visual={
          <PageArtwork variant="range" alt="" className="h-full min-h-44" />
        }
        actions={
          <Button
            asChild
            size="lg"
            className="rounded-xl bg-[#111827] text-white"
          >
            <Link href={shotDatabaseHref} prefetch={false}>
              <Database className="size-4" />
              Open filtered shots
            </Link>
          </Button>
        }
        metrics={[
          {
            label: "Date",
            value: data.dateLabel,
            detail: `${integerFormatter.format(data.allTodayShotCount)} shots imported that day`,
          },
          {
            label: "Selected shots",
            value: integerFormatter.format(data.shots.length),
            detail: `${integerFormatter.format(data.comparisonShots.length)} full comparison shots`,
          },
          {
            label: "Straight rate",
            value: formatRate(data.overall.today.straightRate),
            detail: deltaText(data.overall.straightRateDelta, "pp", true),
          },
          {
            label: "Avg offline",
            value: formatYards(data.overall.today.offlineAverageYd),
            detail: offlineDeltaText(data.overall.offlineDeltaYd),
          },
        ]}
      />

      <MobileSectionChips
        items={[
          { label: "Scope", href: "#scope" },
          { label: "Focus", href: "#focus" },
          { label: "Charts", href: "#charts" },
          { label: "Clubs", href: "#clubs" },
          { label: "Shots", href: "#shots" },
        ]}
      />

      {data.shots.length > 0 ? (
        <MobileMetricStrip
          items={[
            {
              label: "Selected",
              value: integerFormatter.format(data.shots.length),
              detail: `${integerFormatter.format(data.comparisonShots.length)} comparison`,
              tone: "green",
            },
            {
              label: "Straight",
              value: formatRate(data.overall.today.straightRate),
              detail: deltaText(data.overall.straightRateDelta, "pp", true),
              tone: verdictTone(data.overall.verdict),
            },
            {
              label: "Carry",
              value: formatYards(data.overall.today.carryAverageYd),
              detail: deltaText(data.overall.carryDeltaYd, "yd", true),
              tone: deltaTone(data.overall.carryDeltaYd, "higher"),
            },
            {
              label: "Offline",
              value: formatYards(data.overall.today.offlineAverageYd),
              detail: offlineDeltaText(data.overall.offlineDeltaYd),
              tone: deltaTone(data.overall.offlineDeltaYd, "lower"),
            },
          ]}
        />
      ) : null}

      <div id="scope" className="grid scroll-mt-28 gap-3 sm:hidden">
        <MobileFilterSheet
          label="Session scope"
          activeCount={activeFilterChips.length}
        >
          <form className="grid gap-3">
            <TodayScopeFields data={data} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="submit"
                className="rounded-lg bg-[#111827] text-white"
              >
                Analyse
              </Button>
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/today" prefetch={false}>
                  Reset
                </Link>
              </Button>
            </div>
          </form>
        </MobileFilterSheet>
        <ActiveFilterChips items={activeFilterChips} />
      </div>

      <DataPanel className="hidden sm:block">
        <SectionHeader
          title="Session scope"
          description="Date, session, and club scope."
          action={<CalendarDays className="size-5 text-emerald-600" />}
        />
        <CardContent>
          <form className="apple-panel grid gap-3 p-3 md:grid-cols-[minmax(150px,190px)_minmax(220px,1fr)_minmax(150px,220px)_auto_auto]">
            <TodayScopeFields data={data} />
            <div className="flex items-end">
              <Button
                type="submit"
                className="h-10 w-full rounded-lg bg-[#111827] text-white"
              >
                Analyse
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                asChild
                variant="outline"
                className="h-10 w-full rounded-lg"
              >
                <Link href="/today" prefetch={false}>
                  Reset
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </DataPanel>

      {data.shots.length === 0 ? (
        <EmptyToday />
      ) : (
        <>
          <section
            id="focus"
            className="hidden scroll-mt-28 gap-4 sm:grid md:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              label="Verdict"
              value={data.overall.title}
              detail={data.overall.summary}
              icon={verdictIcon(data.overall.verdict)}
              tone={verdictTone(data.overall.verdict)}
            />
            <MetricCard
              label="Carry"
              value={formatYards(data.overall.today.carryAverageYd)}
              detail={deltaText(data.overall.carryDeltaYd, "yd", true)}
              icon={Zap}
              tone={deltaTone(data.overall.carryDeltaYd, "higher")}
            />
            <MetricCard
              label="Playable"
              value={formatRate(data.overall.today.playableRate)}
              detail={deltaText(data.overall.playableRateDelta, "pp", true)}
              icon={Target}
              tone={deltaTone(data.overall.playableRateDelta, "higher")}
            />
            <MetricCard
              label="Straightest"
              value={bestShotTitle(data.bestStraightShots[0])}
              detail={bestShotDetail(data.bestStraightShots[0])}
              icon={Crosshair}
              tone="sky"
            />
          </section>

          <section id="charts" className="scroll-mt-28">
            <TodayShotCharts shots={chartShots} />
          </section>

          <section id="clubs" className="scroll-mt-28">
            <ClubMainStatsPanel stats={data.clubStats} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <DataPanel>
              <SectionHeader
                title="Club by club"
                description="Today against the latest previous shots for the same club."
                action={
                  <StatusPill tone={verdictTone(data.overall.verdict)}>
                    {data.overall.title}
                  </StatusPill>
                }
              />
              <CardContent>
                <DataTableFrame
                  mobile={
                    <MobileHorizontalRail
                      title="Club changes"
                      description="Today against the latest previous shots."
                    >
                      {data.clubComparisons.map((comparison) => (
                        <MobileDataCard
                          key={comparison.clubType}
                          title={comparison.clubLabel}
                          subtitle={`${comparison.today.shotCount}/${comparison.previous.shotCount} shots`}
                          action={
                            <Badge
                              className={verdictBadgeClass(comparison.verdict)}
                            >
                              {verdictLabel(comparison.verdict)}
                            </Badge>
                          }
                        >
                          <DataPair
                            label="Carry"
                            value={formatDeltaPair(
                              comparison.today.carryAverageYd,
                              comparison.carryDeltaYd,
                              "yd",
                              true,
                            )}
                          />
                          <DataPair
                            label="Offline"
                            value={formatDeltaPair(
                              comparison.today.offlineAverageYd,
                              comparison.offlineDeltaYd,
                              "yd",
                              false,
                            )}
                          />
                          <DataPair
                            label="Straight"
                            value={formatDeltaPair(
                              comparison.today.straightRate,
                              comparison.straightRateDelta,
                              "pp",
                              true,
                            )}
                          />
                          <p className="rounded-lg bg-slate-50/80 px-3 py-2 text-sm leading-5 text-muted-foreground">
                            {comparison.summary}
                          </p>
                        </MobileDataCard>
                      ))}
                    </MobileHorizontalRail>
                  }
                >
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Club</TableHead>
                        <TableHead>Call</TableHead>
                        <TableHead className="text-right">Shots</TableHead>
                        <TableHead className="text-right">Carry</TableHead>
                        <TableHead className="text-right">Offline</TableHead>
                        <TableHead className="text-right">Straight</TableHead>
                        <TableHead className="text-right">Playable</TableHead>
                        <TableHead>Signal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.clubComparisons.map((comparison) => (
                        <ClubComparisonRow
                          key={comparison.clubType}
                          comparison={comparison}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </DataTableFrame>
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Straightest shots"
                description="The day’s tightest start-line and side-carry results."
                action={<Crosshair className="size-5 text-sky-600" />}
              />
              <CardContent className="space-y-2">
                {data.bestStraightShots.map((shot) => (
                  <StraightShotCard key={shot.id} shot={shot} />
                ))}
              </CardContent>
            </DataPanel>
          </section>

          <MobileAccordionSection
            title="Today’s shot list"
            count={integerFormatter.format(data.shots.length)}
            description="Open for raw selected shots."
            className="scroll-mt-28"
          >
            <MobileDataList>
              {data.shots.map((shot) => (
                <MobileDataCard
                  key={shot.id}
                  title={`${formatClubType(shot.clubType)} ${formatYards(shot.carryYd)} carry`}
                  subtitle={shot.fileName ?? shot.courseName ?? "Session"}
                  action={
                    <Badge variant="outline">
                      {formatShotCategory(shot.shotCategory)}
                    </Badge>
                  }
                >
                  <DataPair label="Shot" value={shot.shotNumber ?? "--"} />
                  <DataPair label="Total" value={formatYards(shot.totalYd)} />
                  <DataPair
                    label="Side"
                    value={formatSignedYards(shot.sideCarryYd)}
                  />
                </MobileDataCard>
              ))}
            </MobileDataList>
          </MobileAccordionSection>

          <DataPanel id="shots" className="hidden scroll-mt-28 overflow-hidden sm:block">
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-transparent px-6 py-5 transition-colors hover:bg-slate-50/70 group-open:border-border [&::-webkit-details-marker]:hidden">
                <div>
                  <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">
                    Today’s shot list
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Only the selected day, session, and club.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill tone="slate">
                    {integerFormatter.format(data.shots.length)} shots
                  </StatusPill>
                  <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <CardContent>
                <DataTableFrame
                  mobile={
                    <MobileDataList>
                      {data.shots.map((shot) => (
                        <MobileDataCard
                          key={shot.id}
                          title={`${formatClubType(shot.clubType)} ${formatYards(shot.carryYd)} carry`}
                          subtitle={shot.fileName ?? shot.courseName ?? "Session"}
                          action={
                            <Badge variant="outline">
                              {formatShotCategory(shot.shotCategory)}
                            </Badge>
                          }
                        >
                          <DataPair
                            label="Shot"
                            value={shot.shotNumber ?? "--"}
                          />
                          <DataPair
                            label="Total"
                            value={formatYards(shot.totalYd)}
                          />
                          <DataPair
                            label="Side"
                            value={formatSignedYards(shot.sideCarryYd)}
                          />
                          <DataPair
                            label="Start"
                            value={formatDegrees(shot.launchDirectionDeg)}
                          />
                          <DataPair
                            label="Launch"
                            value={formatDegrees(shot.launchAngleDeg)}
                          />
                          <DataPair
                            label="Ball"
                            value={formatMph(shot.ballSpeedMph)}
                          />
                          <DataPair
                            label="Smash"
                            value={formatNumber(shot.smashFactor)}
                          />
                        </MobileDataCard>
                      ))}
                    </MobileDataList>
                  }
                >
                  <Table className="min-w-[1040px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead className="text-right">Shot</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Carry</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Side</TableHead>
                        <TableHead className="text-right">Start</TableHead>
                        <TableHead className="text-right">Launch</TableHead>
                        <TableHead className="text-right">Ball</TableHead>
                        <TableHead className="text-right">Smash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.shots.map((shot) => (
                        <TableRow key={shot.id}>
                          <TableCell className="max-w-52 truncate">
                            {shot.fileName ?? shot.courseName ?? "Session"}
                          </TableCell>
                          <TableCell className="text-right">
                            {shot.shotNumber ?? "--"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatClubType(shot.clubType)}
                          </TableCell>
                          <TableCell>
                            {formatShotCategory(shot.shotCategory)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatYards(shot.carryYd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatYards(shot.totalYd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatSignedYards(shot.sideCarryYd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDegrees(shot.launchDirectionDeg)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDegrees(shot.launchAngleDeg)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMph(shot.ballSpeedMph)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(shot.smashFactor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DataTableFrame>
              </CardContent>
            </details>
          </DataPanel>
        </>
      )}
    </PageShell>
  );
}

function TodayScopeFields({ data }: { data: TodayPracticeData }) {
  return (
    <>
      <label className="grid gap-1 text-sm font-medium">
        Date
        <input
          type="date"
          name="date"
          defaultValue={data.dateKey}
          className="h-10 rounded-lg border bg-white/90 px-3 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Session
        <select
          name="session"
          defaultValue={data.filters.sessionId}
          className="h-10 rounded-lg border bg-white/90 px-3 text-sm"
        >
          <option value="">All sessions today</option>
          {data.sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.label} ({session.shotCount})
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Club
        <select
          name="club"
          defaultValue={data.filters.club}
          className="h-10 rounded-lg border bg-white/90 px-3 text-sm"
        >
          <option value="">All clubs</option>
          {data.clubs.map((club) => (
            <option key={club.type} value={club.type}>
              {club.label} ({club.shotCount})
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function EmptyToday() {
  return (
    <DataPanel>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <CalendarDays className="size-9 text-emerald-500" />
        <div>
          <p className="text-xl font-semibold">No shots for this selection</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Import a Rapsodo CSV for the day, or clear the session and club
            filters.
          </p>
        </div>
        <Button
          asChild
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" />
            Import CSV
          </Link>
        </Button>
      </CardContent>
    </DataPanel>
  );
}

function ClubMainStatsPanel({ stats }: { stats: ClubMainStats[] }) {
  const highlights = buildClubHighlights(stats);
  const records = highlights.filter((highlight) => highlight.kind !== "close");
  const closeCalls = highlights
    .filter((highlight) => highlight.kind === "close")
    .slice(0, 6);

  return (
    <DataPanel>
      <SectionHeader
        title="PB highlights"
        description="Records and near misses from the selected today shots."
        action={<Trophy className="size-5 text-amber-600" />}
      />
      <CardContent className="space-y-5">
        {stats.length === 0 || highlights.length === 0 ? (
          <div className="apple-panel p-4 text-sm text-muted-foreground">
            No PBs or close calls for this selection.
          </div>
        ) : (
          <>
            {records.length > 0 ? (
              <HighlightGroup title="PBs today" highlights={records} />
            ) : null}
            {closeCalls.length > 0 ? (
              <HighlightGroup title="Close to PB" highlights={closeCalls} />
            ) : null}
          </>
        )}
      </CardContent>
    </DataPanel>
  );
}

function HighlightGroup({
  title,
  highlights,
}: {
  title: string;
  highlights: ClubHighlight[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
          {title}
        </h3>
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-700"
        >
          {highlights.length}
        </Badge>
      </div>
      <CompactReadoutGrid
        columnsClassName="md:grid-cols-2 xl:grid-cols-3"
        items={highlights.map((highlight) => ({
          label: highlight.clubLabel,
          value: `${highlight.metricLabel}: ${highlight.value}`,
          detail: highlight.target
            ? `${highlight.detail} ${highlight.target}`
            : highlight.detail,
          tone: highlightTone(highlight.kind),
        }))}
      />
    </section>
  );
}

function buildClubHighlights(stats: ClubMainStats[]) {
  return stats
    .flatMap((stat) =>
      statHighlightDescriptors(stat).flatMap((descriptor) =>
        buildMetricHighlights(stat, descriptor),
      ),
    )
    .sort(
      (left, right) =>
        left.priority - right.priority || left.closeness - right.closeness,
    );
}

function highlightTone(kind: HighlightKind) {
  return kind === "record" ? "green" : kind === "tie" ? "sky" : "amber";
}

function statHighlightDescriptors(
  stat: ClubMainStats,
): ClubHighlightDescriptor[] {
  return [
    {
      key: "total",
      label: "Longest total",
      metric: stat.totalYd,
      unit: "yd",
      direction: "higher",
      closeThreshold: 5,
      priority: 1,
    },
    {
      key: "carry",
      label: "Carry PB",
      metric: stat.carryYd,
      unit: "yd",
      direction: "higher",
      closeThreshold: 5,
      priority: 2,
    },
    {
      key: "ball-speed",
      label: "Ball speed PB",
      metric: stat.ballSpeedMph,
      unit: "mph",
      direction: "higher",
      closeThreshold: 2,
      priority: 3,
    },
    {
      key: "club-speed",
      label: "Club speed PB",
      metric: stat.clubSpeedMph,
      unit: "mph",
      direction: "higher",
      closeThreshold: 2,
      priority: 4,
    },
    {
      key: "smash",
      label: "Smash PB",
      metric: stat.smashFactor,
      unit: "ratio",
      direction: "higher",
      closeThreshold: 0.03,
      priority: 5,
    },
    {
      key: "offline",
      label: "Straightest shot",
      metric: stat.offlineYd,
      unit: "yd",
      direction: "lower",
      closeThreshold: 2,
      priority: 6,
    },
  ];
}

function buildMetricHighlights(
  stat: ClubMainStats,
  descriptor: ClubHighlightDescriptor,
): ClubHighlight[] {
  const { metric, direction, unit } = descriptor;
  if (metric.bestStatus === "new" || metric.bestStatus === "tied") {
    return [
      {
        id: `${stat.clubType}-${descriptor.key}-${metric.bestStatus}`,
        kind: metric.bestStatus === "new" ? "record" : "tie",
        clubLabel: stat.clubLabel,
        metricLabel: descriptor.label,
        value: formatMetricValue(metric.todayBest, unit),
        detail: recordDetail(metric, direction, unit),
        priority: descriptor.priority,
        closeness: 0,
      },
    ];
  }

  const gap = gapToBest(metric, direction);
  if (gap === null || gap <= 0 || gap > descriptor.closeThreshold) {
    return [];
  }

  if (
    direction === "lower" &&
    isNumber(metric.allTimeBest) &&
    metric.allTimeBest <= 0
  ) {
    return [];
  }

  return [
    {
      id: `${stat.clubType}-${descriptor.key}-close`,
      kind: "close",
      clubLabel: stat.clubLabel,
      metricLabel: descriptor.label,
      value: formatMetricValue(metric.todayBest, unit),
      detail: `${formatMetricValue(gap, unit)} ${direction === "higher" ? "short of" : "away from"} your PB.`,
      target: `Target: ${formatMetricValue(metric.allTimeBest, unit)}`,
      priority: 20 + descriptor.priority,
      closeness: gap / descriptor.closeThreshold,
    },
  ];
}

function recordDetail(
  metric: ClubMainStatMetric,
  direction: HighlightDirection,
  unit: MetricUnit,
) {
  if (metric.bestStatus === "tied") {
    return "Tied your previous best.";
  }

  const improvement = improvementOverPrevious(metric, direction);
  if (improvement === null) {
    return "New tracked best.";
  }

  const betterText = direction === "higher" ? "better than" : "tighter than";
  return `${formatMetricValue(improvement, unit)} ${betterText} your previous best.`;
}

function gapToBest(metric: ClubMainStatMetric, direction: HighlightDirection) {
  if (!isNumber(metric.todayBest) || !isNumber(metric.allTimeBest)) {
    return null;
  }

  const gap =
    direction === "higher"
      ? metric.allTimeBest - metric.todayBest
      : metric.todayBest - metric.allTimeBest;
  return Math.round(gap * 100) / 100;
}

function improvementOverPrevious(
  metric: ClubMainStatMetric,
  direction: HighlightDirection,
) {
  if (!isNumber(metric.todayBest) || !isNumber(metric.previousBest)) {
    return null;
  }

  const improvement =
    direction === "higher"
      ? metric.todayBest - metric.previousBest
      : metric.previousBest - metric.todayBest;
  return improvement > 0 ? Math.round(improvement * 100) / 100 : null;
}

function ClubComparisonRow({ comparison }: { comparison: ClubDayComparison }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{comparison.clubLabel}</TableCell>
      <TableCell>
        <Badge className={verdictBadgeClass(comparison.verdict)}>
          {verdictLabel(comparison.verdict)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {comparison.today.shotCount}
        <span className="text-muted-foreground">
          /{comparison.previous.shotCount}
        </span>
      </TableCell>
      <MetricDeltaCell
        value={comparison.today.carryAverageYd}
        delta={comparison.carryDeltaYd}
        unit="yd"
        direction="higher"
      />
      <MetricDeltaCell
        value={comparison.today.offlineAverageYd}
        delta={comparison.offlineDeltaYd}
        unit="yd"
        direction="lower"
      />
      <MetricDeltaCell
        value={comparison.today.straightRate}
        delta={comparison.straightRateDelta}
        unit="pp"
        direction="higher"
        isRate
      />
      <MetricDeltaCell
        value={comparison.today.playableRate}
        delta={comparison.playableRateDelta}
        unit="pp"
        direction="higher"
        isRate
      />
      <TableCell className="max-w-80 text-sm text-muted-foreground">
        {comparison.summary}
      </TableCell>
    </TableRow>
  );
}

function formatDeltaPair(
  value: number | null,
  delta: number | null,
  unit: "yd" | "pp",
  higherIsGood: boolean,
) {
  const direction = higherIsGood ? "higher" : "lower";

  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span>{unit === "pp" ? formatRate(value) : formatYards(value)}</span>
      <span className={deltaClass(delta, direction)}>
        {deltaText(delta, unit, true)}
      </span>
    </span>
  );
}

function MetricDeltaCell({
  value,
  delta,
  unit,
  direction,
  isRate = false,
}: {
  value: number | null;
  delta: number | null;
  unit: "yd" | "pp";
  direction: "higher" | "lower";
  isRate?: boolean;
}) {
  return (
    <TableCell className="text-right">
      <div className="font-medium">
        {isRate ? formatRate(value) : formatYards(value)}
      </div>
      <div className={deltaClass(delta, direction)}>
        {deltaText(delta, unit, true)}
      </div>
    </TableCell>
  );
}

function StraightShotCard({ shot }: { shot: TodayPracticeShot }) {
  return (
    <div className="apple-panel-strong p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {formatClubType(shot.clubType)}{" "}
            {shot.shotNumber ? `shot ${shot.shotNumber}` : ""}
          </p>
          <p className="mt-0.5 max-w-72 truncate text-sm text-muted-foreground">
            {shot.fileName ?? shot.courseName ?? "Today"}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-sky-200 bg-sky-50 text-sky-700"
        >
          {formatSignedYards(shot.sideCarryYd)}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
        <MiniMetric label="Carry" value={formatYards(shot.carryYd)} />
        <MiniMetric label="Total" value={formatYards(shot.totalYd)} />
        <MiniMetric
          label="Start"
          value={formatDegrees(shot.launchDirectionDeg)}
        />
        <MiniMetric label="Ball" value={formatMph(shot.ballSpeedMph)} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function shotDatabaseLink(data: TodayPracticeData) {
  const params = new URLSearchParams({
    from: data.dateKey,
    to: data.dateKey,
  });

  if (data.filters.sessionId) {
    params.set("sessionId", data.filters.sessionId);
  }

  if (data.filters.club) {
    params.set("club", data.filters.club);
  }

  return `/shots?${params.toString()}`;
}

function buildTodayFilterChips(data: TodayPracticeData) {
  const chips: Array<{ label: string; href: string }> = [
    { label: data.dateLabel, href: "/today" },
  ];
  const session = data.sessions.find(
    (item) => item.id === data.filters.sessionId,
  );
  const club = data.clubs.find((item) => item.type === data.filters.club);

  if (session) {
    chips.push({
      label: `${session.label} x`,
      href: todayFilterHref(data, "session"),
    });
  }

  if (club) {
    chips.push({
      label: `${club.label} x`,
      href: todayFilterHref(data, "club"),
    });
  }

  return chips;
}

function todayFilterHref(data: TodayPracticeData, omitKey: "session" | "club") {
  const params = new URLSearchParams({ date: data.dateKey });

  if (omitKey !== "session" && data.filters.sessionId) {
    params.set("session", data.filters.sessionId);
  }

  if (omitKey !== "club" && data.filters.club) {
    params.set("club", data.filters.club);
  }

  return `/today?${params.toString()}`;
}

function toChartShots(shots: TodayPracticeShot[]): TodayChartShot[] {
  return shots.map((shot) => ({
    id: shot.id,
    clubType: shot.clubType,
    clubLabel: formatClubType(shot.clubType),
    shotNumber: shot.shotNumber,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    apexFt: shot.apexFt,
    launchAngleDeg: shot.launchAngleDeg,
    ballSpeedMph: shot.ballSpeedMph,
  }));
}

function verdictIcon(verdict: TodayPracticeData["overall"]["verdict"]) {
  if (verdict === "better") return TrendingUp;
  if (verdict === "worse") return TrendingDown;
  if (verdict === "mixed") return Minus;
  return CalendarDays;
}

function verdictTone(verdict: TodayPracticeData["overall"]["verdict"]) {
  if (verdict === "better") return "green";
  if (verdict === "worse") return "pink";
  if (verdict === "mixed") return "amber";
  return "slate";
}

function deltaTone(value: number | null, direction: "higher" | "lower") {
  if (value === null) return "slate";
  if (value === 0) return "amber";
  const isGood = direction === "higher" ? value > 0 : value < 0;
  return isGood ? "green" : "pink";
}

function verdictBadgeClass(verdict: ClubDayComparison["verdict"]) {
  if (verdict === "better")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (verdict === "worse")
    return "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-50";
  if (verdict === "mixed")
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50";
  return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function verdictLabel(verdict: ClubDayComparison["verdict"]) {
  if (verdict === "better") return "Better";
  if (verdict === "worse") return "Worse";
  if (verdict === "mixed") return "Mixed";
  return "Baseline";
}

function deltaClass(value: number | null, direction: "higher" | "lower") {
  const tone = deltaTone(value, direction);
  const color =
    tone === "green"
      ? "text-emerald-700"
      : tone === "pink"
        ? "text-pink-700"
        : "text-muted-foreground";
  return `text-xs ${color}`;
}

function deltaText(
  value: number | null,
  unit: "yd" | "mph" | "pp",
  showNoBaseline = false,
) {
  if (value === null) return showNoBaseline ? "No baseline" : "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)} ${unit}`;
}

function offlineDeltaText(value: number | null) {
  if (value === null) return "No baseline";
  if (value === 0) return "same as previous";
  return value < 0
    ? `${numberFormatter.format(Math.abs(value))} yd straighter`
    : `${numberFormatter.format(value)} yd wider`;
}

function bestShotTitle(shot: TodayPracticeShot | undefined) {
  if (!shot) return "--";
  return `${formatClubType(shot.clubType)} ${shot.shotNumber ? `#${shot.shotNumber}` : ""}`;
}

function bestShotDetail(shot: TodayPracticeShot | undefined) {
  if (!shot) return "Need directional data";
  return `${formatSignedYards(shot.sideCarryYd)} side, ${formatYards(shot.carryYd)} carry`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatSignedYards(value: number | null) {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)} yd`;
}

function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function formatMetricValue(value: number | null, unit: MetricUnit) {
  if (value === null) return "--";
  return `${formatMetricNumber(value, unit)}${metricUnitSuffix(unit)}`;
}

function formatMetricNumber(value: number, unit: MetricUnit) {
  return unit === "ratio"
    ? smashFormatter.format(value)
    : numberFormatter.format(value);
}

function metricUnitSuffix(unit: MetricUnit) {
  if (unit === "yd") return " yd";
  if (unit === "mph") return " mph";
  if (unit === "deg") return "°";
  if (unit === "ft") return " ft";
  return "";
}

function formatDegrees(value: number | null) {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}°`;
}

function formatNumber(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatShotCategory(value: string | null) {
  if (!value) return "--";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
