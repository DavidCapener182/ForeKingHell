import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  ChartNoAxesCombined,
  Database,
  Flag,
  Info,
  Radar,
  Trophy,
  Upload,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
  MobileBentoSummary,
  MobileDataCard,
  MobileDataList,
  MobileSectionChips,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
  StickyMobileAction,
} from "@/components/premium";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { HandicapConfidenceFeaturePanel } from "@/components/features/feature-panels";
import { MobileAppShell, MobileRouteHeader } from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import { Badge } from "@/components/ui/badge";
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
import { rapsodoSyncSessions, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildCoachSummary } from "@/lib/coach";
import { getProgressData } from "@/lib/progress-data";
import {
  calculateHandicapSummary,
  calculatePlayingHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  formatHandicapValue,
  normaliseHandicapRoundInput,
  type HandicapSummary,
  type PlayingHandicapSummary,
} from "@/lib/round-handicap";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { getRangeRealityHandicapData, type RangeRealityHandicapData } from "@/lib/reality-handicap";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const handicapRoundColumns: DesktopWorkbenchColumn[] = [
  { id: "round", label: "Round", locked: true },
  { id: "date", label: "Date" },
  { id: "type", label: "Type" },
  { id: "score", label: "Score" },
  { id: "rating", label: "Rating" },
  { id: "slope", label: "Slope" },
  { id: "differential", label: "Diff" },
  { id: "eligibility", label: "Eligibility" },
  { id: "holes", label: "Holes" },
  { id: "shots", label: "Shots" },
];

const handicapSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Score differentials",
    href: "#rounds",
    detail: "Every eligible scorecard feeding the handicap confidence view.",
  },
  {
    title: "Round history",
    href: "/rounds",
    detail: "Open the round manager for scorecard cleanup and review.",
  },
  {
    title: "Import scorecard",
    href: "/import",
    detail: "Add simulator or real-course evidence to strengthen the estimate.",
  },
];

export default async function HandicapPage() {
  const [rounds, progressData, featureData, rangeReality] = await Promise.all([
    getHandicapRounds(),
    getProgressData(),
    getFeatureIdeasData(),
    getRangeRealityHandicapData(),
  ]);
  const realRounds = rounds.filter((round) => round.type === "real_round");
  const simulatorRounds = rounds.filter((round) => round.type !== "real_round");
  const missingRatingRounds = rounds.filter(
    (round) => round.courseRating === null || round.slopeRating === null,
  );
  const realHandicap = calculateHandicapSummary(
    realRounds.map((round) => round.handicapDifferential),
  );
  const simulatorHandicap = calculateHandicapSummary(
    simulatorRounds.map((round) => round.handicapDifferential),
  );
  const combinedHandicap = calculateHandicapSummary(
    rounds.map((round) => round.handicapDifferential),
  );
  const playingHandicap = calculatePlayingHandicapSummary(
    rounds.map((round) => ({
      handicapDifferential: round.handicapDifferential,
      type: round.type,
    })),
  );
  const coach = buildCoachSummary(progressData.clubs);
  const topCoachCard = coach.clubCards[0] ?? null;
  const latestRound = rounds[0] ?? null;

  return (
    <PageShell contentClassName="pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5">
      <HandicapMobileOverview
        rounds={rounds}
        missingRatingRounds={missingRatingRounds}
        realHandicap={realHandicap}
        simulatorHandicap={simulatorHandicap}
        combinedHandicap={combinedHandicap}
        playingHandicap={playingHandicap}
        rangeReality={rangeReality}
        latestRound={latestRound}
        topCoachCard={topCoachCard}
      />

      <DesktopWorkbenchLayout scope="handicap" className="hidden lg:grid">
        <div className="hidden items-center justify-between gap-4 sm:flex">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard" prefetch={false}>
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/rounds" prefetch={false}>
                <Flag className="size-4" />
                Rounds
              </Link>
            </Button>
            <Button asChild>
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import scorecard
              </Link>
            </Button>
          </div>
        </div>

        <PageHeader
          eyebrow={<StatusPill tone="amber">Unofficial scoring estimates</StatusPill>}
          title="Handicap"
          description="Separate best-form differentials from a conservative playing estimate. LM World Tour uses score differentials and reduced-score-count logic, but this is not an official Handicap Index."
          visual={<PageArtwork variant="handicap" alt="" className="h-full min-h-44" />}
          actions={
            <Button
              asChild
              size="sm"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link href="/rounds" prefetch={false}>
                <Flag className="size-4" />
                Rounds
              </Link>
            </Button>
          }
          metrics={[
            {
              label: "Real best-form",
              value: formatHandicapValue(realHandicap.value),
              detail: handicapMethodDetail(realHandicap),
            },
            {
              label: "Simulator best-form",
              value: formatHandicapValue(simulatorHandicap.value),
              detail: handicapMethodDetail(simulatorHandicap),
            },
            {
              label: "Realistic playing",
              value: formatHandicapValue(playingHandicap.value),
              detail: playingHandicap.methodLabel,
            },
            {
              label: "Range reality",
              value: rangeReality.estimate.label,
              detail: `${rangeReality.estimate.expectedRangeLabel} / ${rangeReality.estimate.confidenceLabel}`,
            },
          ]}
        />

        <MobileSectionChips
          items={[
            { label: "Estimate", href: "#estimate" },
            { label: "Range", href: "#range-reality" },
            { label: "Trend", href: "#trend" },
            { label: "Tasks", href: "#tasks" },
            { label: "Rounds", href: "#rounds" },
          ]}
        />

        <MobileBentoSummary
          items={[
            {
              label: "Playing estimate",
              value: formatHandicapValue(playingHandicap.value),
              detail: playingHandicap.methodLabel,
              tone: "amber",
            },
            {
              label: "Best form",
              value: formatHandicapValue(realHandicap.value),
              detail: `${realRounds.length} real`,
              tone: "green",
            },
            {
              label: "Trend",
              value: trendSentence(combinedHandicap),
              detail: "Combined",
              tone:
                combinedHandicap.trend.direction === "down"
                  ? "green"
                  : combinedHandicap.trend.direction === "up"
                    ? "amber"
                    : "slate",
            },
            {
              label: "Range reality",
              value: rangeReality.estimate.label,
              detail: rangeReality.estimate.confidenceLabel,
              tone:
                rangeReality.estimate.confidence === "high"
                  ? "green"
                  : rangeReality.estimate.confidence === "medium"
                    ? "sky"
                    : "amber",
            },
          ]}
        />

        <HandicapConfidenceFeaturePanel data={featureData} />

        <section id="estimate" className="scroll-mt-28">
          <PlayingHandicapPanel summary={playingHandicap} />
        </section>

        <section
          aria-label="Handicap confidence panels"
          tabIndex={0}
          className="-mx-4 flex scroll-mt-28 gap-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4"
        >
          <div className="min-w-[82vw] md:min-w-0">
            <HandicapPanel
              title="Real course ceiling"
              summary={realHandicap}
              rounds={realRounds.length}
              tone="green"
            />
          </div>
          <div className="min-w-[82vw] md:min-w-0">
            <HandicapPanel
              title="Simulator ceiling"
              summary={simulatorHandicap}
              rounds={simulatorRounds.length}
              tone="sky"
            />
          </div>
          <div className="min-w-[82vw] md:min-w-0">
            <RangeRealityPanel reality={rangeReality} />
          </div>
          <div className="min-w-[82vw] md:min-w-0">
            <HandicapPanel
              title="Combined ceiling"
              summary={combinedHandicap}
              rounds={rounds.length}
              tone="amber"
            />
          </div>
        </section>

        <section id="range-reality" className="scroll-mt-28">
          <RangeRealityDetailPanel reality={rangeReality} />
        </section>

        <section id="trend" className="grid scroll-mt-28 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <MobileAccordionSection
            title="Readout"
            description="Current scorecard signals."
            count="4 signals"
          >
            <CompactReadoutGrid
              items={[
                {
                  label: "Trend",
                  value: trendSentence(combinedHandicap),
                  detail:
                    "Lower is better. Trend compares current estimate with the prior estimate.",
                  tone:
                    combinedHandicap.trend.direction === "down"
                      ? "green"
                      : combinedHandicap.trend.direction === "up"
                        ? "amber"
                        : "slate",
                },
                {
                  label: "Data quality",
                  value: `${missingRatingRounds.length} round${missingRatingRounds.length === 1 ? "" : "s"} need rating/slope`,
                  detail: "Real-course estimates are stronger with rating and slope.",
                  tone: missingRatingRounds.length > 0 ? "amber" : "green",
                },
                {
                  label: "Latest round",
                  value: latestRound
                    ? `${latestRound.totalScore ?? "--"} at ${latestRound.courseName ?? latestRound.fileName ?? "latest round"}`
                    : "No scorecards yet",
                  detail: latestRound
                    ? `${formatDate(latestRound.date)} / differential ${formatHandicapValue(latestRound.handicapDifferential)}`
                    : "Import or create a scorecard to start.",
                  tone: "sky",
                },
                {
                  label: "Range priority",
                  value: topCoachCard
                    ? `${topCoachCard.clubName}: ${topCoachCard.issueLabel}`
                    : "No club priority yet",
                  detail: topCoachCard
                    ? topCoachCard.drill
                    : "Import more launch monitor sessions.",
                  tone: topCoachCard ? topCoachCard.tone : "slate",
                  href: topCoachCard ? `/bag/${topCoachCard.clubId}/analytics` : "/coach",
                },
              ]}
            />
          </MobileAccordionSection>

          <MobileAccordionSection
            title="Trend chart"
            description="Running best-form estimate."
            count={`${rounds.length} rounds`}
          >
            <HandicapTrendChart rounds={[...rounds].reverse()} />
          </MobileAccordionSection>

          <DataPanel className="hidden sm:flex">
            <SectionHeader
              title="Readout"
              description="What the current scorecards are saying."
              action={<Info className="size-5 text-sky-500" />}
            />
            <CardContent>
              <CompactReadoutGrid
                columnsClassName="md:grid-cols-2"
                items={[
                  {
                    label: "Trend",
                    value: trendSentence(combinedHandicap),
                    detail:
                      "Lower is better. Trend compares the current estimate with the estimate before the newest eligible round.",
                    tone:
                      combinedHandicap.trend.direction === "down"
                        ? "green"
                        : combinedHandicap.trend.direction === "up"
                          ? "amber"
                          : "slate",
                  },
                  {
                    label: "Data quality",
                    value: `${missingRatingRounds.length} round${missingRatingRounds.length === 1 ? "" : "s"} need rating/slope`,
                    detail:
                      "Simulator rounds can fall back to par and 113 slope; real-course estimates are stronger with rating and slope.",
                    tone: missingRatingRounds.length > 0 ? "amber" : "green",
                  },
                  {
                    label: "Latest round",
                    value: latestRound
                      ? `${latestRound.totalScore ?? "--"} at ${latestRound.courseName ?? latestRound.fileName ?? "latest round"}`
                      : "No scorecards yet",
                    detail: latestRound
                      ? `${formatDate(latestRound.date)} / differential ${formatHandicapValue(latestRound.handicapDifferential)}`
                      : "Import or create a scorecard to start.",
                    tone: "sky",
                  },
                  {
                    label: "Range priority",
                    value: topCoachCard
                      ? `${topCoachCard.clubName}: ${topCoachCard.issueLabel}`
                      : "No club priority yet",
                    detail: topCoachCard
                      ? topCoachCard.drill
                      : "Import more launch monitor sessions to separate range performance from scorecards.",
                    tone: topCoachCard ? topCoachCard.tone : "slate",
                    href: topCoachCard ? `/bag/${topCoachCard.clubId}/analytics` : "/coach",
                  },
                ]}
              />
            </CardContent>
          </DataPanel>

          <DataPanel className="hidden sm:flex">
            <SectionHeader
              title="Trend chart"
              description="Running best-form estimate after each eligible round, oldest to newest."
              action={<Trophy className="size-5 text-amber-500" />}
            />
            <CardContent>
              <HandicapTrendChart rounds={[...rounds].reverse()} />
            </CardContent>
          </DataPanel>
        </section>

        {missingRatingRounds.length > 0 ? (
          <DataPanel id="tasks" className="scroll-mt-28 border-amber-200 bg-amber-50/70">
            <SectionHeader
              title="Data to improve"
              description="These rounds are included using fallback assumptions where needed."
              action={<AlertTriangle className="size-5 text-amber-700" />}
            />
            <CardContent className="grid gap-2 md:grid-cols-2">
              {missingRatingRounds.slice(0, 6).map((round) => (
                <Link
                  key={round.id}
                  href={`/rounds/${round.id}`}
                  prefetch={false}
                  className="rounded-xl border border-amber-200 bg-white/80 p-4 hover:border-amber-400"
                >
                  <p className="font-semibold">
                    {round.courseName ?? round.fileName ?? "Untitled round"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Missing {round.courseRating === null ? "course rating" : ""}
                    {round.courseRating === null && round.slopeRating === null ? " and " : ""}
                    {round.slopeRating === null ? "slope rating" : ""}.
                  </p>
                </Link>
              ))}
            </CardContent>
          </DataPanel>
        ) : null}

        <MobileAccordionSection
          title="Score differential table"
          description="Newest scorecards and 18-hole equivalent inputs."
          count={`${rounds.length} rounds`}
        >
          <MobileDataList>
            {rounds.length > 0 ? (
              rounds.map((round) => (
                <MobileDataCard
                  key={round.id}
                  href={`/rounds/${round.id}`}
                  title={round.courseName ?? round.fileName ?? "Untitled round"}
                  subtitle={formatDate(round.date)}
                  action={
                    <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                      {formatSessionType(round.type)}
                    </Badge>
                  }
                >
                  <DataPair label="Score" value={round.totalScore ?? "--"} />
                  <DataPair label="Rating" value={formatOptionalNumber(round.courseRating)} />
                  <DataPair label="Slope" value={round.slopeRating ?? "--"} />
                  <DataPair
                    label="Differential"
                    value={formatHandicapValue(round.handicapDifferential)}
                  />
                  <DataPair
                    label="Eligibility"
                    value={`${round.eligibility.label} · ${round.eligibility.reason}`}
                  />
                  <DataPair label="Holes" value={formatHolesPlayed(round)} />
                </MobileDataCard>
              ))
            ) : (
              <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                No scorecards yet. Import a simulated course or add a real round.
              </div>
            )}
          </MobileDataList>
        </MobileAccordionSection>

        <DataPanel id="rounds" className="hidden scroll-mt-28 sm:flex">
          <SectionHeader
            title="Score differential table"
            description="Best-form estimates use score differentials; 9-hole rounds are shown as 18-hole equivalents."
          />
          <CardContent className="grid gap-3">
            <div data-workbench-scope="handicap-rounds" className="grid gap-3">
              <DesktopTableWorkbenchControls
                viewKey="handicap-rounds"
                scope="handicap-rounds"
                currentViewLabel="Score differential evidence"
                resultLabel={`${rounds.length} rounds`}
                columns={handicapRoundColumns}
                suggestedViews={handicapSuggestedViews}
                exportTableId="handicap-rounds"
                exportFileName="forekinghell-handicap-score-differentials.csv"
              />
              <DataTableFrame mainTable mainTableLabel="Score differential table" stickyFirstColumn>
                <Table
                  className="min-w-[1180px]"
                  data-workbench-export-table="handicap-rounds"
                  aria-describedby="handicap-rounds-summary"
                >
                  <TableCaption id="handicap-rounds-summary">
                    Score differential rows used for the unofficial handicap confidence view.
                  </TableCaption>
                  <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <TableRow>
                      <TableHead
                        data-column="round"
                        className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        Round
                      </TableHead>
                      <TableHead data-column="date">Date</TableHead>
                      <TableHead data-column="type">Type</TableHead>
                      <TableHead data-column="score" className="text-right">
                        Score
                      </TableHead>
                      <TableHead data-column="rating" className="text-right">
                        Rating
                      </TableHead>
                      <TableHead data-column="slope" className="text-right">
                        Slope
                      </TableHead>
                      <TableHead data-column="differential" className="text-right">
                        Diff
                      </TableHead>
                      <TableHead data-column="eligibility">Eligibility</TableHead>
                      <TableHead data-column="holes" className="text-right">
                        Holes
                      </TableHead>
                      <TableHead data-column="shots" className="text-right">
                        Shots
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds.map((round) => (
                      <TableRow key={round.id} tabIndex={0} className="focus-aaa outline-none">
                        <TableCell
                          data-column="round"
                          className="sticky left-0 z-10 max-w-64 truncate bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          <Link
                            href={`/rounds/${round.id}`}
                            prefetch={false}
                            className="hover:underline"
                          >
                            {round.courseName ?? round.fileName ?? "Untitled round"}
                          </Link>
                        </TableCell>
                        <TableCell data-column="date">{formatDate(round.date)}</TableCell>
                        <TableCell data-column="type">
                          <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                            {formatSessionType(round.type)}
                          </Badge>
                        </TableCell>
                        <TableCell data-column="score" className="text-right">
                          {round.totalScore ?? "--"}
                        </TableCell>
                        <TableCell data-column="rating" className="text-right">
                          {formatOptionalNumber(round.courseRating)}
                        </TableCell>
                        <TableCell data-column="slope" className="text-right">
                          {round.slopeRating ?? "--"}
                        </TableCell>
                        <TableCell data-column="differential" className="text-right font-semibold">
                          {formatHandicapValue(round.handicapDifferential)}
                        </TableCell>
                        <TableCell data-column="eligibility" className="max-w-72 whitespace-normal">
                          <span className="font-medium">{round.eligibility.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {round.eligibility.reason}
                          </span>
                        </TableCell>
                        <TableCell data-column="holes" className="text-right">
                          {formatHolesPlayed(round)}
                        </TableCell>
                        <TableCell data-column="shots" className="text-right">
                          {integerFormatter.format(round.shotCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                          No scorecards yet. Import a simulated course or add a real round.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </div>
          </CardContent>
        </DataPanel>
        <StickyMobileAction>
          <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import scorecard
            </Link>
          </Button>
        </StickyMobileAction>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type HandicapRound = Awaited<ReturnType<typeof getHandicapRounds>>[number];
type HandicapCoachCard = ReturnType<typeof buildCoachSummary>["clubCards"][number];

function HandicapMobileOverview({
  rounds,
  missingRatingRounds,
  realHandicap,
  simulatorHandicap,
  combinedHandicap,
  playingHandicap,
  rangeReality,
  latestRound,
  topCoachCard,
}: {
  rounds: HandicapRound[];
  missingRatingRounds: HandicapRound[];
  realHandicap: HandicapSummary;
  simulatorHandicap: HandicapSummary;
  combinedHandicap: HandicapSummary;
  playingHandicap: PlayingHandicapSummary;
  rangeReality: RangeRealityHandicapData;
  latestRound: HandicapRound | null;
  topCoachCard: HandicapCoachCard | null;
}) {
  const topCost = rangeReality.costlyShots[0] ?? null;
  const topPractice = rangeReality.prescriptions[0] ?? null;
  const firstMissingRating = missingRatingRounds[0] ?? null;
  const estimateAvailable = playingHandicap.value !== null;

  return (
    <MobileAppShell className="gap-4" data-handicap-mobile-overview>
      <MobileRouteHeader title="Handicap" group="play" activeKey="handicap" />

      <section className="grid gap-3" aria-labelledby="handicap-current-mobile">
        <IOSSectionHeader
          title={<span id="handicap-current-mobile">Current playing level</span>}
          description="A conservative playing estimate first; best-form ceilings remain supporting evidence."
        />
        <IOSGroupedList label="Current handicap summary">
          <IOSListRow
            label="Playing estimate"
            value={formatHandicapValue(playingHandicap.value)}
            detail={playingHandicap.warning}
            icon={Flag}
            status={
              <IOSInlineStatus
                label={estimateAvailable ? playingHandicap.methodLabel : "More scorecards needed"}
                tone={estimateAvailable ? "info" : "attention"}
              />
            }
          />
          <IOSMetricRow
            label="Movement"
            value={trendSentence(combinedHandicap)}
            detail={`${combinedHandicap.sampleSize} eligible round${
              combinedHandicap.sampleSize === 1 ? "" : "s"
            } across real and simulator play`}
          />
          {latestRound ? (
            <IOSListRow
              label={latestRound.courseName ?? latestRound.fileName ?? "Latest round"}
              value={latestRound.totalScore ?? "--"}
              detail={`${formatDate(latestRound.date)} · differential ${formatHandicapValue(
                latestRound.handicapDifferential,
              )}`}
              href={`/rounds/${latestRound.id}`}
              icon={Trophy}
              status={
                <IOSInlineStatus
                  label={latestRound.eligibility.label}
                  tone={latestRound.eligibility.eligible ? "positive" : "attention"}
                />
              }
            />
          ) : (
            <IOSListRow
              label="No eligible rounds yet"
              detail="Add a complete scorecard to establish a playing estimate."
              href="/rounds/new"
              icon={Flag}
            />
          )}
          {firstMissingRating ? (
            <IOSListRow
              label="Rating or slope needed"
              value={`${missingRatingRounds.length}`}
              detail={`${firstMissingRating.courseName ?? firstMissingRating.fileName ?? "A saved round"} uses fallback assumptions.`}
              href={`/rounds/${firstMissingRating.id}`}
              icon={AlertTriangle}
              status={<IOSInlineStatus label="Improve data confidence" tone="attention" />}
            />
          ) : null}
        </IOSGroupedList>
        <Button asChild className="min-h-12 w-full rounded-xl" data-primary-action>
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" />
            Import scorecard
          </Link>
        </Button>
      </section>

      <section className="grid gap-3" aria-labelledby="handicap-signal-mobile">
        <IOSSectionHeader
          title={<span id="handicap-signal-mobile">Supporting signals</span>}
          description="Ceilings and range evidence help explain the estimate without competing with it."
        />
        <IOSGroupedList label="Handicap supporting signals">
          <IOSMetricRow
            label="Real-course best form"
            value={formatHandicapValue(realHandicap.value)}
            detail={handicapMethodDetail(realHandicap)}
          />
          <IOSMetricRow
            label="Simulator best form"
            value={formatHandicapValue(simulatorHandicap.value)}
            detail={handicapMethodDetail(simulatorHandicap)}
          />
          <IOSListRow
            label="Range reality"
            value={rangeReality.estimate.label}
            detail={`${rangeReality.estimate.expectedRangeLabel} expected · ${rangeReality.estimate.confidenceLabel}`}
            href="/simulator-lab#range-reality"
            icon={Radar}
            status={
              <IOSInlineStatus
                label={rangeReality.estimate.trend.label}
                tone={rangeRealityMobileTone(rangeReality.estimate.confidence)}
              />
            }
          />
          <IOSListRow
            label="Next useful practice"
            value={topCoachCard?.clubName ?? "Build signal"}
            detail={
              topCoachCard?.drill ??
              topPractice?.detail ??
              "Import another measured session to create a stronger recommendation."
            }
            href={topCoachCard ? `/bag/${topCoachCard.clubId}/analytics` : "/coach"}
            icon={ChartNoAxesCombined}
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-3" aria-labelledby="handicap-depth-mobile">
        <IOSSectionHeader
          title={<span id="handicap-depth-mobile">Evidence</span>}
          description="Trend, calculations and historical scorecards are available on demand."
        />
        <IOSDisclosureGroup
          label="Handicap evidence"
          items={[
            {
              value: "method",
              title: "How this estimate works",
              summary: `${playingHandicap.usedDifferentialCount}/${playingHandicap.sampleSize} rounds`,
              description: playingHandicap.methodLabel,
              content: (
                <IOSGroupedList label="Handicap calculation detail" className="bg-card">
                  <IOSMetricRow
                    label="Real evidence"
                    value={integerFormatter.format(playingHandicap.realDifferentialCount)}
                    detail="Real-course score differentials"
                  />
                  <IOSMetricRow
                    label="Simulator evidence"
                    value={integerFormatter.format(playingHandicap.simulatorDifferentialCount)}
                    detail={`Adjusted by ${formatHandicapDelta(
                      playingHandicap.simulatorAdjustment,
                    )} before blending`}
                  />
                  <IOSListRow
                    label="Interpretation"
                    detail="Judge the movement and confidence, not only the lowest best-form number. This is not an official Handicap Index."
                    icon={Calculator}
                  />
                </IOSGroupedList>
              ),
            },
            {
              value: "trend",
              title: "Trend chart",
              summary: `${rounds.length} rounds`,
              description: "Running best-form estimate, oldest to newest",
              content: <HandicapTrendChart rounds={[...rounds].reverse()} />,
              contentClassName: "px-3",
            },
            {
              value: "range",
              title: "Range evidence",
              summary: rangeReality.estimate.confidenceLabel,
              description: rangeReality.estimate.disclaimer,
              content: (
                <div className="grid gap-4">
                  <IOSGroupedList label="Range handicap evidence" className="bg-card">
                    <IOSMetricRow
                      label="Usable sample"
                      value={`${integerFormatter.format(rangeReality.estimate.usableShotCount)} shots`}
                      detail={`${rangeReality.estimate.clubCount} clubs · ${rangeReality.estimate.sessionCount} sessions`}
                    />
                    <IOSListRow
                      label="Costliest miss"
                      value={topCost?.clubLabel ?? "Building"}
                      detail={topCost?.reason ?? "More carry and side data is needed."}
                    />
                    <IOSListRow
                      label="Recommended practice"
                      value={topPractice?.title ?? "Build signal"}
                      detail={
                        topPractice?.detail ?? "Import another range session for a prescription."
                      }
                      href="/practice"
                    />
                  </IOSGroupedList>
                  {rangeReality.estimate.caveats.length > 0 ? (
                    <ul className="grid gap-2 text-[13px] leading-5 text-muted-foreground">
                      {rangeReality.estimate.caveats.slice(0, 3).map((caveat) => (
                        <li key={caveat} className="flex gap-2">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                          <span>{caveat}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ),
            },
            {
              value: "rounds",
              title: "Score differentials",
              summary: `${rounds.length} rounds`,
              description: "Eligibility, scores and 18-hole equivalent inputs",
              content: (
                <IOSGroupedList label="Score differential history" className="bg-card">
                  {rounds.length > 0 ? (
                    rounds.map((round) => (
                      <IOSListRow
                        key={round.id}
                        label={round.courseName ?? round.fileName ?? "Untitled round"}
                        value={formatHandicapValue(round.handicapDifferential)}
                        detail={`${formatDate(round.date)} · score ${round.totalScore ?? "--"} · ${formatSessionType(round.type)}`}
                        href={`/rounds/${round.id}`}
                        status={
                          <IOSInlineStatus
                            label={`${round.eligibility.label} · ${formatHolesPlayed(round)}`}
                            tone={round.eligibility.eligible ? "positive" : "attention"}
                          />
                        }
                      />
                    ))
                  ) : (
                    <IOSListRow
                      label="No scorecards yet"
                      detail="Import a simulator scorecard or add a real round."
                      href="/import"
                      icon={Upload}
                    />
                  )}
                </IOSGroupedList>
              ),
            },
            ...(missingRatingRounds.length > 0
              ? [
                  {
                    value: "quality",
                    title: "Data confidence tasks",
                    summary: `${missingRatingRounds.length} rounds`,
                    description: "Rating and slope fields that still need attention",
                    content: (
                      <IOSGroupedList label="Handicap data confidence tasks" className="bg-card">
                        {missingRatingRounds.map((round) => (
                          <IOSListRow
                            key={round.id}
                            label={round.courseName ?? round.fileName ?? "Untitled round"}
                            detail={`Missing ${round.courseRating === null ? "course rating" : ""}${
                              round.courseRating === null && round.slopeRating === null
                                ? " and "
                                : ""
                            }${round.slopeRating === null ? "slope rating" : ""}.`}
                            href={`/rounds/${round.id}`}
                            icon={Database}
                            status={<IOSInlineStatus label="Fallback in use" tone="attention" />}
                          />
                        ))}
                      </IOSGroupedList>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>
    </MobileAppShell>
  );
}

function rangeRealityMobileTone(
  confidence: RangeRealityHandicapData["estimate"]["confidence"],
): "positive" | "info" | "attention" | "neutral" {
  if (confidence === "high") return "positive";
  if (confidence === "medium") return "info";
  if (confidence === "low") return "attention";
  return "neutral";
}

async function getHandicapRounds() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [sessionRows, shotCounts] = await Promise.all([
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
        scorecardJson: sessions.scorecardJson,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes])))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        sessionId: shots.sessionId,
        count: count(),
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.sessionId),
  ]);
  const shotCountBySessionId = new Map(shotCounts.map((row) => [row.sessionId, row.count]));

  return sessionRows.filter(isRoundHistorySession).map((session) => {
    const scorecard = session.scorecardJson ?? [];
    const rawTotalScore = sumComplete(scorecard.map((hole) => hole.score ?? null));
    const rawTotalPutts = sumComplete(scorecard.map((hole) => hole.putts ?? null));
    const rawTotalPar =
      scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
    const handicapInput = normaliseHandicapRoundInput({
      totalScore: rawTotalScore,
      totalPar: rawTotalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
      holesPlayed: scorecard.length,
    });
    const handicapDifferential = calculateRoundDifferential(handicapInput);
    const eligibility = handicapRoundEligibility({
      type: session.type,
      scorecard,
      handicapDifferential,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
    });

    return {
      ...session,
      courseRating: handicapInput.courseRating,
      totalScore: handicapInput.totalScore,
      totalPutts: handicapInput.isNineHoleEquivalent
        ? doubleNullable(rawTotalPutts)
        : rawTotalPutts,
      totalPar: handicapInput.totalPar ?? null,
      handicapDifferential,
      eligibility,
      holesPlayed: handicapInput.holesPlayed ?? null,
      originalHolesPlayed: handicapInput.originalHolesPlayed,
      isNineHoleEquivalent: handicapInput.isNineHoleEquivalent,
      shotCount: shotCountBySessionId.get(session.id) ?? 0,
    };
  });
}

function HandicapPanel({
  title,
  summary,
  rounds,
  tone,
}: {
  title: string;
  summary: HandicapSummary;
  rounds: number;
  tone: "green" | "sky" | "amber";
}) {
  return (
    <DataPanel>
      <SectionHeader title={title} action={<StatusPill tone={tone}>{rounds} rounds</StatusPill>} />
      <CardContent className="py-4 sm:py-6">
        <p className="text-4xl font-semibold tracking-normal sm:text-6xl">
          {formatHandicapValue(summary.value)}
        </p>
        <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
          <MiniMetric label="Method" value={summary.methodLabel} />
          <MiniMetric
            label="Used scores"
            value={`${summary.usedDifferentialCount}/${summary.sampleSize}`}
          />
          <MiniMetric label="Trend" value={trendSentence(summary)} />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function PlayingHandicapPanel({ summary }: { summary: PlayingHandicapSummary }) {
  return (
    <DataPanel className="border-amber-200 bg-amber-50/70">
      <SectionHeader
        title="Realistic playing handicap"
        description={summary.warning}
        action={<StatusPill tone="amber">Data-limited</StatusPill>}
      />
      <CardContent className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="apple-panel-strong p-3 sm:p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Playing estimate
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-normal sm:mt-2 sm:text-6xl">
            {formatHandicapValue(summary.value)}
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground sm:leading-6">
            Uses recent adjusted scoring, not lowest-score WHS selection.
          </p>
        </div>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-3"
          items={[
            {
              label: "Method",
              value: summary.methodLabel,
              detail: `${summary.usedDifferentialCount} of ${summary.sampleSize} eligible rounds used.`,
              tone: summary.value === null ? "amber" : "green",
            },
            {
              label: "Blend",
              value: `${summary.realDifferentialCount} real / ${summary.simulatorDifferentialCount} sim`,
              detail: `Simulator rounds carry a ${formatHandicapDelta(summary.simulatorAdjustment)} differential adjustment.`,
              tone: summary.realDifferentialCount > 0 ? "sky" : "amber",
            },
            {
              label: "Mindset",
              value: "Judge the trend",
              detail: "A best-form ceiling can be low; this estimate is the fairer playing target.",
              tone: "slate",
            },
          ]}
        />
      </CardContent>
    </DataPanel>
  );
}

function RangeRealityPanel({ reality }: { reality: RangeRealityHandicapData }) {
  const estimate = reality.estimate;

  return (
    <DataPanel id="range-reality-card">
      <SectionHeader
        title="Range reality"
        action={
          <StatusPill tone={rangeRealityTone(estimate.confidence)}>
            {estimate.confidenceLabel}
          </StatusPill>
        }
      />
      <CardContent>
        <p className="text-6xl font-semibold tracking-normal">{estimate.label}</p>
        <div className="mt-4 grid gap-3">
          <MiniMetric label="Index type" value="Range session estimate" />
          <MiniMetric label="Expected range" value={estimate.expectedRangeLabel} />
          <MiniMetric
            label="Usable shots"
            value={integerFormatter.format(estimate.usableShotCount)}
          />
          <MiniMetric label="Clubs" value={integerFormatter.format(estimate.clubCount)} />
          <MiniMetric label="Recent trend" value={estimate.trend.label} />
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/simulator-lab#range-reality" prefetch={false}>
              <Radar className="size-4" />
              Open lab
            </Link>
          </Button>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function RangeRealityDetailPanel({ reality }: { reality: RangeRealityHandicapData }) {
  const estimate = reality.estimate;
  const topCost = reality.costlyShots[0] ?? null;
  const topPractice = reality.prescriptions[0] ?? null;

  return (
    <DataPanel className="border-emerald-200 bg-emerald-50/50">
      <SectionHeader
        title="Range reality handicap"
        description={estimate.disclaimer}
        action={
          <StatusPill tone={rangeRealityTone(estimate.confidence)}>
            {estimate.confidenceLabel}
          </StatusPill>
        }
      />
      <CardContent className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="apple-panel-strong p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Range estimate
          </p>
          <p className="mt-2 text-6xl font-semibold tracking-normal">
            {estimate.label}
            {estimate.value !== null ? (
              <span className="ml-2 align-baseline text-xl font-semibold text-muted-foreground">
                Handicap
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-sm leading-6">
            Expected range <span className="font-semibold">{estimate.expectedRangeLabel}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{estimate.methodLabel}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link href="/simulator-lab#range-reality" prefetch={false}>
                <Radar className="size-4" />
                Open Performance Lab
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/import?source=csv#csv-import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          <CompactReadoutGrid
            columnsClassName="md:grid-cols-3"
            items={[
              {
                label: "Sample",
                value: `${estimate.usableShotCount} shots`,
                detail: `${estimate.clubCount} clubs / ${estimate.sessionCount} sessions`,
                tone: estimate.usableShotCount >= 45 ? "green" : "amber",
              },
              {
                label: "Costliest miss",
                value: topCost?.clubLabel ?? "Building",
                detail: topCost?.reason ?? "Needs more range shots with carry and side data.",
                tone: topCost ? topCost.tone : "slate",
              },
              {
                label: "Next practice",
                value: topPractice?.title ?? "Build signal",
                detail:
                  topPractice?.detail ?? "Import another range session to create a prescription.",
                tone: topPractice?.tone ?? "slate",
              },
              {
                label: "Recent trend",
                value: estimate.trend.label,
                detail: estimate.trend.detail,
                tone: rangeRealityTrendTone(estimate.trend.direction),
              },
            ]}
          />
          {estimate.caveats.length > 0 ? (
            <div className="grid gap-2 text-sm leading-6 text-amber-950/80">
              {estimate.caveats.slice(0, 3).map((caveat) => (
                <p
                  key={caveat}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  {caveat}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function HandicapTrendChart({ rounds }: { rounds: Awaited<ReturnType<typeof getHandicapRounds>> }) {
  const points = rounds
    .map((round, index) => {
      const summary = calculateHandicapSummary(
        rounds
          .slice(0, index + 1)
          .map((item) => item.handicapDifferential)
          .reverse(),
      );
      return summary.value === null ? null : { round, value: summary.value };
    })
    .filter((point): point is { round: (typeof rounds)[number]; value: number } => Boolean(point));

  if (points.length === 0) {
    return (
      <div className="space-y-3">
        <div className="apple-panel grid h-72 place-items-center text-sm text-muted-foreground">
          No eligible score differentials yet.
        </div>
        <ChartAccessibleFallback
          title="Handicap trend"
          summary="No eligible score differentials are available yet, so the unofficial handicap trend chart cannot be calculated."
          columns={[
            { key: "round", label: "Round" },
            { key: "source", label: "Source" },
            { key: "differential", label: "Differential" },
            { key: "estimate", label: "Running estimate" },
          ]}
          rows={[]}
          className="bg-white/70"
        />
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values) - 2;
  const maxValue = Math.max(...values) + 2;
  const xFor = (index: number) => 48 + (index / Math.max(1, points.length - 1)) * 784;
  const yFor = (value: number) =>
    252 - ((value - minValue) / Math.max(1, maxValue - minValue)) * 204;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.value)}`)
    .join(" ");

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 880 300"
        role="img"
        aria-label="Handicap trend chart"
        className="h-72 w-full rounded-2xl border bg-[#0f172a]"
      >
        {[0, 1, 2, 3].map((index) => {
          const value = minValue + ((maxValue - minValue) / 3) * index;
          const y = yFor(value);

          return (
            <g key={index}>
              <line x1="44" x2="836" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.1" />
              <text x="18" y={y + 4} fill="#cbd5e1" fontSize="12">
                {numberFormatter.format(value)}
              </text>
            </g>
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <g key={point.round.id}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.value)}
              r="6"
              fill="#dcfce7"
              stroke="#22c55e"
              strokeWidth="3"
            />
            <text x={xFor(index)} y="282" fill="#94a3b8" fontSize="11" textAnchor="middle">
              {formatShortDate(point.round.date)}
            </text>
          </g>
        ))}
        <text x="44" y="28" fill="#e5e7eb" fontSize="13">
          Best-form estimate
        </text>
      </svg>
      <ChartAccessibleFallback
        title="Handicap trend"
        summary={handicapTrendChartSummary(points)}
        columns={[
          { key: "round", label: "Round" },
          { key: "source", label: "Source" },
          { key: "differential", label: "Differential" },
          { key: "estimate", label: "Running estimate" },
        ]}
        rows={handicapTrendChartRows(points)}
        className="bg-white/70"
      />
    </div>
  );
}

function handicapTrendChartSummary(
  points: Array<{ round: Awaited<ReturnType<typeof getHandicapRounds>>[number]; value: number }>,
) {
  const latest = points.at(-1);
  const first = points[0];

  if (!latest || !first) {
    return "No eligible score differentials are available yet, so the unofficial handicap trend chart cannot be calculated.";
  }

  return `${integerFormatter.format(points.length)} eligible rounds are shown. The running best-form estimate moved from ${formatHandicapValue(first.value)} to ${formatHandicapValue(latest.value)}; lower values indicate improvement.`;
}

function handicapTrendChartRows(
  points: Array<{ round: Awaited<ReturnType<typeof getHandicapRounds>>[number]; value: number }>,
): ChartFallbackRow[] {
  return points.map((point) => ({
    _key: point.round.id,
    round: `${formatDate(point.round.date)} / ${point.round.courseName ?? point.round.fileName ?? "Round"}`,
    source: point.round.type === "real_round" ? "Real course" : "Simulator",
    differential: formatHandicapValue(point.round.handicapDifferential),
    estimate: formatHandicapValue(point.value),
  }));
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel-strong p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function trendSentence(summary: HandicapSummary) {
  if (summary.sampleSize === 0) {
    return "No eligible rounds";
  }

  if (summary.trend.direction === "none") {
    return `${summary.sampleSize} round sample`;
  }

  if (summary.trend.direction === "flat") {
    return "Flat trend";
  }

  return `${summary.trend.direction === "down" ? "Improving" : "Drifting up"} ${formatHandicapDelta(summary.trend.delta)}`;
}

function sumComplete(values: Array<number | null>) {
  return values.length > 0 && values.every((value): value is number => typeof value === "number")
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function handicapRoundEligibility({
  type,
  scorecard,
  handicapDifferential,
  courseRating,
  slopeRating,
}: {
  type: string;
  scorecard: Array<{ score?: number | null }>;
  handicapDifferential: number | null;
  courseRating: number | null;
  slopeRating: number | null;
}) {
  if (scorecard.length !== 9 && scorecard.length !== 18) {
    return {
      eligible: false,
      label: "Excluded",
      reason: `Needs 9 or 18 holes; ${scorecard.length} saved.`,
    };
  }

  const missingScores = scorecard.filter((hole) => typeof hole.score !== "number").length;
  if (missingScores > 0) {
    return {
      eligible: false,
      label: "Excluded",
      reason: `${missingScores} hole score${missingScores === 1 ? " is" : "s are"} missing.`,
    };
  }

  if (handicapDifferential === null) {
    return {
      eligible: false,
      label: "Excluded",
      reason: "Scoring or par data is incomplete.",
    };
  }

  if (courseRating === null || slopeRating === null) {
    return {
      eligible: true,
      label: "Eligible with defaults",
      reason:
        type === "real_round"
          ? "Rating or slope is missing; the estimate falls back to par and slope 113."
          : "Simulator estimate uses par and slope 113 where rating data is missing.",
    };
  }

  return {
    eligible: true,
    label: "Eligible",
    reason: "Complete scorecard with course rating and slope.",
  };
}

function doubleNullable(value: number | null) {
  return typeof value === "number" ? value * 2 : null;
}

function formatHolesPlayed(round: { holesPlayed: number | null; isNineHoleEquivalent: boolean }) {
  if (round.isNineHoleEquivalent) {
    return "18 eq";
  }

  return typeof round.holesPlayed === "number" ? integerFormatter.format(round.holesPlayed) : "--";
}

function handicapMethodDetail(summary: HandicapSummary) {
  return summary.sampleSize === 0
    ? "No eligible scorecards"
    : `${summary.usedDifferentialCount} of ${summary.sampleSize} differentials used`;
}

function rangeRealityTone(confidence: RangeRealityHandicapData["estimate"]["confidence"]) {
  if (confidence === "high") return "green";
  if (confidence === "medium") return "sky";
  if (confidence === "low") return "amber";
  return "slate";
}

function rangeRealityTrendTone(
  direction: RangeRealityHandicapData["estimate"]["trend"]["direction"],
) {
  if (direction === "improving") return "green";
  if (direction === "worse") return "pink";
  if (direction === "flat") return "sky";
  return "slate";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatOptionalNumber(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "--";
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
