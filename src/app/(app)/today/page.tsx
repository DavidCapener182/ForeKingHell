import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
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
  MobileDataCard,
  MobileFilterSheet,
  MobileHorizontalRail,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  commonAiPrompts,
  type DesktopInsightMetric,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Table,
  TableBody,
  TableCaption,
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
import { isEstimatedClubData } from "@/lib/club-analytics";
import { calculateClubFaceAngleDeg } from "@/lib/club-face-angle";
import { formatClubType } from "@/lib/club-format";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlanForSourceSessions } from "@/lib/practice-planner";
import {
  clubTypeCurrentPerformanceScore,
  clubTypeEstimatedStrokeEffect,
} from "@/lib/today-club-scoring";
import {
  buildPlanResultReadout,
  buildScoringControlReadout,
  buildSessionQualityReadout,
  clubControlLabel,
  clubSessionBadgeReadout,
  latestPracticeHeadline,
} from "@/lib/today-practice-scoring";
import {
  type ClubDayComparison,
  type ClubMainStatMetric,
  type ClubMainStats,
  type TodayPracticeData,
  type TodayPracticeShot,
  getTodayPracticeData,
  isExcludedPracticeQualityTag,
} from "@/lib/today-session-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type TodaySocialContext = {
  loaded: boolean;
  challenges: ChallengeListItem[];
};

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
const MIN_CONFIDENT_CLUB_SHOTS = 5;
type MetricUnit = "yd" | "mph" | "deg" | "ft" | "ratio";
type HighlightDirection = "higher" | "lower";
type HighlightKind = "record" | "tie" | "close";
type ClubSort = "bag" | "best" | "worst";
type ReviewTone = "green" | "sky" | "pink" | "amber" | "slate";
type PracticeReviewMode = "clean" | "raw";

const todayClubPerformanceColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "call", label: "Call" },
  { id: "shots", label: "Shots" },
  { id: "carry", label: "Carry" },
  { id: "offline", label: "Offline" },
  { id: "straight", label: "Straight" },
  { id: "playable", label: "Lateral window" },
  { id: "signal", label: "Signal" },
];

const todayRawShotColumns: DesktopWorkbenchColumn[] = [
  { id: "session", label: "Session", locked: true },
  { id: "shot", label: "Shot" },
  { id: "club", label: "Club" },
  { id: "type", label: "Type" },
  { id: "quality", label: "Quality" },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "side", label: "Side" },
  { id: "start", label: "Start" },
  { id: "launch", label: "Launch" },
  { id: "ball", label: "Ball speed" },
  { id: "smash", label: "Smash" },
];

const todaySavedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Latest practice",
    href: "/today",
    detail: "Review the freshest import, club calls and clean scoring evidence.",
  },
  {
    title: "Worst clubs first",
    href: "/today?clubSort=worst",
    detail: "Put the practice opportunities at the top of the comparison board.",
  },
  {
    title: "Shot explorer",
    href: "/shots",
    detail: "Open the underlying launch-monitor rows with full filters and export.",
  },
];

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
  sessionQualityLabel: "Good" | "Productive" | "Mixed" | "Poor";
  sessionQualityDetail: string;
  playableRateLabel: string;
  strikeScore: number;
  scoringScore: number;
  scoringControlLabel: string;
  tone: ReviewTone;
  strong: string;
  weak: string;
  recommendation: string;
  strikeDetail: string;
  scoringDetail: string;
};

type WhatChangedItem = {
  label: string;
  value: string;
  detail: string;
  tone: ReviewTone;
  priority: number;
};

type VerdictReasonItem = {
  label: string;
  value: string;
  tone: ReviewTone;
};

type ConfidenceMeterItem = {
  clubLabel: string;
  score: number | null;
  label: string;
  reason: string;
  tone: ReviewTone;
};

type DriverHealthSummary = {
  path: number | null;
  targetPath: number;
  startLine: number | null;
  faceAngle: number | null;
  faceToPath: number | null;
  measuredShotCount: number;
  totalShotCount: number;
  status: string;
  detail: string;
  tone: ReviewTone;
};

type SessionCoachingSummary = {
  strikeScore: number;
  strikeDetail: string;
  scoringScore: number;
  scoringDetail: string;
  biggestGain: ClubDayComparison | null;
  gainDetail: string;
  biggestOpportunity: ClubDayComparison | null;
  opportunityDetail: string;
  opportunityCause: string;
  opportunityTarget: string;
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
  const userId = await requireCurrentUserId();
  const socialLoaded = shouldLoadTodaySocial(first(params.social));
  const [data, challengeData] = await Promise.all([
    getTodayPracticeData({
      date: first(params.date),
      sessionId: first(params.session),
      club: first(params.club),
    }),
    socialLoaded ? getChallengesPageData() : Promise.resolve(null),
  ]);
  const linkedPracticePlan = await getPracticePlanForSourceSessions(
    userId,
    data.sessions.map((session) => session.id),
  );
  const socialContext: TodaySocialContext = {
    loaded: socialLoaded,
    challenges: challengeData?.active ?? [],
  };
  const reviewMode = parsePracticeReviewMode(first(params.evidence));
  const selectedReviewOverall = reviewOverall(data, reviewMode);
  const selectedReviewComparisons = reviewComparisons(data, reviewMode);
  const shotDatabaseHref = shotDatabaseLink(data);
  const chartShots = toChartShots(reviewShots(data, reviewMode));
  const chartClubStatuses = toChartClubStatuses(selectedReviewComparisons);
  const chartPatternInsight = shotPatternInsight(selectedReviewComparisons);
  const clubSort = parseClubSort(first(params.clubSort));
  const sortedClubComparisons = sortClubComparisons(selectedReviewComparisons, clubSort);
  const activeFilterChips = buildTodayFilterChips(data);

  return (
    <PageShell size="full" className="today-review-page" contentClassName="pb-4 sm:pb-5">
      <TodayHoverStyles comparisons={data.clubComparisons} />
      <MobileAppShell className="min-h-0 pb-0">
        <MobileTopBar title="Today" />
        <TodayMobileVerdictCard
          data={data}
          reviewMode={reviewMode}
          linkedPracticePlan={linkedPracticePlan}
        />
        <TodayPrescriptionCard data={data} shotDatabaseHref={shotDatabaseHref} />
        <TodayMobileIntent
          data={data}
          linkedPracticePlan={linkedPracticePlan}
          shotDatabaseHref={shotDatabaseHref}
        />
        <TodayMobileScopeSheet
          data={data}
          activeFilterChips={activeFilterChips}
          reviewMode={reviewMode}
          clubSort={clubSort}
        />
        {data.shots.length > 0 ? (
          <TodayMobileEvidence
            data={data}
            reviewMode={reviewMode}
            selectedReviewOverall={selectedReviewOverall}
            comparisons={sortedClubComparisons}
            clubSort={clubSort}
            chartShots={chartShots}
            chartClubStatuses={chartClubStatuses}
            chartPatternInsight={chartPatternInsight}
            shotDatabaseHref={shotDatabaseHref}
            linkedPracticePlan={linkedPracticePlan}
          />
        ) : (
          <TodayMobileEmpty />
        )}
      </MobileAppShell>

      <TodayDesktopDashboard
        data={data}
        socialContext={socialContext}
        shotDatabaseHref={shotDatabaseHref}
        chartShots={chartShots}
        chartClubStatuses={chartClubStatuses}
        chartPatternInsight={chartPatternInsight}
        comparisons={sortedClubComparisons}
        clubSort={clubSort}
        activeFilterChips={activeFilterChips}
        linkedPracticePlan={linkedPracticePlan}
      />
    </PageShell>
  );
}

function TodayMobileIntent({
  data,
  linkedPracticePlan,
  shotDatabaseHref,
}: {
  data: TodayPracticeData;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
  shotDatabaseHref: string;
}) {
  const focus = practiceFocus(data);
  const planResult = buildPlanResultReadout(linkedPracticePlan);

  return (
    <section className="grid gap-3 lg:hidden" aria-labelledby="today-intent-heading">
      <IOSSectionHeader
        title={<span id="today-intent-heading">Today&apos;s plan</span>}
        description="The next useful move, followed by the evidence only when you need it."
      />
      <IOSGroupedList label="Today plan">
        <IOSListRow
          label="Practice intent"
          value={data.shots.length > 0 ? focus.clubText : "Set up"}
          detail={
            data.shots.length > 0
              ? "Open the focused task flow for the first drill."
              : "Import a measured session before choosing a drill."
          }
          href={data.shots.length > 0 ? "/practice" : "/import"}
          icon={Dumbbell}
          status={
            <IOSInlineStatus
              label={data.shots.length > 0 ? "Ready to practise" : "Evidence needed"}
              tone={data.shots.length > 0 ? "positive" : "attention"}
            />
          }
        />
        {linkedPracticePlan ? (
          <IOSListRow
            label="Planned drill"
            value={planResult?.label ?? "Linked"}
            detail={linkedPracticePlan.title}
            href={linkedPracticePlan.href}
            icon={CalendarDays}
          />
        ) : null}
        <IOSListRow
          label="Latest review"
          value={`${integerFormatter.format(data.shots.length)} clean`}
          detail="Open the complete filtered shot explorer."
          href={shotDatabaseHref}
          icon={Database}
        />
        {data.dataCleaning.excludedShotCount > 0 ? (
          <IOSListRow
            label="Scoring sample"
            value={`${integerFormatter.format(data.dataCleaning.excludedShotCount)} held out`}
            detail={`${integerFormatter.format(data.dataCleaning.cleanShotCount)} of ${integerFormatter.format(
              data.dataCleaning.importedShotCount,
            )} imported shots drive this recommendation.`}
            status={<IOSInlineStatus label={data.dataCleaning.reasonLabel} tone="attention" />}
          />
        ) : null}
      </IOSGroupedList>
    </section>
  );
}

function TodayMobileScopeSheet({
  data,
  activeFilterChips,
  reviewMode,
  clubSort,
}: {
  data: TodayPracticeData;
  activeFilterChips: { label: string; href: string }[];
  reviewMode: PracticeReviewMode;
  clubSort: ClubSort;
}) {
  return (
    <section className="grid gap-2 lg:hidden" aria-label="Today review scope">
      <MobileFilterSheet label="Review scope" activeCount={activeFilterChips.length}>
        <form className="grid gap-4 pb-3 [&_input]:min-h-11 [&_select]:min-h-11">
          <TodayScopeFields data={data} />
          <input type="hidden" name="evidence" value={reviewMode} />
          <input type="hidden" name="clubSort" value={clubSort} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" className="min-h-11 rounded-lg">
              Apply scope
            </Button>
            <Button asChild variant="outline" className="min-h-11 rounded-lg">
              <Link href="/today" prefetch={false}>
                Reset
              </Link>
            </Button>
          </div>
        </form>
        <TodayReviewControls data={data} mode={reviewMode} clubSort={clubSort} />
      </MobileFilterSheet>
      {activeFilterChips.length > 0 ? (
        <p className="px-1 text-[13px] text-muted-foreground">
          {activeFilterChips.map((chip) => chip.label).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function TodayMobileEvidence({
  data,
  reviewMode,
  selectedReviewOverall,
  comparisons,
  clubSort,
  chartShots,
  chartClubStatuses,
  chartPatternInsight,
  shotDatabaseHref,
  linkedPracticePlan,
}: {
  data: TodayPracticeData;
  reviewMode: PracticeReviewMode;
  selectedReviewOverall: ReturnType<typeof reviewOverall>;
  comparisons: ClubDayComparison[];
  clubSort: ClubSort;
  chartShots: TodayChartShot[];
  chartClubStatuses: TodayChartClubStatus[];
  chartPatternInsight: string;
  shotDatabaseHref: string;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
}) {
  const highlights = buildClubHighlights(data.clubStats, buildClubEquipmentMap(data.shots));

  return (
    <section className="grid gap-3 lg:hidden" aria-labelledby="today-depth-heading">
      <IOSSectionHeader
        title={<span id="today-depth-heading">Evidence and detail</span>}
        description="Open one section at a time. The recommendation above stays the main task."
      />
      <IOSDisclosureGroup
        label="Today evidence sections"
        items={[
          {
            value: "numbers",
            title: "Current numbers",
            summary: `${integerFormatter.format(data.shots.length)} shots`,
            description:
              reviewMode === "clean" ? "Trusted scoring sample" : "All imported evidence",
            content: (
              <TodayMobileMetricRows
                data={data}
                reviewMode={reviewMode}
                selectedReviewOverall={selectedReviewOverall}
                linkedPracticePlan={linkedPracticePlan}
              />
            ),
          },
          {
            value: "clubs",
            title: "Club performance",
            summary: `${comparisons.length} clubs`,
            description: "Scan the call first; open the full explorer only for deeper data.",
            content: (
              <TodayMobileClubRows data={data} comparisons={comparisons} clubSort={clubSort} />
            ),
          },
          {
            value: "charts",
            title: "Dispersion and trajectory",
            summary: `${integerFormatter.format(chartShots.length)} shots`,
            description: "Specialist visual evidence for the current selection.",
            content: (
              <div className="-mx-2 min-w-0 overflow-x-clip">
                <TodayShotCharts
                  shots={chartShots}
                  clubStatuses={chartClubStatuses}
                  patternInsight={chartPatternInsight}
                />
              </div>
            ),
          },
          {
            value: "highlights",
            title: "Highlights",
            summary: `${highlights.length} signals`,
            description: "Personal bests, close calls and the straightest shot.",
            content: (
              <TodayMobileHighlightRows
                highlights={highlights}
                bestShot={data.bestStraightShots[0] ?? null}
              />
            ),
          },
          {
            value: "shots",
            title: "Imported shot rows",
            summary: integerFormatter.format(data.rawShots.length),
            description: "A concise preview with clean-scoring exclusions labelled.",
            content: <TodayMobileShotRows data={data} shotDatabaseHref={shotDatabaseHref} />,
          },
        ]}
      />
    </section>
  );
}

function TodayMobileMetricRows({
  data,
  reviewMode,
  selectedReviewOverall,
  linkedPracticePlan,
}: {
  data: TodayPracticeData;
  reviewMode: PracticeReviewMode;
  selectedReviewOverall: ReturnType<typeof reviewOverall>;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
}) {
  const planResult = buildPlanResultReadout(linkedPracticePlan);

  return (
    <IOSGroupedList label="Current practice numbers" className="bg-card">
      <IOSMetricRow
        label="Offline"
        value={formatYards(selectedReviewOverall.today.offlineAverageYd)}
        detail={offlineDeltaText(selectedReviewOverall.offlineDeltaYd)}
      />
      <IOSMetricRow
        label="Straight"
        value={formatRate(selectedReviewOverall.today.straightRate)}
        detail={deltaText(selectedReviewOverall.straightRateDelta, "pp", true)}
      />
      <IOSMetricRow
        label="Lateral window"
        value={formatRate(selectedReviewOverall.today.playableRate)}
        detail={deltaText(selectedReviewOverall.playableRateDelta, "pp", true)}
      />
      <IOSMetricRow
        label="Carry"
        value={formatYards(selectedReviewOverall.today.carryAverageYd)}
        detail={deltaText(selectedReviewOverall.carryDeltaYd, "yd", true)}
      />
      <IOSListRow
        label="Evidence mode"
        value={reviewMode === "clean" ? "Trusted shots" : "All imported"}
        detail={`${integerFormatter.format(data.dataCleaning.cleanShotCount)} clean · ${integerFormatter.format(
          data.dataCleaning.excludedShotCount,
        )} held out`}
      />
      {planResult ? (
        <IOSListRow
          label="Plan versus actual"
          value={planResult.label}
          detail={planResult.detail}
          href={linkedPracticePlan?.href}
        />
      ) : null}
    </IOSGroupedList>
  );
}

function TodayMobileClubRows({
  data,
  comparisons,
  clubSort,
}: {
  data: TodayPracticeData;
  comparisons: ClubDayComparison[];
  clubSort: ClubSort;
}) {
  return (
    <div className="grid gap-3">
      <nav aria-label="Sort club performance" className="ios-route-tabs grid grid-cols-3">
        {(
          [
            ["worst", "Needs work"],
            ["best", "Best"],
            ["bag", "Bag order"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={todaySortHref(data, value)}
            prefetch={false}
            aria-current={clubSort === value ? "page" : undefined}
            className="ios-route-tab focus-aaa inline-flex min-h-11 items-center justify-center px-2 text-center outline-none"
          >
            {label}
          </Link>
        ))}
      </nav>
      <IOSGroupedList label="Club performance rows" className="bg-card">
        {comparisons.map((comparison) => (
          <IOSListRow
            key={comparison.clubType}
            label={comparison.clubLabel}
            value={clubComparisonCallLabel(comparison)}
            detail={`${comparison.today.shotCount} shots · ${formatYards(
              comparison.today.carryAverageYd,
            )} carry · ${formatYards(comparison.today.offlineAverageYd)} offline`}
            status={
              <span className="text-[13px] leading-[1.15rem] text-muted-foreground">
                {clubComparisonSignalText(comparison)}
              </span>
            }
          />
        ))}
      </IOSGroupedList>
    </div>
  );
}

function TodayMobileHighlightRows({
  highlights,
  bestShot,
}: {
  highlights: ClubHighlight[];
  bestShot: TodayPracticeShot | null;
}) {
  return (
    <IOSGroupedList label="Latest practice highlights" className="bg-card">
      {bestShot ? (
        <IOSListRow
          label="Shot of the day"
          value={formatYards(bestShot.carryYd)}
          detail={`${formatClubType(bestShot.clubType)} · ${formatSignedYards(
            bestShot.sideCarryYd,
          )} side`}
          icon={Crosshair}
          status={<IOSInlineStatus label="Straightest selected shot" tone="info" />}
        />
      ) : null}
      {highlights.slice(0, 8).map((highlight) => (
        <IOSListRow
          key={highlight.id}
          label={`${highlight.clubLabel} · ${highlight.metricLabel}`}
          value={highlight.value}
          detail={highlight.detail}
          status={
            <IOSInlineStatus
              label={highlight.kind === "close" ? "Close to PB" : "Personal best"}
              tone={highlight.kind === "close" ? "attention" : "positive"}
            />
          }
        />
      ))}
      {highlights.length === 0 && !bestShot ? (
        <IOSListRow
          label="No highlight yet"
          detail="The selected practice does not contain a PB or directional highlight."
        />
      ) : null}
    </IOSGroupedList>
  );
}

function TodayMobileShotRows({
  data,
  shotDatabaseHref,
}: {
  data: TodayPracticeData;
  shotDatabaseHref: string;
}) {
  return (
    <IOSGroupedList label="Imported shot preview" className="bg-card">
      {data.rawShots.slice(0, 10).map((shot) => {
        const heldOut = isExcludedPracticeQualityTag(shot.qualityTag);

        return (
          <IOSListRow
            key={shot.id}
            label={`${formatClubType(shot.clubType)} · shot ${shot.shotNumber ?? "--"}`}
            value={formatYards(shot.carryYd)}
            detail={`${formatSignedYards(shot.sideCarryYd)} side · ${formatYards(
              shot.totalYd,
            )} total`}
            status={
              <IOSInlineStatus
                label={formatShotQualityLabel(shot)}
                tone={heldOut ? "attention" : "positive"}
              />
            }
          />
        );
      })}
      <IOSListRow
        label="Open every shot"
        value={integerFormatter.format(data.rawShots.length)}
        detail="Use the full explorer for filters, audit detail and export."
        href={shotDatabaseHref}
        icon={Database}
      />
    </IOSGroupedList>
  );
}

function TodayMobileEmpty() {
  return (
    <section className="grid gap-3 lg:hidden" aria-labelledby="today-empty-heading">
      <IOSSectionHeader title={<span id="today-empty-heading">Get a useful read today</span>} />
      <IOSGroupedList label="Today first-use actions">
        <IOSListRow
          label="Import launch-monitor shots"
          detail="Add a measured practice session to unlock the recommendation."
          href="/import"
          icon={Upload}
        />
        <IOSListRow
          label="Connect Rapsodo"
          detail="Bring the newest session in from R-Cloud."
          href="/rapsodo"
          icon={Database}
        />
      </IOSGroupedList>
    </section>
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
    <section id="focus" className="ios-grouped-list grid gap-3 p-4 lg:hidden">
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

function TodayMobileVerdictCard({
  data,
  reviewMode,
  linkedPracticePlan,
}: {
  data: TodayPracticeData;
  reviewMode: PracticeReviewMode;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
}) {
  const score = practiceScoreSummary(data, reviewMode);
  const comparisons = reviewComparisons(data, reviewMode);
  const best = bestClubComparison(comparisons);
  const work = needsWorkComparison(comparisons);
  const planResult = buildPlanResultReadout(linkedPracticePlan);

  return (
    <section id="verdict" className="ios-grouped-list lg:hidden">
      <div className="ios-grouped-row flex items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Latest session</p>
          <h2 className="mt-1 text-[22px] font-bold leading-7 tracking-[-0.02em]">
            {heroVerdictTitle(data, reviewMode)}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] text-muted-foreground">Practice usefulness</p>
          <p className="mt-0.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {score.score}
          </p>
          <p className="text-xs text-muted-foreground">out of 100</p>
        </div>
      </div>
      <TodayVerdictRow label="Best current form" value={best?.clubLabel ?? score.strong} />
      <TodayVerdictRow label="Practise first" value={work?.clubLabel ?? score.weak} />
      {planResult ? <TodayVerdictRow label="Planned drill" value={planResult.label} /> : null}
      <Link
        href={data.shots.length > 0 ? "/practice" : "/import"}
        prefetch={false}
        aria-label={`${score.recommendation}. ${data.shots.length > 0 ? "Open practice" : "Import a session"}`}
        className="focus-aaa grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-secondary/55 px-4 py-2.5 outline-none transition-colors active:bg-secondary motion-reduce:transition-none"
      >
        <span className="min-w-0">
          <span className="block text-[13px] text-muted-foreground">Recommendation</span>
          <span className="mt-0.5 block text-[15px] font-semibold leading-5">
            {score.recommendation}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}

function TodayVerdictRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ios-grouped-row grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
      <span className="text-[15px] text-muted-foreground">{label}</span>
      <span className="max-w-48 truncate text-right text-[15px] font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function TodayReviewControls({
  data,
  mode,
  clubSort,
}: {
  data: TodayPracticeData;
  mode: PracticeReviewMode;
  clubSort: ClubSort;
}) {
  const sessionId =
    data.sessions.find((session) => session.id === data.filters.sessionId)?.id ??
    data.sessions[0]?.id ??
    null;

  return (
    <section aria-labelledby="today-review-controls" className="ios-grouped-list lg:hidden">
      <div className="ios-grouped-row px-4 py-3">
        <h2 id="today-review-controls" className="text-[17px] font-semibold">
          Review controls
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Switch the evidence set without deleting imported shots.
        </p>
      </div>
      <div className="ios-grouped-row px-4 py-3">
        <p className="mb-2 text-[13px] text-muted-foreground">Evidence</p>
        <nav aria-label="Session evidence view" className="ios-route-tabs flex">
          {(["clean", "raw"] as const).map((value) => (
            <Link
              key={value}
              href={todayReviewModeHref(data, clubSort, value)}
              aria-current={mode === value ? "page" : undefined}
              className="ios-route-tab focus-aaa inline-flex min-w-0 flex-1 items-center justify-center outline-none"
            >
              {value === "clean" ? "Trusted shots" : "All imported"}
            </Link>
          ))}
        </nav>
      </div>
      <dl>
        <TodayReviewControlRow label="Distance" value="Carry or total in Charts" />
        <TodayReviewControlRow
          label="Direction"
          value="Centreline; no separate target offset was imported"
        />
        <TodayReviewControlRow
          label="Values"
          value="Provider rows normalised to the stored yard and mph schema"
        />
      </dl>
      {sessionId ? (
        <div className="px-4 py-3">
          <Button asChild variant="outline" className="min-h-11 w-full rounded-xl">
            <Link href={`/analyse/session-impact?sessionId=${encodeURIComponent(sessionId)}`}>
              Simulate outlier exclusions
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function TodayReviewControlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ios-grouped-row grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-right text-[13px] font-medium leading-5">{value}</dd>
    </div>
  );
}

type TodayBentoSpan = 4 | 5 | 6 | 7 | 8 | 12;

function todayBentoSpan(span: TodayBentoSpan): CSSProperties {
  return { gridColumn: `span ${span} / span ${span}` };
}

function TodayBentoItem({
  children,
  className = "",
  id,
  span,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  span: TodayBentoSpan;
}) {
  return (
    <div id={id} className={`min-w-0 self-start ${className}`} style={todayBentoSpan(span)}>
      {children}
    </div>
  );
}

function TodayDesktopDashboard({
  data,
  socialContext,
  shotDatabaseHref,
  chartShots,
  chartClubStatuses,
  chartPatternInsight,
  comparisons,
  clubSort,
  activeFilterChips,
  linkedPracticePlan,
}: {
  data: TodayPracticeData;
  socialContext: TodaySocialContext;
  shotDatabaseHref: string;
  chartShots: TodayChartShot[];
  chartClubStatuses: TodayChartClubStatus[];
  chartPatternInsight: string;
  comparisons: ClubDayComparison[];
  clubSort: ClubSort;
  activeFilterChips: { label: string; href: string }[];
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
}) {
  const hasShots = data.shots.length > 0;

  return (
    <DesktopWorkbenchLayout
      scope="today"
      className="hidden lg:grid"
      railBreakpoint="wide"
      rail={
        <DesktopInsightRail
          title="AI latest-practice rail"
          description="Explain the latest practice, compare it with baseline and turn visible evidence into the next drill."
          metrics={todayInsightMetrics(data, linkedPracticePlan)}
          evidence={todayInsightEvidence(data, linkedPracticePlan)}
          prompts={commonAiPrompts("latest practice review")}
          actions={[
            {
              label: "Open shot rows",
              href: shotDatabaseHref,
              detail: "Filter, compare and export the underlying launch-monitor rows.",
              icon: Database,
            },
            {
              label: "Open planner",
              href: "/practice",
              detail: "Turn the latest practice readout into the next range block.",
              icon: Dumbbell,
            },
          ]}
        />
      }
    >
      <div
        className="grid auto-rows-auto items-start gap-4 lg:gap-5"
        style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
      >
        <div className="flex items-center justify-between gap-4" style={todayBentoSpan(12)}>
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
            <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </div>
        </div>

        <TodayBentoItem span={12}>
          <div className="@container/today-top">
            <div
              data-equal-height-row="today-top"
              className="today-top-grid grid items-stretch gap-4 lg:gap-5"
            >
              <div className="today-summary-stack @container/today-summary grid min-w-0 gap-4 lg:gap-5">
                <TodayVerdictHero
                  data={data}
                  linkedPracticePlan={linkedPracticePlan}
                  className="h-full"
                />
                <WhatChangedCard items={whatChangedItems(data)} className="h-full" />
              </div>
              <TodayScoreStack
                data={data}
                linkedPracticePlan={linkedPracticePlan}
                className="h-full"
              />
            </div>
          </div>
        </TodayBentoItem>
        <TodayBentoItem span={12}>
          <DriverHealthCard summary={driverHealthSummary(data)} />
        </TodayBentoItem>
        <TodayBentoItem span={12}>
          <SessionSignalStrip data={data} />
        </TodayBentoItem>
        <TodayBentoItem span={12}>
          <TodayKpiStrip data={data} />
        </TodayBentoItem>

        <TodayBentoItem id="focus" span={12} className="scroll-mt-28">
          <div className="@container/today-practice">
            <div
              data-equal-height-row="today-practice"
              className={`today-practice-grid grid items-stretch gap-4 lg:gap-5 ${
                hasShots
                  ? "today-practice-grid-has-prescription"
                  : "today-practice-grid-no-prescription"
              }`}
            >
              {hasShots ? (
                <div className="today-practice-prescription min-w-0">
                  <TodayPracticePrescription data={data} />
                </div>
              ) : null}
              <div className="today-practice-mode min-w-0">
                <TodayPracticeModePanel data={data} shotDatabaseHref={shotDatabaseHref} />
              </div>
              <div className="today-practice-plan min-w-0">
                <PracticePlanFollowedCard plan={linkedPracticePlan} data={data} />
              </div>
            </div>
          </div>
        </TodayBentoItem>

        <TodayBentoItem span={12}>
          <TodayDesktopFilterBar data={data} activeFilterChips={activeFilterChips} />
        </TodayBentoItem>

        {hasShots ? (
          <>
            {data.dataCleaning.excludedShotCount > 0 ? (
              <TodayBentoItem span={12}>
                <TodayDataCleaningImpactCard data={data} linkedPracticePlan={linkedPracticePlan} />
              </TodayBentoItem>
            ) : null}
            <TodayBentoItem id="charts" span={12} className="scroll-mt-28">
              <TodayShotCharts
                shots={chartShots}
                clubStatuses={chartClubStatuses}
                patternInsight={chartPatternInsight}
              />
            </TodayBentoItem>
            <TodayBentoItem id="clubs" span={12} className="scroll-mt-28">
              <ClubPerformancePanel data={data} comparisons={comparisons} sort={clubSort} />
            </TodayBentoItem>
            <TodayBentoItem id="pbs" span={12} className="scroll-mt-28">
              <TodayHighlightsPanel
                stats={data.clubStats}
                shots={data.shots}
                bestStraightShots={data.bestStraightShots}
              />
            </TodayBentoItem>
            <TodayBentoItem span={12}>
              <div
                data-equal-height-row="today-footer"
                className="grid items-stretch gap-4 lg:grid-cols-2"
              >
                <TodaySocialLine
                  data={data}
                  socialContext={socialContext}
                  loadHref={todaySocialHref(data, clubSort)}
                  className="h-full"
                />
                <TodayRawShotListPanel
                  data={data}
                  shotDatabaseHref={shotDatabaseHref}
                  className="h-full"
                />
              </div>
            </TodayBentoItem>
          </>
        ) : null}
      </div>
    </DesktopWorkbenchLayout>
  );
}

function todayInsightMetrics(
  data: TodayPracticeData,
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>,
): DesktopInsightMetric[] {
  const score = practiceScoreSummary(data);
  const driver = driverHealthSummary(data);
  const focus = practiceFocus(data);
  const planResult = buildPlanResultReadout(linkedPracticePlan);
  const metrics: DesktopInsightMetric[] = [
    {
      label: "Practice usefulness",
      value: `${score.score}/100`,
      detail: score.sessionQualityDetail,
      tone: score.tone,
    },
    {
      label: "Scoring control",
      value: score.scoringControlLabel,
      detail: score.scoringDetail,
      tone: score.scoringScore >= 8 ? "green" : score.scoringScore >= 6.5 ? "amber" : "sky",
    },
    {
      label: "Driver delivery",
      value: driver.status,
      detail: driver.detail,
      tone: driver.tone,
    },
    {
      label: "Next action",
      value: data.shots.length > 0 ? focus.clubText : "Import",
      detail:
        data.shots.length > 0
          ? focus.problem
          : "Import a tracked practice session before asking the assistant for a plan.",
      tone: data.shots.length > 0 ? "amber" : "slate",
    },
  ];

  if (planResult) {
    metrics.splice(2, 0, {
      label: "Planned drill result",
      value: planResult.scoreLabel,
      detail: `${planResult.label}: ${planResult.detail}`,
      tone: planResult.tone,
    });
  }

  return metrics;
}

function todayInsightEvidence(
  data: TodayPracticeData,
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>,
) {
  const score = practiceScoreSummary(data);
  const work = needsWorkComparison(data.clubComparisons);
  const best = bestClubComparison(data.clubComparisons);
  const planResult = buildPlanResultReadout(linkedPracticePlan);
  const evidence = [
    `${integerFormatter.format(data.shots.length)} clean shots from ${integerFormatter.format(
      selectedClubCount(data),
    )} clubs on ${data.dateLabel}.`,
    `${formatRate(data.overall.today.playableRate)} inside the lateral window, ${formatRate(
      data.overall.today.straightRate,
    )} straight and ${formatYards(data.overall.today.offlineAverageYd)} offline.`,
    `Practice usefulness ${score.score}/100; scoring control ${score.scoringControlLabel.toLowerCase()}.`,
  ];

  if (best) {
    evidence.push(
      `${best.clubLabel} was the strongest current read: ${bestPerformerDetail(best)}.`,
    );
  }

  if (work) {
    evidence.push(`${work.clubLabel} is the first practice job: ${opportunityShortDetail(work)}.`);
  }

  if (data.dataCleaning.excludedShotCount > 0) {
    evidence.push(
      `Clean scoring held out ${integerFormatter.format(
        data.dataCleaning.excludedShotCount,
      )} ${data.dataCleaning.reasonLabel.toLowerCase()} shot rows.`,
    );
  }

  if (planResult) {
    evidence.push(`Linked practice plan result: ${planResult.label} (${planResult.scoreLabel}).`);
  }

  return evidence.slice(0, 6);
}

function TodayDesktopFilterBar({
  data,
  activeFilterChips,
  className = "",
}: {
  data: TodayPracticeData;
  activeFilterChips: { label: string; href: string }[];
  className?: string;
}) {
  return (
    <section
      id="scope"
      className={`scroll-mt-28 rounded-xl border border-[#d9ded8] bg-white px-3 py-2 shadow-sm ${className}`}
    >
      <form className="grid gap-2 md:grid-cols-[auto_minmax(150px,190px)_minmax(220px,1fr)_minmax(150px,220px)_auto_auto] md:items-end">
        <div className="hidden pb-2 pr-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground md:block">
          Filters
        </div>
        <TodayScopeFields data={data} />
        <Button type="submit" className="h-9 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
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
      {activeFilterChips.length > 0 ? (
        <div className="mt-2">
          <ActiveFilterChips items={activeFilterChips} />
        </div>
      ) : null}
    </section>
  );
}

function TodayDataCleaningImpactCard({
  data,
  linkedPracticePlan,
  className = "",
}: {
  data: TodayPracticeData;
  linkedPracticePlan?: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
  className?: string;
}) {
  if (data.dataCleaning.excludedShotCount === 0) {
    return null;
  }

  const cleanScore = practiceScoreSummary(data, "clean");
  const rawScore = practiceScoreSummary(data, "raw");
  const carryDelta = delta(data.overall.today.carryAverageYd, data.rawOverall.today.carryAverageYd);
  const scoreDelta = cleanScore.score - rawScore.score;
  const scoringDelta = cleanScore.scoringScore - rawScore.scoringScore;
  const cleanHeadline = practiceHeadlineFromScore(cleanScore);
  const rawHeadline = practiceHeadlineFromScore(rawScore);
  const verdictUnchanged = cleanHeadline === rawHeadline;
  const planNote = buildPlanCleanSampleNote(linkedPracticePlan ?? null, data);

  return (
    <section
      className={`grid gap-3 rounded-lg border border-emerald-100 bg-emerald-50/45 p-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-950">Data cleaning impact</p>
          <p className="mt-1 text-sm leading-5 text-emerald-900">
            Rows held for review stay in raw history and are held out of clean scoring, session
            comparisons and highlights.
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-white/80 text-emerald-800">
          {integerFormatter.format(data.dataCleaning.excludedShotCount)} held out
        </Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <DataCleaningMetric
          label="Imported"
          value={integerFormatter.format(data.dataCleaning.importedShotCount)}
        />
        <DataCleaningMetric
          label="Clean selected"
          value={integerFormatter.format(data.dataCleaning.cleanShotCount)}
        />
        <DataCleaningMetric
          label="Held out"
          value={integerFormatter.format(data.dataCleaning.excludedShotCount)}
        />
        <DataCleaningMetric label="Reason" value={data.dataCleaning.reasonLabel} />
      </div>
      <div className="grid gap-2 rounded-lg border border-emerald-100 bg-white/75 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <p className="font-semibold leading-5 text-emerald-950">
          Impact: carry {formatImpactDelta(carryDelta, "yd")} · session score{" "}
          {formatImpactDelta(scoreDelta, "points")} · scoring control{" "}
          {formatImpactDelta(scoringDelta, "points")}
        </p>
        <p className="leading-5 text-emerald-900">
          {verdictUnchanged
            ? `Verdict unchanged: ${cleanHeadline}.`
            : `Verdict moved from ${rawHeadline} to ${cleanHeadline}.`}
        </p>
      </div>
      {data.dataCleaning.excludedByClub.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.dataCleaning.excludedByClub.map((item) => (
            <Badge
              key={item.clubType}
              variant="outline"
              className="border-emerald-200 bg-white/80 text-emerald-900"
            >
              {item.clubLabel}: {item.cleanShotCount}/{item.importedShotCount} clean
            </Badge>
          ))}
        </div>
      ) : null}
      {planNote ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm font-medium leading-5 text-amber-950">
          {planNote}
        </p>
      ) : null}
    </section>
  );
}

function DataCleaningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-emerald-100 bg-white/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-semibold text-slate-950">{value}</p>
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
  const currentStep = steps[0];
  const nextStep = steps[1];
  const readyCount = steps.filter((step) => step.status === "ready").length;
  const progress = Math.round((readyCount / steps.length) * 100);

  return (
    <DataPanel className="@container/today-mode h-full self-stretch gap-0 border-[#d9ded8] bg-white py-0 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="grid h-full content-between gap-3 p-3 lg:p-4">
        <div className="today-mode-header flex flex-col gap-3">
          <div className="flex min-w-0 gap-3">
            <PracticeCardIllustration kind="target" tone="green" size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0B7A3B]">
                Practice mode
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight tracking-normal text-slate-950">
                Current loop
              </h2>
              <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
                Drill, capture the next shots, then compare before sharing.
              </p>
            </div>
          </div>
          <Button
            asChild
            className="h-10 rounded-lg bg-[#0B7A3B] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(11,122,59,0.18)] hover:bg-[#064E3B]"
          >
            <Link href={hasShots ? "/coach" : "/import"} prefetch={false}>
              {hasShots ? "Start drill" : "Import shots"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="today-mode-steps grid gap-2">
          <PracticeLoopRow label="Current drill" step={currentStep} index={0} />
          <PracticeLoopRow label="Next action" step={nextStep} index={1} />
        </div>

        <div className="rounded-lg border border-emerald-100 bg-emerald-50/55 px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-emerald-950">
            <span>Progress</span>
            <span>{readyCount}/5 ready</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <span
              className="block h-full rounded-full bg-emerald-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <details className="group rounded-lg border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <span>Full 5-step workflow</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-2 border-t border-slate-100 p-3">
            {steps.map((step, index) => {
              const card = <PracticeStepCard step={step} index={index} />;

              return step.href ? (
                <Link key={step.title} href={step.href} prefetch={false} className="block">
                  {card}
                </Link>
              ) : (
                <div key={step.title}>{card}</div>
              );
            })}
          </div>
        </details>
      </div>
    </DataPanel>
  );
}

function PracticePlanFollowedCard({
  plan,
  data,
  className = "",
}: {
  plan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
  data?: TodayPracticeData;
  className?: string;
}) {
  if (!plan) {
    return (
      <section
        className={`@container/today-plan h-full rounded-lg border border-[#E5E7EB] bg-white p-3 ${className}`}
      >
        <div className="today-plan-grid grid h-full grid-rows-[auto_1fr_auto] gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#050505]">Practice plan link</p>
            <StatusPill tone="slate">Waiting</StatusPill>
          </div>
          <p className="text-sm leading-5 text-[#6B7280]">
            Complete a saved Practice Planner session and link the import to compare plan against
            actual results.
          </p>
          <Button asChild variant="outline" className="rounded-lg @3xl/today-plan:min-w-36">
            <Link href="/practice" prefetch={false}>
              Open planner
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const planResult = buildPlanResultReadout(plan);
  const planTone = (planResult?.tone ?? "green") as ReviewTone;
  const cleanSampleNote = data ? buildPlanCleanSampleNote(plan, data) : null;

  return (
    <section
      className={`@container/today-plan h-full rounded-lg border p-3 ${practicePlanResultCardClass(planTone)} ${className}`}
    >
      <div className="today-plan-grid grid h-full grid-rows-[auto_1fr_auto] gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${practicePlanResultHeadingClass(planTone)}`}>
            Planned drill result
          </p>
          <StatusPill tone={planTone}>{planResult?.label ?? "Linked"}</StatusPill>
        </div>
        <div>
          <p
            className={`text-xl font-semibold tracking-normal ${practicePlanResultHeadingClass(planTone)}`}
          >
            {plan.title}
          </p>
          <p className={`mt-1 text-sm leading-5 ${practicePlanResultBodyClass(planTone)}`}>
            {planResult ? `${planResult.scoreLabel} - ${planResult.detail}` : plan.verdict}
          </p>
          {cleanSampleNote ? (
            <p className="mt-2 rounded-lg border border-white/65 bg-white/70 px-3 py-2 text-sm font-medium leading-5 text-slate-800">
              {cleanSampleNote}
            </p>
          ) : null}
        </div>
        <Button
          asChild
          variant={planTone === "green" ? "default" : "outline"}
          className={`rounded-lg @3xl/today-plan:min-w-36 ${planTone === "green" ? "premium-action" : practicePlanResultButtonClass(planTone)}`}
        >
          <Link href={plan.href} prefetch={false}>
            Review plan
          </Link>
        </Button>
      </div>
    </section>
  );
}

function PracticeLoopRow({
  label,
  step,
  index,
}: {
  label: string;
  step: PracticeFlowStep;
  index: number;
}) {
  const content = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm">
      <span className={practiceStepNumberClass(step.status)}>{index + 1}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate font-semibold text-slate-950">{step.title}</span>
        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-slate-600">
          {step.detail}
        </span>
      </span>
      <PracticeStepStatus status={step.status} />
    </div>
  );

  return step.href ? (
    <Link href={step.href} prefetch={false} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function PracticeStepCard({ step, index }: { step: PracticeFlowStep; index: number }) {
  const visualTone =
    step.status === "ready" ? "green" : step.status === "needed" ? "amber" : "slate";

  return (
    <article
      className={`grid min-h-24 content-start gap-2 rounded-lg border bg-white p-3 text-sm transition-colors hover:border-emerald-200 ${practiceStepCardClass(
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
      .today-practice-grid-has-prescription {
        grid-template-areas:
          "prescription"
          "mode"
          "plan";
      }
      .today-practice-grid-no-prescription {
        grid-template-areas:
          "mode"
          "plan";
      }
      .today-practice-prescription {
        grid-area: prescription;
      }
      .today-practice-mode {
        grid-area: mode;
      }
      .today-practice-plan {
        grid-area: plan;
      }
      @container today-highlight-list (min-width: 36rem) {
        .today-highlight-card-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @container today-highlight-list (min-width: 54rem) {
        .today-highlight-card-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @container today-prescription (min-width: 36rem) {
        .today-prescription-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (min-width: 1000px) {
        .today-top-grid {
          grid-template-columns: minmax(0, 2fr) minmax(17rem, 1fr);
        }
        .today-summary-stack {
          grid-template-rows: minmax(0, 1fr) auto;
        }
        .today-signal-grid {
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
        }
        .today-practice-grid-has-prescription {
          grid-template-columns: minmax(20rem, 5fr) minmax(0, 7fr);
          grid-template-areas:
            "prescription mode"
            "plan plan";
        }
        .today-practice-grid-no-prescription {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-areas: "mode plan";
        }
        .today-highlights-grid {
          grid-template-columns: repeat(12, minmax(0, 1fr));
        }
        .today-highlights-list {
          grid-column: span 8 / span 8;
        }
        .today-highlights-rail {
          grid-column: span 4 / span 4;
        }
        .today-summary-grid {
          grid-template-columns: 8rem minmax(0, 1fr);
          align-items: center;
        }
      }
      @media (min-width: 1280px) {
        .today-summary-grid {
          grid-template-columns: 12rem minmax(0, 1fr);
        }
        .today-mode-header {
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
        }
        .today-mode-steps {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .today-plan-grid {
          grid-template-columns: minmax(10rem, 0.35fr) minmax(0, 1fr) auto;
          grid-template-rows: none;
          align-items: center;
        }
        .today-coaching-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }
      ${selectors}
    `}</style>
  );
}

function TodayVerdictHero({
  data,
  linkedPracticePlan,
  className = "",
}: {
  data: TodayPracticeData;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
  className?: string;
}) {
  const selectedClubs = selectedClubCount(data);
  const bestShot = data.bestStraightShots[0];
  const scope = sessionScopeLabel(data);
  const score = practiceScoreSummary(data);
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const storyChips = verdictStoryChips(data);

  return (
    <section
      className={`@container/today-hero overflow-hidden rounded-[20px] border border-[#d9ded8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-5 shadow-sm lg:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={verdictTone(data.overall.verdict)}>Session verdict</StatusPill>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          {data.dateLabel}
        </span>
      </div>
      <h1 className="mt-3 max-w-4xl text-3xl font-semibold uppercase leading-[1.04] tracking-normal text-slate-950 @2xl/today-hero:text-4xl @5xl/today-hero:text-5xl">
        {heroVerdictTitle(data)}
      </h1>
      {storyChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {storyChips.map((chip) => (
            <VerdictReasonChip key={`${chip.label}-${chip.value}`} item={chip} />
          ))}
        </div>
      ) : null}
      <p className="mt-3 max-w-3xl text-base font-medium leading-6 text-slate-700">
        {reviewNarrative(data, linkedPracticePlan)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {integerFormatter.format(data.shots.length)} shots /{" "}
        {integerFormatter.format(selectedClubs)} {selectedClubs === 1 ? "club" : "clubs"} / {scope}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HeroScopePill label={selectedClubLabel(data)} value="Scope" />
        <HeroScopePill label="Up to 50 earlier / club" value="Baseline" />
        <HeroScopePill
          label={bestShot ? bestShotTitle(bestShot) : "No shot yet"}
          value="Shot of the day"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <VerdictStoryCard
          label="Best current form"
          value={best?.clubLabel ?? score.strong}
          detail={best ? bestPerformerDetail(best) : "Building signal"}
          tone="green"
          icon={<ShieldCheck className="size-4" />}
        />
        <VerdictStoryCard
          label="Biggest opportunity"
          value={work?.clubLabel ?? score.weak}
          detail={work ? opportunityShortDetail(work) : "No clear drag"}
          tone="pink"
          icon={<Target className="size-4" />}
        />
        <VerdictStoryCard
          label="Recommendation"
          value={score.recommendation}
          detail={score.scoringDetail}
          tone="amber"
          icon={<Dumbbell className="size-4" />}
        />
      </div>
    </section>
  );
}

function TodayScoreStack({
  data,
  linkedPracticePlan,
  className = "",
}: {
  data: TodayPracticeData;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
  className?: string;
}) {
  return (
    <section
      className={`grid min-w-0 grid-rows-[auto_minmax(0,1fr)] items-stretch gap-4 ${className}`}
    >
      <PracticeScoreHeroCard
        score={practiceScoreSummary(data)}
        reliable={reliableClubComparison(data.clubComparisons)}
        linkedPracticePlan={linkedPracticePlan}
      />
      <HeroShotSpotlight shot={data.bestStraightShots[0]} />
    </section>
  );
}

function TodayKpiStrip({ data, className = "" }: { data: TodayPracticeData; className?: string }) {
  return (
    <section className={`grid items-stretch gap-2 md:grid-cols-2 xl:grid-cols-4 ${className}`}>
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
        label="Lateral window"
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
    </section>
  );
}

function SessionSignalStrip({
  data,
  className = "",
}: {
  data: TodayPracticeData;
  className?: string;
}) {
  return (
    <section className={`@container/today-signal ${className}`}>
      <div
        data-equal-height-row="today-signal"
        className="today-signal-grid grid items-stretch gap-3"
      >
        <SessionCoachingCard summary={sessionCoachingSummary(data)} />
        <ConfidenceMeterCard items={confidenceMeterItems(data)} />
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
    <div className={`min-h-28 rounded-lg border px-3 py-2.5 shadow-sm ${verdictCardClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
        <span className={`grid size-8 place-items-center rounded-full ${reviewIconClass(tone)}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold leading-tight tracking-normal text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium leading-5 text-slate-700">{detail}</p>
    </div>
  );
}

function PracticeScoreHeroCard({
  score,
  reliable,
  linkedPracticePlan,
}: {
  score: PracticeScoreSummary;
  reliable: ClubDayComparison | null;
  linkedPracticePlan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>;
}) {
  const reliableReadout = clubTrustReadout(reliable);
  const planResult = buildPlanResultReadout(linkedPracticePlan);

  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${verdictCardClass(score.tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">
            Practice usefulness
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            How useful the session was; scoring control and planned-drill result stay separate.
          </p>
        </div>
        <span
          className={`grid size-10 place-items-center rounded-full ${reviewIconClass(score.tone)}`}
        >
          <Gauge className="size-5" />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-5xl font-semibold leading-none tracking-normal text-slate-950">
          {score.score}
        </p>
        <p className="pb-1 text-xl font-semibold text-slate-700">/100</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-700">{score.sessionQualityLabel}</p>
      <div className={`mt-3 grid gap-2 ${planResult ? "grid-cols-2" : "grid-cols-3"}`}>
        <ScoreMiniMetric label="Lateral window" value={score.playableRateLabel} />
        <ScoreMiniMetric label="Strike quality" value={`${score.strikeScore}/10`} />
        <ScoreMiniMetric
          label="Scoring control"
          value={`${score.scoringControlLabel} ${score.scoringScore}/10`}
        />
        {planResult ? <ScoreMiniMetric label="Planned drill" value={planResult.label} /> : null}
      </div>
      <p className="mt-3 rounded-lg border border-white/60 bg-white/65 px-3 py-2 text-sm font-medium leading-5 text-slate-800">
        {reliableReadout.label}: {reliable?.clubLabel ?? "building signal"}.{" "}
        {planResult ? planResult.detail : (reliableReadout.detail ?? score.sessionQualityDetail)}
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

function WhatChangedCard({
  items,
  className = "",
}: {
  items: WhatChangedItem[];
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="today-summary-grid grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Compared with prior same-club shots
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
              What changed
            </h2>
          </div>
          <Route className="size-5 text-sky-600 @sm/today-summary:hidden" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className={`rounded-lg border px-3 py-2 ${verdictCardClass(item.tone)}`}
            >
              <p className="text-sm font-semibold text-slate-950">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
                {item.value}
              </p>
              <p className="mt-1 text-xs font-medium leading-4 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DriverHealthCard({
  summary,
  className = "",
}: {
  summary: DriverHealthSummary;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 shadow-sm ${verdictCardClass(summary.tone)} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">
            Driver delivery
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
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
        <DriverHealthMetric label="Path" value={formatDegrees(summary.path)} />
        <DriverHealthMetric label="Draw target" value={formatDegrees(summary.targetPath)} />
        <DriverHealthMetric label="Start line" value={formatDegrees(summary.startLine)} />
        <DriverHealthMetric label="Modelled face" value={formatDegrees(summary.faceAngle)} />
        <DriverHealthMetric label="Modelled F-to-P" value={formatDegrees(summary.faceToPath)} />
      </div>
      <p className="mt-3 rounded-lg border border-white/60 bg-white/65 px-3 py-2 text-sm font-medium leading-5 text-slate-800">
        {summary.detail}
      </p>
      {summary.totalShotCount > 0 ? (
        <p className="mt-2 text-xs font-medium leading-5 text-slate-700">
          Delivery evidence: {summary.measuredShotCount}/{summary.totalShotCount} driver rows had
          measured club data. Face and face-to-path are modelled from path and launch direction.
        </p>
      ) : null}
    </div>
  );
}

function DriverHealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/65 px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function SessionCoachingCard({ summary }: { summary: SessionCoachingSummary }) {
  const opportunityEffect = summary.biggestOpportunity
    ? sessionImpactValue(summary.biggestOpportunity)
    : null;
  const opportunityTone = deltaTone(opportunityEffect, "higher");

  return (
    <div className="@container/session-coaching h-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Session coaching
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">
            Strike quality vs scoring control
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${reviewStatusClass(
            opportunityTone,
          )}`}
        >
          Effect {formatSignedDecimal(opportunityEffect)}
        </span>
      </div>
      <div className="today-coaching-grid mt-3 grid gap-2 md:grid-cols-2">
        <QualityReadoutCard
          label="Strike quality"
          value={`${summary.strikeScore}/10`}
          detail={summary.strikeDetail}
          tone={summary.strikeScore >= 8 ? "green" : summary.strikeScore >= 6.5 ? "amber" : "pink"}
        />
        <QualityReadoutCard
          label="Scoring control"
          value={`${summary.scoringScore}/10`}
          detail={summary.scoringDetail}
          tone={
            summary.scoringScore >= 8 ? "green" : summary.scoringScore >= 6.5 ? "amber" : "pink"
          }
        />
        <CoachingReadoutBlock
          label="Biggest gain"
          value={summary.biggestGain?.clubLabel ?? "Building signal"}
          detail={summary.gainDetail}
          tone="green"
        />
        <CoachingReadoutBlock
          label="Biggest opportunity"
          value={summary.biggestOpportunity?.clubLabel ?? "No clear drag"}
          detail={summary.opportunityDetail}
          tone="pink"
        />
      </div>
      <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm font-medium leading-5 text-amber-950">
        {summary.opportunityCause} {summary.opportunityTarget}
      </p>
    </div>
  );
}

function QualityReadoutCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: ReviewTone;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${verdictCardClass(tone)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-tight tracking-normal text-slate-950">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-slate-700">{detail}</p>
    </div>
  );
}

function CoachingReadoutBlock({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: ReviewTone;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${reviewStatusClass(tone)}`}
        >
          {tone === "green" ? "Maintain" : "Focus"}
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold tracking-normal text-slate-950">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-slate-600">{detail}</p>
    </div>
  );
}

function ConfidenceMeterCard({ items }: { items: ConfidenceMeterItem[] }) {
  const visibleItems = items.slice(0, 3);

  return (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Confidence meter
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">
            Scoring trust
          </h2>
        </div>
        <ShieldCheck className="size-5 text-emerald-700" />
      </div>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          visibleItems.map((item) => (
            <div
              key={item.clubLabel}
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-slate-950">{item.clubLabel}</p>
                <span
                  className={`max-w-full rounded-full px-2 py-0.5 text-right text-[11px] font-semibold leading-4 ${reviewStatusClass(
                    item.tone,
                  )}`}
                >
                  {item.label}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <span
                  className={`block h-full rounded-full ${rateBarClass(item.tone)}`}
                  style={{ width: `${clamp(item.score ?? 0, 0, 100)}%` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium leading-4 text-slate-600">
                {item.reason}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 text-sm font-medium text-slate-600">
            Confidence appears once this review has club-level shot data.
          </div>
        )}
      </div>
      {items.length > visibleItems.length ? (
        <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
          {items.length - visibleItems.length} more club trust reads below.
        </p>
      ) : null}
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

function VerdictReasonChip({ item }: { item: VerdictReasonItem }) {
  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${reviewStatusClass(
        item.tone,
      )}`}
    >
      <span>{item.label}</span>
      <span className="font-medium">{item.value}</span>
    </span>
  );
}

function HeroShotSpotlight({ shot }: { shot: TodayPracticeShot | undefined }) {
  return (
    <div className="grid h-full min-h-[190px] overflow-hidden rounded-lg border border-emerald-100 bg-[#083524] p-2 text-white shadow-sm lg:min-h-[270px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex h-full flex-col justify-between gap-3 rounded-md border border-white/15 bg-white/95 px-3 py-3 text-slate-950 shadow-sm">
        {shot ? (
          <>
            <div className="grid gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-[11px] font-semibold uppercase tracking-normal text-slate-700">
                  Shot of the day
                </p>
                <Crosshair className="size-3.5 shrink-0 text-sky-600" />
              </div>
              <h3 className="text-xl font-semibold leading-tight tracking-normal">
                {bestShotTitle(shot)}
              </h3>
              <p className="rounded-md border border-sky-100 bg-sky-50 px-2 py-1 text-xs font-semibold leading-4 text-sky-900">
                {shotOfDayReason(shot)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ShotMetric label="Total" value={formatYards(shot.totalYd)} />
              <ShotMetric label="Carry" value={formatYards(shot.carryYd)} />
              <ShotMetric label="Start" value={formatDegrees(shot.launchDirectionDeg)} />
              <ShotMetric label="Ball" value={formatMph(shot.ballSpeedMph)} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Directional shot data will spotlight the best strike here.
          </p>
        )}
      </div>
      <div className="relative min-h-44 overflow-hidden rounded-md border border-white/10 bg-emerald-950 lg:min-h-0">
        <HeroFairwayVisual shot={shot} />
      </div>
    </div>
  );
}

function ShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <dl className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold tabular-nums text-slate-950">{value}</dd>
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

function isWedgeClubType(clubType: string | null | undefined) {
  const normalized = clubType?.trim().toLowerCase();
  return normalized === "wedge" || ["pw", "gw", "aw", "sw", "lw"].includes(normalized ?? "");
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
    <div className="h-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
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
      <p className="mt-2 text-xl font-semibold leading-tight tracking-normal text-slate-950">
        {value}
      </p>
      <p className={reviewDeltaClass(tone)}>{detail}</p>
    </div>
  );
}

function TodayPracticePrescription({ data }: { data: TodayPracticeData }) {
  const focus = practiceFocus(data);

  return (
    <DataPanel className="@container/today-prescription flex h-full flex-col self-stretch gap-0 border-[#d9ded8] bg-white py-0 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between lg:px-4">
        <div className="flex min-w-0 gap-3">
          <PracticeCardIllustration kind="target" tone="green" size="sm" />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-normal text-slate-950">
              Latest practice prescription
            </h2>
            <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
              A simple drill target from the session pattern.
            </p>
          </div>
        </div>
        <div className="sm:pt-1">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-9 rounded-lg border-[#0B7A3B] bg-white px-3 text-sm font-semibold text-[#0B7A3B] shadow-sm hover:bg-emerald-50 hover:text-[#064E3B]"
          >
            <Link href="/coach" prefetch={false}>
              <Dumbbell className="size-4" />
              Start drill
            </Link>
          </Button>
        </div>
      </div>
      <CardContent className="flex-1 px-3 pb-3 pt-0 lg:px-4">
        <div className="today-prescription-grid grid h-full auto-rows-fr gap-2">
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
      className={`flex min-h-24 items-center gap-3 rounded-lg border px-3 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.035)] ${prescriptionToneClass(
        tone,
      )}`}
    >
      <PracticeCardIllustration kind={icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.08em]">{label}</p>
        <p className="mt-1.5 text-sm font-medium leading-5 text-slate-950">{value}</p>
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
          <StatusPill tone={verdictTone(data.overall.verdict)}>{heroVerdictTitle(data)}</StatusPill>
        }
      />
      <CardContent className="space-y-3">
        <ClubPerformanceSummaryCards data={data} />
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-100 bg-emerald-50/55 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium leading-5 text-emerald-950">
            Latest read: {clubPerformanceRead(data)}
          </p>
          <ClubSortControls data={data} activeSort={sort} />
        </div>
        <div data-workbench-scope="today-club-performance">
          <DesktopTableWorkbenchControls
            viewKey="today-club-performance"
            scope="today-club-performance"
            currentViewLabel="Latest practice club performance"
            resultLabel={`${integerFormatter.format(comparisons.length)} compared clubs`}
            columns={todayClubPerformanceColumns}
            suggestedViews={todaySavedViews}
            exportTableId="today-club-performance"
            exportFileName="forekinghell-latest-practice-club-performance.csv"
          />
        </div>
        <DataTableFrame
          mainTable
          label="Club performance comparison table"
          stickyFirstColumn
          className="[&_[data-slot=scroll-area-viewport]]:overflow-x-hidden [&_[data-slot=table-container]]:overflow-x-visible"
          mobile={
            <MobileHorizontalRail
              title="Club performance"
              description="This session against up to 50 earlier clean shots for the same club."
            >
              {comparisons.map((comparison) => (
                <MobileDataCard
                  key={comparison.clubType}
                  title={comparison.clubLabel}
                  subtitle={`${comparison.today.shotCount}/${comparison.previous.shotCount} shots`}
                  action={
                    <Badge className={clubComparisonBadgeClass(comparison)}>
                      {clubComparisonCallLabel(comparison)}
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
                    {clubComparisonSignalText(comparison)}
                  </p>
                </MobileDataCard>
              ))}
            </MobileHorizontalRail>
          }
        >
          <Table
            className="w-full"
            containerClassName="overflow-x-visible"
            data-workbench-scope="today-club-performance"
            data-workbench-export-table="today-club-performance"
            aria-describedby="today-club-performance-summary"
          >
            <TableCaption id="today-club-performance-summary" className="sr-only">
              Latest practice club comparison table showing current and previous shot counts, carry,
              offline, straight, lateral-window and signal values.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 h-8 bg-white px-2 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  Club
                </TableHead>
                <TableHead data-column="call" className="h-8 px-2">
                  Call
                </TableHead>
                <TableHead data-column="shots" className="h-8 px-2 text-right">
                  Shots
                </TableHead>
                <TableHead data-column="carry" className="h-8 px-2 text-right">
                  Carry
                </TableHead>
                <TableHead data-column="offline" className="h-8 px-2 text-right">
                  Offline
                </TableHead>
                <TableHead data-column="straight" className="h-8 px-2 text-right">
                  Straight
                </TableHead>
                <TableHead data-column="playable" className="h-8 px-2 text-right">
                  Lateral
                </TableHead>
                <TableHead
                  data-column="signal"
                  className="h-8 max-w-[11rem] whitespace-normal px-2"
                >
                  Signal
                </TableHead>
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
  const reliableReadout = clubTrustReadout(reliable);

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <ClubSummaryCard
        label="Best current form"
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
        label={reliableReadout.label}
        comparison={reliable}
        icon={<ShieldCheck className="size-4" />}
        tone="sky"
        detail={reliableReadout.detail}
        subdetail={reliableReadout.subdetail}
      />
    </div>
  );
}

function ClubSummaryCard({
  label,
  comparison,
  icon,
  tone,
  detail,
  subdetail,
}: {
  label: string;
  comparison: ClubDayComparison | null;
  icon: ReactNode;
  tone: "green" | "pink" | "sky";
  detail?: string | null;
  subdetail?: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`grid size-8 place-items-center rounded-full ${summaryIconClass(tone)}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
        {comparison?.clubLabel ?? "--"}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {detail ??
          (comparison
            ? `${formatRate(comparison.today.straightRate)} straight · ${formatRate(comparison.today.playableRate)} in lateral window`
            : "No club data")}
      </p>
      {comparison ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {subdetail ?? `${formatYards(comparison.today.offlineAverageYd)} offline`}
        </p>
      ) : null}
    </div>
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
              {club.label} ({formatClubOptionShotCount(club)})
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function TodaySocialLine({
  className = "",
  data,
  socialContext,
  loadHref,
}: {
  className?: string;
  data: TodayPracticeData;
  socialContext: TodaySocialContext;
  loadHref: string;
}) {
  if (data.shots.length === 0) {
    return null;
  }

  const bestClubRow = bestClubComparison(data.clubComparisons);
  const bestClub = bestClubRow?.clubLabel ?? data.clubs[0]?.label ?? "This session";
  const bestClubType = bestClubRow?.clubType ?? data.clubs[0]?.type ?? "";
  const challenge = socialContext.loaded
    ? findRelevantChallenge(socialContext.challenges, bestClubType)
    : null;

  return (
    <section
      id="social-context"
      className={`scroll-mt-28 rounded-xl border bg-white p-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Compare this session</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {!socialContext.loaded
              ? `Social comparison is on demand. Load challenge context when ${bestClub} is ready for records, events or tour-style challenges.`
              : challenge
                ? `Recommended: ${bestClub} straightness stood out. Compare it against ${challenge.title}.`
                : `Recommended: ${bestClub} has ${integerFormatter.format(data.shots.length)} selected shots ready for records, events and tour-style challenges.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!socialContext.loaded ? (
            <Button asChild variant="outline" size="sm">
              <Link href={loadHref} prefetch={false}>
                <Trophy className="size-4" />
                Load challenge context
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={challenge ? `/challenges/${challenge.id}` : "/feed"} prefetch={false}>
                <Trophy className="size-4" />
                {challenge ? challenge.title : "Open feed"}
              </Link>
            </Button>
          )}
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

function TodayRawShotListPanel({
  className = "",
  data,
  shotDatabaseHref,
}: {
  className?: string;
  data: TodayPracticeData;
  shotDatabaseHref: string;
}) {
  return (
    <section
      id="shots"
      className={`scroll-mt-28 rounded-xl border bg-white p-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Raw shot list</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {integerFormatter.format(data.rawShots.length)} imported rows ·{" "}
            {integerFormatter.format(data.shots.length)} clean selected.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={shotDatabaseHref} prefetch={false}>
            <Database className="size-4" />
            View rows
          </Link>
        </Button>
      </div>
      <details className="group mt-2 rounded-lg border border-slate-200 bg-slate-50/55">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
          <span>Preview table</span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-200 p-3">
          <div data-workbench-scope="today-raw-shot-preview" className="mb-3">
            <DesktopTableWorkbenchControls
              viewKey="today-raw-shot-preview"
              scope="today-raw-shot-preview"
              currentViewLabel="Latest practice raw shots"
              resultLabel={`${integerFormatter.format(data.rawShots.length)} imported rows`}
              columns={todayRawShotColumns}
              suggestedViews={todaySavedViews}
              exportTableId="today-raw-shot-preview"
              exportFileName="forekinghell-latest-practice-raw-shots.csv"
            />
          </div>
          <DataTableFrame label="Raw shot preview table" stickyFirstColumn>
            <Table
              className="min-w-[1040px]"
              data-workbench-scope="today-raw-shot-preview"
              data-workbench-export-table="today-raw-shot-preview"
              aria-describedby="today-raw-shot-preview-summary"
            >
              <TableCaption id="today-raw-shot-preview-summary" className="sr-only">
                Raw shot preview table for the selected latest-practice shots with session, club,
                shot type, quality, carry, total, side, start, launch, ball speed and smash values.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <TableHead
                    data-column="session"
                    className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    Session
                  </TableHead>
                  <TableHead data-column="shot" className="text-right">
                    Shot
                  </TableHead>
                  <TableHead data-column="club">Club</TableHead>
                  <TableHead data-column="type">Type</TableHead>
                  <TableHead data-column="quality">Quality</TableHead>
                  <TableHead data-column="carry" className="text-right">
                    Carry
                  </TableHead>
                  <TableHead data-column="total" className="text-right">
                    Total
                  </TableHead>
                  <TableHead data-column="side" className="text-right">
                    Side
                  </TableHead>
                  <TableHead data-column="start" className="text-right">
                    Start
                  </TableHead>
                  <TableHead data-column="launch" className="text-right">
                    Launch
                  </TableHead>
                  <TableHead data-column="ball" className="text-right">
                    Ball
                  </TableHead>
                  <TableHead data-column="smash" className="text-right">
                    Smash
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rawShots.map((shot) => (
                  <TableRow key={shot.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="session"
                      className="sticky left-0 z-10 max-w-52 truncate bg-white py-1.5 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      {shot.fileName ?? shot.courseName ?? "Session"}
                    </TableCell>
                    <TableCell data-column="shot" className="py-1.5 text-right">
                      {shot.shotNumber ?? "--"}
                    </TableCell>
                    <TableCell data-column="club" className="py-1.5 font-medium">
                      {formatClubType(shot.clubType)}
                    </TableCell>
                    <TableCell data-column="type" className="py-1.5">
                      {formatShotCategory(shot.shotCategory)}
                    </TableCell>
                    <TableCell data-column="quality" className="py-1.5">
                      <Badge variant="outline" className={shotQualityBadgeClass(shot)}>
                        {formatShotQualityLabel(shot)}
                      </Badge>
                    </TableCell>
                    <TableCell data-column="carry" className="py-1.5 text-right">
                      {formatYards(shot.carryYd)}
                    </TableCell>
                    <TableCell data-column="total" className="py-1.5 text-right">
                      {formatYards(shot.totalYd)}
                    </TableCell>
                    <TableCell data-column="side" className="py-1.5 text-right">
                      {formatSignedYards(shot.sideCarryYd)}
                    </TableCell>
                    <TableCell data-column="start" className="py-1.5 text-right">
                      {formatDegrees(shot.launchDirectionDeg)}
                    </TableCell>
                    <TableCell data-column="launch" className="py-1.5 text-right">
                      {formatDegrees(shot.launchAngleDeg)}
                    </TableCell>
                    <TableCell data-column="ball" className="py-1.5 text-right">
                      {formatMph(shot.ballSpeedMph)}
                    </TableCell>
                    <TableCell data-column="smash" className="py-1.5 text-right">
                      {formatNumber(shot.smashFactor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      </details>
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
  const bestShot = bestStraightShots[0] ?? null;

  return (
    <DataPanel className="@container/today-highlights">
      <SectionHeader
        title="Latest practice highlights"
        description={`${records.length} PB moments · ${closeCalls.length} close to PB`}
        action={<Trophy className="size-5 text-amber-600" />}
      />
      <CardContent>
        {stats.length === 0 || highlights.length === 0 ? (
          <div className="apple-panel p-3 text-sm text-muted-foreground">
            No PBs or close calls for this selection.
          </div>
        ) : (
          <div
            data-equal-height-row="today-highlights"
            className="today-highlights-grid grid items-stretch gap-3"
          >
            <div className="today-highlights-list @container/today-highlight-list h-full">
              {records.length > 0 ? (
                <HighlightGroup title="PB moments" highlights={records.slice(0, 6)} />
              ) : (
                <div className="apple-panel p-3 text-sm text-muted-foreground">
                  No PBs in this selection yet.
                </div>
              )}
            </div>

            <aside className="today-highlights-rail @container/today-highlight-rail grid h-full auto-rows-fr gap-3">
              <section className="flex h-full flex-col gap-2 rounded-lg border border-sky-100 bg-sky-50/45 p-3">
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
                  <div className="grid min-h-0 flex-1 gap-2 @sm/today-highlight-rail:grid-cols-[minmax(0,1fr)_12rem]">
                    <StraightShotCard
                      shot={bestShot}
                      featured
                      className="flex h-full flex-col justify-between"
                    />
                    <div
                      data-media-container
                      className="relative min-h-28 overflow-hidden rounded-lg border border-sky-200 bg-emerald-950"
                    >
                      <HeroFairwayVisual shot={bestShot} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-muted-foreground">
                    No directional shot data for this selection.
                  </div>
                )}
              </section>

              <div className="h-full">
                {closeCalls.length > 0 ? (
                  <details className="group h-full rounded-lg border border-amber-100 bg-amber-50/35">
                    <summary className="grid h-full min-h-36 cursor-pointer list-none content-center gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-amber-950">
                            Close to PB
                          </span>
                          <span className="block text-xs text-amber-800">
                            {closeCalls.length} near misses from this practice.
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-amber-900">
                          View all
                          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                        </span>
                      </span>
                      <span className="grid gap-1.5 @sm/today-highlight-rail:grid-cols-2">
                        {closeCalls.slice(0, 4).map((highlight) => (
                          <span
                            key={`summary-${highlight.id}`}
                            className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-amber-100 bg-white/70 px-2 py-1.5"
                          >
                            <span className="min-w-0 truncate text-xs font-medium text-amber-900">
                              {highlight.clubLabel} · {highlight.metricLabel}
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-amber-950">
                              {highlight.value}
                            </span>
                          </span>
                        ))}
                      </span>
                    </summary>
                    <div className="grid gap-2 border-t border-amber-100 p-3">
                      {closeCalls.map((highlight) => (
                        <HighlightCard key={highlight.id} highlight={highlight} />
                      ))}
                    </div>
                  </details>
                ) : (
                  <div className="rounded-lg border border-amber-100 bg-amber-50/35 px-3 py-2.5 text-sm text-amber-900">
                    No close-to-PB calls for this selection.
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function HighlightGroup({ title, highlights }: { title: string; highlights: ClubHighlight[] }) {
  const gridClass =
    title === "Close to PB"
      ? "today-highlight-card-grid grid flex-1 auto-rows-fr items-stretch gap-2"
      : highlights.length <= 4
        ? "today-highlight-card-grid grid flex-1 auto-rows-fr items-stretch gap-3"
        : "today-highlight-card-grid grid flex-1 auto-rows-fr items-stretch gap-3";

  return (
    <section className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
          {title}
        </h3>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          {highlights.length}
        </Badge>
      </div>
      <div data-equal-height-row="today-highlight-cards" className={gridClass}>
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
      <div className="flex h-full min-h-24 items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/45 px-3 py-2.5">
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
          className="h-16 min-h-0 w-20 shrink-0 border-0 bg-transparent"
          imageClassName="px-1 py-1"
          sizes="88px"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-28 items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 shadow-sm">
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
        className="h-20 min-h-0 w-24 shrink-0 border-0 bg-transparent sm:w-28"
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
    <TableRow
      className={`focus-aaa outline-none ${rowTone.rowClass}`}
      data-club-hover={comparison.clubType}
      tabIndex={0}
    >
      <TableCell
        data-column="club"
        className={`sticky left-0 z-10 px-2 py-1.5 font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)] ${rowTone.stickyClass}`}
      >
        {comparison.clubLabel}
      </TableCell>
      <TableCell data-column="call" className="px-2 py-1.5">
        <Badge className={clubComparisonBadgeClass(comparison)}>
          {clubComparisonCallLabel(comparison)}
        </Badge>
      </TableCell>
      <TableCell data-column="shots" className="px-2 py-1.5 text-right">
        {comparison.today.shotCount}
        <span className="text-muted-foreground">/{comparison.previous.shotCount}</span>
      </TableCell>
      <MetricDeltaCell
        column="carry"
        value={comparison.today.carryAverageYd}
        delta={comparison.carryDeltaYd}
        unit="yd"
        direction="higher"
      />
      <MetricDeltaCell
        column="offline"
        value={comparison.today.offlineAverageYd}
        delta={comparison.offlineDeltaYd}
        unit="yd"
        direction="lower"
      />
      <RateDeltaCell
        column="straight"
        value={comparison.today.straightRate}
        delta={comparison.straightRateDelta}
        direction="higher"
        metric="straight"
      />
      <RateDeltaCell
        column="playable"
        value={comparison.today.playableRate}
        delta={comparison.playableRateDelta}
        direction="higher"
        metric="playable"
      />
      <TableCell
        data-column="signal"
        className="max-w-[10.5rem] whitespace-normal px-2 py-1.5 align-top text-sm leading-snug text-muted-foreground"
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
  if (isLowSampleComparison(comparison)) {
    return [clubComparisonSignalText(comparison)];
  }

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

function isLowSampleComparison(comparison: ClubDayComparison) {
  return comparison.today.shotCount < MIN_CONFIDENT_CLUB_SHOTS;
}

function clubComparisonCallLabel(comparison: ClubDayComparison) {
  return clubSessionBadgeReadout(comparison.clubType, comparison.today).label;
}

function clubComparisonBadgeClass(comparison: ClubDayComparison) {
  const readout = clubSessionBadgeReadout(comparison.clubType, comparison.today);

  if (readout.tone === "slate") {
    return "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100";
  }

  return verdictToneBadgeClass(readout.tone);
}

function clubComparisonSignalText(comparison: ClubDayComparison) {
  if (!isLowSampleComparison(comparison)) {
    return comparison.summary;
  }

  const shots = integerFormatter.format(comparison.today.shotCount);
  const noun = comparison.today.shotCount === 1 ? "shot" : "shots";
  return `${shots} current ${noun}. Retest before calling ${comparison.clubLabel} better or worse.`;
}

function MetricDeltaCell({
  column,
  value,
  delta,
  unit,
  direction,
}: {
  column: string;
  value: number | null;
  delta: number | null;
  unit: "yd";
  direction: "higher" | "lower";
}) {
  return (
    <TableCell data-column={column} className="whitespace-normal px-2 py-1.5 text-right">
      <div className="font-medium">{formatYards(value)}</div>
      <div className={deltaClass(delta, direction)}>{deltaText(delta, unit, true)}</div>
    </TableCell>
  );
}

function RateDeltaCell({
  column,
  value,
  delta,
  direction,
  metric,
}: {
  column: string;
  value: number | null;
  delta: number | null;
  direction: "higher";
  metric: "straight" | "playable";
}) {
  const tone = rateValueTone(value, metric);

  return (
    <TableCell data-column={column} className="whitespace-normal px-2 py-1.5 text-right">
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
  className = "",
}: {
  shot: TodayPracticeShot;
  featured?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`${
        featured
          ? "rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 shadow-sm"
          : "rounded-lg border border-slate-200/80 bg-white px-3 py-2"
      } ${className}`}
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

function shouldLoadTodaySocial(value: string) {
  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes";
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

function todaySocialHref(data: TodayPracticeData, sort: ClubSort) {
  const params = new URLSearchParams({
    date: data.dateKey,
    social: "1",
  });

  if (data.filters.sessionId) {
    params.set("session", data.filters.sessionId);
  }

  if (data.filters.club) {
    params.set("club", data.filters.club);
  }

  if (sort !== "bag") {
    params.set("clubSort", sort);
  }

  return `/today?${params.toString()}#social-context`;
}

function todayReviewModeHref(data: TodayPracticeData, sort: ClubSort, mode: PracticeReviewMode) {
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
  if (mode === "raw") {
    params.set("evidence", "raw");
  }

  return `/today?${params.toString()}#today-review-controls`;
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

function parsePracticeReviewMode(value: string): PracticeReviewMode {
  return value === "raw" ? "raw" : "clean";
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
    launchDirectionDeg: shot.launchDirectionDeg,
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

function shotPatternInsight(comparisons: ClubDayComparison[]) {
  const best = bestClubComparison(comparisons);
  const work = needsWorkComparison(comparisons);
  const reliable = reliableClubComparison(comparisons);

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

function heroVerdictTitle(data: TodayPracticeData, mode: PracticeReviewMode = "clean") {
  if (reviewShots(data, mode).length > 0) {
    const score = practiceScoreSummary(data, mode);
    return practiceHeadlineFromScore(score);
  }

  if (data.overall.verdict === "better") return "Better than baseline";
  if (data.overall.verdict === "worse") return "Behind baseline";
  if (data.overall.verdict === "mixed") return "Mixed session";
  return data.overall.title;
}

function practiceHeadlineFromScore(score: PracticeScoreSummary) {
  return latestPracticeHeadline(
    {
      score: score.score,
      label: score.sessionQualityLabel,
      detail: score.sessionQualityDetail,
      tone: score.tone,
    },
    buildScoringControlReadout(score.scoringScore),
  );
}

function verdictStoryChips(data: TodayPracticeData): VerdictReasonItem[] {
  const { playableRateDelta, offlineDeltaYd, carryDeltaYd } = data.overall;
  const chips: VerdictReasonItem[] = [];

  if (isNumber(playableRateDelta)) {
    chips.push({
      label:
        playableRateDelta > 1
          ? "More playable"
          : playableRateDelta < -1
            ? "Less playable"
            : "Playable held",
      value: deltaText(playableRateDelta, "pp", true),
      tone: playableKpiTone(playableRateDelta),
    });
  }

  if (isNumber(offlineDeltaYd)) {
    chips.push({
      label: offlineDeltaYd < -1 ? "Straighter" : offlineDeltaYd > 1 ? "Wider" : "Accuracy held",
      value: offlineDeltaText(offlineDeltaYd),
      tone: offlineKpiTone(offlineDeltaYd),
    });
  }

  if (isNumber(carryDeltaYd)) {
    chips.push({
      label:
        carryDeltaYd > 1
          ? "Longer"
          : carryDeltaYd < -1 && Math.abs(carryDeltaYd) <= 5
            ? "Slightly shorter"
            : carryDeltaYd < -1
              ? "Shorter"
              : "Carry held",
      value: deltaText(carryDeltaYd, "yd", true),
      tone:
        carryDeltaYd < -1 && Math.abs(carryDeltaYd) <= 5
          ? "amber"
          : deltaTone(carryDeltaYd, "higher"),
    });
  }

  return chips;
}

function reviewNarrative(
  data: TodayPracticeData,
  linkedPracticePlan?: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>,
) {
  const { verdict, offlineDeltaYd, straightRateDelta, carryDeltaYd } = data.overall;

  if (!isNumber(offlineDeltaYd) && !isNumber(straightRateDelta) && !isNumber(carryDeltaYd)) {
    return data.overall.summary;
  }

  const coaching = sessionCoachingSummary(data);
  const score = practiceScoreSummary(data);
  const planResult = buildPlanResultReadout(linkedPracticePlan ?? null);
  const best = coaching.biggestGain;
  const opportunity = coaching.biggestOpportunity;
  const intro =
    best && opportunity && score.score >= 70 && score.scoringScore < 6.5
      ? `${best.clubLabel} was strong. ${firstPracticeJobLabel(
          opportunity,
        )} remains the first practice job.`
      : best && opportunity
        ? `${best.clubLabel} was the best performer. ${opportunity.clubLabel} is the biggest opportunity.`
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

  const planNote =
    planResult?.label === "Incomplete"
      ? " The session was useful. The planned drill was not fully proven."
      : "";
  const changeSummary = sentenceJoin(parts);

  return `${intro}${changeSummary ? ` ${changeSummary}.` : ""}${planNote}`;
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

function selectedClubCount(data: TodayPracticeData, mode: PracticeReviewMode = "clean") {
  return new Set(reviewShots(data, mode).map((shot) => shot.clubType)).size;
}

function sessionScopeLabel(data: TodayPracticeData) {
  const session = data.sessions.find((item) => item.id === data.filters.sessionId);
  if (session) return session.label;
  return "All sessions for this practice date";
}

function practiceFocus(data: TodayPracticeData) {
  const work = needsWorkComparison(data.clubComparisons);
  const clubText = work?.clubLabel ?? "your next set";
  const problem = work ? opportunityProblemText(work) : data.overall.summary;

  return {
    clubText,
    problem,
  };
}

function reviewShots(data: TodayPracticeData, mode: PracticeReviewMode) {
  return mode === "raw" ? data.rawShots : data.shots;
}

function reviewComparisons(data: TodayPracticeData, mode: PracticeReviewMode) {
  return mode === "raw" ? data.rawClubComparisons : data.clubComparisons;
}

function reviewOverall(data: TodayPracticeData, mode: PracticeReviewMode) {
  return mode === "raw" ? data.rawOverall : data.overall;
}

function practiceScoreSummary(
  data: TodayPracticeData,
  mode: PracticeReviewMode = "clean",
): PracticeScoreSummary {
  const comparisons = reviewComparisons(data, mode);
  const overall = reviewOverall(data, mode);
  const shots = reviewShots(data, mode);
  const best = bestClubComparison(comparisons);
  const work = needsWorkComparison(comparisons);
  const reliable = reliableClubComparison(comparisons);
  const coaching = sessionCoachingSummary(data, mode);
  const sessionQuality = buildSessionQualityReadout({
    shotCount: shots.length,
    selectedClubCount: selectedClubCount(data, mode),
    playableRate: overall.today.playableRate,
    bigMissRate: overall.today.bigMissRate,
    offlineAverageYd: overall.today.offlineAverageYd,
    strikeScore: coaching.strikeScore,
    pbMomentCount: pbMomentCount(data),
    clubs: comparisons.map((comparison) => ({
      clubType: comparison.clubType,
      shotCount: comparison.today.shotCount,
      playableRate: comparison.today.playableRate,
      bigMissRate: comparison.today.bigMissRate,
      offlineAverageYd: comparison.today.offlineAverageYd,
      straightRate: comparison.today.straightRate,
      carryStdDevYd: comparison.today.carryStdDevYd,
      carryRobustStdDevYd: comparison.today.carryRobustStdDevYd,
    })),
  });
  const scoringControl = buildScoringControlReadout(coaching.scoringScore);
  const score = sessionQuality.score;
  const tone = sessionQuality.tone as ReviewTone;
  const sessionUsefulnessLabel =
    score >= 70 && (scoringControl.label === "Mixed" || scoringControl.label === "Needs work")
      ? "Productive"
      : sessionQuality.label;
  return {
    score,
    sessionQualityLabel: sessionUsefulnessLabel,
    sessionQualityDetail: sessionQuality.detail,
    playableRateLabel: formatRate(data.overall.today.playableRate),
    strikeScore: coaching.strikeScore,
    scoringScore: coaching.scoringScore,
    scoringControlLabel: scoringControl.label,
    tone,
    strong: best?.clubLabel ?? reliable?.clubLabel ?? "Building",
    weak: work?.clubLabel ?? "None clear",
    recommendation: work ? firstPracticeJobLabel(work) : "Retest the same block",
    strikeDetail: coaching.strikeDetail,
    scoringDetail: scoringControl.detail,
  };
}

function sessionCoachingSummary(
  data: TodayPracticeData,
  mode: PracticeReviewMode = "clean",
): SessionCoachingSummary {
  const comparisons = reviewComparisons(data, mode);
  const strikeScore = sessionStrikeQualityScore(data, mode);
  const scoringScore = sessionScoringQualityScore(data, mode);
  const scoringControl = buildScoringControlReadout(scoringScore);
  const biggestGain = bestClubComparison(comparisons);
  const biggestOpportunity = needsWorkComparison(comparisons);

  return {
    strikeScore,
    strikeDetail: strikeQualityDetail(strikeScore),
    scoringScore,
    scoringDetail: scoringControl.detail,
    biggestGain,
    gainDetail: biggestGain
      ? gainDetail(biggestGain)
      : "Import more shots to separate form from noise.",
    biggestOpportunity,
    opportunityDetail: biggestOpportunity
      ? opportunityDetail(biggestOpportunity)
      : "No single club is dragging this review yet.",
    opportunityCause: biggestOpportunity
      ? opportunityCause(biggestOpportunity)
      : "Keep the next block like-for-like.",
    opportunityTarget: biggestOpportunity
      ? opportunityTarget(biggestOpportunity)
      : "Retest before changing the practice plan.",
  };
}

function sessionScoringQualityScore(data: TodayPracticeData, mode: PracticeReviewMode = "clean") {
  const weighted = weightedAverage(
    reviewComparisons(data, mode)
      .filter((comparison) => comparison.today.shotCount > 0)
      .map((comparison) => ({
        value: clubTypeCurrentPerformanceScore(comparison.clubType, comparison.today),
        weight: comparison.today.shotCount,
      })),
  );

  return roundOneNumber((weighted ?? 0) / 10) ?? 0;
}

function sessionStrikeQualityScore(data: TodayPracticeData, mode: PracticeReviewMode = "clean") {
  const weighted = weightedAverage(
    reviewShots(data, mode)
      .map((shot) => ({
        value: shotStrikeQualityScore(shot),
        weight: 1,
      }))
      .filter((item) => isNumber(item.value)),
  );

  return roundOneNumber((weighted ?? 0) / 10) ?? 0;
}

function shotStrikeQualityScore(shot: TodayPracticeShot) {
  if (isNumber(shot.smashFactor)) {
    return smashStrikeScore(shot.clubType, shot.smashFactor);
  }

  if (isNumber(shot.ballSpeedMph) && isNumber(shot.carryYd)) {
    return clamp((shot.carryYd / Math.max(shot.ballSpeedMph, 1)) * 48, 45, 88);
  }

  return null;
}

function smashStrikeScore(clubType: string, smashFactor: number) {
  const profile = isDriverClubType(clubType)
    ? { floor: 1.36, ceiling: 1.5 }
    : isWedgeClubType(clubType)
      ? { floor: 1.08, ceiling: 1.28 }
      : { floor: 1.22, ceiling: 1.42 };

  return clamp(
    ((smashFactor - profile.floor) / (profile.ceiling - profile.floor)) * 45 + 55,
    40,
    100,
  );
}

function strikeQualityDetail(score: number) {
  if (score >= 8.2) return "Strike was strong enough to leave the swing alone.";
  if (score >= 6.5) return "Strike was playable; scoring was decided more by direction.";
  return "Contact quality needs checking before judging the scoring pattern.";
}

function gainDetail(comparison: ClubDayComparison) {
  return `${bestPerformerDetail(comparison)}. Maintain current swing.`;
}

function opportunityProblemText(comparison: ClubDayComparison) {
  return `${comparison.clubLabel} is the biggest opportunity. ${opportunityDetail(
    comparison,
  )} ${opportunityCause(comparison)}`;
}

function opportunityDetail(comparison: ClubDayComparison) {
  if (clubControlLabel(comparison.today) === "Playable but not scoring-tight") {
    return `${clubControlLabel(comparison.today)}: ${formatRate(
      comparison.today.playableRate,
    )} playable, ${formatRate(comparison.today.straightRate)} straight and ${formatYards(
      comparison.today.offlineAverageYd,
    )} offline.`;
  }

  if (isDriverClubType(comparison.clubType) && (comparison.today.playableRate ?? 0) >= 75) {
    return `Direction, not strike: ${formatYards(
      comparison.today.offlineAverageYd,
    )} offline with ${formatRate(comparison.today.playableRate)} playable.`;
  }

  if (isWedgeClubType(comparison.clubType)) {
    return `${formatYards(comparison.today.offlineAverageYd)} offline and ${formatRate(
      comparison.today.straightRate,
    )} straight. Tighten start line.`;
  }

  return `${formatYards(comparison.today.offlineAverageYd)} offline, ${formatRate(
    comparison.today.playableRate,
  )} playable, ${formatRate(comparison.today.straightRate)} straight.`;
}

function opportunityCause(comparison: ClubDayComparison) {
  if (clubControlLabel(comparison.today) === "Playable but not scoring-tight") {
    return "Start line is the first fix; do not rebuild a playable swing.";
  }

  if (isDriverClubType(comparison.clubType) && (comparison.today.playableRate ?? 0) >= 75) {
    return "Do not chase speed or contact first; start line and face control are the job.";
  }

  if ((comparison.today.playableRate ?? 0) < 65) {
    return "Playable rate is the first fix.";
  }

  if ((comparison.today.straightRate ?? 0) < 25) {
    return "Start line is the first fix.";
  }

  return "Carry and dispersion need another cleaner block.";
}

function opportunityTarget(comparison: ClubDayComparison) {
  if (isDriverClubType(comparison.clubType)) {
    return "Keep strike intent; run a 20-ball driver line-control block.";
  }

  if (isWedgeClubType(comparison.clubType)) {
    return "Retest the same yardage window before changing wedge technique.";
  }

  return `Retest ${comparison.clubLabel} and beat this review's ${formatYards(
    comparison.today.offlineAverageYd,
  )} offline average.`;
}

function firstPracticeJobLabel(comparison: ClubDayComparison) {
  if ((comparison.today.straightRate ?? 100) < 35) {
    return `${comparison.clubLabel} start line`;
  }

  if ((comparison.today.playableRate ?? 100) < 65) {
    return `${comparison.clubLabel} playable strike`;
  }

  if (isNumber(comparison.today.carryStdDevYd) && comparison.today.carryStdDevYd > 18) {
    return `${comparison.clubLabel} carry window`;
  }

  return `${comparison.clubLabel} scoring control`;
}

function pbMomentCount(data: TodayPracticeData) {
  return data.clubStats.reduce((total, stats) => {
    const metrics: ClubMainStatMetric[] = [
      stats.carryYd,
      stats.totalYd,
      stats.offlineYd,
      stats.ballSpeedMph,
      stats.clubSpeedMph,
      stats.smashFactor,
      stats.launchAngleDeg,
      stats.apexFt,
    ];

    return (
      total +
      metrics.filter((metric) => metric.bestStatus !== "none" && metric.todayBest !== null).length
    );
  }, 0);
}

function bestPerformerDetail(comparison: ClubDayComparison) {
  return `${formatRate(comparison.today.playableRate)} playable / ${formatYards(
    comparison.today.offlineAverageYd,
  )} offline`;
}

function opportunityShortDetail(comparison: ClubDayComparison) {
  if (clubControlLabel(comparison.today) === "Playable but not scoring-tight") {
    return `${formatRate(comparison.today.playableRate)} playable but not scoring-tight`;
  }

  if (isDriverClubType(comparison.clubType) && (comparison.today.playableRate ?? 0) >= 75) {
    return `Direction only: ${formatYards(comparison.today.offlineAverageYd)} offline`;
  }

  return `${formatRate(comparison.today.straightRate)} straight / ${formatYards(
    comparison.today.offlineAverageYd,
  )} offline`;
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
      label: "Lateral window",
      value: deltaText(data.overall.playableRateDelta, "pp", true),
      detail: "inside the lateral window",
      tone: deltaTone(data.overall.playableRateDelta, "higher"),
      priority: 0,
    },
  ];
}

function sessionImpactValue(comparison: ClubDayComparison) {
  if (comparison.verdict === "new") {
    return null;
  }

  return clubTypeEstimatedStrokeEffect(comparison.clubType, {
    carryDeltaYd: comparison.carryDeltaYd,
    offlineDeltaYd: comparison.offlineDeltaYd,
    straightRateDelta: comparison.straightRateDelta,
    playableRateDelta: comparison.playableRateDelta,
    bigMissRateDelta: comparison.bigMissRateDelta,
    consistencyDeltaYd: comparison.consistencyDeltaYd,
  });
}

function confidenceMeterItems(data: TodayPracticeData): ConfidenceMeterItem[] {
  const storyComparisons = uniqueComparisons([
    bestClubComparison(data.clubComparisons),
    reliableClubComparison(data.clubComparisons),
    needsWorkComparison(data.clubComparisons),
  ]);
  const comparisons =
    storyComparisons.length > 0 ? storyComparisons : data.clubComparisons.slice(0, 3);

  return comparisons.map((comparison) => {
    const score =
      comparison.today.shotCount > 0
        ? clubTypeCurrentPerformanceScore(comparison.clubType, comparison.today)
        : null;
    const readout = confidenceMeterReadout(comparison, score);

    return {
      clubLabel: comparison.clubLabel,
      score,
      label: readout.label,
      reason: readout.reason,
      tone: readout.tone,
    };
  });
}

function confidenceMeterReadout(
  comparison: ClubDayComparison,
  score: number | null,
): { label: string; reason: string; tone: ReviewTone } {
  const shotCount = comparison.today.shotCount;
  const reason = `${integerFormatter.format(shotCount)} shots / ${formatRate(
    comparison.today.playableRate,
  )} playable / ${formatYards(comparison.today.offlineAverageYd)} offline`;

  if (!isNumber(score)) {
    return {
      label: "Building",
      reason,
      tone: "slate",
    };
  }

  if (shotCount < 5) {
    return {
      label: "Low confidence",
      reason,
      tone: score >= 65 ? "amber" : "pink",
    };
  }

  if (
    isDriverClubType(comparison.clubType) &&
    (comparison.today.playableRate ?? 0) >= 90 &&
    ((comparison.today.offlineAverageYd ?? 0) >= 10 || (comparison.today.straightRate ?? 100) < 50)
  ) {
    return {
      label: "Monitor start line",
      reason,
      tone: "amber",
    };
  }

  if (clubControlLabel(comparison.today) === "Playable but not scoring-tight") {
    return {
      label: "Tighten start line",
      reason,
      tone: "amber",
    };
  }

  if (score >= 78) {
    return {
      label: "High confidence",
      reason,
      tone: "green",
    };
  }

  if (score >= 62) {
    return {
      label: "Medium confidence",
      reason,
      tone: "sky",
    };
  }

  return {
    label: "Low confidence",
    reason,
    tone: "pink",
  };
}

function driverHealthSummary(data: TodayPracticeData): DriverHealthSummary {
  const driverShots = data.shots.filter((shot) => isDriverClubType(shot.clubType));
  const measuredDriverShots = driverShots.filter(
    (shot) => !isEstimatedClubData(shot.clubDataEstType),
  );
  const path = roundOneNumber(averageNumbers(measuredDriverShots.map((shot) => shot.clubPathDeg)));
  const startLine = roundOneNumber(
    averageNumbers(driverShots.map((shot) => shot.launchDirectionDeg)),
  );
  const faceAngle = roundOneNumber(
    averageNumbers(
      measuredDriverShots.map((shot) =>
        calculateClubFaceAngleDeg(shot.launchDirectionDeg, shot.clubPathDeg),
      ),
    ),
  );
  const faceToPath = roundOneNumber(
    averageNumbers(
      measuredDriverShots.map((shot) => {
        const modelledFace = calculateClubFaceAngleDeg(shot.launchDirectionDeg, shot.clubPathDeg);
        return isNumber(modelledFace) && isNumber(shot.clubPathDeg)
          ? modelledFace - shot.clubPathDeg
          : null;
      }),
    ),
  );
  const targetPath = 5;
  const measuredShotCount = measuredDriverShots.length;
  const totalShotCount = driverShots.length;

  if (driverShots.length === 0) {
    return {
      path: null,
      targetPath,
      startLine: null,
      faceAngle: null,
      faceToPath: null,
      measuredShotCount,
      totalShotCount,
      status: "No driver in review",
      detail: "Add driver shots to see path, face angle and draw health here.",
      tone: "slate",
    };
  }

  if (!isNumber(path)) {
    return {
      path: null,
      targetPath,
      startLine,
      faceAngle,
      faceToPath: null,
      measuredShotCount,
      totalShotCount,
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
      faceAngle,
      faceToPath,
      measuredShotCount,
      totalShotCount,
      status: "Healthy push draw",
      detail: "Path is sitting close to your normal draw window.",
      tone: "green",
    };
  }

  if (path < 3) {
    return {
      path,
      targetPath,
      startLine,
      faceAngle,
      faceToPath,
      measuredShotCount,
      totalShotCount,
      status: "Playable, monitor path",
      detail:
        "Path is below the draw-window target, but delivery is playable. Monitor start line before adding more inside path.",
      tone: "amber",
    };
  }

  if (isNumber(faceToPath) && faceToPath > 3) {
    return {
      path,
      targetPath,
      startLine,
      faceAngle,
      faceToPath,
      measuredShotCount,
      totalShotCount,
      status: "Face too open",
      detail: "Path is usable, but face angle is drifting too far open.",
      tone: "pink",
    };
  }

  if (isNumber(faceToPath) && faceToPath < -1.5) {
    return {
      path,
      targetPath,
      startLine,
      faceAngle,
      faceToPath,
      measuredShotCount,
      totalShotCount,
      status: "Face closing",
      detail: "Path is present, but face angle is closing against it.",
      tone: "amber",
    };
  }

  return {
    path,
    targetPath,
    startLine,
    faceAngle,
    faceToPath,
    measuredShotCount,
    totalShotCount,
    status: "Driver delivery needs a check",
    detail:
      "Driver delivery is outside the preferred window. Treat this as a check, not a reason to chase a bigger draw.",
    tone: "amber",
  };
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
  return comparisonConfidencePool(comparisons).sort(compareBestClub)[0] ?? null;
}

function needsWorkComparison(comparisons: ClubDayComparison[]) {
  return comparisonConfidencePool(comparisons).sort(compareNeedsWork)[0] ?? null;
}

function reliableClubComparison(comparisons: ClubDayComparison[]) {
  return comparisonConfidencePool(comparisons).sort(compareReliableClub)[0] ?? null;
}

function comparisonConfidencePool(comparisons: ClubDayComparison[]) {
  const confident = comparisons.filter((comparison) => !isLowSampleComparison(comparison));
  return confident.length > 0 ? [...confident] : [...comparisons];
}

function compareBestClub(left: ClubDayComparison, right: ClubDayComparison) {
  const leftScore = clubTypeCurrentPerformanceScore(left.clubType, left.today);
  const rightScore = clubTypeCurrentPerformanceScore(right.clubType, right.today);

  return (
    rightScore - leftScore ||
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
    longTermReliabilityScore(right) - longTermReliabilityScore(left) ||
    valueOrZero(right.today.playableRate) - valueOrZero(left.today.playableRate) ||
    valueOrZero(right.today.straightRate) - valueOrZero(left.today.straightRate) ||
    valueOrZero(left.today.offlineAverageYd) - valueOrZero(right.today.offlineAverageYd)
  );
}

function longTermReliabilityScore(comparison: ClubDayComparison) {
  const previousScore =
    comparison.previous.shotCount > 0
      ? clubTypeCurrentPerformanceScore(comparison.clubType, comparison.previous)
      : null;
  const todayScore = clubTypeCurrentPerformanceScore(comparison.clubType, comparison.today);
  const sampleScore = clamp(
    ((comparison.previous.shotCount + comparison.today.shotCount) / 30) * 100,
    0,
    100,
  );

  if (isNumber(previousScore)) {
    return previousScore * 0.55 + todayScore * 0.25 + sampleScore * 0.2;
  }

  return todayScore * 0.75 + sampleScore * 0.25;
}

function clubPerformanceNarrative(data: TodayPracticeData) {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);
  const reliableReadout = clubTrustReadout(reliable);

  if (!best || !work || !reliable) {
    return "This session against up to 50 earlier clean shots for the same club.";
  }

  return `${best.clubLabel} had today's best current form, ${reliable.clubLabel} ${reliableReadout.narrative}, and ${work.clubLabel} is the biggest opportunity.`;
}

function clubPerformanceRead(data: TodayPracticeData) {
  const best = bestClubComparison(data.clubComparisons);
  const work = needsWorkComparison(data.clubComparisons);
  const reliable = reliableClubComparison(data.clubComparisons);
  const reliableReadout = clubTrustReadout(reliable);

  if (!best || !work || !reliable) {
    return data.overall.summary;
  }

  return `${best.clubLabel} had today's best current form, ${reliable.clubLabel} ${reliableReadout.read}, and ${work.clubLabel} is the first practice job.`;
}

function clubTrustReadout(comparison: ClubDayComparison | null): {
  label: string;
  detail: string | null;
  subdetail: string | null;
  narrative: string;
  read: string;
} {
  if (!comparison) {
    return {
      label: "Most trusted long-term",
      detail: null,
      subdetail: null,
      narrative: "is the longer-term trust read",
      read: "remains the long-term trust read",
    };
  }

  if (shouldCallMostPlayable(comparison)) {
    return {
      label: "Playable but not scoring-tight",
      detail: `${formatRate(comparison.today.playableRate)} playable, but start line still needs work.`,
      subdetail: `${formatRate(comparison.today.straightRate)} straight · ${formatYards(
        comparison.today.offlineAverageYd,
      )} offline`,
      narrative: "is the most playable read, but not the straightest one",
      read: "was most playable but still needs start-line work",
    };
  }

  return {
    label: "Most trusted long-term",
    detail: `${formatRate(comparison.today.straightRate)} straight · ${formatRate(
      comparison.today.playableRate,
    )} playable`,
    subdetail: `${formatYards(comparison.today.offlineAverageYd)} offline`,
    narrative: "is the longer-term trust read",
    read: "remains the long-term trust read",
  };
}

function shouldCallMostPlayable(comparison: ClubDayComparison) {
  return (comparison.today.playableRate ?? 0) >= 90 && (comparison.today.straightRate ?? 100) < 35;
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
  if (isLowSampleComparison(comparison)) {
    return {
      rowClass: "bg-slate-50/70 text-slate-500 hover:bg-slate-50",
      stickyClass: "bg-slate-50 text-slate-600",
    };
  }

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

function practicePlanResultCardClass(tone: ReviewTone) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50/80";
  if (tone === "pink") return "border-pink-200 bg-pink-50/75";
  if (tone === "amber") return "border-amber-200 bg-amber-50/80";
  if (tone === "sky") return "border-sky-200 bg-sky-50/75";
  return "border-slate-200 bg-slate-50";
}

function practicePlanResultHeadingClass(tone: ReviewTone) {
  if (tone === "green") return "text-emerald-950";
  if (tone === "pink") return "text-pink-950";
  if (tone === "amber") return "text-amber-950";
  if (tone === "sky") return "text-sky-950";
  return "text-slate-950";
}

function practicePlanResultBodyClass(tone: ReviewTone) {
  if (tone === "green") return "text-emerald-900";
  if (tone === "pink") return "text-pink-900";
  if (tone === "amber") return "text-amber-900";
  if (tone === "sky") return "text-sky-900";
  return "text-slate-700";
}

function practicePlanResultButtonClass(tone: ReviewTone) {
  if (tone === "pink")
    return "border-pink-200 text-pink-950 hover:border-pink-300 hover:bg-pink-50";
  if (tone === "amber") {
    return "border-amber-200 text-amber-950 hover:border-amber-300 hover:bg-amber-50";
  }
  if (tone === "sky") return "border-sky-200 text-sky-950 hover:border-sky-300 hover:bg-sky-50";
  return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function verdictToneBadgeClass(tone: ReviewTone) {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  }

  if (tone === "pink") return "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-50";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50";
  return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function deltaClass(value: number | null, direction: "higher" | "lower") {
  const tone = deltaTone(value, direction);
  const color =
    tone === "green"
      ? "text-emerald-800"
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

function shotOfDayReason(shot: TodayPracticeShot) {
  const offline = isNumber(shot.sideCarryYd) ? Math.abs(shot.sideCarryYd) : null;

  if (isNumber(offline) && offline <= 3) {
    return `Closest to target: ${formatOfflineYards(shot.sideCarryYd)}.`;
  }

  if (isNumber(offline) && offline <= 10) {
    return `Best executed shot: ${formatOfflineYards(shot.sideCarryYd)}.`;
  }

  if (isNumber(shot.launchDirectionDeg) && Math.abs(shot.launchDirectionDeg) <= 3.5) {
    return `Best start line: ${formatDegrees(shot.launchDirectionDeg)}.`;
  }

  return "Best executed shot from the selected review.";
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

function formatShotCategory(value: string | null) {
  if (!value) return "--";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatClubOptionShotCount(club: TodayPracticeData["clubs"][number]) {
  if (club.cleanShotCount === club.shotCount) {
    return integerFormatter.format(club.shotCount);
  }

  return `${integerFormatter.format(club.cleanShotCount)} clean / ${integerFormatter.format(
    club.shotCount,
  )}`;
}

function shotQualityBadgeClass(shot: TodayPracticeShot) {
  if (isShotExcluded(shot)) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function formatShotQualityLabel(shot: TodayPracticeShot) {
  if (shot.dataIntegrityIssue === "trajectory-review") {
    return "Review: trajectory";
  }

  if (isShotExcluded(shot)) {
    return `Excluded: ${formatQualityTag(shot.qualityTag)}`;
  }

  return "Clean";
}

function isShotExcluded(shot: TodayPracticeShot) {
  return shot.dataIntegrityIssue !== null || isExcludedPracticeQualityTag(shot.qualityTag);
}

function formatQualityTag(value: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "non-clean";
  }

  if (normalized === "top") {
    return "topped / non-clean";
  }

  if (normalized === "bad_data" || normalized === "bad-data") {
    return "bad data";
  }

  return normalized.replace(/[-_]+/g, " ");
}

function formatImpactDelta(value: number | null, unit: "yd" | "points") {
  if (!isNumber(value)) {
    return "--";
  }

  const sign = value > 0 ? "+" : "";
  const suffix = unit === "yd" ? " yd" : "";
  return `${sign}${numberFormatter.format(value)}${suffix}`;
}

function buildPlanCleanSampleNote(
  plan: Awaited<ReturnType<typeof getPracticePlanForSourceSessions>> | null,
  data: TodayPracticeData,
) {
  if (!plan || data.dataCleaning.excludedShotCount === 0) {
    return null;
  }

  for (const block of plan.blocks ?? []) {
    if (!block.ballCount || block.clubs.length === 0) {
      continue;
    }

    const blockClubs = new Set(block.clubs);
    const rawCount = data.rawShots.filter((shot) => blockClubs.has(shot.clubType)).length;
    const cleanCount = data.shots.filter((shot) => blockClubs.has(shot.clubType)).length;
    const excludedCount = rawCount - cleanCount;

    if (rawCount >= block.ballCount && cleanCount < block.ballCount && excludedCount > 0) {
      const clubLabel =
        block.clubs.length === 1 ? formatClubType(block.clubs[0] ?? "") : "matching";
      const noun = excludedCount === 1 ? "shot" : "shots";

      return `Plan partially matched: ${integerFormatter.format(cleanCount)}/${integerFormatter.format(
        block.ballCount,
      )} valid ${clubLabel} shots found. ${integerFormatter.format(
        excludedCount,
      )} excluded ${noun} stay in raw history.`;
    }
  }

  return `Clean scoring used ${integerFormatter.format(
    data.dataCleaning.cleanShotCount,
  )}/${integerFormatter.format(
    data.dataCleaning.importedShotCount,
  )} valid shots; excluded shots stay in raw history.`;
}

function delta(current: number | null, previous: number | null) {
  if (!isNumber(current) || !isNumber(previous)) {
    return null;
  }

  return Math.round((current - previous) * 10) / 10;
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

function weightedAverage(items: Array<{ value: number | null; weight: number }>) {
  const values = items.flatMap((item) =>
    isNumber(item.value) && item.weight > 0 ? [{ value: item.value, weight: item.weight }] : [],
  );

  if (values.length === 0) {
    return null;
  }

  const weightTotal = values.reduce((total, item) => total + item.weight, 0);
  return values.reduce((total, item) => total + item.value * item.weight, 0) / weightTotal;
}

function cssAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
