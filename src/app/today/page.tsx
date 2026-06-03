import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Award,
  CalendarDays,
  ChevronDown,
  Crosshair,
  Database,
  Dumbbell,
  Flag,
  Gauge,
  Route,
  ShieldCheck,
  Target,
  Trophy,
  Upload,
} from "lucide-react";

import {
  ActiveFilterChips,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
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
  type TodayChartClubStatus,
  type TodayChartShot,
} from "@/app/today/today-shot-charts";
import { ClubArtwork } from "@/components/visuals/club-artwork";
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
type ClubSort = "bag" | "best" | "worst";
type ReviewTone = "green" | "sky" | "pink" | "amber" | "slate";

type ClubHighlight = {
  id: string;
  kind: HighlightKind;
  clubType: string;
  clubLabel: string;
  clubBrand: string | null;
  clubModel: string | null;
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

type PracticeScoreSummary = {
  score: number;
  tone: ReviewTone;
  strong: string;
  weak: string;
  recommendation: string;
  trend: string;
};

type WhatChangedItem = {
  label: string;
  value: string;
  detail: string;
  tone: ReviewTone;
  priority: number;
};

type SessionImpactItem = {
  clubLabel: string;
  value: number | null;
  detail: string;
  tone: ReviewTone;
};

type ConfidenceChangeItem = {
  clubLabel: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  tone: ReviewTone;
};

type DriverHealthSummary = {
  path: number | null;
  targetPath: number;
  startLine: number | null;
  faceToPath: number | null;
  status: string;
  detail: string;
  tone: ReviewTone;
};

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Setup</StatusPill>}
          title="Latest Practice Review"
          description="Database connection required before the latest practice review can load."
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
  const chartClubStatuses = toChartClubStatuses(data.clubComparisons);
  const chartPatternInsight = shotPatternInsight(data);
  const clubSort = parseClubSort(first(params.clubSort));
  const sortedClubComparisons = sortClubComparisons(data.clubComparisons, clubSort);
  const activeFilterChips = buildTodayFilterChips(data);

  return (
    <PageShell size="full" className="today-review-page" contentClassName="pb-4 sm:pb-5">
      <TodayHoverStyles comparisons={data.clubComparisons} />
      <MobileAppShell className="min-h-0 pb-0">
        <MobileTopBar
          title="Today"
          actions={
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-[#050505]"
            >
              <Link href="/import" prefetch={false} aria-label="Import CSV">
                <Upload className="size-5" />
              </Link>
            </Button>
          }
        />
        <MobileRouteTabs group="dashboard" activeKey="today" />
        <MobileStatusAction
          label="Latest practice"
          value={data.overall.title}
          detail={reviewNarrative(data)}
          action={
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href={shotDatabaseHref} prefetch={false}>
                Shot rows
              </Link>
            </Button>
          }
        />
        <TodayMobileVerdictCard data={data} />
        <TodayPrescriptionCard data={data} shotDatabaseHref={shotDatabaseHref} />
        <TodayPracticeModePanel data={data} shotDatabaseHref={shotDatabaseHref} />
        <MobileMetricStrip
          items={[
            {
              label: "Offline",
              value: formatYards(data.overall.today.offlineAverageYd),
              detail: offlineDeltaText(data.overall.offlineDeltaYd),
              tone: deltaTone(data.overall.offlineDeltaYd, "lower"),
            },
            {
              label: "Straight",
              value: formatRate(data.overall.today.straightRate),
              detail: deltaText(data.overall.straightRateDelta, "pp", true),
              tone: deltaTone(data.overall.straightRateDelta, "higher"),
            },
            {
              label: "Playable",
              value: formatRate(data.overall.today.playableRate),
              detail: deltaText(data.overall.playableRateDelta, "pp", true),
              tone: deltaTone(data.overall.playableRateDelta, "higher"),
            },
            {
              label: "Carry",
              value: formatYards(data.overall.today.carryAverageYd),
              detail: deltaText(data.overall.carryDeltaYd, "yd", true),
              tone: deltaTone(data.overall.carryDeltaYd, "higher"),
            },
          ]}
        />
        <MobileAccordionSection
          title="Shot of the day"
          count={data.bestStraightShots[0] ? "1 shot" : "Waiting"}
          description="A compact visual check, kept below the prescription."
        >
          <HeroShotSpotlight shot={data.bestStraightShots[0]} />
        </MobileAccordionSection>
        <NativeListSection
          title="Latest practice work"
          description="Filtered shot rows, charts and club scope."
        >
          <MobilePlayRoute
            href={shotDatabaseHref}
            title="Latest review"
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
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </div>
        </div>

        <TodayReviewHero data={data} />
        <TodayPracticeModePanel data={data} shotDatabaseHref={shotDatabaseHref} />
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

      <div id="scope" className="grid scroll-mt-28 gap-3 sm:hidden">
        <details className="group rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-semibold text-[#050505]">Session scope</span>
              <span className="mt-0.5 block text-xs text-[#6B7280]">
                Refine the current review without leaving the page.
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              {activeFilterChips.length > 0 ? (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[11px]">
                  {activeFilterChips.length}
                </Badge>
              ) : null}
              <ChevronDown className="size-4 text-[#6B7280] transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <form className="grid gap-3 border-t border-[#E5E7EB] p-3">
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
        </details>
        <ActiveFilterChips items={activeFilterChips} />
      </div>

      <section
        id="scope"
        className="hidden scroll-mt-28 rounded-xl border border-[#d9ded8] bg-white px-3 py-2 shadow-sm sm:block"
      >
        <form className="grid gap-2 md:grid-cols-[auto_minmax(150px,190px)_minmax(220px,1fr)_minmax(150px,220px)_auto_auto] md:items-end">
          <div className="hidden pb-2 pr-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground md:block">
            Filters
          </div>
          <TodayScopeFields data={data} />
          <Button
            type="submit"
            className="h-9 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            Apply
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-9 rounded-lg text-muted-foreground hover:text-slate-950"
          >
            <Link href="/today" prefetch={false}>
              Reset
            </Link>
          </Button>
        </form>
      </section>

      {data.shots.length > 0 ? (
        <section id="focus" className="hidden scroll-mt-28 sm:block">
          <TodayPracticePrescription data={data} />
        </section>
      ) : null}

      {data.shots.length === 0 ? (
        <EmptyToday />
      ) : (
        <>
          <section id="charts" className="scroll-mt-28">
            <div className="sm:hidden">
              <MobileAccordionSection
                title="Charts"
                count={`${integerFormatter.format(chartShots.length)} shots`}
                description="Dispersion and trajectory stay available without pushing the prescription down."
              >
                <TodayShotCharts
                  shots={chartShots}
                  clubStatuses={chartClubStatuses}
                  patternInsight={chartPatternInsight}
                />
              </MobileAccordionSection>
            </div>
            <div className="hidden sm:block">
              <TodayShotCharts
                shots={chartShots}
                clubStatuses={chartClubStatuses}
                patternInsight={chartPatternInsight}
              />
            </div>
          </section>

          <section id="clubs" className="scroll-mt-28">
            <ClubPerformancePanel data={data} comparisons={sortedClubComparisons} sort={clubSort} />
          </section>

          <section id="pbs" className="scroll-mt-28">
            <TodayHighlightsPanel
              stats={data.clubStats}
              shots={data.shots}
              bestStraightShots={data.bestStraightShots}
            />
          </section>

          <TodaySocialLine data={data} challenges={challengeData.active} />

          <MobileAccordionSection
            title="Latest practice shot list"
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
                  action={<Badge variant="outline">{formatShotCategory(shot.shotCategory)}</Badge>}
                >
                  <DataPair label="Shot" value={shot.shotNumber ?? "--"} />
                  <DataPair label="Total" value={formatYards(shot.totalYd)} />
                  <DataPair label="Side" value={formatSignedYards(shot.sideCarryYd)} />
                </MobileDataCard>
              ))}
            </MobileDataList>
          </MobileAccordionSection>

          <DataPanel id="shots" className="hidden scroll-mt-28 overflow-hidden sm:block">
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-transparent px-4 py-3 transition-colors hover:bg-slate-50/70 group-open:border-border [&::-webkit-details-marker]:hidden">
                <div>
                  <h2 className="text-lg font-semibold tracking-normal">Raw shot list</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {integerFormatter.format(data.shots.length)} selected shots · inspect source
                    rows and shot-level details.
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
                            <Badge variant="outline">{formatShotCategory(shot.shotCategory)}</Badge>
                          }
                        >
                          <DataPair label="Shot" value={shot.shotNumber ?? "--"} />
                          <DataPair label="Total" value={formatYards(shot.totalYd)} />
                          <DataPair label="Side" value={formatSignedYards(shot.sideCarryYd)} />
                          <DataPair label="Start" value={formatDegrees(shot.launchDirectionDeg)} />
                          <DataPair label="Launch" value={formatDegrees(shot.launchAngleDeg)} />
                          <DataPair label="Ball" value={formatMph(shot.ballSpeedMph)} />
                          <DataPair label="Smash" value={formatNumber(shot.smashFactor)} />
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
                          <TableCell className="text-right">{shot.shotNumber ?? "--"}</TableCell>
                          <TableCell className="font-medium">
                            {formatClubType(shot.clubType)}
                          </TableCell>
                          <TableCell>{formatShotCategory(shot.shotCategory)}</TableCell>
                          <TableCell className="text-right">{formatYards(shot.carryYd)}</TableCell>
                          <TableCell className="text-right">{formatYards(shot.totalYd)}</TableCell>
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

function TodayPrescriptionCard({
  data,
  shotDatabaseHref,
}: {
  data: TodayPracticeData;
  shotDatabaseHref: string;
}) {
  const focus = practiceFocus(data);

  return (
    <section
      id="focus"
      className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 sm:hidden"
    >
      <div>
        <p className="text-sm font-semibold text-[#0B7A3B]">Latest practice prescription</p>
        <h2 className="mt-1 text-2xl font-semibold leading-7 tracking-normal text-[#050505]">
          {data.shots.length > 0 ? `Tighten ${focus.clubText}` : "Import a practice session"}
        </h2>
        <p className="mt-2 text-sm leading-5 text-[#6B7280]">
          {data.shots.length > 0
            ? focus.problem
            : "A fresh import unlocks filtered shots, club deltas, PBs and a practice prescription."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" data-primary-action>
        <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href={data.shots.length > 0 ? shotDatabaseHref : "/import"} prefetch={false}>
            {data.shots.length > 0 ? "Open shots" : "Import"}
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-lg">
          <Link href={data.shots.length > 0 ? "/coach" : "/rapsodo"} prefetch={false}>
            {data.shots.length > 0 ? "Start drill" : "Connect"}
          </Link>
        </Button>
      </div>
    </section>
  );
}

function TodayMobileVerdictCard({ data }: { data: TodayPracticeData }) {
  const score = practiceScoreSummary(data);
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);

  return (
    <section
      id="verdict"
      className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm sm:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            Session verdict
          </p>
          <h2 className="mt-1 text-3xl font-semibold leading-8 tracking-normal text-[#050505]">
            {data.overall.title}
          </h2>
        </div>
        <div className="shrink-0 rounded-lg border border-[#DDE7DF] bg-[#F5F9F6] px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B7A3B]">
            Score
          </p>
          <p className="text-2xl font-semibold leading-none tracking-normal text-[#050505]">
            {score.score}
          </p>
          <p className="text-[11px] font-medium text-[#6B7280]">/100</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MobileVerdictMetric
          label="Strength"
          value={best?.clubLabel ?? score.strong}
          tone="green"
        />
        <MobileVerdictMetric label="Weakness" value={work?.clubLabel ?? score.weak} tone="pink" />
        <MobileVerdictMetric label="Trend" value={score.trend} tone={score.tone} />
      </div>
      <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold leading-5 text-emerald-950">
        Recommendation: {score.recommendation}
      </p>
    </section>
  );
}

function MobileVerdictMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: ReviewTone;
}) {
  return (
    <div className={`min-h-20 rounded-lg border px-2.5 py-2 ${verdictCardClass(tone)}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-[#050505]">{value}</p>
    </div>
  );
}

type PracticeCardStatus = "ready" | "needed" | "optional";
type PracticeCardTone = "green" | "sky" | "pink" | "amber" | "slate";
type PracticeIllustrationKind =
  | "target"
  | "golfer"
  | "clipboard"
  | "progress"
  | "flag"
  | "share"
  | "alert"
  | "aim"
  | "club";

type PracticeFlowStep = {
  title: string;
  detail: string;
  href?: string;
  status: PracticeCardStatus;
  icon: PracticeIllustrationKind;
};

function TodayPracticeModePanel({
  data,
  shotDatabaseHref,
}: {
  data: TodayPracticeData;
  shotDatabaseHref: string;
}) {
  const hasShots = data.shots.length > 0;
  const steps: PracticeFlowStep[] = [
    {
      title: hasShots ? "Start drill" : "Upload CSV",
      detail: hasShots ? "Use the current focus as the first drill." : "Bring in a Rapsodo CSV.",
      href: hasShots ? "/coach" : "/import",
      status: "ready",
      icon: hasShots ? "golfer" : "clipboard",
    },
    {
      title: "Record/import shots",
      detail: "Add the next batch against the same club scope.",
      href: "/import",
      status: hasShots ? "ready" : "needed",
      icon: "clipboard",
    },
    {
      title: "Review result",
      detail: "Open filtered shots and compare the new pattern.",
      href: shotDatabaseHref,
      status: hasShots ? "ready" : "needed",
      icon: "progress",
    },
    {
      title: "Mark complete",
      detail: "Treat the session as done once the signal improves.",
      status: "optional",
      icon: "flag",
    },
    {
      title: "Share optional",
      detail: "Only post PBs, records or challenge results after proof is clear.",
      href: "/feed",
      status: "optional",
      icon: "share",
    },
  ];

  return (
    <DataPanel className="border-[#d9ded8] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between lg:px-5 lg:py-5">
        <div className="flex min-w-0 gap-3">
          <PracticeCardIllustration kind="target" tone="green" size="sm" />
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight tracking-normal text-slate-950">
              Practice mode
            </h2>
            <p className="mt-1 max-w-5xl text-sm font-medium leading-5 text-slate-600 sm:text-base">
              Turn the latest review into a short loop: do the drill, capture the next shots, then
              compare the result before sharing anything.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="h-11 rounded-lg bg-[#0B7A3B] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(11,122,59,0.22)] hover:bg-[#064E3B]"
        >
          <Link href={hasShots ? "/coach" : "/import"} prefetch={false}>
            {hasShots ? "Start drill" : "Import shots"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-2.5 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5 lg:px-5 lg:pb-5">
        {steps.map((step, index) => {
          const card = <PracticeStepCard step={step} index={index} />;

          return step.href ? (
            <Link key={step.title} href={step.href} prefetch={false} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={step.title} className="h-full">
              {card}
            </div>
          );
        })}
      </div>
    </DataPanel>
  );
}

function PracticeStepCard({ step, index }: { step: PracticeFlowStep; index: number }) {
  const visualTone =
    step.status === "ready" ? "green" : step.status === "needed" ? "amber" : "slate";

  return (
    <article
      className={`grid h-full min-h-32 content-start gap-3 rounded-lg border bg-white p-3 text-sm transition-colors hover:border-emerald-200 ${practiceStepCardClass(
        step.status,
      )}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={practiceStepNumberClass(step.status)}>{index + 1}</span>
        <PracticeStepStatus status={step.status} />
      </div>
      <div className="flex items-center gap-3">
        <PracticeCardIllustration kind={step.icon} tone={visualTone} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-5 text-slate-950">{step.title}</p>
          <p className="mt-1 leading-5 text-slate-600">{step.detail}</p>
        </div>
      </div>
    </article>
  );
}

function PracticeStepStatus({ status }: { status: PracticeCardStatus }) {
  if (status === "ready") {
    return (
      <span className="grid size-5 place-items-center rounded-full bg-[#0B7A3B] text-white">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none">
          <path
            d="M5.2 10.2 8.4 13.4 14.8 6.6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`size-5 rounded-full border-2 border-dashed ${
        status === "needed" ? "border-amber-600/70" : "border-slate-500/70"
      }`}
      aria-hidden="true"
    />
  );
}

function PracticeCardIllustration({
  kind,
  tone,
  size = "md",
}: {
  kind: PracticeIllustrationKind;
  tone: PracticeCardTone;
  size?: "sm" | "md" | "lg";
}) {
  const shellSize = size === "sm" ? "size-12" : "size-16";
  const svgSize = size === "sm" ? "size-8" : size === "lg" ? "size-11" : "size-10";

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${shellSize} ${practiceIllustrationClass(
        tone,
      )}`}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className={svgSize} fill="none">
        {practiceIllustrationPaths(kind)}
      </svg>
    </span>
  );
}

function practiceIllustrationPaths(kind: PracticeIllustrationKind) {
  switch (kind) {
    case "target":
      return (
        <>
          <circle cx="22" cy="25" r="13" stroke="currentColor" strokeWidth="3" />
          <circle cx="22" cy="25" r="7" stroke="currentColor" strokeWidth="3" />
          <circle cx="22" cy="25" r="2.5" fill="currentColor" />
          <path
            d="m27.5 19.5 8.8-8.8M33.5 10.5h4v4M30.8 13.2h3.8v3.8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </>
      );
    case "golfer":
      return (
        <>
          <circle cx="24" cy="9" r="4" fill="currentColor" />
          <path
            d="M22 15.5 25.5 24M25.5 24 19 38M25.5 24 32 38M15 18.5l8 4 8-4M31 18.5 40 9.5M40 9.5l2.5 3.5M18 38h-5M32 38h5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M10 40h25M12 33.5c3.8 1.2 7.8 1.4 12 .5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <circle cx="40" cy="39" r="2" fill="currentColor" />
        </>
      );
    case "clipboard":
      return (
        <>
          <path
            d="M15 11h18a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M19 8h10v6H19zM18 22h12M18 29h8M18 36h6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <circle cx="34" cy="34" r="7" fill="currentColor" />
          <path d="M34 30.5v7M30.5 34h7" stroke="white" strokeLinecap="round" strokeWidth="2.4" />
        </>
      );
    case "progress":
      return (
        <>
          <path
            d="M10 37h28M13 31v6M21 25v12M29 19v18M37 13v24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="m11 25 9-2 7-7 5 2 7-7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <circle cx="20" cy="23" r="2" fill="currentColor" />
          <circle cx="32" cy="18" r="2" fill="currentColor" />
        </>
      );
    case "flag":
      return (
        <>
          <path d="M17 40V10" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
          <path
            d="M18 12h18l-5 6 5 6H18"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path d="M12 40h14" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        </>
      );
    case "share":
      return (
        <>
          <path
            d="M14 19v19h20V27"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M25 23 37 11M29 11h8v8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </>
      );
    case "alert":
      return (
        <>
          <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="3" />
          <path
            d="M24 14v14M24 34h.1"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      );
    case "aim":
      return (
        <>
          <circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="3" />
          <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="3" />
          <path
            d="M24 7v8M24 33v8M7 24h8M33 24h8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </>
      );
    case "club":
      return (
        <>
          <path
            d="M31 8 21 35M18 35c-3.8 0-6.5 1.6-6.5 3.8 0 2 2.4 3.2 6.6 3.2h7.4c3.9 0 6.9-2.5 7.7-6.2l.4-1.8H18Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path d="M14 36c4.8 1.7 10.2 1.7 16.4 0" stroke="currentColor" strokeWidth="3" />
        </>
      );
  }
}

function TodayHoverStyles({ comparisons }: { comparisons: ClubDayComparison[] }) {
  const selectors = comparisons
    .map((comparison) => {
      const club = cssAttributeValue(comparison.clubType);

      return `
        .today-review-page:has([data-club-hover="${club}"]:hover) [data-dispersion-club="${club}"] {
          opacity: 1;
          filter: drop-shadow(0 0 5px rgba(15, 23, 42, 0.28));
        }
      `;
    })
    .join("\n");

  return (
    <style>{`
      .today-review-page [data-dispersion-club] {
        transition: opacity 140ms ease, filter 140ms ease;
      }
      .today-review-page:has([data-club-hover]:hover) [data-dispersion-club] {
        opacity: 0.18;
      }
      .today-review-page [data-club-hover]:hover {
        background: rgba(248, 250, 252, 0.92);
      }
      .today-review-page [data-club-hover]:hover td:first-child {
        color: #334155;
      }
      ${selectors}
    `}</style>
  );
}

function TodayReviewHero({ data }: { data: TodayPracticeData }) {
  const selectedClubs = selectedClubCount(data);
  const bestShot = data.bestStraightShots[0];
  const scope = sessionScopeLabel(data);
  const focus = practiceFocus(data);
  const score = practiceScoreSummary(data);
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);
  const changes = whatChangedItems(data);
  const impact = sessionImpactItems(data);
  const confidence = confidenceChangeItems(data);
  const driver = driverHealthSummary(data);

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#d9ded8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={verdictTone(data.overall.verdict)}>Session verdict</StatusPill>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {data.dateLabel}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl text-6xl font-semibold uppercase leading-[1.02] tracking-normal text-slate-950 xl:text-7xl">
            {data.overall.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-slate-700 xl:text-lg">
            {reviewNarrative(data)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {integerFormatter.format(data.shots.length)} shots /{" "}
            {integerFormatter.format(selectedClubs)} {selectedClubs === 1 ? "club" : "clubs"} /{" "}
            {scope}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <HeroScopePill label={selectedClubLabel(data)} value="Scope" />
            <HeroScopePill
              label={`${integerFormatter.format(data.comparisonShots.length)} comparison`}
              value="Baseline"
            />
            <HeroScopePill
              label={bestShot ? bestShotTitle(bestShot) : "No shot yet"}
              value="Shot of the day"
            />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <VerdictStoryCard
              label="Strength"
              value={best?.clubLabel ?? score.strong}
              detail={best ? `${formatRate(best.today.playableRate)} playable` : "Building signal"}
              tone="green"
              icon={<ShieldCheck className="size-4" />}
            />
            <VerdictStoryCard
              label="Weakness"
              value={work?.clubLabel ?? score.weak}
              detail={
                work ? `${formatYards(work.today.offlineAverageYd)} offline` : "No clear drag"
              }
              tone="pink"
              icon={<Target className="size-4" />}
            />
            <VerdictStoryCard
              label="Recommendation"
              value={score.recommendation}
              detail={`Start with ${focus.clubText}`}
              tone="amber"
              icon={<Dumbbell className="size-4" />}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <PracticeScoreHeroCard score={score} reliable={reliable} />
          <HeroShotSpotlight shot={bestShot} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <WhatChangedCard items={changes} />
        <DriverHealthCard summary={driver} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <SessionImpactCard items={impact} />
        <ConfidenceChangeCard items={confidence} />
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <ReviewKpi
          icon={<Crosshair className="size-4" />}
          label="Offline"
          value={formatYards(data.overall.today.offlineAverageYd)}
          detail={offlineDeltaText(data.overall.offlineDeltaYd)}
          status={offlineStatus(data.overall.offlineDeltaYd)}
          tone={offlineKpiTone(data.overall.offlineDeltaYd)}
        />
        <ReviewKpi
          icon={<Gauge className="size-4" />}
          label="Straight rate"
          value={formatRate(data.overall.today.straightRate)}
          detail={deltaText(data.overall.straightRateDelta, "pp", true)}
          status={rateStatus(data.overall.straightRateDelta)}
          tone={deltaTone(data.overall.straightRateDelta, "higher")}
        />
        <ReviewKpi
          icon={<ShieldCheck className="size-4" />}
          label="Playable"
          value={formatRate(data.overall.today.playableRate)}
          detail={deltaText(data.overall.playableRateDelta, "pp", true)}
          status={rateStatus(data.overall.playableRateDelta, "Solid")}
          tone={playableKpiTone(data.overall.playableRateDelta)}
        />
        <ReviewKpi
          icon={<Route className="size-4" />}
          label="Carry"
          value={formatYards(data.overall.today.carryAverageYd)}
          detail={deltaText(data.overall.carryDeltaYd, "yd", true)}
          status={carryStatus(data.overall.carryDeltaYd)}
          tone={deltaTone(data.overall.carryDeltaYd, "higher")}
        />
      </div>
    </section>
  );
}

function VerdictStoryCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: ReviewTone;
  icon: ReactNode;
}) {
  return (
    <div className={`min-h-32 rounded-lg border px-3.5 py-3 shadow-sm ${verdictCardClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
        <span className={`grid size-8 place-items-center rounded-full ${reviewIconClass(tone)}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold leading-tight tracking-normal text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium leading-5 text-slate-700">{detail}</p>
    </div>
  );
}

function PracticeScoreHeroCard({
  score,
  reliable,
}: {
  score: PracticeScoreSummary;
  reliable: ClubDayComparison | null;
}) {
  return (
    <div className={`rounded-lg border px-4 py-4 shadow-sm ${verdictCardClass(score.tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">
            Practice score
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">Practice quality, not handicap.</p>
        </div>
        <span
          className={`grid size-10 place-items-center rounded-full ${reviewIconClass(score.tone)}`}
        >
          <Gauge className="size-5" />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <p className="text-6xl font-semibold leading-none tracking-normal text-slate-950">
          {score.score}
        </p>
        <p className="pb-1 text-xl font-semibold text-slate-500">/100</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ScoreMiniMetric label="Strong" value={score.strong} />
        <ScoreMiniMetric label="Weak" value={score.weak} />
        <ScoreMiniMetric label="Trend" value={score.trend} />
      </div>
      <p className="mt-3 rounded-lg border border-white/60 bg-white/65 px-3 py-2 text-sm font-medium leading-5 text-slate-800">
        Most reliable: {reliable?.clubLabel ?? "building signal"}.
      </p>
    </div>
  );
}

function ScoreMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-16 rounded-lg border border-white/60 bg-white/65 px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function WhatChangedCard({ items }: { items: WhatChangedItem[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Compared to last session
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
            What changed
          </h2>
        </div>
        <Route className="size-5 text-sky-600" />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className={`rounded-lg border px-3 py-2.5 ${verdictCardClass(item.tone)}`}
          >
            <p className="text-sm font-semibold text-slate-950">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              {item.value}
            </p>
            <p className="mt-1 text-xs font-medium leading-4 text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverHealthCard({ summary }: { summary: DriverHealthSummary }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${verdictCardClass(summary.tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">
            Driver health
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
            {summary.status}
          </h2>
        </div>
        <span
          className={`grid size-10 place-items-center rounded-full ${reviewIconClass(summary.tone)}`}
        >
          <Flag className="size-5" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <DriverHealthMetric label="Path" value={formatDegrees(summary.path)} />
        <DriverHealthMetric label="Target" value={formatDegrees(summary.targetPath)} />
        <DriverHealthMetric label="Start line" value={formatDegrees(summary.startLine)} />
        <DriverHealthMetric label="Face-to-path" value={formatDegrees(summary.faceToPath)} />
      </div>
      <p className="mt-3 rounded-lg border border-white/60 bg-white/65 px-3 py-2 text-sm font-medium leading-5 text-slate-800">
        {summary.detail}
      </p>
    </div>
  );
}

function DriverHealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/65 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function SessionImpactCard({ items }: { items: SessionImpactItem[] }) {
  const values = items.map((item) => item.value).filter(isNumber);
  const net =
    values.length > 0 ? roundOneNumber(values.reduce((total, value) => total + value, 0)) : null;
  const tone = deltaTone(net, "higher");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Session impact
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
            Strokes saved / lost
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${reviewStatusClass(tone)}`}>
          Net {formatSignedDecimal(net)}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.clubLabel}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{item.clubLabel}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-600">{item.detail}</p>
              </div>
              <p className={`text-lg font-semibold tabular-nums ${impactValueClass(item.tone)}`}>
                {formatSignedDecimal(item.value)}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 text-sm font-medium text-slate-600">
            No comparable club impact yet.
          </div>
        )}
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
        Estimated from carry, dispersion, playable rate and consistency deltas.
      </p>
    </div>
  );
}

function ConfidenceChangeCard({ items }: { items: ConfidenceChangeItem[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Confidence change
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
            Club confidence
          </h2>
        </div>
        <ShieldCheck className="size-5 text-emerald-700" />
      </div>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.clubLabel}
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-950">{item.clubLabel}</p>
                <p className={`text-sm font-semibold ${impactValueClass(item.tone)}`}>
                  {confidenceRangeText(item)}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <span
                  className={`block h-full rounded-full ${rateBarClass(item.tone)}`}
                  style={{ width: `${clamp(item.current ?? 0, 0, 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 text-sm font-medium text-slate-600">
            Confidence appears once comparable clubs exist.
          </div>
        )}
      </div>
    </div>
  );
}

function HeroScopePill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs shadow-sm">
      <span className="font-semibold text-slate-950">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </span>
  );
}

function HeroShotSpotlight({ shot }: { shot: TodayPracticeShot | undefined }) {
  return (
    <div className="relative min-h-[180px] overflow-hidden rounded-lg border border-emerald-100 bg-[#083524] p-3 text-white shadow-sm sm:min-h-[280px] sm:p-4">
      <HeroFairwayVisual shot={shot} />
      <div className="relative z-10 flex h-full flex-col justify-end">
        <div className="w-full rounded-lg border border-white/15 bg-white/95 px-3 py-2 text-slate-950 shadow-sm">
          {shot ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-5 gap-y-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-[11px] font-semibold uppercase tracking-normal text-slate-700">
                  Shot of the day
                </p>
                <Crosshair className="size-3.5 shrink-0 text-sky-600" />
              </div>
              <h3 className="min-w-0 truncate text-lg font-semibold leading-tight tracking-normal">
                {bestShotTitle(shot)}
              </h3>
              <p className="text-xs font-medium leading-4 text-slate-700">
                {formatYards(shot.totalYd)} total
              </p>
              <ShotMetric label="Start" value={formatDegrees(shot.launchDirectionDeg)} />
              <p className="text-xs font-medium leading-4 text-slate-700">
                {formatYards(shot.carryYd)} carry
              </p>
              <ShotMetric label="Ball" value={formatMph(shot.ballSpeedMph)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Directional shot data will spotlight the best strike here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <dl className="inline-flex min-w-0 items-baseline gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold tabular-nums text-slate-950">{value}</dd>
    </dl>
  );
}

function HeroFairwayVisual({ shot }: { shot: TodayPracticeShot | undefined }) {
  if (shot && isDriverClubType(shot.clubType)) {
    return <HeroTeeFairwayVisual shot={shot} />;
  }

  return <HeroApproachVisual shot={shot} />;
}

function HeroApproachVisual({ shot }: { shot: TodayPracticeShot | undefined }) {
  const green = { x: 322, y: 164 };
  const approach = { x: 322, y: 342 };
  const landing = approachLandingPoint(shot, green);
  const targetDistanceYd = shotCarryDistanceYd(shot) ?? 110;

  return (
    <svg
      viewBox="70 68 504 392"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={
        shot
          ? `${formatClubType(shot.clubType)} shot of the day aimed at the green`
          : "Approach target visual"
      }
    >
      <defs>
        <filter id="today-approach-image-soften">
          <feGaussianBlur stdDeviation="0.7" />
          <feColorMatrix type="saturate" values="0.68" />
        </filter>
        <filter id="today-approach-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <image
        href="/assets/hole-350-aerial.jpg"
        x="0"
        y="0"
        width="644"
        height="1024"
        filter="url(#today-approach-image-soften)"
        opacity="0.94"
        preserveAspectRatio="xMidYMid slice"
      />
      <rect x="0" y="0" width="644" height="1024" fill="#04160f" opacity="0.34" />
      <path
        d={`M ${approach.x} ${approach.y} Q ${green.x - 18} 304 ${green.x} ${green.y}`}
        fill="none"
        stroke="#ffffff"
        strokeDasharray="10 9"
        strokeLinecap="round"
        strokeOpacity="0.8"
        strokeWidth="3"
      />
      {shot ? (
        <path
          d={`M ${approach.x} ${approach.y} Q ${(approach.x + landing.x) / 2 + 24} 280 ${landing.x} ${landing.y}`}
          fill="none"
          stroke="#bae6fd"
          strokeLinecap="round"
          strokeOpacity="0.78"
          strokeWidth="3"
        />
      ) : null}
      <g opacity="0.88">
        <ellipse cx={green.x} cy={green.y + 6} rx="76" ry="47" fill="#bbf7d0" opacity="0.16" />
        <ellipse
          cx={green.x}
          cy={green.y + 6}
          rx="58"
          ry="35"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeOpacity="0.78"
        />
        <ellipse
          cx={green.x}
          cy={green.y + 6}
          rx="31"
          ry="19"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.7"
          strokeOpacity="0.72"
        />
        <Flag
          x={green.x - 7}
          y={green.y - 37}
          width={20}
          height={20}
          className="fill-white text-white"
        />
      </g>
      <g>
        <circle
          cx={approach.x}
          cy={approach.y}
          r="6"
          fill="#ffffff"
          stroke="#0f172a"
          strokeOpacity="0.24"
          strokeWidth="2"
        />
        <text x={approach.x + 14} y={approach.y + 4} fill="#ffffff" fontSize="14" fontWeight="700">
          {formatYards(targetDistanceYd)}
        </text>
      </g>
      {shot ? (
        <g filter="url(#today-approach-glow)">
          <title>{`${bestShotTitle(shot)} landing: ${formatOfflineYards(shot.sideCarryYd)} offline`}</title>
          <circle
            cx={landing.x}
            cy={landing.y}
            r="9"
            fill="#fef08a"
            fillOpacity="0.95"
            stroke="#0f172a"
            strokeOpacity="0.38"
            strokeWidth="1.5"
          />
          <circle cx={landing.x} cy={landing.y} r="3.2" fill="#ffffff" />
        </g>
      ) : null}
    </svg>
  );
}

function HeroTeeFairwayVisual({ shot }: { shot: TodayPracticeShot }) {
  const tee = { x: 322, y: 422 };
  const green = { x: 322, y: 154 };
  const distanceYd = shotDistanceYd(shot) ?? 220;
  const carryYd = shot.carryYd ?? distanceYd;
  const landing = fairwayLandingPoint(shot, distanceYd, tee, green);
  const carryLanding = fairwayLandingPoint(shot, carryYd, tee, green);
  const showsRoll =
    isNumber(shot.totalYd) &&
    isNumber(shot.carryYd) &&
    (shot.totalYd ?? 0) - (shot.carryYd ?? 0) >= 3;

  return (
    <svg
      viewBox="70 92 504 392"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Driver shot of the day from tee to fairway"
    >
      <defs>
        <filter id="today-tee-image-soften">
          <feGaussianBlur stdDeviation="0.6" />
          <feColorMatrix type="saturate" values="0.72" />
        </filter>
        <filter id="today-tee-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <image
        href="/assets/hole-350-aerial.jpg"
        x="0"
        y="0"
        width="644"
        height="1024"
        filter="url(#today-tee-image-soften)"
        opacity="0.95"
        preserveAspectRatio="xMidYMid slice"
      />
      <rect x="0" y="0" width="644" height="1024" fill="#04160f" opacity="0.36" />
      <path
        d={`M ${tee.x - 52} ${tee.y + 10} C ${tee.x - 68} 334 ${green.x - 116} 254 ${green.x - 96} ${green.y + 46} C ${green.x - 32} ${green.y + 12} ${green.x + 32} ${green.y + 12} ${green.x + 96} ${green.y + 46} C ${green.x + 116} 254 ${tee.x + 68} 334 ${tee.x + 52} ${tee.y + 10} Z`}
        fill="#bbf7d0"
        opacity="0.13"
      />
      <ellipse cx={landing.x} cy={landing.y} rx="82" ry="32" fill="#bbf7d0" opacity="0.14" />
      <ellipse
        cx={landing.x}
        cy={landing.y}
        rx="60"
        ry="22"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.62"
        strokeWidth="1.8"
      />
      <path
        d={`M ${tee.x} ${tee.y} C ${(tee.x + landing.x) / 2 - 8} 342 ${(tee.x + landing.x) / 2 - 4} 288 ${landing.x} ${landing.y}`}
        fill="none"
        stroke="#ffffff"
        strokeDasharray="10 9"
        strokeLinecap="round"
        strokeOpacity="0.76"
        strokeWidth="3"
      />
      <path
        d={`M ${tee.x} ${tee.y} C ${(tee.x + landing.x) / 2 - 28} 330 ${(tee.x + landing.x) / 2 + 22} 252 ${landing.x} ${landing.y}`}
        fill="none"
        stroke="#bae6fd"
        strokeLinecap="round"
        strokeOpacity="0.82"
        strokeWidth="3.2"
      />
      {showsRoll ? (
        <path
          d={`M ${carryLanding.x} ${carryLanding.y} L ${landing.x} ${landing.y}`}
          fill="none"
          stroke="#ffffff"
          strokeDasharray="3 5"
          strokeLinecap="round"
          strokeOpacity="0.58"
          strokeWidth="2"
        />
      ) : null}
      <g>
        <circle
          cx={tee.x}
          cy={tee.y}
          r="7"
          fill="#ffffff"
          stroke="#0f172a"
          strokeOpacity="0.28"
          strokeWidth="2"
        />
        <text x={tee.x + 14} y={tee.y + 4} fill="#ffffff" fontSize="14" fontWeight="700">
          Tee
        </text>
      </g>
      <g opacity="0.78">
        <Flag
          x={green.x - 7}
          y={green.y - 38}
          width={19}
          height={19}
          className="fill-white text-white"
        />
        <text x={green.x + 16} y={green.y - 20} fill="#ffffff" fontSize="13" fontWeight="700">
          350 yd
        </text>
      </g>
      <g filter="url(#today-tee-glow)">
        <title>{`${bestShotTitle(shot)} finish: ${formatYards(distanceYd)} ${shot.totalYd ? "total" : "carry"}`}</title>
        {showsRoll ? (
          <circle
            cx={carryLanding.x}
            cy={carryLanding.y}
            r="4.5"
            fill="#ffffff"
            fillOpacity="0.9"
            stroke="#0f172a"
            strokeOpacity="0.32"
            strokeWidth="1"
          />
        ) : null}
        <circle
          cx={landing.x}
          cy={landing.y}
          r="9"
          fill="#fef08a"
          fillOpacity="0.95"
          stroke="#0f172a"
          strokeOpacity="0.38"
          strokeWidth="1.5"
        />
        <circle cx={landing.x} cy={landing.y} r="3.2" fill="#ffffff" />
        <text x={landing.x + 13} y={landing.y - 9} fill="#ffffff" fontSize="14" fontWeight="800">
          {formatYards(distanceYd)}
        </text>
      </g>
    </svg>
  );
}

function shotDistanceYd(shot: TodayPracticeShot | undefined) {
  return shot?.totalYd ?? shot?.carryYd ?? null;
}

function shotCarryDistanceYd(shot: TodayPracticeShot | undefined) {
  return shot?.carryYd ?? shot?.totalYd ?? null;
}

function isDriverClubType(clubType: string | null | undefined) {
  return clubType?.trim().toLowerCase() === "driver";
}

function approachLandingPoint(
  shot: TodayPracticeShot | undefined,
  green: { x: number; y: number },
) {
  const side = shot?.sideCarryYd ?? 0;
  const maxSide = Math.max(18, Math.abs(side) * 1.35);

  return {
    x: green.x + clamp(side / maxSide, -1, 1) * 58,
    y: green.y + 6,
  };
}

function fairwayLandingPoint(
  shot: TodayPracticeShot,
  distanceYd: number,
  tee: { x: number; y: number },
  green: { x: number; y: number },
) {
  const holeLengthYd = 350;
  const side = shot.sideCarryYd ?? 0;
  const progress = clamp(distanceYd / holeLengthYd, 0, 1);

  return {
    x: 322 + clamp(side / 45, -1, 1) * 82,
    y: tee.y + (green.y - tee.y) * progress,
  };
}

function ReviewKpi({
  icon,
  label,
  value,
  detail,
  status,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  status: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className={`grid size-7 place-items-center rounded-full ${reviewIconClass(tone)}`}>
            {icon}
          </span>
          {label}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${reviewStatusClass(tone)}`}
        >
          {status}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold leading-tight tracking-normal text-slate-950">
        {value}
      </p>
      <p className={reviewDeltaClass(tone)}>{detail}</p>
    </div>
  );
}

function TodayPracticePrescription({ data }: { data: TodayPracticeData }) {
  const focus = practiceFocus(data);

  return (
    <DataPanel className="border-[#d9ded8] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between lg:px-5 lg:py-5">
        <div className="flex min-w-0 gap-3">
          <PracticeCardIllustration kind="target" tone="green" size="sm" />
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight tracking-normal text-slate-950">
              Latest practice prescription
            </h2>
            <p className="mt-1 text-sm font-medium leading-5 text-slate-600 sm:text-base">
              A simple drill target from the session pattern.
            </p>
          </div>
        </div>
        <div className="sm:pt-1">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-10 rounded-lg border-[#0B7A3B] bg-white px-4 text-sm font-semibold text-[#0B7A3B] shadow-sm hover:bg-emerald-50 hover:text-[#064E3B]"
          >
            <Link href="/coach" prefetch={false}>
              <Dumbbell className="size-4" />
              Start drill
            </Link>
          </Button>
        </div>
      </div>
      <CardContent className="pt-0">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PrescriptionBlock label="Problem" value={focus.problem} tone="pink" icon="alert" />
          <PrescriptionBlock
            label="Cause to check"
            value="Start line / face control"
            tone="amber"
            icon="aim"
          />
          <PrescriptionBlock
            label="Drill"
            value={`20-ball gate drill with ${focus.clubText}`}
            tone="sky"
            icon="club"
          />
          <PrescriptionBlock
            label="Target"
            value={`12 of 20 inside ±10 yd. Beat this review’s ${formatYards(data.overall.today.offlineAverageYd)} offline average.`}
            tone="green"
            icon="flag"
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function PrescriptionBlock({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "green" | "sky" | "pink" | "amber";
  icon: PracticeIllustrationKind;
}) {
  return (
    <div
      className={`flex min-h-32 items-center gap-3 rounded-lg border px-3.5 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)] ${prescriptionToneClass(
        tone,
      )}`}
    >
      <PracticeCardIllustration kind={icon} tone={tone} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.08em]">{label}</p>
        <p className="mt-2 text-sm font-medium leading-5 text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function ClubPerformancePanel({
  data,
  comparisons,
  sort,
}: {
  data: TodayPracticeData;
  comparisons: ClubDayComparison[];
  sort: ClubSort;
}) {
  return (
    <DataPanel className="min-w-0">
      <SectionHeader
        title="Club performance"
        description={clubPerformanceNarrative(data)}
        action={
          <StatusPill tone={verdictTone(data.overall.verdict)}>{data.overall.title}</StatusPill>
        }
      />
      <CardContent className="space-y-4">
        <ClubPerformanceSummaryCards data={data} />
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-100 bg-emerald-50/55 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium leading-5 text-emerald-950">
            Latest read: {clubPerformanceRead(data)}
          </p>
          <ClubSortControls data={data} activeSort={sort} />
        </div>
        <DataTableFrame
          className="[&_[data-slot=scroll-area-viewport]]:overflow-x-hidden [&_[data-slot=table-container]]:overflow-x-visible"
          mobile={
            <MobileHorizontalRail
              title="Club performance"
              description="This review against the latest previous shots."
            >
              {comparisons.map((comparison) => (
                <MobileDataCard
                  key={comparison.clubType}
                  title={comparison.clubLabel}
                  subtitle={`${comparison.today.shotCount}/${comparison.previous.shotCount} shots`}
                  action={
                    <Badge className={verdictBadgeClass(comparison.verdict)}>
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
                <TableHead className="sticky left-0 z-10 bg-white px-2">Club</TableHead>
                <TableHead className="px-2">Call</TableHead>
                <TableHead className="px-2 text-right">Shots</TableHead>
                <TableHead className="px-2 text-right">Carry</TableHead>
                <TableHead className="px-2 text-right">Offline</TableHead>
                <TableHead className="px-2 text-right">Straight</TableHead>
                <TableHead className="px-2 text-right">Playable</TableHead>
                <TableHead className="max-w-[11rem] whitespace-normal px-2">Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((comparison) => (
                <ClubComparisonRow
                  key={comparison.clubType}
                  comparison={comparison}
                  bestClubType={bestClubComparison(data.clubComparisons)?.clubType ?? null}
                  focusClubType={needsWorkComparison(data.clubComparisons)?.clubType ?? null}
                />
              ))}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </DataPanel>
  );
}

function ClubSortControls({ data, activeSort }: { data: TodayPracticeData; activeSort: ClubSort }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1.5">
      <SortLink href={todaySortHref(data, "worst")} active={activeSort === "worst"}>
        Sort by worst
      </SortLink>
      <SortLink href={todaySortHref(data, "best")} active={activeSort === "best"}>
        Sort by best
      </SortLink>
      <SortLink href={todaySortHref(data, "bag")} active={activeSort === "bag"}>
        Bag order
      </SortLink>
    </div>
  );
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={
        active
          ? "inline-flex min-h-8 items-center rounded-lg border border-emerald-800 bg-emerald-800 px-2.5 text-xs font-semibold text-white shadow-sm"
          : "inline-flex min-h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
      }
      aria-current={active ? "true" : undefined}
    >
      {children}
    </Link>
  );
}

function ClubPerformanceSummaryCards({ data }: { data: TodayPracticeData }) {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <ClubSummaryCard
        label="Best this review"
        comparison={best}
        icon={<Award className="size-4" />}
        tone="green"
      />
      <ClubSummaryCard
        label="Needs work"
        comparison={work}
        icon={<Target className="size-4" />}
        tone="pink"
      />
      <ClubSummaryCard
        label="Most reliable"
        comparison={reliable}
        icon={<ShieldCheck className="size-4" />}
        tone="sky"
      />
    </div>
  );
}

function ClubSummaryCard({
  label,
  comparison,
  icon,
  tone,
}: {
  label: string;
  comparison: ClubDayComparison | null;
  icon: ReactNode;
  tone: "green" | "pink" | "sky";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`grid size-8 place-items-center rounded-full ${summaryIconClass(tone)}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
        {comparison?.clubLabel ?? "--"}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {comparison
          ? `${formatRate(comparison.today.straightRate)} straight · ${formatRate(comparison.today.playableRate)} playable`
          : "No club data"}
      </p>
      {comparison ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatYards(comparison.today.offlineAverageYd)} offline
        </p>
      ) : null}
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
    <Link
      href={href}
      prefetch={false}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#E5E7EB] bg-white py-3"
    >
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
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        Date
        <input
          type="date"
          name="date"
          defaultValue={data.dateKey}
          className="h-9 w-full min-w-0 rounded-lg border bg-white/90 px-3 text-sm"
        />
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        Session
        <select
          name="session"
          defaultValue={data.filters.sessionId}
          className="h-9 w-full min-w-0 rounded-lg border bg-white/90 px-3 text-sm"
        >
          <option value="">All sessions for this practice date</option>
          {data.sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.label} ({session.shotCount})
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        Club
        <select
          name="club"
          defaultValue={data.filters.club}
          className="h-9 w-full min-w-0 rounded-lg border bg-white/90 px-3 text-sm"
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
            Import a Rapsodo CSV for the practice date, or clear the session and club filters.
          </p>
        </div>
        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
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

  const bestClubRow = bestClubComparison(data.clubComparisons);
  const bestClub = bestClubRow?.clubLabel ?? data.clubs[0]?.label ?? "This session";
  const bestClubType = bestClubRow?.clubType ?? data.clubs[0]?.type ?? "";
  const challenge = findRelevantChallenge(challenges, bestClubType);

  return (
    <section className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Compare this session</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {challenge
              ? `Recommended: ${bestClub} straightness stood out. Compare it against ${challenge.title}.`
              : `Recommended: ${bestClub} has ${integerFormatter.format(data.shots.length)} selected shots ready for records, events and tour-style challenges.`}
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

function TodayHighlightsPanel({
  stats,
  shots,
  bestStraightShots,
}: {
  stats: ClubMainStats[];
  shots: TodayPracticeShot[];
  bestStraightShots: TodayPracticeShot[];
}) {
  const highlights = buildClubHighlights(stats, buildClubEquipmentMap(shots));
  const records = highlights.filter((highlight) => highlight.kind !== "close");
  const closeCalls = highlights.filter((highlight) => highlight.kind === "close").slice(0, 6);
  const bestNearMiss = closeCalls[0] ?? null;
  const bestShot = bestStraightShots[0] ?? null;

  return (
    <DataPanel>
      <SectionHeader
        title="Latest practice highlights"
        description={`${records.length} PB moments · ${closeCalls.length} close to PB`}
        action={<Trophy className="size-5 text-amber-600" />}
      />
      <CardContent className="space-y-4">
        {stats.length === 0 || highlights.length === 0 ? (
          <div className="apple-panel p-4 text-sm text-muted-foreground">
            No PBs or close calls for this selection.
          </div>
        ) : (
          <div className="space-y-5">
            {records.length > 0 ? (
              <HighlightGroup title="PB moments" highlights={records.slice(0, 6)} />
            ) : (
              <div className="apple-panel p-4 text-sm text-muted-foreground">
                No PBs in this selection yet.
              </div>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
                    Shot of the day
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Best single shot by offline and start line.
                  </p>
                </div>
                <Crosshair className="size-4 text-sky-600" />
              </div>
              {bestShot ? (
                <div className="max-w-xl">
                  <StraightShotCard shot={bestShot} featured />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-muted-foreground">
                  No directional shot data for this selection.
                </div>
              )}
            </section>

            {closeCalls.length > 0 ? (
              <details className="group rounded-lg border border-amber-100 bg-amber-50/35">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-sm font-semibold text-amber-950">Close to PB</span>
                    <span className="block text-xs text-amber-800">
                      {bestNearMiss
                        ? `${closeCalls.length} near misses. Best: ${bestNearMiss.clubLabel} ${bestNearMiss.metricLabel.toLowerCase()}, ${bestNearMiss.detail}`
                        : `${closeCalls.length} near misses`}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
                    View all
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="grid gap-2 border-t border-amber-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {closeCalls.map((highlight) => (
                    <HighlightCard key={highlight.id} highlight={highlight} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function HighlightGroup({ title, highlights }: { title: string; highlights: ClubHighlight[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
          {title}
        </h3>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
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
  const statusLabel = highlight.kind === "tie" ? "Tied PB" : close ? "Close" : "New PB";
  const imageAlt = clubImageAlt(highlight);

  if (close) {
    return (
      <div className="flex min-h-28 items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/45 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-200 bg-white/70 text-amber-800">
              {highlight.clubLabel}
            </Badge>
            <span className="text-xs font-medium text-amber-800">{statusLabel}</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">{highlight.metricLabel}</p>
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
        <ClubArtwork
          clubType={highlight.clubType}
          brand={highlight.clubBrand}
          model={highlight.clubModel}
          alt={imageAlt}
          className="h-20 min-h-0 w-24 shrink-0 border-0 bg-transparent"
          imageClassName="px-1 py-1"
          sizes="88px"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-32 items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="border-emerald-200 bg-white/70 text-emerald-700">
            {highlight.clubLabel}
          </Badge>
          <span className="text-xs font-medium text-emerald-700">{statusLabel}</span>
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">{highlight.metricLabel}</p>
        <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
          {highlight.value}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-700">{highlight.detail}</p>
        {highlight.target ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">{highlight.target}</p>
        ) : null}
      </div>
      <ClubArtwork
        clubType={highlight.clubType}
        brand={highlight.clubBrand}
        model={highlight.clubModel}
        alt={imageAlt}
        className="h-24 min-h-0 w-28 shrink-0 border-0 bg-transparent sm:w-32"
        imageClassName="px-1 py-1"
        sizes="120px"
      />
    </div>
  );
}

function clubImageAlt(highlight: ClubHighlight) {
  return [highlight.clubBrand, highlight.clubModel, highlight.clubLabel].filter(Boolean).join(" ");
}

function buildClubHighlights(
  stats: ClubMainStats[],
  equipmentByClub: Map<string, { brand: string | null; model: string | null }>,
) {
  return stats
    .flatMap((stat) =>
      statHighlightDescriptors(stat).flatMap((descriptor) =>
        buildMetricHighlights(stat, descriptor, equipmentByClub.get(stat.clubType)),
      ),
    )
    .sort((left, right) => left.priority - right.priority || left.closeness - right.closeness);
}

function buildClubEquipmentMap(shots: TodayPracticeShot[]) {
  const equipmentByClub = new Map<string, { brand: string | null; model: string | null }>();

  for (const shot of shots) {
    const current = equipmentByClub.get(shot.clubType);

    if (!current || (!current.brand && !current.model)) {
      equipmentByClub.set(shot.clubType, {
        brand: shot.clubBrand,
        model: shot.clubModel,
      });
    }
  }

  return equipmentByClub;
}

function statHighlightDescriptors(stat: ClubMainStats): ClubHighlightDescriptor[] {
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
  equipment: { brand: string | null; model: string | null } | undefined,
): ClubHighlight[] {
  const { metric, direction, unit } = descriptor;
  if (metric.bestStatus === "new" || metric.bestStatus === "tied") {
    return [
      {
        id: `${stat.clubType}-${descriptor.key}-${metric.bestStatus}`,
        kind: metric.bestStatus === "new" ? "record" : "tie",
        clubType: stat.clubType,
        clubLabel: stat.clubLabel,
        clubBrand: equipment?.brand ?? null,
        clubModel: equipment?.model ?? null,
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

  if (direction === "lower" && isNumber(metric.allTimeBest) && metric.allTimeBest <= 0) {
    return [];
  }

  return [
    {
      id: `${stat.clubType}-${descriptor.key}-close`,
      kind: "close",
      clubType: stat.clubType,
      clubLabel: stat.clubLabel,
      clubBrand: equipment?.brand ?? null,
      clubModel: equipment?.model ?? null,
      metricLabel: descriptor.label,
      value: formatMetricValue(metric.todayBest, unit),
      detail: `${formatMetricValue(gap, unit)} ${direction === "higher" ? "short of" : "away from"} your PB.`,
      target: `Target: ${formatMetricValue(metric.allTimeBest, unit)}`,
      priority: 20 + descriptor.priority,
      closeness: gap / descriptor.closeThreshold,
    },
  ];
}

function recordDetail(metric: ClubMainStatMetric, direction: HighlightDirection, unit: MetricUnit) {
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

function improvementOverPrevious(metric: ClubMainStatMetric, direction: HighlightDirection) {
  if (!isNumber(metric.todayBest) || !isNumber(metric.previousBest)) {
    return null;
  }

  const improvement =
    direction === "higher"
      ? metric.todayBest - metric.previousBest
      : metric.previousBest - metric.todayBest;
  return improvement > 0 ? Math.round(improvement * 100) / 100 : null;
}

function ClubComparisonRow({
  comparison,
  bestClubType,
  focusClubType,
}: {
  comparison: ClubDayComparison;
  bestClubType: string | null;
  focusClubType: string | null;
}) {
  const signalLines = buildSignalLines(comparison);
  const rowTone = clubRowTone(comparison, bestClubType, focusClubType);

  return (
    <TableRow className={rowTone.rowClass} data-club-hover={comparison.clubType}>
      <TableCell className={`sticky left-0 z-10 px-2 font-medium ${rowTone.stickyClass}`}>
        {comparison.clubLabel}
      </TableCell>
      <TableCell className="px-2">
        <Badge className={verdictBadgeClass(comparison.verdict)}>
          {verdictLabel(comparison.verdict)}
        </Badge>
      </TableCell>
      <TableCell className="px-2 text-right">
        {comparison.today.shotCount}
        <span className="text-muted-foreground">/{comparison.previous.shotCount}</span>
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
      <RateDeltaCell
        value={comparison.today.straightRate}
        delta={comparison.straightRateDelta}
        direction="higher"
        metric="straight"
      />
      <RateDeltaCell
        value={comparison.today.playableRate}
        delta={comparison.playableRateDelta}
        direction="higher"
        metric="playable"
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
      <span className={deltaClass(delta, direction)}>{deltaText(delta, unit, true)}</span>
    </span>
  );
}

function buildSignalLines(comparison: ClubDayComparison) {
  const parts = [
    isNumber(comparison.offlineDeltaYd) ? offlineDeltaText(comparison.offlineDeltaYd) : null,
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
}: {
  value: number | null;
  delta: number | null;
  unit: "yd";
  direction: "higher" | "lower";
}) {
  return (
    <TableCell className="px-2 text-right whitespace-normal">
      <div className="font-medium">{formatYards(value)}</div>
      <div className={deltaClass(delta, direction)}>{deltaText(delta, unit, true)}</div>
    </TableCell>
  );
}

function RateDeltaCell({
  value,
  delta,
  direction,
  metric,
}: {
  value: number | null;
  delta: number | null;
  direction: "higher";
  metric: "straight" | "playable";
}) {
  const tone = rateValueTone(value, metric);

  return (
    <TableCell className="px-2 text-right whitespace-normal">
      <div className="font-medium">{formatRate(value)}</div>
      <div className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <span
          className={`block h-full rounded-full ${rateBarClass(tone)}`}
          style={{ width: `${clamp(value ?? 0, 0, 100)}%` }}
        />
      </div>
      <div className={deltaClass(delta, direction)}>{deltaText(delta, "pp", true)}</div>
    </TableCell>
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
          ? "rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 shadow-sm"
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
        <StraightShotMetric label="Start" value={formatDegrees(shot.launchDirectionDeg)} />
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
  const chips: Array<{ label: string; href: string }> = [{ label: data.dateLabel, href: "/today" }];
  const session = data.sessions.find((item) => item.id === data.filters.sessionId);
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

function todaySortHref(data: TodayPracticeData, sort: ClubSort) {
  const params = new URLSearchParams({ date: data.dateKey });

  if (data.filters.sessionId) {
    params.set("session", data.filters.sessionId);
  }

  if (data.filters.club) {
    params.set("club", data.filters.club);
  }

  if (sort !== "bag") {
    params.set("clubSort", sort);
  }

  return `/today?${params.toString()}`;
}

function parseClubSort(value: string): ClubSort {
  if (value === "best" || value === "worst") {
    return value;
  }

  return "bag";
}

function sortClubComparisons(comparisons: ClubDayComparison[], sort: ClubSort) {
  if (sort === "best") {
    return [...comparisons].sort(compareBestClub);
  }

  if (sort === "worst") {
    return [...comparisons].sort(compareNeedsWork);
  }

  return comparisons;
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

function toChartClubStatuses(comparisons: ClubDayComparison[]): TodayChartClubStatus[] {
  return comparisons.map((comparison) => ({
    clubType: comparison.clubType,
    verdict: comparison.verdict,
    summary: comparison.summary,
  }));
}

function shotPatternInsight(data: TodayPracticeData) {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);

  if (!best && !work && !reliable) {
    return "Shot patterns will appear once this review has chartable club data.";
  }

  const parts = [
    work ? `${work.clubLabel} widened in this review` : null,
    best ? `${best.clubLabel} was the strongest performer` : null,
    reliable ? `${reliable.clubLabel} stayed most playable` : null,
  ].filter(Boolean) as string[];

  return `${sentenceJoin(parts)}.`;
}

function reviewNarrative(data: TodayPracticeData) {
  const { verdict, offlineDeltaYd, straightRateDelta, carryDeltaYd } = data.overall;

  if (!isNumber(offlineDeltaYd) && !isNumber(straightRateDelta) && !isNumber(carryDeltaYd)) {
    return data.overall.summary;
  }

  const best = bestClubComparison(data.clubComparisons);
  const focus = practiceFocus(data);
  const intro =
    best && data.clubComparisons.length > 0
      ? `${best.clubLabel} held up best, but ${focus.clubText} pulled the session down.`
      : verdict === "better"
        ? "Your dispersion improved in this review."
        : verdict === "worse"
          ? "This review finished behind your previous baseline."
          : verdict === "mixed"
            ? "This was a mixed session."
            : "This review is building a new baseline.";
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
  const session = data.sessions.find((item) => item.id === data.filters.sessionId);
  if (session) return session.label;
  return "All sessions for this practice date";
}

function practiceFocus(data: TodayPracticeData) {
  const work = needsWorkComparison(data.clubComparisons);
  const worseClubs = data.clubComparisons
    .filter((comparison) => comparison.verdict === "worse")
    .sort(compareNeedsWork)
    .slice(0, 3);
  const fallback = work ? [work] : data.clubComparisons.slice(0, 3);
  const focusClubs = worseClubs.length > 0 ? worseClubs : fallback;
  const clubText =
    focusClubs.length > 0
      ? joinLabels(focusClubs.map((comparison) => comparison.clubLabel))
      : "your next set";
  const problem = work
    ? `${clubText} pulled the session down. ${work.clubLabel} was the priority: ${formatRate(work.today.straightRate)} straight and ${formatYards(work.today.offlineAverageYd)} offline.`
    : data.overall.summary;

  return {
    clubText,
    problem,
  };
}

function practiceScoreSummary(data: TodayPracticeData): PracticeScoreSummary {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);
  const focus = practiceFocus(data);
  const confidence = snapshotConfidence(data.overall.today) ?? 50;
  const deltaBoost =
    (data.overall.offlineDeltaYd ?? 0) * -0.7 +
    (data.overall.straightRateDelta ?? 0) * 0.24 +
    (data.overall.playableRateDelta ?? 0) * 0.22 +
    (data.overall.carryDeltaYd ?? 0) * 0.08;
  const score = data.shots.length > 0 ? clamp(Math.round(confidence + deltaBoost), 0, 100) : 0;
  const tone = score >= 82 ? "green" : score >= 68 ? "amber" : score >= 50 ? "sky" : "pink";
  const trend =
    data.overall.verdict === "better"
      ? "Improving"
      : data.overall.verdict === "worse"
        ? "Needs work"
        : data.overall.verdict === "mixed"
          ? "Stable"
          : "Baseline";

  return {
    score,
    tone,
    strong: best?.clubLabel ?? reliable?.clubLabel ?? "Building",
    weak: work?.clubLabel ?? "None clear",
    recommendation: `${focus.clubText} delivery drill`,
    trend,
  };
}

function whatChangedItems(data: TodayPracticeData): WhatChangedItem[] {
  const items = data.clubComparisons.flatMap((comparison) => {
    const changes: WhatChangedItem[] = [];

    if (isNumber(comparison.carryDeltaYd)) {
      changes.push({
        label: `${comparison.clubLabel} carry`,
        value: deltaText(comparison.carryDeltaYd, "yd", true),
        detail: comparison.carryDeltaYd >= 0 ? "longer than baseline" : "shorter than baseline",
        tone: deltaTone(comparison.carryDeltaYd, "higher"),
        priority: Math.abs(comparison.carryDeltaYd) * 1.2,
      });
    }

    if (isNumber(comparison.offlineDeltaYd)) {
      changes.push({
        label: `${comparison.clubLabel} dispersion`,
        value:
          comparison.offlineDeltaYd <= 0
            ? `${numberFormatter.format(Math.abs(comparison.offlineDeltaYd))} yd tighter`
            : `${numberFormatter.format(comparison.offlineDeltaYd)} yd wider`,
        detail: comparison.offlineDeltaYd <= 0 ? "closer to target" : "wider cone than baseline",
        tone: deltaTone(comparison.offlineDeltaYd, "lower"),
        priority: Math.abs(comparison.offlineDeltaYd) * 1.5,
      });
    }

    if (isNumber(comparison.consistencyDeltaYd)) {
      changes.push({
        label: `${comparison.clubLabel} carry cone`,
        value:
          comparison.consistencyDeltaYd <= 0
            ? `${numberFormatter.format(Math.abs(comparison.consistencyDeltaYd))} yd tighter`
            : `${numberFormatter.format(comparison.consistencyDeltaYd)} yd wider`,
        detail:
          comparison.consistencyDeltaYd <= 0
            ? "carry cluster tightened"
            : "carry cluster spread out",
        tone: deltaTone(comparison.consistencyDeltaYd, "lower"),
        priority: Math.abs(comparison.consistencyDeltaYd),
      });
    }

    return changes;
  });

  const strongest = items.sort((left, right) => right.priority - left.priority).slice(0, 3);

  if (strongest.length > 0) {
    return strongest;
  }

  return [
    {
      label: "Carry",
      value: deltaText(data.overall.carryDeltaYd, "yd", true),
      detail: "against the comparable baseline",
      tone: deltaTone(data.overall.carryDeltaYd, "higher"),
      priority: 0,
    },
    {
      label: "Dispersion",
      value: offlineDeltaText(data.overall.offlineDeltaYd),
      detail: "average offline movement",
      tone: deltaTone(data.overall.offlineDeltaYd, "lower"),
      priority: 0,
    },
    {
      label: "Playable",
      value: deltaText(data.overall.playableRateDelta, "pp", true),
      detail: "playable shot rate",
      tone: deltaTone(data.overall.playableRateDelta, "higher"),
      priority: 0,
    },
  ];
}

function sessionImpactItems(data: TodayPracticeData): SessionImpactItem[] {
  const storyComparisons = uniqueComparisons([
    bestClubComparison(data.clubComparisons),
    reliableClubComparison(data.clubComparisons),
    needsWorkComparison(data.clubComparisons),
  ]);
  const comparisons =
    storyComparisons.length > 0 ? storyComparisons : data.clubComparisons.slice(0, 3);

  return comparisons.map((comparison) => {
    const value = sessionImpactValue(comparison);
    const tone = deltaTone(value, "higher");

    return {
      clubLabel: comparison.clubLabel,
      value,
      detail: impactDetail(comparison),
      tone,
    };
  });
}

function sessionImpactValue(comparison: ClubDayComparison) {
  if (comparison.verdict === "new") {
    return null;
  }

  const impact =
    clamp((comparison.offlineDeltaYd ?? 0) * -0.055, -0.42, 0.42) +
    clamp((comparison.straightRateDelta ?? 0) * 0.012, -0.25, 0.25) +
    clamp((comparison.playableRateDelta ?? 0) * 0.01, -0.2, 0.2) +
    clamp((comparison.carryDeltaYd ?? 0) * 0.015, -0.18, 0.18) +
    clamp((comparison.consistencyDeltaYd ?? 0) * -0.018, -0.18, 0.18);

  return roundOneNumber(clamp(impact, -0.8, 0.8));
}

function impactDetail(comparison: ClubDayComparison) {
  const signals = [
    isNumber(comparison.offlineDeltaYd) ? offlineDeltaText(comparison.offlineDeltaYd) : null,
    isNumber(comparison.playableRateDelta)
      ? `${deltaText(comparison.playableRateDelta, "pp", true)} playable`
      : null,
    isNumber(comparison.carryDeltaYd)
      ? `${deltaText(comparison.carryDeltaYd, "yd", true)} carry`
      : null,
  ].filter(Boolean) as string[];

  return signals.slice(0, 2).join(" / ") || comparison.summary;
}

function confidenceChangeItems(data: TodayPracticeData): ConfidenceChangeItem[] {
  const storyComparisons = uniqueComparisons([
    bestClubComparison(data.clubComparisons),
    reliableClubComparison(data.clubComparisons),
    needsWorkComparison(data.clubComparisons),
  ]);
  const comparisons =
    storyComparisons.length > 0 ? storyComparisons : data.clubComparisons.slice(0, 3);

  return comparisons.map((comparison) => {
    const previous =
      comparison.previous.shotCount > 0 ? snapshotConfidence(comparison.previous) : null;
    const current = comparison.today.shotCount > 0 ? snapshotConfidence(comparison.today) : null;
    const delta = isNumber(current) && isNumber(previous) ? current - previous : null;

    return {
      clubLabel: comparison.clubLabel,
      previous,
      current,
      delta,
      tone: deltaTone(delta, "higher"),
    };
  });
}

function driverHealthSummary(data: TodayPracticeData): DriverHealthSummary {
  const driverShots = data.shots.filter((shot) => isDriverClubType(shot.clubType));
  const path = roundOneNumber(averageNumbers(driverShots.map((shot) => shot.clubPathDeg)));
  const startLine = roundOneNumber(
    averageNumbers(driverShots.map((shot) => shot.launchDirectionDeg)),
  );
  const faceToPath =
    isNumber(path) && isNumber(startLine) ? roundOneNumber(startLine - path) : null;
  const targetPath = 5;

  if (driverShots.length === 0) {
    return {
      path: null,
      targetPath,
      startLine: null,
      faceToPath: null,
      status: "No driver in review",
      detail: "Add driver shots to see path, start line and draw health here.",
      tone: "slate",
    };
  }

  if (!isNumber(path)) {
    return {
      path: null,
      targetPath,
      startLine,
      faceToPath: null,
      status: "Driver path missing",
      detail: "Driver shots are present, but club-path data was not captured.",
      tone: "amber",
    };
  }

  if (
    path >= 3 &&
    path <= 7 &&
    (!isNumber(faceToPath) || (faceToPath >= -1.5 && faceToPath <= 3))
  ) {
    return {
      path,
      targetPath,
      startLine,
      faceToPath,
      status: "Healthy push draw",
      detail: "Path is sitting close to the +5 target window.",
      tone: "green",
    };
  }

  if (path < 3) {
    return {
      path,
      targetPath,
      startLine,
      faceToPath,
      status: "Path under target",
      detail: "Driver is not travelling enough from the inside for the target draw.",
      tone: "amber",
    };
  }

  if (isNumber(faceToPath) && faceToPath > 3) {
    return {
      path,
      targetPath,
      startLine,
      faceToPath,
      status: "Face too open",
      detail: "Path is usable, but the start line is drifting too far right.",
      tone: "pink",
    };
  }

  if (isNumber(faceToPath) && faceToPath < -1.5) {
    return {
      path,
      targetPath,
      startLine,
      faceToPath,
      status: "Face closing",
      detail: "Path is present, but start line is closing against it.",
      tone: "amber",
    };
  }

  return {
    path,
    targetPath,
    startLine,
    faceToPath,
    status: "Driver needs a check",
    detail: "Path is outside the target window for the preferred draw pattern.",
    tone: "amber",
  };
}

function snapshotConfidence(snapshot: TodayPracticeData["overall"]["today"]) {
  if (snapshot.shotCount <= 0) {
    return null;
  }

  const playable = snapshot.playableRate ?? 55;
  const straight = snapshot.straightRate ?? 24;
  const offline = isNumber(snapshot.offlineAverageYd)
    ? clamp(100 - snapshot.offlineAverageYd * 3.5, 0, 100)
    : 55;
  const consistency = isNumber(snapshot.carryStdDevYd)
    ? clamp(100 - snapshot.carryStdDevYd * 2.4, 0, 100)
    : 55;

  return clamp(
    Math.round(playable * 0.42 + straight * 0.24 + offline * 0.22 + consistency * 0.12),
    0,
    100,
  );
}

function uniqueComparisons(items: Array<ClubDayComparison | null>) {
  const seen = new Set<string>();
  const result: ClubDayComparison[] = [];

  for (const item of items) {
    if (!item || seen.has(item.clubType)) {
      continue;
    }

    seen.add(item.clubType);
    result.push(item);
  }

  return result;
}

function bestClubComparison(comparisons: ClubDayComparison[]) {
  return [...comparisons].sort(compareBestClub)[0] ?? null;
}

function needsWorkComparison(comparisons: ClubDayComparison[]) {
  return [...comparisons].sort(compareNeedsWork)[0] ?? null;
}

function reliableClubComparison(comparisons: ClubDayComparison[]) {
  return [...comparisons].sort(compareReliableClub)[0] ?? null;
}

function compareBestClub(left: ClubDayComparison, right: ClubDayComparison) {
  return (
    right.score - left.score ||
    valueOrZero(right.today.straightRate) - valueOrZero(left.today.straightRate) ||
    valueOrZero(right.today.playableRate) - valueOrZero(left.today.playableRate) ||
    valueOrZero(left.today.offlineAverageYd) - valueOrZero(right.today.offlineAverageYd)
  );
}

function compareNeedsWork(left: ClubDayComparison, right: ClubDayComparison) {
  return (
    left.score - right.score ||
    valueOrZero(left.today.straightRate) - valueOrZero(right.today.straightRate) ||
    valueOrZero(right.today.offlineAverageYd) - valueOrZero(left.today.offlineAverageYd)
  );
}

function compareReliableClub(left: ClubDayComparison, right: ClubDayComparison) {
  return (
    valueOrZero(right.today.playableRate) - valueOrZero(left.today.playableRate) ||
    valueOrZero(right.today.straightRate) - valueOrZero(left.today.straightRate) ||
    valueOrZero(left.today.offlineAverageYd) - valueOrZero(right.today.offlineAverageYd)
  );
}

function clubPerformanceNarrative(data: TodayPracticeData) {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);

  if (!best || !work || !reliable) {
    return "This review against the latest previous shots for the same club.";
  }

  return `${best.clubLabel} improved, ${reliable.clubLabel} stayed reliable, and ${work.clubLabel} needs the most attention.`;
}

function clubPerformanceRead(data: TodayPracticeData) {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);

  if (!best || !work || !reliable) {
    return data.overall.summary;
  }

  return `${best.clubLabel} helped the session, ${reliable.clubLabel} held playable rate, and ${work.clubLabel} caused most of the damage.`;
}

function joinLabels(labels: string[]) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function valueOrZero(value: number | null) {
  return isNumber(value) ? value : 0;
}

function offlineStatus(value: number | null) {
  if (value === null) return "Baseline";
  if (value < -1) return "Straighter";
  if (value > 1) return "Watch";
  return "Stable";
}

function rateStatus(value: number | null, stableLabel = "Stable") {
  if (value === null) return "Baseline";
  if (value > 1) return "Up";
  if (value < -1) return "Down";
  return stableLabel;
}

function carryStatus(value: number | null) {
  if (value === null) return "Baseline";
  if (value > 1) return "Longer";
  if (value < -1) return "Shorter";
  return "Stable";
}

function reviewIconClass(tone: "green" | "sky" | "pink" | "amber" | "slate") {
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "pink") return "bg-pink-50 text-pink-700";
  if (tone === "amber") return "bg-amber-50 text-amber-800";
  if (tone === "sky") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function reviewStatusClass(tone: "green" | "sky" | "pink" | "amber" | "slate") {
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "pink") return "bg-pink-50 text-pink-700";
  if (tone === "amber") return "bg-amber-50 text-amber-800";
  if (tone === "sky") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function practiceStepCardClass(status: PracticeCardStatus) {
  if (status === "ready") {
    return "border-[#dbe4de] border-b-[#0B7A3B] shadow-[0_10px_24px_rgba(15,23,42,0.055),inset_0_-1px_0_#0B7A3B]";
  }

  if (status === "needed") {
    return "border-amber-200 border-b-amber-500 shadow-[0_8px_20px_rgba(146,64,14,0.06)]";
  }

  return "border-[#d9ded8] border-b-slate-400 shadow-[0_8px_20px_rgba(15,23,42,0.045)]";
}

function practiceStepNumberClass(status: PracticeCardStatus) {
  if (status === "ready") {
    return "grid size-8 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800";
  }

  if (status === "needed") {
    return "grid size-8 place-items-center rounded-full bg-amber-50 text-sm font-semibold text-amber-800";
  }

  return "grid size-8 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700";
}

function practiceIllustrationClass(tone: PracticeCardTone) {
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "pink") return "bg-pink-50 text-pink-700";
  if (tone === "amber") return "bg-amber-50 text-amber-800";
  if (tone === "sky") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-500";
}

function prescriptionToneClass(tone: "green" | "sky" | "pink" | "amber") {
  if (tone === "green") {
    return "border-emerald-100 bg-[linear-gradient(135deg,#f6fbf7_0%,#ffffff_100%)] text-emerald-800";
  }

  if (tone === "pink") {
    return "border-pink-100 bg-[linear-gradient(135deg,#fff5f8_0%,#ffffff_100%)] text-pink-800";
  }

  if (tone === "amber") {
    return "border-amber-100 bg-[linear-gradient(135deg,#fff9ed_0%,#ffffff_100%)] text-amber-900";
  }

  return "border-sky-100 bg-[linear-gradient(135deg,#f2f8ff_0%,#ffffff_100%)] text-sky-800";
}

function summaryIconClass(tone: "green" | "pink" | "sky") {
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "pink") return "bg-pink-50 text-pink-700";
  return "bg-sky-50 text-sky-700";
}

function rateBarClass(tone: "green" | "sky" | "pink" | "amber" | "slate") {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "pink") return "bg-pink-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "sky") return "bg-sky-500";
  return "bg-slate-400";
}

function clubRowTone(
  comparison: ClubDayComparison,
  bestClubType: string | null,
  focusClubType: string | null,
) {
  if (comparison.clubType === focusClubType) {
    return {
      rowClass: "bg-amber-50/45 hover:bg-amber-50",
      stickyClass: "bg-amber-50",
    };
  }

  if (comparison.clubType === bestClubType) {
    return {
      rowClass: "bg-emerald-50/35 hover:bg-emerald-50",
      stickyClass: "bg-emerald-50",
    };
  }

  if (comparison.verdict === "worse") {
    return {
      rowClass: "hover:bg-pink-50/45",
      stickyClass: "bg-white",
    };
  }

  return {
    rowClass: "hover:bg-slate-50/80",
    stickyClass: "bg-white",
  };
}

function rateValueTone(
  value: number | null,
  metric: "straight" | "playable",
): "green" | "sky" | "pink" | "amber" | "slate" {
  if (value === null) return "slate";

  if (metric === "playable") {
    if (value >= 85) return "green";
    if (value >= 70) return "amber";
    return "pink";
  }

  if (value >= 35) return "green";
  if (value >= 20) return "amber";
  return "pink";
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

function verdictCardClass(tone: ReviewTone) {
  if (tone === "green") return "border-emerald-100 bg-emerald-50/65 text-emerald-950";
  if (tone === "pink") return "border-pink-100 bg-pink-50/65 text-pink-950";
  if (tone === "amber") return "border-amber-100 bg-amber-50/70 text-amber-950";
  if (tone === "sky") return "border-sky-100 bg-sky-50/70 text-sky-950";
  return "border-slate-200 bg-slate-50 text-slate-950";
}

function impactValueClass(tone: ReviewTone) {
  if (tone === "green") return "text-emerald-700";
  if (tone === "pink") return "text-pink-700";
  if (tone === "amber") return "text-amber-800";
  if (tone === "sky") return "text-sky-700";
  return "text-slate-600";
}

function verdictTone(verdict: TodayPracticeData["overall"]["verdict"]) {
  if (verdict === "better") return "green";
  if (verdict === "worse") return "pink";
  if (verdict === "mixed") return "amber";
  return "slate";
}

function deltaTone(value: number | null, direction: "higher" | "lower") {
  if (value === null) return "slate";
  if (Math.abs(value) <= 1) return "amber";
  const isGood = direction === "higher" ? value > 0 : value < 0;
  return isGood ? "green" : "pink";
}

function offlineKpiTone(value: number | null) {
  if (value === null) return "slate";
  if (value < -1) return "green";
  if (value > 3) return "pink";
  return "amber";
}

function playableKpiTone(value: number | null) {
  if (value === null) return "slate";
  if (value > 1) return "green";
  if (value < -5) return "pink";
  return "amber";
}

function verdictBadgeClass(verdict: ClubDayComparison["verdict"]) {
  if (verdict === "better")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (verdict === "worse") return "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-50";
  if (verdict === "mixed") return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50";
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
        : tone === "amber"
          ? "text-amber-800"
          : "text-muted-foreground";
  return `text-xs ${color}`;
}

function deltaText(value: number | null, unit: "yd" | "mph" | "pp", showNoBaseline = false) {
  if (value === null) return showNoBaseline ? "No baseline" : "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)} ${unit}`;
}

function formatSignedDecimal(value: number | null) {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
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
  return unit === "ratio" ? smashFormatter.format(value) : numberFormatter.format(value);
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

function confidenceRangeText(item: ConfidenceChangeItem) {
  if (!isNumber(item.current)) {
    return "--";
  }

  if (!isNumber(item.previous)) {
    return `${item.current}% baseline`;
  }

  return `${item.previous}% to ${item.current}% (${deltaText(item.delta, "pp", true)})`;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOneNumber(value: number | null | undefined) {
  return isNumber(value) ? Math.round(value * 10) / 10 : null;
}

function averageNumbers(items: Array<number | null>) {
  const values = items.filter(isNumber);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function cssAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
