import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  Award,
  CalendarDays,
  ChevronDown,
  Crosshair,
  Database,
  Trophy,
  Upload,
} from "lucide-react";

import {
  ActiveFilterChips,
  DataPair,
  DataPanel,
  DataTableFrame,
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
import {
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
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
import { findRelevantChallenge } from "@/lib/challenge-relevance";
import { formatClubType } from "@/lib/club-format";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
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
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
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
  const [data, challengeData] = await Promise.all([
    getTodayPracticeData({
      date: first(params.date),
      sessionId: first(params.session),
      club: first(params.club),
    }),
    getChallengesPageData(),
  ]);
  const shotDatabaseHref = shotDatabaseLink(data);
  const chartShots = toChartShots(data.shots);
  const activeFilterChips = buildTodayFilterChips(data);

  return (
    <PageShell size="full" contentClassName="pb-4 sm:pb-5">
      <MobileAppShell className="min-h-0 pb-0">
        <MobileTopBar
          title="Dashboard"
          actions={
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full text-[#050505]">
              <Link href="/import" prefetch={false} aria-label="Import CSV">
                <Upload className="size-5" />
              </Link>
            </Button>
          }
        />
        <MobileRouteTabs group="dashboard" activeKey="today" />
        <MobileStatusAction
          label="Today’s practice"
          value="Today"
          detail={data.overall.summary}
          action={
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href={shotDatabaseHref} prefetch={false}>
                Shot rows
              </Link>
            </Button>
          }
        />
        <MobileMetricStrip
          items={[
            {
              label: "Date",
              value: data.dateLabel,
              detail: `${integerFormatter.format(data.allTodayShotCount)} shots imported that day`,
              tone: "green",
            },
            {
              label: "Selected",
              value: integerFormatter.format(data.shots.length),
              detail: `${integerFormatter.format(data.comparisonShots.length)} comparison shots`,
              tone: "sky",
            },
            {
              label: "Straight",
              value: formatRate(data.overall.today.straightRate),
              detail: deltaText(data.overall.straightRateDelta, "pp", true),
              tone: "amber",
            },
          ]}
        />
        <NativeListSection title="Today’s work" description="Filtered shot rows, charts and club scope.">
          <MobilePlayRoute
            href={shotDatabaseHref}
            title="Today"
            value={`${integerFormatter.format(data.shots.length)} selected`}
            detail="Filtered shot rows, charts and club scope."
            icon={<Database className="size-5" />}
          />
        </NativeListSection>
      </MobileAppShell>

      <div className="hidden sm:contents">
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
              View shot rows
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

      <TodayReviewHero data={data} />
      </div>

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
                className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
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

      <section
        id="scope"
        className="hidden scroll-mt-28 rounded-xl border border-[#d9ded8] bg-white px-4 py-3 shadow-sm sm:block"
      >
        <form className="grid gap-3 md:grid-cols-[auto_minmax(150px,190px)_minmax(220px,1fr)_minmax(150px,220px)_auto_auto] md:items-end">
          <div className="hidden pb-2 pr-1 text-sm font-semibold text-slate-900 md:block">
            Filters
          </div>
          <TodayScopeFields data={data} />
          <Button
            type="submit"
            className="h-10 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            Apply
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-lg">
            <Link href="/today" prefetch={false}>
              Reset
            </Link>
          </Button>
        </form>
      </section>

      {data.shots.length === 0 ? (
        <EmptyToday />
      ) : (
        <>
          <section id="charts" className="scroll-mt-28">
            <TodayShotCharts shots={chartShots} />
          </section>

          <section
            id="clubs"
            className="grid scroll-mt-28 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"
          >
            <DataPanel className="min-w-0">
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
                  className="[&_[data-slot=scroll-area-viewport]]:overflow-x-hidden [&_[data-slot=table-container]]:overflow-x-visible"
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
                          <p className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm leading-5 text-muted-foreground">
                            {comparison.summary}
                          </p>
                        </MobileDataCard>
                      ))}
                    </MobileHorizontalRail>
                  }
                >
                  <Table className="w-full" containerClassName="overflow-x-visible">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2">Club</TableHead>
                        <TableHead className="px-2">Call</TableHead>
                        <TableHead className="px-2 text-right">Shots</TableHead>
                        <TableHead className="px-2 text-right">Carry</TableHead>
                        <TableHead className="px-2 text-right">Offline</TableHead>
                        <TableHead className="px-2 text-right">Straight</TableHead>
                        <TableHead className="px-2 text-right">Playable</TableHead>
                        <TableHead className="max-w-[10.5rem] whitespace-normal px-2">
                          Signal
                        </TableHead>
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

            <StraightestShotsPanel
              shots={data.bestStraightShots}
              comparisonCount={data.clubComparisons.length}
            />
          </section>

          <section id="pbs" className="scroll-mt-28">
            <ClubMainStatsPanel stats={data.clubStats} />
          </section>

          <TodaySocialLine data={data} challenges={challengeData.active} />

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
                    Raw shot list
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {integerFormatter.format(data.shots.length)} selected shots. Expand for the source rows.
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

function TodayReviewHero({ data }: { data: TodayPracticeData }) {
  const selectedClub = selectedClubLabel(data);
  const selectedClubs = selectedClubCount(data);
  const bestShot = data.bestStraightShots[0];
  const scope = sessionScopeLabel(data);

  return (
    <section className="rounded-[20px] border border-[#d9ded8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <StatusPill tone={verdictTone(data.overall.verdict)}>
            Today’s practice
          </StatusPill>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
            Practice review
          </h1>
          <p className="mt-2 text-lg font-medium text-slate-800">
            {data.dateLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {integerFormatter.format(data.shots.length)} shots ·{" "}
            {integerFormatter.format(selectedClubs)}{" "}
            {selectedClubs === 1 ? "club" : "clubs"} · {scope}
          </p>

          <div className="mt-6 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Session verdict
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
              {data.overall.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
              {reviewNarrative(data)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white/85 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">
            Selected scope
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <ReviewScopeRow label="Club" value={selectedClub} />
            <ReviewScopeRow
              label="Selected shots"
              value={integerFormatter.format(data.shots.length)}
            />
            <ReviewScopeRow
              label="Comparison shots"
              value={integerFormatter.format(data.comparisonShots.length)}
            />
            <ReviewScopeRow
              label="Shot of the day"
              value={bestShot ? bestShotTitle(bestShot) : "--"}
            />
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReviewKpi
          label="Offline"
          value={formatYards(data.overall.today.offlineAverageYd)}
          detail={offlineDeltaText(data.overall.offlineDeltaYd)}
          tone={deltaTone(data.overall.offlineDeltaYd, "lower")}
        />
        <ReviewKpi
          label="Straight rate"
          value={formatRate(data.overall.today.straightRate)}
          detail={deltaText(data.overall.straightRateDelta, "pp", true)}
          tone={deltaTone(data.overall.straightRateDelta, "higher")}
        />
        <ReviewKpi
          label="Playable"
          value={formatRate(data.overall.today.playableRate)}
          detail={deltaText(data.overall.playableRateDelta, "pp", true)}
          tone={deltaTone(data.overall.playableRateDelta, "higher")}
        />
        <ReviewKpi
          label="Carry"
          value={formatYards(data.overall.today.carryAverageYd)}
          detail={deltaText(data.overall.carryDeltaYd, "yd", true)}
          tone={deltaTone(data.overall.carryDeltaYd, "higher")}
        />
      </div>
    </section>
  );
}

function ReviewScopeRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-40 truncate text-right font-semibold text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function ReviewKpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
}) {
  return (
    <div className="min-h-[118px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`size-2.5 rounded-full ring-4 ${reviewDotClass(tone)}`} />
      </div>
      <p className="mt-3 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
        {value}
      </p>
      <p className={reviewDeltaClass(tone)}>{detail}</p>
    </div>
  );
}

function MobilePlayRoute({
  href,
  icon,
  title,
  value,
  detail,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Link href={href} prefetch={false} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#E5E7EB] bg-white py-3">
      <span className="grid size-11 place-items-center rounded-full bg-[#F5F6F4] text-[#0B7A3B]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[#050505]">{title}</span>
        <span className="mt-1 block text-sm font-medium text-[#050505]">{value}</span>
        <span className="mt-0.5 block line-clamp-2 text-sm leading-5 text-[#6B7280]">{detail}</span>
      </span>
      <ArrowRight className="size-4 text-[#6B7280]" />
    </Link>
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

function TodaySocialLine({
  data,
  challenges,
}: {
  data: TodayPracticeData;
  challenges: ChallengeListItem[];
}) {
  if (data.shots.length === 0) {
    return null;
  }

  const bestClubRow = data.clubComparisons[0] ?? null;
  const bestClub = bestClubRow?.clubLabel ?? data.clubs[0]?.label ?? "This session";
  const bestClubType = bestClubRow?.clubType ?? data.clubs[0]?.type ?? "";
  const challenge = findRelevantChallenge(challenges, bestClubType);

  return (
    <section className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Compare this session</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {challenge
              ? `${bestClub} has ${integerFormatter.format(data.shots.length)} selected shots. Use the closest matching challenge, records, or event boards after the review.`
              : `${bestClub} has ${integerFormatter.format(data.shots.length)} selected shots. Use matching imports for relevant records, tournaments, or friend boards.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={challenge ? `/challenges/${challenge.id}` : "/feed"} prefetch={false}>
              <Trophy className="size-4" />
              {challenge ? challenge.title : "Open feed"}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/course-records" prefetch={false}>
              <Award className="size-4" />
              Records
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/tournaments" prefetch={false}>
              <Trophy className="size-4" />
              Events
            </Link>
          </Button>
        </div>
      </div>
    </section>
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
      <div
        className={
          title === "Close to PB"
            ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        }
      >
        {highlights.map((highlight) => (
          <HighlightCard key={highlight.id} highlight={highlight} />
        ))}
      </div>
    </section>
  );
}

function HighlightCard({ highlight }: { highlight: ClubHighlight }) {
  const close = highlight.kind === "close";
  const statusLabel =
    highlight.kind === "tie" ? "Tied PB" : close ? "Close" : "New PB";

  if (close) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50/45 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-200 bg-white/70 text-amber-800"
          >
            {highlight.clubLabel}
          </Badge>
          <span className="text-xs font-medium text-amber-800">
            {statusLabel}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {highlight.metricLabel}
          </p>
          <p className="shrink-0 text-lg font-semibold tracking-normal text-slate-950">
            {highlight.value}
          </p>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-700">
          {highlight.detail}
          {highlight.target ? (
            <span className="text-muted-foreground"> · {highlight.target}</span>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Badge
          variant="outline"
          className="border-emerald-200 bg-white/70 text-emerald-700"
        >
          {highlight.clubLabel}
        </Badge>
        <span className="text-xs font-medium text-emerald-700">
          {statusLabel}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        {highlight.metricLabel}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
        {highlight.value}
      </p>
      <p className="mt-1 text-sm leading-5 text-slate-700">
        {highlight.detail}
      </p>
      {highlight.target ? (
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {highlight.target}
        </p>
      ) : null}
    </div>
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
  const signalLines = buildSignalLines(comparison);

  return (
    <TableRow>
      <TableCell className="px-2 font-medium">{comparison.clubLabel}</TableCell>
      <TableCell className="px-2">
        <Badge className={verdictBadgeClass(comparison.verdict)}>
          {verdictLabel(comparison.verdict)}
        </Badge>
      </TableCell>
      <TableCell className="px-2 text-right">
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
      <TableCell
        className="max-w-[10.5rem] whitespace-normal px-2 align-top text-sm leading-snug text-muted-foreground"
        title={comparison.summary}
      >
        {signalLines.map((line, index) => (
          <span key={`${line}-${index}`} className="block">
            {line}
          </span>
        ))}
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

function buildSignalLines(comparison: ClubDayComparison) {
  const parts = [
    isNumber(comparison.offlineDeltaYd)
      ? offlineDeltaText(comparison.offlineDeltaYd)
      : null,
    isNumber(comparison.straightRateDelta)
      ? `${deltaText(comparison.straightRateDelta, "pp", true)} straight`
      : null,
    isNumber(comparison.carryDeltaYd)
      ? `${deltaText(comparison.carryDeltaYd, "yd", true)} carry`
      : null,
  ].filter(Boolean) as string[];

  if (parts.length > 0) {
    return parts.slice(0, 2);
  }

  return [comparison.summary];
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
    <TableCell className="px-2 text-right whitespace-normal">
      <div className="font-medium">
        {isRate ? formatRate(value) : formatYards(value)}
      </div>
      <div className={deltaClass(delta, direction)}>
        {deltaText(delta, unit, true)}
      </div>
    </TableCell>
  );
}

function StraightestShotsPanel({
  shots,
  comparisonCount,
}: {
  shots: TodayPracticeShot[];
  comparisonCount: number;
}) {
  const visibleShots = shots.slice(0, 5);
  const hiddenShots = shots.slice(5);
  const panelHeight = Math.max(380, 132 + comparisonCount * 48);
  const panelStyle = {
    "--shot-panel-height": `${panelHeight}px`,
  } as CSSProperties;

  return (
    <div className="min-w-0" style={panelStyle}>
      <DataPanel className="xl:h-[var(--shot-panel-height)] xl:overflow-hidden">
        <SectionHeader
          title="Shot of the day"
          description="Top 5 straightest shots by offline and start line."
          action={<Crosshair className="size-4 text-sky-600" />}
        />
        <CardContent className="mx-auto w-full max-w-md space-y-1.5 xl:mx-0 xl:max-w-none xl:max-h-[calc(var(--shot-panel-height)-5.5rem)] xl:overflow-y-auto xl:pr-2 xl:[scrollbar-gutter:stable]">
          {visibleShots.length > 0 ? (
            visibleShots.map((shot, index) => (
              <StraightShotCard
                key={shot.id}
                shot={shot}
                featured={index === 0}
              />
            ))
          ) : (
            <div className="apple-panel p-4 text-sm text-muted-foreground">
              No directional shot data for this selection.
            </div>
          )}
          {hiddenShots.length > 0 ? (
            <details className="group">
              <summary className="mt-2 flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                View all straightest shots
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 space-y-2">
                {hiddenShots.map((shot) => (
                  <StraightShotCard key={shot.id} shot={shot} />
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </DataPanel>
    </div>
  );
}

function StraightShotCard({
  shot,
  featured = false,
}: {
  shot: TodayPracticeShot;
  featured?: boolean;
}) {
  return (
    <article
      className={
        featured
          ? "rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2"
          : "rounded-lg border border-slate-200/80 bg-white px-3 py-2"
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <h4 className="text-sm font-semibold leading-tight text-slate-950">
          {formatClubType(shot.clubType)}
          {shot.shotNumber ? ` shot ${shot.shotNumber}` : ""}
        </h4>
        <Badge
          variant="outline"
          className="h-5 shrink-0 border-sky-200 bg-white px-1.5 text-[11px] font-medium text-sky-700"
        >
          {formatOfflineYards(shot.sideCarryYd)}
        </Badge>
      </div>
      <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
        {shotSessionLabel(shot)}
      </p>
      <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        <StraightShotMetric label="Carry" value={formatYards(shot.carryYd)} />
        <StraightShotMetric label="Total" value={formatYards(shot.totalYd)} />
        <StraightShotMetric
          label="Start"
          value={formatDegrees(shot.launchDirectionDeg)}
        />
        <StraightShotMetric label="Ball" value={formatMph(shot.ballSpeedMph)} />
      </dl>
    </article>
  );
}

function StraightShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1 text-xs">
      <dt className="text-[10px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="font-semibold text-slate-950">{value}</dd>
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

function reviewNarrative(data: TodayPracticeData) {
  const { verdict, offlineDeltaYd, straightRateDelta, carryDeltaYd } =
    data.overall;

  if (
    !isNumber(offlineDeltaYd) &&
    !isNumber(straightRateDelta) &&
    !isNumber(carryDeltaYd)
  ) {
    return data.overall.summary;
  }

  const intro =
    verdict === "better"
      ? "Your dispersion improved today."
      : verdict === "worse"
        ? "Today finished behind your previous baseline."
        : verdict === "mixed"
          ? "Today was a mixed session."
          : "Today is building a new baseline.";
  const parts: string[] = [];

  if (isNumber(offlineDeltaYd)) {
    parts.push(
      offlineDeltaYd <= 0
        ? `Shots finished ${numberFormatter.format(Math.abs(offlineDeltaYd))} yd closer to target on average`
        : `Shots finished ${numberFormatter.format(offlineDeltaYd)} yd farther from target on average`,
    );
  }

  if (isNumber(straightRateDelta)) {
    parts.push(
      straightRateDelta >= 0
        ? `straight-shot rate rose by ${numberFormatter.format(straightRateDelta)} percentage points`
        : `straight-shot rate fell by ${numberFormatter.format(Math.abs(straightRateDelta))} percentage points`,
    );
  }

  if (isNumber(carryDeltaYd)) {
    parts.push(
      carryDeltaYd >= 0
        ? `carry distance was up ${numberFormatter.format(carryDeltaYd)} yd`
        : `carry distance was down ${numberFormatter.format(Math.abs(carryDeltaYd))} yd`,
    );
  }

  return `${intro} ${sentenceJoin(parts)}.`;
}

function sentenceJoin(parts: string[]) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function selectedClubLabel(data: TodayPracticeData) {
  if (!data.filters.club) return "All clubs";
  return (
    data.clubs.find((club) => club.type === data.filters.club)?.label ??
    formatClubType(data.filters.club)
  );
}

function selectedClubCount(data: TodayPracticeData) {
  return new Set(data.shots.map((shot) => shot.clubType)).size;
}

function sessionScopeLabel(data: TodayPracticeData) {
  const session = data.sessions.find(
    (item) => item.id === data.filters.sessionId,
  );
  if (session) return session.label;
  return "All sessions today";
}

function reviewDotClass(tone: "green" | "sky" | "pink" | "amber" | "slate") {
  if (tone === "green") return "bg-emerald-500 ring-emerald-100";
  if (tone === "pink") return "bg-pink-500 ring-pink-100";
  if (tone === "amber") return "bg-amber-500 ring-amber-100";
  if (tone === "sky") return "bg-sky-500 ring-sky-100";
  return "bg-slate-400 ring-slate-200";
}

function reviewDeltaClass(tone: "green" | "sky" | "pink" | "amber" | "slate") {
  const color =
    tone === "green"
      ? "text-emerald-700"
      : tone === "pink"
        ? "text-pink-700"
        : tone === "amber"
          ? "text-amber-800"
          : "text-muted-foreground";
  return `mt-2 text-sm font-medium ${color}`;
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

function formatOfflineYards(value: number | null) {
  if (value === null) return "--";
  return `${numberFormatter.format(Math.abs(value))} yd offline`;
}

function shotSessionLabel(shot: TodayPracticeShot) {
  const date = shortDateFormatter.format(shot.sessionDate);

  if (shot.courseName) {
    return `${shot.courseName} · ${date}`;
  }

  if (!shot.fileName) {
    return `Range session · ${date}`;
  }

  const cleanName = shot.fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lowerName = cleanName.toLowerCase();
  const label =
    lowerName.includes("rapsodo") && lowerName.includes("range")
      ? "Range session"
      : titleCase(cleanName).slice(0, 36);

  return `${label} · ${date}`;
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

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
