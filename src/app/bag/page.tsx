import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bot,
  Brain,
  Database,
  Gauge,
  Grid3X3,
  Layers3,
  MapPinned,
  Minus,
  Radar,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { BagFeaturePanel } from "@/components/features/feature-panels";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { MobileSummaryHero } from "@/components/visuals/mobile-summary-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
  MobileBentoSummary,
  MobileCompanionAccordion,
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
  MobileAppShell,
  MobileRouteTabs,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
  PBCard,
  ProgressCard,
} from "@/components/mobile-sports";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, sessions, shots, strokesGainedShotEvents, userProfiles } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  buildAiCaddieCards,
  buildConfidenceHeatMaps,
  buildCourseStrategyMode,
  buildPathTrendTracking,
  buildPersonalStrokesGainedModel,
  buildShotPatternOverlaySummaries,
  buildSmartBagBuilder,
  buildWedgeMatrix,
  type AiCaddieCard,
  type ConfidenceHeatMap,
  type CourseStrategyMode,
  type PathTrendTracking,
  type PersonalStrokesGainedModel,
  type ShotPatternOverlaySummary,
  type SmartBagBuilder,
  type WedgeMatrixClub,
} from "@/lib/bag-intelligence";
import { findRelevantChallenge } from "@/lib/challenge-relevance";
import {
  buildClubBenchmarkRows,
  type ClubBenchmarkMetricKey,
  type ClubBenchmarkMetricValues,
  type ClubBenchmarkPeerComparison,
  type ClubBenchmarkPeerSummary,
  type ClubBenchmarkRow,
} from "@/lib/club-benchmarks";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  buildCourseDecisionAdvice,
  getClubDecisionLabel,
  getClubDecisionTone,
  type ClubDecisionLabel,
  type CourseDecisionAdvice,
} from "@/lib/course-decision-advice";
import { buildPersonalGappingTargets, type GappingTargetTone } from "@/lib/gapping-targets";
import {
  isManageableTopEndGap,
  isMissingYardageWindowGap,
  isScoringEndGap,
  missingYardageWindowPriority,
} from "@/lib/gapping-windows";
import {
  clubAccent,
  clubSortValue,
  formatClubType,
  isShortGameTouchClubType,
  isTrackedClubType,
} from "@/lib/club-format";
import { ensureCurrentSocialProfile, getBlockedUserIds, getFriendIds } from "@/lib/social";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import {
  SAND_WEDGE_STOCK_MIN_CARRY_YD,
  calculateStockCarryTrend,
  calculateStockYardage,
  selectStockYardageShots,
  type StockCarryTrend,
  type StockShotRole,
  type StockShotRoleSummary,
  type StockShot,
} from "@/lib/stock-yardage";
import { DistanceBenchmarkPanel } from "./distance-benchmark-panel";
import { PersonalBestCard, type PersonalBestMetric } from "./personal-best-card";
import { TargetDistanceSelector, type TargetDistanceRow } from "./target-distance-selector";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const RECENT_SHOTS_PER_CLUB = 200;
const PEER_SHOT_QUERY_LIMIT = 3000;
const PEER_MIN_STOCK_SHOTS = 3;
const PERSONAL_STROKES_GAINED_LIMIT = 200;
const PEER_PERCENTILE_METRIC_KEYS: ClubBenchmarkMetricKey[] = [
  "carryYd",
  "clubSpeedMph",
  "ballSpeedMph",
  "smashFactor",
  "maxHeightYd",
  "landAngleDeg",
];

type PageProps = {
  searchParams?: Promise<{
    pb?: string | string[];
  }>;
};

const WEDGE_ROLE_ORDER: StockShotRole[] = ["full", "pitch", "chip-touch"];

export default async function BagPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const personalBestMetric = parsePersonalBestMetric(resolvedSearchParams.pb);
  const [bag, profile, challengeData, featureData, personalStrokesGainedEvents] = await Promise.all(
    [
      getBag(),
      ensureCurrentSocialProfile(),
      getBagChallengeData(),
      getFeatureIdeasData(),
      getPersonalStrokesGainedEvents(),
    ],
  );
  const gappingRows = buildGappingRows(bag, {
    handicapBand: profile.handicapBand,
  });
  const wedgeMatrix = buildWedgeMatrix(bag);
  const smartBagBuilder = buildSmartBagBuilder({
    clubs: bag,
    gappingRows,
    wedgeMatrix,
  });
  const pathTrend = buildPathTrendTracking(bag);
  const shotPatternOverlays = buildShotPatternOverlaySummaries(bag);
  const courseStrategy = buildCourseStrategyMode({ clubs: bag, wedgeMatrix });
  const confidenceHeatMaps = buildConfidenceHeatMaps(bag);
  const personalStrokesGained = buildPersonalStrokesGainedModel(personalStrokesGainedEvents);
  const aiCaddieCards = buildAiCaddieCards({
    strategy: courseStrategy,
    smartBag: smartBagBuilder,
    heatMaps: confidenceHeatMaps,
    pathTrend,
    personalStrokesGained,
  });
  const targetDistanceRows = buildTargetDistanceRows(bag, gappingRows);
  const benchmarkRows = buildBenchmarkRows(bag);
  const peerBenchmarkSummary =
    benchmarkRows.length > 0 ? await getPeerBenchmarkSummary(benchmarkRows) : emptyPeerSummary();
  const courseAdvice = buildCourseDecisionAdvice(bag);
  const totalShots = bag.reduce((total, club) => total + club.rawShotCount, 0);
  const stockConfidenceClubs = bag.filter(shouldShowInCarryGapping);
  const bestClub =
    [...stockConfidenceClubs].sort(
      (left, right) => right.stock.confidenceScore - left.stock.confidenceScore,
    )[0] ?? null;
  const weakestGap =
    [...gappingRows]
      .filter(
        (row): row is GappingRow & { workOnYd: number } =>
          row.workOnYd !== null && row.targetPriorityYd > 0,
      )
      .sort((left, right) => right.targetPriorityYd - left.targetPriorityYd)[0] ?? null;
  const averageConfidence =
    stockConfidenceClubs.length === 0
      ? 0
      : Math.round(
          stockConfidenceClubs.reduce((total, club) => total + club.stock.confidenceScore, 0) /
            stockConfidenceClubs.length,
        );
  const maxDisplayCarry = maxVisualCarryYd(gappingRows);
  const bagDoctorFindings = buildBagDoctorFindings(gappingRows);
  const wedgeRoleClubs = bag.filter(hasWedgeRoleReadout);
  const stockFilterClubs = bag.filter((club) => club.stock.stockExclusionReasons.length > 0);

  return (
    <PageShell contentClassName="pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5">
      <MobileAppShell>
        <MobileTopBar title="Analyse" />
        <MobileRouteTabs group="analyse" activeKey="bag" />
        <MobileTabBar
          activeKey="gapping"
          className="-mt-4 text-sm"
          tabs={[
            { key: "gapping", label: "Gapping", href: "/bag" },
            { key: "clubs", label: "Clubs", href: "#clubs" },
            { key: "decisions", label: "Decisions", href: "#decisions" },
            { key: "longest", label: "Longest", href: "/bag/longest" },
          ]}
        />
        <TargetDistanceSelector rows={targetDistanceRows} initialTargetYd={150} />
        <MobileBentoSummary
          items={[
            {
              label: "Bag trust",
              value: `${averageConfidence}%`,
              detail: `${bag.length} clubs · ${totalShots} shots`,
              tone: averageConfidence >= 70 ? "green" : "amber",
            },
            {
              label: "Weak gap",
              value: weakestGap ? formatClubType(weakestGap.clubType) : "--",
              detail: weakestGap ? workOnText(weakestGap) : "Need carry samples",
              tone: weakestGap?.targetTone ?? "slate",
            },
            {
              label: "Dangerous miss",
              value: bestClub ? formatBagDangerousMiss(bestClub.stock) : "--",
              detail: bestClub ? formatClubType(bestClub.type) : "Build a trusted club",
              tone: bestClub ? "sky" : "slate",
            },
            {
              label: "Best trust",
              value: bestClub ? formatClubType(bestClub.type) : "--",
              detail: bestClub ? `${bestClub.stock.confidenceScore}% confidence` : "Need samples",
              tone: "green",
            },
          ]}
        />
        <MobileCompanionAccordion
          items={[
            {
              value: "performance",
              title: "Performance",
              description: "Personal bests, gapping ladder and doctor.",
              summary: `${gappingRows.length} clubs`,
              children: (
                <div className="grid gap-4">
                  <NativeListSection title="Personal bests">
                    <div className="grid gap-3">
                      <PersonalBestCard
                        clubs={bag}
                        initialMetric={personalBestMetric}
                        variant="inline"
                      />
                    </div>
                  </NativeListSection>
                  <NativeListSection title="Full gapping ladder">
                    <ProgressCard
                      title="Bag trust"
                      value={`${averageConfidence}%`}
                      detail={`${bag.length} active clubs · ${totalShots} tracked shots`}
                    >
                      <div className="grid gap-2">
                        {gappingRows.slice(0, 8).map((row) => {
                          const visualCarry = visualCarryYd(row);

                          return (
                            <Link
                              key={row.id}
                              href={`/bag/${row.id}`}
                              prefetch={false}
                              className="trust-indicator grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-sm"
                            >
                              <span className="font-semibold">{formatClubType(row.clubType)}</span>
                              <span className="h-2 rounded-full bg-[#E5E7EB]">
                                <span
                                  className="block h-2 rounded-full bg-[#0B7A3B]"
                                  style={{
                                    width: `${carryWidthPercent(visualCarry, maxDisplayCarry)}%`,
                                  }}
                                />
                              </span>
                              <span className="font-semibold">{formatCarryYards(visualCarry)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </ProgressCard>
                    <div className="grid grid-cols-2 gap-2">
                      <PBCard
                        title="Best club"
                        value={bestClub ? formatClubType(bestClub.type) : "--"}
                        detail="Highest trust"
                      />
                      <PBCard
                        title="Weakest gap"
                        value={weakestGap ? formatClubType(weakestGap.clubType) : "--"}
                        detail={weakestGap ? workOnText(weakestGap) : "Need samples"}
                      />
                    </div>
                  </NativeListSection>
                  <NativeListSection title="Gapping doctor">
                    <div className="grid gap-2">
                      {bagDoctorFindings.slice(0, 3).map((finding) => (
                        <Link
                          key={`${finding.title}-${finding.detail}`}
                          href={finding.href ?? "/import"}
                          prefetch={false}
                          className="premium-rail-card rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{finding.title}</p>
                              <p className="mt-1 text-xs leading-5 text-[#6B7280]">
                                {finding.detail}
                              </p>
                            </div>
                            <StatusPill tone={finding.tone}>{finding.label}</StatusPill>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </NativeListSection>
                </div>
              ),
            },
            {
              value: "lower-scores",
              title: "Lower scores",
              description: "Strategy, wedges, heat maps and caddie.",
              summary: `${smartBagBuilder.currentScore}% bag`,
              children: (
                <LowerScoresFeatureStack
                  smartBagBuilder={smartBagBuilder}
                  wedgeMatrix={wedgeMatrix}
                  pathTrend={pathTrend}
                  shotPatternOverlays={shotPatternOverlays}
                  courseStrategy={courseStrategy}
                  confidenceHeatMaps={confidenceHeatMaps}
                  aiCaddieCards={aiCaddieCards}
                  personalStrokesGained={personalStrokesGained}
                  compact
                />
              ),
            },
            {
              value: "bag-setup",
              title: "Bag setup",
              description: "Wedge roles, stock filters and club rail.",
              summary: `${bag.length} clubs`,
              children: (
                <div className="grid gap-4">
                  {wedgeRoleClubs.length > 0 ? (
                    <NativeListSection title="Wedge roles">
                      <WedgeRoleCards clubs={wedgeRoleClubs} compact />
                    </NativeListSection>
                  ) : null}
                  {stockFilterClubs.length > 0 ? (
                    <NativeListSection title="Best-stock filters">
                      <StockFilterCards clubs={stockFilterClubs} compact />
                    </NativeListSection>
                  ) : null}
                  <NativeListSection title="Club rail">
                    <div
                      aria-label="Club rail"
                      tabIndex={0}
                      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {bag.map((club, index) => (
                        <Link
                          key={club.id}
                          href={`/bag/${club.id}`}
                          prefetch={false}
                          className="premium-rail-card grid min-w-36 gap-2 rounded-lg p-3"
                        >
                          <ClubArtwork
                            clubType={club.type}
                            brand={club.brand}
                            model={club.model}
                            alt=""
                            className="h-14 rounded-lg"
                            sizes="144px"
                            priority={index === 0}
                          />
                          <span className="font-semibold">{formatClubType(club.type)}</span>
                          <span className="text-sm text-[#6B7280]">
                            {formatMetric(club.stock.bestStockCarryYd)} yd
                          </span>
                        </Link>
                      ))}
                    </div>
                  </NativeListSection>
                </div>
              ),
            },
            {
              value: "fitting",
              title: "Fitting and benchmarks",
              description: "Feature checks, target links and club identities.",
              summary: "Full analysis",
              children: <BagFeaturePanel data={featureData} compactMobile />,
            },
          ]}
        />
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/import">
            <Upload className="size-4" />
            Import CSV
          </Link>
        </Button>
      </div>

      <div className="hidden sm:contents">
        <PageHeader
          eyebrow={<StatusPill>Bag map</StatusPill>}
          title="Stock yardages"
          description="Best stock carry, latest reliable form, recommended numbers, dispersion, and trust by club."
          visual={
            <PageArtwork variant="stockYardages" alt="" className="h-full min-h-44" priority />
          }
          visualSize="wide"
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/bag/longest">
                  <Trophy className="size-4" />
                  Longest shots
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/achievements">
                  <Award className="size-4" />
                  Achievements
                </Link>
              </Button>
            </>
          }
          metrics={[
            {
              label: "Clubs",
              value: bag.length.toString(),
              detail: "Tracked active clubs",
            },
            {
              label: "Shots",
              value: totalShots.toString(),
              detail: "Saved launch monitor rows",
            },
            {
              label: "Confidence",
              value: `${averageConfidence}%`,
              detail: "Average stock confidence",
            },
            {
              label: "Data trust",
              value: featureData.dataHealth.metric,
              detail: featureData.dataHealth.status,
            },
          ]}
        />

        <MobileSectionChips
          items={[
            { label: "Gapping", href: "#gapping" },
            { label: "PBs", href: "#personal-bests" },
            { label: "Lower scores", href: "#lower-scores" },
            { label: "Wedges", href: "#wedge-roles" },
            { label: "Levels", href: "#levels" },
            { label: "Decisions", href: "#decisions" },
            { label: "Clubs", href: "#clubs" },
          ]}
        />

        <TargetDistanceSelector rows={targetDistanceRows} initialTargetYd={150} />

        <MobileSummaryHero
          eyebrow={<StatusPill tone="green">Bag readout</StatusPill>}
          title="Trust the number, then check the gap."
          description="Start with the best club, weakest ladder gap, and current confidence before opening the full table."
          metricLabel="Best club"
          metricValue={bestClub ? formatClubType(bestClub.type) : "--"}
          visual={
            <ClubArtwork
              clubType={bestClub?.type ?? "driver"}
              brand={bestClub?.brand}
              model={bestClub?.model}
              alt=""
              className="h-20 w-20 rounded-xl"
              sizes="80px"
              priority
            />
          }
          action={
            <Button
              asChild
              size="sm"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link href="#clubs">Clubs</Link>
            </Button>
          }
        />

        <MobileMetricStrip
          items={[
            {
              label: "Clubs",
              value: bag.length.toString(),
              detail: "Active",
              tone: "green",
            },
            {
              label: "Confidence",
              value: `${averageConfidence}%`,
              detail: "Average",
              tone: "sky",
            },
            {
              label: "Weakest gap",
              value: weakestGap ? formatClubType(weakestGap.clubType) : "--",
              detail: weakestGap ? workOnText(weakestGap) : "Need carry samples",
              tone: weakestGap?.targetTone ?? "amber",
            },
          ]}
        />

        <BagFeaturePanel data={featureData} />

        <section id="personal-bests" className="w-full scroll-mt-28">
          <PersonalBestCard clubs={bag} initialMetric={personalBestMetric} />
        </section>

        <section id="lower-scores" className="scroll-mt-28">
          <LowerScoresFeatureStack
            smartBagBuilder={smartBagBuilder}
            wedgeMatrix={wedgeMatrix}
            pathTrend={pathTrend}
            shotPatternOverlays={shotPatternOverlays}
            courseStrategy={courseStrategy}
            confidenceHeatMaps={confidenceHeatMaps}
            aiCaddieCards={aiCaddieCards}
            personalStrokesGained={personalStrokesGained}
          />
        </section>

        <BagConfidenceLadder
          rows={gappingRows}
          maxCarryYd={maxDisplayCarry}
          findings={bagDoctorFindings}
        />

        {wedgeRoleClubs.length > 0 ? (
          <section id="wedge-roles" className="scroll-mt-28">
            <WedgeRolePanel clubs={wedgeRoleClubs} />
          </section>
        ) : null}

        {stockFilterClubs.length > 0 ? <StockFilterPanel clubs={stockFilterClubs} /> : null}

        {gappingRows.length > 0 ? (
          <section id="gapping" className="scroll-mt-28">
            <CarryGappingTable rows={gappingRows} />
          </section>
        ) : null}

        {benchmarkRows.length > 0 ? (
          <section id="levels" className="scroll-mt-28">
            <DistanceBenchmarkPanel rows={benchmarkRows} peerSummary={peerBenchmarkSummary} />
          </section>
        ) : null}

        <section id="decisions" className="scroll-mt-28">
          <CourseDecisionPanel advice={courseAdvice} />
        </section>

        <section
          id="clubs"
          aria-label="Club detail cards"
          tabIndex={0}
          className="-mx-4 flex scroll-mt-28 gap-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3"
        >
          {bag.map((club) => (
            <Link
              key={club.id}
              href={`/bag/${club.id}`}
              className="group block min-w-[82vw] md:min-w-0"
            >
              <Card className="premium-card h-full transition-colors group-hover:border-emerald-300">
                <CardHeader className="p-4 sm:p-6">
                  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <ClubArtwork
                      clubType={club.type}
                      brand={club.brand}
                      model={club.model}
                      alt=""
                      className="h-16 w-full shrink-0 rounded-xl sm:h-20"
                      sizes="112px"
                    />
                    <div className="min-w-0 space-y-1 text-right">
                      <CardDescription className="truncate">{club.brandModel}</CardDescription>
                      <CardTitle className="text-2xl tracking-normal sm:text-3xl">
                        {formatClubType(club.type)}
                      </CardTitle>
                      <div className="flex justify-end">
                        <StatusPill tone={getClubDecisionTone(club.decisionLabel)}>
                          {club.decisionLabel}
                        </StatusPill>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 sm:space-y-5 sm:p-6 sm:pt-0">
                  <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {club.isShortGameTouch ? "Touch median" : "Recommended"}
                      </p>
                      <p className="text-4xl font-semibold tracking-normal sm:text-5xl">
                        {formatMetric(clubPrimaryCarryYd(club))}
                        <span className="ml-1 text-lg text-muted-foreground">yd</span>
                      </p>
                      {club.stockTrend ? <ShotTrendBadge trend={club.stockTrend} /> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {club.isShortGameTouch ? "Full stock" : "Best stock"}
                      </p>
                      <p className="text-2xl font-semibold tracking-normal sm:text-3xl">
                        {formatMetric(clubSecondaryCarryYd(club))}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <MiniDispersion
                      shots={club.shots}
                      accent={club.accent}
                      carryMedianYd={
                        club.isShortGameTouch
                          ? club.touch.carryMedianYd
                          : club.stock.bestStockCarryYd
                      }
                    />
                  </div>

                  <div className="hidden grid-cols-3 gap-3 text-sm sm:grid">
                    <Metric
                      label={club.isShortGameTouch ? "Touch sample" : "Sample"}
                      value={(club.isShortGameTouch
                        ? club.touch.sampleSize
                        : club.stock.sampleSize
                      ).toString()}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Full best" : "Personal best"}
                      value={formatMetric(club.stock.personalBestCarryYd)}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Upper touch" : "Latest reliable"}
                      value={formatMetric(
                        club.isShortGameTouch
                          ? club.touch.carryP75Yd
                          : club.stock.latestReliableCarryYd,
                      )}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Longest touch" : "Reliable range"}
                      value={
                        club.isShortGameTouch
                          ? formatMetric(club.touch.longestCarryYd)
                          : formatCarryRange(
                              club.stock.latestReliableCarryP25Yd,
                              club.stock.latestReliableCarryP75Yd,
                            )
                      }
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Lower touch" : "Ball mph"}
                      value={formatMetric(
                        club.isShortGameTouch
                          ? club.touch.carryP25Yd
                          : club.stock.averageBallSpeedMph,
                      )}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Under 30" : "Launch"}
                      value={
                        club.isShortGameTouch
                          ? club.touch.under30YdCount.toString()
                          : `${formatMetric(club.stock.averageLaunchAngleDeg)} deg`
                      }
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Type" : "Side"}
                      value={
                        club.isShortGameTouch
                          ? club.type === "sw"
                            ? "Touch + stock"
                            : "Touch"
                          : `${formatMetric(club.stock.dispersionLeftYd)}L / ${formatMetric(
                              club.stock.dispersionRightYd,
                            )}R`
                      }
                    />
                  </div>

                  {club.isShortGameTouch ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      Round chips and pitches are shown as touch data, not full-swing stock yardage.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{club.decisionLabel}</span>
                      <span className="text-muted-foreground">
                        {club.isShortGameTouch && club.type !== "sw"
                          ? `${club.touch.sampleSize} shots`
                          : `${club.stock.confidenceScore}%`}
                      </span>
                    </div>
                    <Progress
                      value={
                        club.isShortGameTouch && club.type !== "sw"
                          ? Math.min(100, (club.touch.sampleSize / 50) * 100)
                          : club.stock.confidenceScore
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        {bag.length === 0 ? (
          <Card className="premium-card">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Target className="size-8 text-emerald-500" />
              <div>
                <p className="text-lg font-medium">No clubs imported yet</p>
                <p className="text-sm text-muted-foreground">
                  Import Rapsodo CSVs to build the bag map.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <BagSocialComparison
          bestClub={bestClub}
          leaderboardOptedIn={profile.leaderboardVisibility !== "private"}
          challenges={challengeData.active}
        />
        <StickyMobileAction>
          <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link href="#clubs">Find club</Link>
          </Button>
        </StickyMobileAction>
      </div>
    </PageShell>
  );
}

async function getBagChallengeData(): Promise<{ active: ChallengeListItem[] }> {
  try {
    return await getChallengesPageData();
  } catch (error) {
    console.error("[bag] Challenge data unavailable", error);
    return { active: [] };
  }
}

async function getPersonalStrokesGainedEvents() {
  const db = getDb();
  const userId = await requireCurrentUserId();

  return db
    .select({
      category: strokesGainedShotEvents.category,
      startLie: strokesGainedShotEvents.startLie,
      endLie: strokesGainedShotEvents.endLie,
      startDistanceYd: strokesGainedShotEvents.startDistanceYd,
      strokesGained: strokesGainedShotEvents.strokesGained,
    })
    .from(strokesGainedShotEvents)
    .where(eq(strokesGainedShotEvents.userId, userId))
    .orderBy(desc(strokesGainedShotEvents.createdAt))
    .limit(PERSONAL_STROKES_GAINED_LIMIT);
}

async function getBag() {
  const db = getDb();
  const userId = await requireCurrentUserId();

  const clubRows = await db
    .select({
      id: clubs.id,
      userId: clubs.userId,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
    })
    .from(clubs)
    .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
    .orderBy(asc(clubs.type));

  const clubsByType = new Map<string, typeof clubRows>();

  for (const club of clubRows) {
    const existing = clubsByType.get(club.type) ?? [];
    existing.push(club);
    clubsByType.set(club.type, existing);
  }

  const mergedClubRows = [...clubsByType.values()].map((clubGroup) => {
    const primary = clubGroup.find((club) => club.brand || club.model) ?? clubGroup[0];
    const preferredBrand = clubGroup.find((club) => club.brand)?.brand ?? primary.brand;
    const preferredModel = clubGroup.find((club) => club.model)?.model ?? primary.model;

    return {
      id: primary.id,
      userId: primary.userId,
      type: primary.type,
      brand: preferredBrand,
      model: preferredModel,
      memberIds: clubGroup.map((club) => club.id),
    };
  });

  const allClubMemberIds = mergedClubRows.flatMap((club) => club.memberIds);
  const personalBestRows =
    allClubMemberIds.length > 0
      ? await db
          .select({
            clubId: shots.clubId,
            carryYd: sql<number | null>`max(${shots.carryYd})`,
            totalYd: sql<number | null>`max(${shots.totalYd})`,
          })
          .from(shots)
          .innerJoin(sessions, eq(shots.sessionId, sessions.id))
          .where(
            and(
              eq(shots.userId, userId),
              eq(sessions.userId, userId),
              inArray(shots.clubId, allClubMemberIds),
              isNotNull(shots.carryYd),
              sql`(${shots.qualityTag} is null or lower(${shots.qualityTag}) not in ('mishit', 'top', 'thin', 'fat', 'bad_data'))`,
              sql`(${shots.shotCategory} is null or lower(${shots.shotCategory}) not in ('chip', 'pitch', 'recovery', 'bunker'))`,
              sql`(lower(${shots.clubType}) not in ('sw', 'lw', 'wedge') or ${shots.carryYd} >= ${SAND_WEDGE_STOCK_MIN_CARRY_YD})`,
              sql`(lower(${shots.clubType}) not in ('pw', 'gw', 'aw') or ${shots.carryYd} > 30)`,
            ),
          )
          .groupBy(shots.clubId)
      : [];
  const personalBestByClubId = new Map<
    string,
    { carryYd: number | null; totalYd: number | null }
  >();

  for (const row of personalBestRows) {
    personalBestByClubId.set(row.clubId, {
      carryYd: row.carryYd,
      totalYd: row.totalYd,
    });
  }

  const clubData = await Promise.all(
    mergedClubRows.map(async (club) => {
      const [recentShots, [shotCount]] = await Promise.all([
        db
          .select({
            id: shots.id,
            clubId: shots.clubId,
            shotNumber: shots.shotNumber,
            shotAt: shots.shotAt,
            carryYd: shots.carryYd,
            totalYd: shots.totalYd,
            sideCarryYd: shots.sideCarryYd,
            ballSpeedMph: shots.ballSpeedMph,
            clubSpeedMph: shots.clubSpeedMph,
            launchAngleDeg: shots.launchAngleDeg,
            launchDirectionDeg: shots.launchDirectionDeg,
            apexFt: shots.apexFt,
            descentAngleDeg: shots.descentAngleDeg,
            attackAngleDeg: shots.attackAngleDeg,
            clubPathDeg: shots.clubPathDeg,
            spinRate: shots.spinRate,
            smashFactor: shots.smashFactor,
            spinAxis: shots.spinAxis,
            courseHoleNumber: shots.courseHoleNumber,
            sessionType: sessions.type,
            shotCategory: shots.shotCategory,
            qualityTag: shots.qualityTag,
          })
          .from(shots)
          .innerJoin(sessions, eq(shots.sessionId, sessions.id))
          .where(
            and(
              eq(shots.userId, userId),
              eq(sessions.userId, userId),
              inArray(shots.clubId, club.memberIds),
            ),
          )
          .orderBy(desc(shots.shotAt))
          .limit(RECENT_SHOTS_PER_CLUB),
        db
          .select({ value: count() })
          .from(shots)
          .where(and(eq(shots.userId, userId), inArray(shots.clubId, club.memberIds))),
      ]);

      return {
        club,
        recentShots,
        personalBestRows: club.memberIds.flatMap((clubId) =>
          personalBestByClubId.get(clubId) ? [personalBestByClubId.get(clubId)!] : [],
        ),
        rawShotCount: shotCount?.value ?? 0,
      };
    }),
  );

  return clubData
    .filter(({ club }) => isTrackedClubType(club.type))
    .map(({ club, recentShots, personalBestRows, rawShotCount }) => {
      const accent = clubAccent(club.type);
      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";
      const isShortGameTouch = isShortGameTouchClubType(club.type);
      const isTouchOnlyClub = isShortGameTouch && club.type !== "sw";
      const touch = calculateShortGameTouchSummary(recentShots, RECENT_SHOTS_PER_CLUB, {
        clubType: club.type,
      });
      const stockBase = calculateStockYardage(recentShots, RECENT_SHOTS_PER_CLUB, {
        clubType: club.type,
      });
      const personalBest = {
        carryYd: roundOne(maxNumberOrNull(personalBestRows.map((row) => row.carryYd))),
        totalYd: roundOne(maxNumberOrNull(personalBestRows.map((row) => row.totalYd))),
      };
      const stock = {
        ...stockBase,
        personalBestCarryYd: personalBest.carryYd,
      };
      const stockTrend = isTouchOnlyClub
        ? null
        : calculateStockCarryTrend(recentShots, RECENT_SHOTS_PER_CLUB, {
            clubType: club.type,
          });
      const decisionLabel = getClubDecisionLabel({
        isShortGameTouch: isTouchOnlyClub,
        stockLabel: stock.label,
      });

      return {
        ...club,
        accent,
        brandModel,
        isShortGameTouch,
        decisionLabel,
        rawShotCount,
        shots: recentShots,
        personalBest,
        touch,
        stock,
        stockTrend,
      };
    })
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));
}

type BagClub = Awaited<ReturnType<typeof getBag>>[number];
type PeerBenchmarkShot = StockShot & {
  id: string;
  userId: string;
  clubId: string;
  clubType: string;
  shotAt: Date;
  clubSpeedMph: number | null;
  apexFt: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
};
type PeerProfileRow = {
  userId: string;
  visibilitySettingsJson: {
    bag?: "private" | "friends" | "public";
    allowCompare?: boolean;
  };
};

type GappingRow = {
  id: string;
  clubType: string;
  brandModel: string;
  carryYd: number | null;
  gappingCarryYd: number | null;
  latestReliableCarryYd: number | null;
  latestReliableCarryP25Yd: number | null;
  latestReliableCarryP75Yd: number | null;
  personalBestCarryYd: number | null;
  playNumberYd: number | null;
  nextClubType: string | null;
  gapToNextYd: number | null;
  targetCarryYd: number | null;
  targetPlayNumberYd: number | null;
  workOnYd: number | null;
  targetGapYd: number | null;
  targetMessage: string;
  targetTone: GappingTargetTone;
  targetPriorityYd: number;
  sampleSize: number;
  confidenceScore: number;
  averageLaunchAngleDeg: number | null;
  decisionLabel: ClubDecisionLabel;
};

type BagDoctorFinding = {
  title: string;
  detail: string;
  label: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
  href?: string;
};

function parsePersonalBestMetric(value: string | string[] | undefined): PersonalBestMetric {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue === "total" ? "total" : "carry";
}

function visualCarryYd(row: GappingRow) {
  return row.gappingCarryYd;
}

function maxVisualCarryYd(rows: GappingRow[]) {
  return Math.max(1, ...rows.map((row) => visualCarryYd(row) ?? 0));
}

function formatCarryYards(carryYd: number | null) {
  return carryYd === null ? "--" : `${formatMetric(carryYd)} yd`;
}

function clubPrimaryCarryYd(club: BagClub) {
  if (club.isShortGameTouch) {
    return club.touch.carryMedianYd;
  }

  return club.stock.coursePlayCarryYd;
}

function clubSecondaryCarryYd(club: BagClub) {
  if (club.isShortGameTouch) {
    return club.type === "sw" ? club.stock.bestStockCarryYd : null;
  }

  return club.stock.bestStockCarryYd;
}

function LowerScoresFeatureStack({
  smartBagBuilder,
  wedgeMatrix,
  pathTrend,
  shotPatternOverlays,
  courseStrategy,
  confidenceHeatMaps,
  aiCaddieCards,
  personalStrokesGained,
  compact = false,
}: {
  smartBagBuilder: SmartBagBuilder;
  wedgeMatrix: WedgeMatrixClub[];
  pathTrend: PathTrendTracking;
  shotPatternOverlays: ShotPatternOverlaySummary[];
  courseStrategy: CourseStrategyMode;
  confidenceHeatMaps: ConfidenceHeatMap[];
  aiCaddieCards: AiCaddieCard[];
  personalStrokesGained: PersonalStrokesGainedModel;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-3" : "grid gap-4"}>
      <div className={compact ? "grid gap-3" : "grid gap-4 xl:grid-cols-[0.85fr_1.15fr]"}>
        <SmartBagBuilderPanel model={smartBagBuilder} />
        <WedgeMatrixPanel matrix={wedgeMatrix} />
      </div>
      <div className={compact ? "grid gap-3" : "grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"}>
        <PathTrendPanel trend={pathTrend} />
        <ShotPatternOverlayPanel overlays={shotPatternOverlays} />
      </div>
      <div className={compact ? "grid gap-3" : "grid gap-4 xl:grid-cols-[1fr_1fr]"}>
        <CourseStrategyModePanel strategy={courseStrategy} />
        <ConfidenceHeatMapPanel heatMaps={confidenceHeatMaps} />
      </div>
      <div className={compact ? "grid gap-3" : "grid gap-4 xl:grid-cols-[1fr_1fr]"}>
        <AiCaddiePanel cards={aiCaddieCards} />
        <PersonalStrokesGainedModelPanel model={personalStrokesGained} />
      </div>
    </div>
  );
}

function SmartBagBuilderPanel({ model }: { model: SmartBagBuilder }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Gap wedge integration"
        description="Smart bag builder scores the current setup and ranks the next bag move."
        action={<ShoppingBag className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-3">
        <div className="apple-panel-strong grid gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Current bag score
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-normal">{model.currentScore}%</p>
            </div>
            <StatusPill
              tone={model.currentScore >= 85 ? "green" : model.currentScore >= 70 ? "sky" : "amber"}
            >
              {model.scoreLabel}
            </StatusPill>
          </div>
          <Progress value={model.currentScore} />
        </div>
        <div className="grid gap-2">
          {model.suggestions.length > 0 ? (
            model.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="grid gap-2 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{suggestion.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {suggestion.detail}
                    </p>
                  </div>
                  <StatusPill tone={suggestion.tone}>{suggestion.scoreAfter}%</StatusPill>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Bag score {formatSignedPercent(suggestion.scoreLift)} projected
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              No urgent fitting gap in the current numbers.
            </div>
          )}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function WedgeMatrixPanel({ matrix }: { matrix: WedgeMatrixClub[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Full wedge matrix"
        description="Full, 3/4, and half-shot carry windows for scoring clubs."
        action={<Grid3X3 className="size-5 text-amber-600" />}
      />
      <CardContent>
        {matrix.length > 0 ? (
          <div className="grid gap-3">
            {matrix.map((club) => (
              <div key={club.id} className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{club.label}</p>
                    <p className="text-xs text-muted-foreground">{club.brandModel}</p>
                  </div>
                  <StatusPill
                    tone={club.isSuggested ? "amber" : club.matrixScore >= 70 ? "green" : "sky"}
                  >
                    {club.isSuggested ? "Target" : `${club.matrixScore}%`}
                  </StatusPill>
                </div>
                <div className="mt-3 grid gap-2">
                  {club.rows.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-white/85 px-2 py-1.5 text-xs"
                    >
                      <span className="font-semibold">{row.label}</span>
                      <span className="truncate text-muted-foreground">
                        {row.detail} {row.sampleSize > 0 ? `${row.sampleSize} shots` : ""}
                      </span>
                      <span className="font-semibold">{formatCarryYards(row.carryYd)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage
            title="Wedge matrix building"
            detail="Add PW, GW/AW, SW or LW shots to build full and partial carry windows."
          />
        )}
      </CardContent>
    </DataPanel>
  );
}

function PathTrendPanel({ trend }: { trend: PathTrendTracking }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Face-to-path trend"
        description="Red is measured club path. Black is the face/start-line proxy against that path."
        action={<Radar className="size-5 text-sky-600" />}
      />
      <CardContent className="grid gap-3">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
          <div>
            <p className="text-base font-semibold">{trend.label}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{trend.detail}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Monthly cards are averages. Recent shots below are individual rows.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-5 rounded-full bg-red-600" />
                Club path
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-5 rounded-full bg-slate-950" />
                Face / start line
              </span>
            </div>
          </div>
          <StatusPill tone={pathTrendStatusTone(trend.status)}>
            {pathTrendStatusLabel(trend.status)}
          </StatusPill>
        </div>
        {trend.points.length > 0 ? (
          <div className="grid gap-3">
            {trend.points.map((point) => (
              <div
                key={point.monthKey}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{point.label}</p>
                    <p className="mt-0.5 text-base font-semibold">{point.patternLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{point.sampleSize} shots</p>
                  </div>
                  <StatusPill tone={facePathPatternTone(point.patternCode)}>
                    {point.patternCode}
                  </StatusPill>
                </div>
                <FacePathDiagram point={point} />
                <p className="mt-2 min-h-8 text-xs leading-4 text-muted-foreground">
                  {point.patternDetail}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <DataPair label="Path" value={formatSignedDegrees(point.pathDeg)} />
                  <DataPair label="Face" value={formatSignedDegrees(point.faceDeg)} />
                  <DataPair label="F-P" value={formatSignedDegrees(point.faceToPathProxyDeg)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage
            title="Path trend building"
            detail="Import rows with club path to chart monthly movement."
          />
        )}
        {trend.recentShots.length > 0 ? (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
            <div>
              <p className="text-sm font-semibold">Recent individual shots</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Same face-to-path picture, one launch-monitor row at a time.
              </p>
            </div>
            <div className="grid gap-3">
              {trend.recentShots.map((shot) => (
                <div
                  key={shot.key}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{shot.patternLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{shot.shotAtLabel}</p>
                    </div>
                    <StatusPill tone={facePathPatternTone(shot.patternCode)}>
                      {shot.patternCode}
                    </StatusPill>
                  </div>
                  <FacePathDiagram point={shot} diagramKey={shot.key} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <DataPair label="Path" value={formatSignedDegrees(shot.pathDeg)} />
                    <DataPair label="Face" value={formatSignedDegrees(shot.faceDeg)} />
                    <DataPair label="F-P" value={formatSignedDegrees(shot.faceToPathProxyDeg)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {trend.clubs.length > 1 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold">Clubs with path data</p>
            <div className="mt-3 grid gap-2">
              {trend.clubs.map((club) => (
                <div
                  key={club.clubId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-[#F5F6F4] px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold">{club.label}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {club.patternLabel} · {club.sampleSize} shots
                    </p>
                  </div>
                  <div className="text-right font-semibold">
                    <p>{formatSignedDegrees(club.pathDeg)}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      F-P {formatSignedDegrees(club.faceToPathProxyDeg)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </DataPanel>
  );
}

function ShotPatternOverlayPanel({ overlays }: { overlays: ShotPatternOverlaySummary[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Shot pattern overlays"
        description="Carry cone, offline window, and playable rate from actual shot patterns."
        action={<Layers3 className="size-5 text-emerald-600" />}
      />
      <CardContent>
        {overlays.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {overlays.map((overlay) => (
              <div
                key={overlay.clubId}
                className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{overlay.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {overlay.sampleSize} shots · {overlay.primaryMiss} miss
                    </p>
                  </div>
                  <StatusPill tone={overlay.tone}>{formatMetric(overlay.playableRate)}%</StatusPill>
                </div>
                <PatternOverlaySvg overlay={overlay} />
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="P10" value={formatCarryYards(overlay.carryP10Yd)} />
                  <Metric label="Median" value={formatCarryYards(overlay.carryP50Yd)} />
                  <Metric label="P90" value={formatCarryYards(overlay.carryP90Yd)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage
            title="Patterns need side data"
            detail="Add at least five usable shots with carry and offline values."
          />
        )}
      </CardContent>
    </DataPanel>
  );
}

function CourseStrategyModePanel({ strategy }: { strategy: CourseStrategyMode }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Course strategy mode"
        description="Target-yardage calls from recommended carries and miss windows."
        action={<MapPinned className="size-5 text-sky-600" />}
      />
      <CardContent>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-2"
          items={strategy.scenarios.map((scenario) => ({
            label: scenario.label,
            value: scenario.recommendation,
            detail: scenario.detail,
            tone: scenario.tone,
            href: scenario.clubId ? `/bag/${scenario.clubId}` : undefined,
          }))}
        />
      </CardContent>
    </DataPanel>
  );
}

function ConfidenceHeatMapPanel({ heatMaps }: { heatMaps: ConfidenceHeatMap[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Confidence heat maps"
        description="Green, amber, and red carry windows by club."
        action={<Sparkles className="size-5 text-emerald-600" />}
      />
      <CardContent>
        {heatMaps.length > 0 ? (
          <div className="grid gap-3">
            {heatMaps.slice(0, 4).map((heatMap) => (
              <div
                key={heatMap.clubId}
                className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{heatMap.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {heatMap.confidenceScore}% confidence · {heatMap.sampleSize} shots
                    </p>
                  </div>
                  <StatusPill tone={heatMap.confidenceScore >= 75 ? "green" : "sky"}>
                    Heat
                  </StatusPill>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {heatMap.bands.map((band) => (
                    <div
                      key={band.label}
                      className={`rounded-md border px-2 py-2 ${intelligenceToneClass(band.tone)}`}
                    >
                      <p className="text-xs font-semibold">{band.label}</p>
                      <p className="mt-1 text-lg font-semibold tracking-normal">
                        {band.rangeLabel}
                        <span className="ml-1 text-xs">yd</span>
                      </p>
                      <p className="mt-1 text-xs leading-4">{band.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage
            title="Heat maps building"
            detail="Each club needs four usable carries and a recommended number."
          />
        )}
      </CardContent>
    </DataPanel>
  );
}

function AiCaddiePanel({ cards }: { cards: AiCaddieCard[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="AI caddie"
        description="Number-led caddie calls from bag, wedge, strategy, and SG evidence."
        action={<Bot className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-2"
          items={cards.map((card) => ({
            label: card.title,
            value: card.value,
            detail: card.detail,
            tone: card.tone,
          }))}
        />
      </CardContent>
    </DataPanel>
  );
}

function PersonalStrokesGainedModelPanel({ model }: { model: PersonalStrokesGainedModel }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Personal strokes gained"
        description="Your own judged round events, grouped into the scoring model."
        action={<Brain className="size-5 text-sky-600" />}
      />
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Total" value={formatSignedStrokes(model.total)} />
          <Metric label="Average" value={formatSignedStrokes(model.average)} />
          <Metric label="Judged" value={model.sampleSize.toString()} />
        </div>
        {model.categories.length > 0 ? (
          <div className="grid gap-2">
            {model.categories.map((category) => (
              <div
                key={category.category}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3 text-sm"
              >
                <span className="font-semibold">{category.label}</span>
                <span className="text-muted-foreground">{category.sampleSize} shots</span>
                <StatusPill tone={category.tone}>{formatSignedStrokes(category.total)}</StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage
            title="SG model building"
            detail="Mapped rounds with expected-strokes events will unlock personal scoring leaks."
          />
        )}
      </CardContent>
    </DataPanel>
  );
}

function EmptyPanelMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function WedgeRolePanel({ clubs }: { clubs: BagClub[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Wedge roles"
        description="Full, pitch, and chip/touch windows are derived without changing the database schema."
        action={<Target className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <WedgeRoleCards clubs={clubs} />
      </CardContent>
    </DataPanel>
  );
}

function WedgeRoleCards({ clubs, compact = false }: { clubs: BagClub[]; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 lg:grid-cols-2 xl:grid-cols-3"}>
      {clubs.map((club) => (
        <Link
          key={club.id}
          href={`/bag/${club.id}`}
          prefetch={false}
          className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3 transition-colors hover:border-emerald-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{club.brandModel}</p>
              <p className="mt-1 text-base font-semibold">{formatClubType(club.type)}</p>
            </div>
            <StatusPill tone={club.stock.coursePlayCarryYd === null ? "amber" : "green"}>
              {club.stock.coursePlayCarryYd === null ? "Building" : "Ready"}
            </StatusPill>
          </div>
          <div className="mt-3 grid gap-2">
            {WEDGE_ROLE_ORDER.map((role) => (
              <WedgeRoleReadout
                key={role}
                role={role}
                summary={roleSummaryFor(club.stock.shotRoleSummaries, role)}
              />
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

function WedgeRoleReadout({
  role,
  summary,
}: {
  role: StockShotRole;
  summary: StockShotRoleSummary | null;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-white/80 px-2 py-1.5 text-xs">
      <span className="font-semibold">{wedgeRoleLabel(role)}</span>
      <span className="truncate text-muted-foreground">
        {summary ? `${summary.sampleSize} shots · ${formatRoleRange(summary)}` : "No shots"}
      </span>
      <span className="font-semibold">
        {summary === null || summary.carryMedianYd === null
          ? "--"
          : `${formatMetric(summary.carryMedianYd)} yd`}
      </span>
    </div>
  );
}

function StockFilterPanel({ clubs }: { clubs: BagClub[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Best-stock filters"
        description="Shows why rows did not feed the Best Stock median. Personal Best is tracked separately so one long clean shot still appears."
        action={<Database className="size-5 text-sky-600" />}
      />
      <CardContent>
        <StockFilterCards clubs={clubs} />
      </CardContent>
    </DataPanel>
  );
}

function StockFilterCards({ clubs, compact = false }: { clubs: BagClub[]; compact?: boolean }) {
  const sortedClubs = [...clubs]
    .sort((left, right) => right.stock.stockExclusionCount - left.stock.stockExclusionCount)
    .slice(0, compact ? 4 : 8);

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 lg:grid-cols-2 xl:grid-cols-4"}>
      {sortedClubs.map((club) => (
        <Link
          key={club.id}
          href={`/bag/${club.id}`}
          prefetch={false}
          className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3 transition-colors hover:border-sky-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold">{formatClubType(club.type)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {club.stock.sampleSize} used · {club.stock.stockExclusionCount} not used
              </p>
            </div>
            <StatusPill tone="sky">{formatMetric(club.stock.personalBestCarryYd)} PB</StatusPill>
          </div>
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            {formatStockExclusionReasons(club.stock.stockExclusionReasons)}
          </p>
        </Link>
      ))}
    </div>
  );
}

function BagConfidenceLadder({
  rows,
  maxCarryYd,
  findings,
}: {
  rows: GappingRow[];
  maxCarryYd: number;
  findings: BagDoctorFinding[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)] xl:items-start">
      <DataPanel>
        <SectionHeader
          title="Bag confidence ladder"
          description="Recommended is the primary course number. Best Stock stays visible as potential."
          action={<Gauge className="size-5 text-emerald-600" />}
        />
        <CardContent>
          <div
            aria-label="Bag confidence ladder"
            tabIndex={0}
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mx-0 sm:px-0"
          >
            {rows.map((row) => {
              const confidence = confidenceReadout(row);
              const gap = gapReadout(row);
              const visualCarry = visualCarryYd(row);

              return (
                <Link
                  key={row.id}
                  href={`/bag/${row.id}`}
                  prefetch={false}
                  className="premium-rail-card grid min-h-[15rem] w-40 shrink-0 content-between rounded-lg p-3 transition-colors hover:border-emerald-300"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-muted-foreground">{row.brandModel}</p>
                        <p className="mt-1 text-lg font-semibold tracking-normal">
                          {formatClubType(row.clubType)}
                        </p>
                      </div>
                      <StatusPill tone={confidence.tone}>{confidence.label}</StatusPill>
                    </div>

                    <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {row.playNumberYd === null ? "Best stock" : "Recommended"}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-normal">
                      {formatCarryYards(visualCarry)}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <span
                        className="block h-2 rounded-full bg-[#0B7A3B]"
                        style={{
                          width: `${carryWidthPercent(visualCarry, maxCarryYd)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs">
                    <div className="flex items-center justify-between gap-2 rounded-md bg-[#F5F6F4] px-2 py-1.5">
                      <span className="text-muted-foreground">
                        {row.playNumberYd === null ? "Recommended" : "Best stock"}
                      </span>
                      <span className="font-semibold">
                        {row.playNumberYd === null ? "--" : formatCarryYards(row.carryYd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-[#F5F6F4] px-2 py-1.5">
                      <span className="text-muted-foreground">Course gap</span>
                      <span className="font-semibold">{gap.value}</span>
                    </div>
                    <StatusPill tone={gap.tone} className="max-w-full justify-center truncate">
                      {gap.label}
                    </StatusPill>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </DataPanel>

      <DataPanel>
        <SectionHeader
          title="Gapping doctor"
          description="Flags overlap, course-critical yardage windows, and numbers that need more clean shots."
          action={
            findings.every((finding) => finding.tone === "green") ? (
              <ShieldCheck className="size-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-5 text-amber-600" />
            )
          }
        />
        <CardContent className="grid gap-3">
          {findings.map((finding) => (
            <Link
              key={`${finding.title}-${finding.detail}`}
              href={finding.href ?? "/import"}
              prefetch={false}
              className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3 transition-colors hover:border-emerald-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{finding.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{finding.detail}</p>
                </div>
                <StatusPill tone={finding.tone}>{finding.label}</StatusPill>
              </div>
            </Link>
          ))}
        </CardContent>
      </DataPanel>
    </section>
  );
}

function buildBagDoctorFindings(rows: GappingRow[]): BagDoctorFinding[] {
  if (rows.length === 0) {
    return [
      {
        title: "Import a first bag sample",
        detail: "A Rapsodo CSV with several clubs will unlock carry, gapping and trust checks.",
        label: "Start",
        tone: "slate",
        href: "/import",
      },
    ];
  }

  const findings: BagDoctorFinding[] = [];
  const unreliable = rows
    .filter((row) => row.confidenceScore < 55 || row.sampleSize < 10)
    .sort(
      (left, right) =>
        left.confidenceScore - right.confidenceScore || left.sampleSize - right.sampleSize,
    );
  const overlap = rows.find((row) => row.gapToNextYd !== null && row.gapToNextYd < 8);
  const missingWindow = rows
    .filter((row) => isMissingYardageWindowGap(gapWindowInput(row)))
    .sort(
      (left, right) =>
        missingYardageWindowPriority(gapWindowInput(right)) -
          missingYardageWindowPriority(gapWindowInput(left)) ||
        (right.gapToNextYd ?? 0) - (left.gapToNextYd ?? 0),
    )[0];
  const wedge = rows.find(
    (row) => ["pw", "gw", "sw", "lw"].includes(row.clubType) && row.sampleSize < 15,
  );

  if (unreliable[0]) {
    findings.push({
      title: `${formatClubType(unreliable[0].clubType)} is not decision-ready`,
      detail: `${unreliable[0].sampleSize} clean shots and ${unreliable[0].confidenceScore}% trust. Retest before using this as a stock number.`,
      label: "Retest",
      tone: "amber",
      href: `/bag/${unreliable[0].id}`,
    });
  }

  if (overlap) {
    const severeOverlap = isSevereGapCompression(overlap);
    findings.push({
      title: severeOverlap
        ? `${formatClubType(overlap.clubType)} overlaps the next club`
        : `${formatClubType(overlap.clubType)} gap is worth watching`,
      detail: `${formatGap(overlap.gapToNextYd)} course gap to the next club. Check strike quality, loft setup, or club mapping.`,
      label: severeOverlap ? "Overlap" : "Watch",
      tone: severeOverlap ? "pink" : "amber",
      href: `/bag/${overlap.id}`,
    });
  }

  if (missingWindow) {
    const scoringGap = isScoringEndGap(gapWindowInput(missingWindow));

    findings.push({
      title: scoringGap ? "Scoring yardage window" : "Missing yardage window",
      detail: scoringGap
        ? `${formatClubType(missingWindow.clubType)} leaves a ${formatGap(
            missingWindow.gapToNextYd,
          )} scoring-end gap. Add the missing wedge, choke-down, or flighted option.`
        : `${formatClubType(missingWindow.clubType)} leaves a ${formatGap(
            missingWindow.gapToNextYd,
          )} course gap to the next club. Add a choke-down or flighted option.`,
      label: scoringGap ? "Scoring" : "Gap",
      tone: "amber",
      href: `/bag/${missingWindow.id}`,
    });
  }

  if (wedge && !findings.some((finding) => finding.href === `/bag/${wedge.id}`)) {
    findings.push({
      title: "Wedge window needs more proof",
      detail: `${formatClubType(wedge.clubType)} has ${wedge.sampleSize} clean stock shots. Add partial and full swings before trusting scoring numbers.`,
      label: "Wedges",
      tone: "sky",
      href: `/bag/${wedge.id}`,
    });
  }

  if (findings.length === 0) {
    const strongest = [...rows].sort(
      (left, right) => right.confidenceScore - left.confidenceScore,
    )[0];

    return [
      {
        title: "No urgent gapping flags",
        detail: strongest
          ? `${formatClubType(strongest.clubType)} is currently the clearest number at ${strongest.confidenceScore}% trust.`
          : "The current bag has enough shape for first-pass decisions.",
        label: "Clean",
        tone: "green",
        href: strongest ? `/bag/${strongest.id}` : "/bag",
      },
    ];
  }

  return findings.slice(0, 4);
}

function confidenceReadout(row: GappingRow): {
  label: string;
  tone: BagDoctorFinding["tone"];
} {
  if (row.sampleSize < 10) {
    return { label: "Needs shots", tone: "slate" };
  }

  if (row.confidenceScore >= 75) {
    return { label: "Trusted", tone: "green" };
  }

  if (row.confidenceScore >= 60) {
    return { label: "Usable", tone: "sky" };
  }

  return { label: "Retest", tone: "amber" };
}

function gapReadout(row: GappingRow): {
  value: string;
  label: string;
  tone: BagDoctorFinding["tone"];
} {
  if (row.gapToNextYd === null) {
    return { value: "--", label: "End club", tone: "slate" };
  }

  if (row.gapToNextYd < 8) {
    return {
      value: formatGap(row.gapToNextYd),
      label: isSevereGapCompression(row) ? "Overlap risk" : "Watch gap",
      tone: isSevereGapCompression(row) ? "pink" : "amber",
    };
  }

  if (row.gapToNextYd > 18) {
    if (isManageableTopEndGap(gapWindowInput(row))) {
      return { value: formatGap(row.gapToNextYd), label: "Top gap ok", tone: "sky" };
    }

    return {
      value: formatGap(row.gapToNextYd),
      label: isScoringEndGap(gapWindowInput(row)) ? "Scoring gap" : "Missing window",
      tone: "amber",
    };
  }

  return { value: formatGap(row.gapToNextYd), label: "Gap ok", tone: "green" };
}

function isSevereGapCompression(row: GappingRow) {
  return (
    row.gapToNextYd !== null &&
    row.gapToNextYd <= 4 &&
    row.sampleSize >= 20 &&
    row.confidenceScore >= 75
  );
}

function gapWindowInput(row: GappingRow) {
  return {
    longerClubType: row.clubType,
    shorterClubType: row.nextClubType,
    gapYd: row.gapToNextYd,
  };
}

function formatGap(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function buildBenchmarkRows(bag: BagClub[]): ClubBenchmarkRow[] {
  return buildClubBenchmarkRows(
    bag.map((club) => ({
      clubId: club.id,
      clubType: club.type,
      brandModel: club.brandModel,
      carryYd: club.stock.bestStockCarryYd,
      bestSampleFloorYd: club.stock.bestSampleFloorYd,
      sampleSize: club.stock.sampleSize,
      confidenceScore: club.stock.confidenceScore,
      metrics: buildBenchmarkMetricValues(club),
    })),
  );
}

function buildBenchmarkMetricValues(club: BagClub): ClubBenchmarkMetricValues {
  const { filteredShots } = selectStockYardageShots(club.shots, RECENT_SHOTS_PER_CLUB, {
    clubType: club.type,
  });

  return {
    carryYd: club.stock.bestStockCarryYd,
    clubSpeedMph: averageBenchmarkMetric(filteredShots, (shot) => shot.clubSpeedMph),
    ballSpeedMph: averageBenchmarkMetric(filteredShots, (shot) => shot.ballSpeedMph),
    smashFactor: averageBenchmarkMetric(filteredShots, (shot) => shot.smashFactor, 2),
    maxHeightYd: averageBenchmarkMetric(
      filteredShots,
      (shot) => (shot.apexFt === null || shot.apexFt === undefined ? null : shot.apexFt / 3),
      1,
    ),
    landAngleDeg: averageBenchmarkMetric(filteredShots, (shot) => shot.descentAngleDeg),
  };
}

async function getPeerBenchmarkSummary(
  rows: ClubBenchmarkRow[],
): Promise<ClubBenchmarkPeerSummary> {
  const db = getDb();
  const viewerUserId = await requireCurrentUserId();
  const targetClubTypes = new Set(rows.map((row) => row.comparison.benchmark.clubType));
  const [profileRows, friendIds, blockedIds] = await Promise.all([
    db
      .select({
        userId: userProfiles.userId,
        visibilitySettingsJson: userProfiles.visibilitySettingsJson,
      })
      .from(userProfiles),
    getFriendIds(viewerUserId),
    getBlockedUserIds(viewerUserId),
  ]);
  const friendIdSet = new Set(friendIds);
  const eligibleUserIds = profileRows
    .filter((profile) =>
      canUseProfileForPeerBenchmarks(profile, {
        viewerUserId,
        friendIds: friendIdSet,
        blockedIds,
      }),
    )
    .map((profile) => profile.userId);

  if (eligibleUserIds.length === 0 || targetClubTypes.size === 0) {
    return emptyPeerSummary();
  }

  const peerClubTypes = new Set(targetClubTypes);
  if (targetClubTypes.has("hybrid")) {
    for (let hybridNumber = 1; hybridNumber <= 9; hybridNumber += 1) {
      peerClubTypes.add(`${hybridNumber}h`);
    }
  }

  const peerShots = await db
    .select({
      id: shots.id,
      userId: shots.userId,
      clubId: shots.clubId,
      clubType: shots.clubType,
      shotAt: shots.shotAt,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      ballSpeedMph: shots.ballSpeedMph,
      clubSpeedMph: shots.clubSpeedMph,
      launchAngleDeg: shots.launchAngleDeg,
      apexFt: shots.apexFt,
      descentAngleDeg: shots.descentAngleDeg,
      smashFactor: shots.smashFactor,
      courseHoleNumber: shots.courseHoleNumber,
      sessionType: sessions.type,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(
      and(
        inArray(shots.userId, eligibleUserIds),
        inArray(shots.clubType, Array.from(peerClubTypes)),
        eq(clubs.active, true),
      ),
    )
    .orderBy(desc(shots.shotAt))
    .limit(PEER_SHOT_QUERY_LIMIT);

  const targetedPeerShots = peerShots.filter((shot) =>
    targetClubTypes.has(peerBenchmarkClubTypeFor(shot.clubType)),
  );
  const peerMetricValues = buildPeerMetricValues(targetedPeerShots, targetClubTypes);
  const contributingUserIds = new Set<string>();

  for (const values of peerMetricValues.values()) {
    for (const value of values) {
      contributingUserIds.add(value.userId);
    }
  }

  return {
    cohortLabel: "Public and friends",
    peerUserCount: contributingUserIds.size,
    peerShotCount: targetedPeerShots.length,
    comparisons: rows.flatMap((row) =>
      PEER_PERCENTILE_METRIC_KEYS.map((metricKey) =>
        buildPeerComparison(row, metricKey, peerMetricValues),
      ),
    ),
  };
}

function canUseProfileForPeerBenchmarks(
  profile: PeerProfileRow,
  context: {
    viewerUserId: string;
    friendIds: Set<string>;
    blockedIds: Set<string>;
  },
) {
  if (profile.userId === context.viewerUserId || context.blockedIds.has(profile.userId)) {
    return false;
  }

  if (profile.visibilitySettingsJson?.allowCompare === false) {
    return false;
  }

  if (context.friendIds.has(profile.userId)) {
    return true;
  }

  return profile.visibilitySettingsJson?.bag === "public";
}

function buildPeerMetricValues(shotsForPeers: PeerBenchmarkShot[], targetClubTypes: Set<string>) {
  const groupedShots = new Map<string, PeerBenchmarkShot[]>();

  for (const shot of shotsForPeers) {
    const clubType = peerBenchmarkClubTypeFor(shot.clubType);

    if (!targetClubTypes.has(clubType)) {
      continue;
    }

    const key = `${shot.userId}:${clubType}`;
    groupedShots.set(key, [...(groupedShots.get(key) ?? []), shot]);
  }

  const metricValues = new Map<
    string,
    Array<{ userId: string; value: number; sampleSize: number }>
  >();

  for (const [key, clubShots] of groupedShots.entries()) {
    const [userId, clubType] = key.split(":");
    const { filteredShots } = selectStockYardageShots(clubShots, RECENT_SHOTS_PER_CLUB, {
      clubType,
    });

    if (filteredShots.length < PEER_MIN_STOCK_SHOTS) {
      continue;
    }

    const metrics = buildPeerBenchmarkMetricValues(filteredShots);

    for (const metricKey of PEER_PERCENTILE_METRIC_KEYS) {
      const value = metrics[metricKey];

      if (!isFiniteMetric(value)) {
        continue;
      }

      const metricKeyId = peerMetricMapKey(clubType, metricKey);
      metricValues.set(metricKeyId, [
        ...(metricValues.get(metricKeyId) ?? []),
        {
          userId,
          value,
          sampleSize: countMetricSamples(filteredShots, metricKey),
        },
      ]);
    }
  }

  return metricValues;
}

function buildPeerComparison(
  row: ClubBenchmarkRow,
  metricKey: ClubBenchmarkMetricKey,
  peerMetricValues: Map<string, Array<{ userId: string; value: number; sampleSize: number }>>,
): ClubBenchmarkPeerComparison {
  const values =
    peerMetricValues.get(peerMetricMapKey(row.comparison.benchmark.clubType, metricKey)) ?? [];
  const numbers = values.map((item) => item.value);
  const actual = actualBenchmarkMetricValue(row, metricKey);

  return {
    clubType: row.comparison.benchmark.clubType,
    metricKey,
    peerCount: numbers.length,
    sampleSize: values.reduce((total, item) => total + item.sampleSize, 0),
    peerMedian: roundOne(percentile(numbers, 0.5)),
    topQuartile: roundOne(percentile(numbers, 0.75)),
    percentile: isFiniteMetric(actual) ? percentileRank(numbers, actual) : null,
  };
}

function buildPeerBenchmarkMetricValues(
  shotsForClub: PeerBenchmarkShot[],
): ClubBenchmarkMetricValues {
  return {
    carryYd: roundOne(
      percentile(shotsForClub.map((shot) => shot.carryYd).filter(isFiniteMetric), 0.5),
    ),
    clubSpeedMph: averageBenchmarkMetric(shotsForClub, (shot) => shot.clubSpeedMph),
    ballSpeedMph: averageBenchmarkMetric(shotsForClub, (shot) => shot.ballSpeedMph),
    smashFactor: averageBenchmarkMetric(shotsForClub, (shot) => shot.smashFactor, 2),
    maxHeightYd: averageBenchmarkMetric(
      shotsForClub,
      (shot) => (shot.apexFt === null || shot.apexFt === undefined ? null : shot.apexFt / 3),
      1,
    ),
    landAngleDeg: averageBenchmarkMetric(shotsForClub, (shot) => shot.descentAngleDeg),
  };
}

function actualBenchmarkMetricValue(row: ClubBenchmarkRow, metricKey: ClubBenchmarkMetricKey) {
  if (metricKey === "carryYd") {
    return row.carryYd;
  }

  return row.metrics?.[metricKey] ?? null;
}

function countMetricSamples(shotsForClub: PeerBenchmarkShot[], metricKey: ClubBenchmarkMetricKey) {
  if (metricKey === "carryYd") {
    return shotsForClub.filter((shot) => isFiniteMetric(shot.carryYd)).length;
  }

  if (metricKey === "clubSpeedMph") {
    return shotsForClub.filter((shot) => isFiniteMetric(shot.clubSpeedMph)).length;
  }

  if (metricKey === "ballSpeedMph") {
    return shotsForClub.filter((shot) => isFiniteMetric(shot.ballSpeedMph)).length;
  }

  if (metricKey === "smashFactor") {
    return shotsForClub.filter((shot) => isFiniteMetric(shot.smashFactor)).length;
  }

  if (metricKey === "maxHeightYd") {
    return shotsForClub.filter((shot) => isFiniteMetric(shot.apexFt)).length;
  }

  if (metricKey === "landAngleDeg") {
    return shotsForClub.filter((shot) => isFiniteMetric(shot.descentAngleDeg)).length;
  }

  return 0;
}

function peerMetricMapKey(clubType: string, metricKey: ClubBenchmarkMetricKey) {
  return `${clubType}:${metricKey}`;
}

function peerBenchmarkClubTypeFor(clubType: string) {
  if (/^[1-9]h$/.test(clubType)) {
    return "hybrid";
  }

  return clubType;
}

function emptyPeerSummary(): ClubBenchmarkPeerSummary {
  return {
    cohortLabel: "Public and friends",
    peerUserCount: 0,
    peerShotCount: 0,
    comparisons: [],
  };
}

function averageBenchmarkMetric<T>(
  rows: T[],
  selector: (row: T) => number | null | undefined,
  precision = 1,
) {
  const values = rows.map(selector).filter(isFiniteMetric);

  if (values.length === 0) {
    return null;
  }

  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const factor = 10 ** precision;

  return Math.round(average * factor) / factor;
}

function isFiniteMetric(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function percentileRank(values: number[], value: number) {
  if (values.length === 0) {
    return null;
  }

  const lowerOrEqual = values.filter((peerValue) => peerValue <= value).length;

  return Math.round((lowerOrEqual / values.length) * 100);
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function maxNumberOrNull(values: Array<number | null | undefined>) {
  const numbers = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function buildGappingRows(
  bag: BagClub[],
  options: { handicapBand?: string | null } = {},
): GappingRow[] {
  const stockBag = bag.filter(shouldShowInCarryGapping);

  const baseRows: GappingRow[] = stockBag.map((club, index) => {
    const clubGappingCarryYd = club.stock.coursePlayCarryYd ?? club.stock.bestStockCarryYd;
    const nextClub = stockBag
      .slice(index + 1)
      .find(
        (candidate) =>
          (candidate.stock.coursePlayCarryYd ?? candidate.stock.bestStockCarryYd) !== null,
      );
    const nextClubGappingCarryYd =
      nextClub === undefined
        ? null
        : (nextClub.stock.coursePlayCarryYd ?? nextClub.stock.bestStockCarryYd);
    const gapToNextYd =
      clubGappingCarryYd !== null && nextClubGappingCarryYd !== null
        ? clubGappingCarryYd - nextClubGappingCarryYd
        : null;

    return {
      id: club.id,
      clubType: club.type,
      brandModel: club.brandModel,
      carryYd: club.stock.bestStockCarryYd,
      gappingCarryYd: clubGappingCarryYd,
      latestReliableCarryYd: club.stock.latestReliableCarryYd,
      latestReliableCarryP25Yd: club.stock.latestReliableCarryP25Yd,
      latestReliableCarryP75Yd: club.stock.latestReliableCarryP75Yd,
      personalBestCarryYd: club.stock.personalBestCarryYd,
      playNumberYd: club.stock.coursePlayCarryYd,
      nextClubType: nextClub?.type ?? null,
      gapToNextYd: gapToNextYd === null ? null : Math.round(gapToNextYd * 10) / 10,
      targetCarryYd: null,
      targetPlayNumberYd: null,
      workOnYd: null,
      targetGapYd: null,
      targetMessage: "Need carry samples",
      targetTone: "slate",
      targetPriorityYd: 0,
      sampleSize: club.stock.sampleSize,
      confidenceScore: club.stock.confidenceScore,
      decisionLabel: club.decisionLabel,
      averageLaunchAngleDeg: club.stock.averageLaunchAngleDeg,
    };
  });

  return buildPersonalGappingTargets(baseRows, {
    handicapBand: options.handicapBand,
  });
}

function shouldShowInCarryGapping(club: BagClub) {
  if (!club.isShortGameTouch) {
    return true;
  }

  return (club.stock.bestStockCarryYd ?? 0) >= SAND_WEDGE_STOCK_MIN_CARRY_YD;
}

function buildTargetDistanceRows(bag: BagClub[], gappingRows: GappingRow[]): TargetDistanceRow[] {
  const stockRows: TargetDistanceRow[] = gappingRows.map((row) => ({
    id: row.id,
    clubType: row.clubType,
    carryYd: row.carryYd,
    latestReliableCarryYd: row.latestReliableCarryYd,
    playNumberYd: row.playNumberYd,
    sampleSize: row.sampleSize,
    confidenceScore: row.confidenceScore,
    shotRole: "stock",
  }));
  const touchRows: TargetDistanceRow[] = bag
    .filter((club) => club.isShortGameTouch && club.touch.sampleSize > 0)
    .flatMap((club) => {
      const touchPlayNumberYd =
        club.touch.carryMedianYd ?? club.touch.carryP75Yd ?? club.touch.longestCarryYd;
      const touchMaxYd = club.touch.longestCarryYd ?? club.touch.carryP75Yd ?? touchPlayNumberYd;

      if (touchPlayNumberYd === null || touchMaxYd === null) {
        return [];
      }

      return [
        {
          id: `${club.id}:touch`,
          clubType: club.type,
          carryYd: touchPlayNumberYd,
          playNumberYd: touchPlayNumberYd,
          sampleSize: club.touch.sampleSize,
          confidenceScore: Math.min(90, Math.round((club.touch.sampleSize / 50) * 100)),
          shotRole: "touch",
          touchMinYd: club.touch.carryP25Yd,
          touchMedianYd: club.touch.carryMedianYd,
          touchMaxYd,
        } satisfies TargetDistanceRow,
      ];
    });

  return [...stockRows, ...touchRows];
}

function CourseDecisionPanel({ advice }: { advice: CourseDecisionAdvice[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="On-course decisions"
        description="Recommended-number reminders from the current bag map."
        action={<MapPinned className="size-5 text-sky-500" />}
      />
      <CardContent>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-2 xl:grid-cols-4"
          items={advice.map((item) => ({
            label: item.label,
            value: item.value,
            detail: item.detail,
            tone: item.tone,
            href: item.clubId ? `/bag/${item.clubId}` : undefined,
          }))}
        />
      </CardContent>
    </DataPanel>
  );
}

function BagSocialComparison({
  bestClub,
  leaderboardOptedIn,
  challenges,
}: {
  bestClub: Awaited<ReturnType<typeof getBag>>[number] | null;
  leaderboardOptedIn: boolean;
  challenges: ChallengeListItem[];
}) {
  const challenge = findRelevantChallenge(challenges, bestClub?.type);

  return (
    <DataPanel>
      <SectionHeader
        title="Friend comparison"
        description="Only shown as an opt-in leaderboard prompt. Bag data stays private unless profile visibility allows it."
        action={<Users className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="trust-indicator rounded-lg p-3 text-sm leading-6 text-muted-foreground">
          {leaderboardOptedIn && bestClub
            ? `${formatClubType(bestClub.type)} is your most trusted active club. Compare it through friend boards or a private challenge when you want a fair opt-in benchmark.`
            : "Leaderboard comparison is off in your profile, so this page is keeping the bag readout private."}
        </div>
        <Button asChild variant="outline" className="w-fit">
          <Link
            href={leaderboardOptedIn && challenge ? `/challenges/${challenge.id}` : "/profile"}
            prefetch={false}
          >
            <Users className="size-4" />
            {leaderboardOptedIn && challenge ? "Open challenge" : "Privacy settings"}
          </Link>
        </Button>
      </CardContent>
    </DataPanel>
  );
}

function CarryGappingTable({ rows }: { rows: GappingRow[] }) {
  const targetGapYd = rows.find((row) => row.targetGapYd !== null)?.targetGapYd ?? null;

  return (
    <Card className="premium-card">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-xl tracking-normal sm:text-2xl">Carry gapping</CardTitle>
        <CardDescription className="hidden sm:block">
          Recommended is the course number. Best stock, latest reliable, and personal best stay
          visible by club.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:space-y-5 sm:p-6 sm:pt-0">
        {targetGapYd !== null ? (
          <>
            <MobileAccordionSection
              title="Gapping targets"
              description="Target gap and priorities."
              count={`${rows.length} clubs`}
            >
              <GappingRecommendations rows={rows} targetGapYd={targetGapYd} compact />
            </MobileAccordionSection>
            <div className="hidden sm:block">
              <GappingRecommendations rows={rows} targetGapYd={targetGapYd} />
            </div>
          </>
        ) : null}
        <CarryGappingBars rows={rows} />
        <MobileAccordionSection title="Full gapping table" count={`${rows.length} clubs`}>
          <MobileDataList>
            {rows.map((row) => (
              <MobileDataCard
                key={row.id}
                href={`/bag/${row.id}`}
                title={formatClubType(row.clubType)}
                subtitle={row.brandModel}
                action={<GapBadge row={row} />}
              >
                <DataPair
                  label="Best stock"
                  value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`}
                />
                <DataPair label="Latest reliable" value={formatLatestReliable(row)} />
                <DataPair
                  label="Recommended"
                  value={`${formatMetric(row.playNumberYd)}${row.playNumberYd === null ? "" : " yd"}`}
                />
                <DataPair
                  label="Personal best"
                  value={`${formatMetric(row.personalBestCarryYd)}${row.personalBestCarryYd === null ? "" : " yd"}`}
                />
                <DataPair
                  label="Target"
                  value={`${formatMetric(row.targetCarryYd)}${row.targetCarryYd === null ? "" : " yd"}`}
                />
                <DataPair label="Work on" value={<WorkOnBadge row={row} />} />
                <DataPair label="Decision" value={`${row.confidenceScore}% ${row.decisionLabel}`} />
              </MobileDataCard>
            ))}
          </MobileDataList>
        </MobileAccordionSection>
        <div className="hidden sm:block">
          <DataTableFrame>
            <Table className="min-w-[1220px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Best stock</TableHead>
                  <TableHead className="text-right">Latest reliable</TableHead>
                  <TableHead className="text-right">Recommended</TableHead>
                  <TableHead className="text-right">Personal best</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Work on</TableHead>
                  <TableHead className="text-right">Sample</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/bag/${row.id}`}
                        className="font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        {formatClubType(row.clubType)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground">
                      {row.brandModel}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMetric(row.carryYd)}
                      {row.carryYd === null ? "" : " yd"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">
                        {formatMetric(row.latestReliableCarryYd)}
                        {row.latestReliableCarryYd === null ? "" : " yd"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCarryRange(
                          row.latestReliableCarryP25Yd,
                          row.latestReliableCarryP75Yd,
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMetric(row.playNumberYd)}
                      {row.playNumberYd === null ? "" : " yd"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMetric(row.personalBestCarryYd)}
                      {row.personalBestCarryYd === null ? "" : " yd"}
                    </TableCell>
                    <TableCell className="text-right">
                      <GapBadge row={row} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">
                        {formatMetric(row.targetCarryYd)}
                        {row.targetCarryYd === null ? "" : " yd"}
                      </span>
                      {row.targetPlayNumberYd === null ? null : (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.targetPlayNumberYd} play
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <WorkOnBadge row={row} />
                    </TableCell>
                    <TableCell className="text-right">{row.sampleSize}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{row.confidenceScore}%</span>
                      <span className="ml-2 text-muted-foreground">{row.decisionLabel}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      </CardContent>
    </Card>
  );
}

function GappingRecommendations({
  rows,
  targetGapYd,
  compact = false,
}: {
  rows: GappingRow[];
  targetGapYd: number;
  compact?: boolean;
}) {
  const priorities = rows
    .filter(
      (row): row is GappingRow & { workOnYd: number; targetCarryYd: number } =>
        row.workOnYd !== null && row.targetCarryYd !== null,
    )
    .filter((row) => row.targetPriorityYd > 0)
    .sort((left, right) => right.targetPriorityYd - left.targetPriorityYd)
    .slice(0, 3);

  return (
    <div
      className={compact ? "grid gap-3" : "apple-panel grid gap-3 p-4 lg:grid-cols-[0.7fr_1.3fr]"}
    >
      <div className="apple-panel-strong p-3 sm:p-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Target gap
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-normal sm:mt-2 sm:text-4xl">
          {numberFormatter.format(targetGapYd)} yd
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Personal gap from your current recommended carries. Progress targets are capped by club
          type, confidence, and handicap band.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {priorities.length > 0 ? (
          <div className="md:col-span-3">
            <CompactReadoutGrid
              columnsClassName="md:grid-cols-3"
              items={priorities.map((row) => ({
                label: formatClubType(row.clubType),
                value: `${numberFormatter.format(row.targetCarryYd)} yd next step`,
                detail: workOnText(row),
                tone: row.targetTone,
                href: `/bag/${row.id}`,
              }))}
            />
          </div>
        ) : (
          <div className="apple-panel-strong p-4 md:col-span-3">
            <p className="font-semibold">Distances are in a healthy window</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No club needs a distance chase from the current bag data. Keep prioritising strike
              consistency and predictable carry.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function workOnText(row: Pick<GappingRow, "targetMessage">) {
  return row.targetMessage;
}

function CarryGappingBars({ rows }: { rows: GappingRow[] }) {
  const maxCarry = maxVisualCarryYd(rows);

  return (
    <div className="apple-panel grid gap-3 p-3 sm:p-4">
      {rows.map((row) => {
        const visualCarry = visualCarryYd(row);
        const width = carryWidthPercent(visualCarry, maxCarry);

        return (
          <Link
            key={row.id}
            href={`/bag/${row.id}`}
            className="grid gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-white/80"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{formatClubType(row.clubType)}</span>
              {carryBarReadout(row)}
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function carryBarReadout(row: GappingRow) {
  if (row.playNumberYd !== null) {
    return (
      <span className="grid gap-0.5 text-right leading-tight">
        <span className="font-semibold text-slate-900">
          {formatMetric(row.playNumberYd)} yd recommended
        </span>
        <span className="text-xs text-muted-foreground">
          {formatCarryYards(row.carryYd)} best stock
        </span>
      </span>
    );
  }

  if (row.carryYd !== null) {
    return (
      <span className="grid gap-0.5 text-right leading-tight">
        <span className="font-semibold text-slate-900">{formatMetric(row.carryYd)} yd stock</span>
        <span className="text-xs text-muted-foreground">recommended building</span>
      </span>
    );
  }

  return <span className="text-slate-700">Needs calibration</span>;
}

function carryWidthPercent(carryYd: number | null, maxCarry: number) {
  if (carryYd === null || carryYd <= 0 || maxCarry <= 0) {
    return 0;
  }

  return Math.max(8, ((carryYd ?? 0) / maxCarry) * 100);
}

function GapBadge({ row }: { row: GappingRow }) {
  const gapYd = row.gapToNextYd;

  if (gapYd === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const tone =
    gapYd < 8 && isSevereGapCompression(row)
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : gapYd < 8
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : gapYd > 18
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}
    >
      {numberFormatter.format(gapYd)} yd
    </span>
  );
}

function WorkOnBadge({
  row,
}: {
  row: Pick<GappingRow, "workOnYd" | "targetMessage" | "targetTone">;
}) {
  if (row.workOnYd === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const label =
    row.workOnYd > 0 ? `Potential +${numberFormatter.format(row.workOnYd)} yd` : row.targetMessage;

  return (
    <span
      className={`inline-flex min-w-28 max-w-48 justify-center rounded-full border px-2 py-1 text-center text-xs font-semibold leading-snug ${targetToneClass(
        row.targetTone,
      )}`}
    >
      {label}
    </span>
  );
}

function targetToneClass(tone: GappingTargetTone) {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (tone === "pink") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function intelligenceToneClass(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (tone === "pink") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function pathTrendStatusTone(status: PathTrendTracking["status"]) {
  if (status === "neutralising") {
    return "green";
  }

  if (status === "stable") {
    return "sky";
  }

  if (status === "widening") {
    return "amber";
  }

  return "slate";
}

function pathTrendStatusLabel(status: PathTrendTracking["status"]) {
  if (status === "neutralising") {
    return "Neutralising";
  }

  if (status === "stable") {
    return "Stable";
  }

  if (status === "widening") {
    return "Widening";
  }

  return "Building";
}

function facePathPatternTone(patternCode: string) {
  if (patternCode === "E") {
    return "green";
  }

  if (patternCode === "G" || patternCode === "F" || patternCode === "H" || patternCode === "B") {
    return "sky";
  }

  if (patternCode === "D" || patternCode === "C") {
    return "amber";
  }

  if (patternCode === "A" || patternCode === "I") {
    return "pink";
  }

  return "slate";
}

function FacePathDiagram({
  point,
  diagramKey,
}: {
  point: Pick<
    PathTrendTracking["points"][number],
    "label" | "patternLabel" | "pathDeg" | "faceDeg"
  >;
  diagramKey?: string;
}) {
  const markerSuffix = (diagramKey ?? point.label).replace(/[^a-zA-Z0-9_-]/g, "-");
  const pathLine = facePathLine(point.pathDeg, 92);
  const faceLine = facePathLine(point.faceDeg, 100);

  return (
    <svg
      className="mt-3 h-40 w-full rounded-lg border border-slate-200 bg-[#F5F6F4]"
      viewBox="0 0 240 150"
      role="img"
      aria-label={`${point.label} ${point.patternLabel} face-to-path diagram`}
    >
      <defs>
        <marker
          id={`path-arrow-${markerSuffix}`}
          markerHeight="7"
          markerWidth="7"
          orient="auto"
          refX="6"
          refY="3.5"
        >
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#dc2626" />
        </marker>
        <marker
          id={`face-arrow-${markerSuffix}`}
          markerHeight="7"
          markerWidth="7"
          orient="auto"
          refX="6"
          refY="3.5"
        >
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#0f172a" />
        </marker>
      </defs>
      <line x1="28" y1="82" x2="216" y2="82" stroke="#94a3b8" strokeDasharray="7 6" />
      <line x1="206" y1="22" x2="206" y2="132" stroke="#cbd5e1" strokeDasharray="5 7" />
      <circle cx="206" cy="82" r="5" fill="#fff" stroke="#64748b" strokeWidth="1.5" />
      {pathLine ? (
        <line
          x1={pathLine.x1}
          y1={pathLine.y1}
          x2={pathLine.x2}
          y2={pathLine.y2}
          stroke="#dc2626"
          strokeLinecap="round"
          strokeWidth="7"
          markerEnd={`url(#path-arrow-${markerSuffix})`}
          opacity="0.72"
        />
      ) : null}
      {faceLine ? (
        <line
          x1={faceLine.x1}
          y1={faceLine.y1}
          x2={faceLine.x2}
          y2={faceLine.y2}
          stroke="#0f172a"
          strokeLinecap="round"
          strokeWidth="4"
          markerEnd={`url(#face-arrow-${markerSuffix})`}
        />
      ) : null}
      <text x="31" y="34" fill="#475569" fontSize="11" fontWeight="600">
        Target
      </text>
      <text x="127" y="31" fill="#475569" fontSize="11" fontWeight="600">
        Right / push
      </text>
      <text x="127" y="132" fill="#475569" fontSize="11" fontWeight="600">
        Left / pull
      </text>
    </svg>
  );
}

function facePathLine(value: number | null, length: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const baseX = 206;
  const baseY = 82;
  const angle = Math.max(-55, Math.min(55, value));
  const radians = (angle * Math.PI) / 180;

  return {
    x1: baseX,
    y1: baseY,
    x2: Math.round((baseX - Math.cos(radians) * length) * 10) / 10,
    y2: Math.round((baseY - Math.sin(radians) * length) * 10) / 10,
  };
}

function PatternOverlaySvg({ overlay }: { overlay: ShotPatternOverlaySummary }) {
  const carryP10 = overlay.carryP10Yd ?? 0;
  const carryP50 = overlay.carryP50Yd ?? carryP10;
  const carryP90 = overlay.carryP90Yd ?? carryP50;
  const maxCarry = Math.max(1, carryP90);
  const maxSide = Math.max(20, Math.abs(overlay.sideP10Yd ?? 0), Math.abs(overlay.sideP90Yd ?? 0));
  const xLeft = 120 + ((overlay.sideP10Yd ?? 0) / maxSide) * 88;
  const xRight = 120 + ((overlay.sideP90Yd ?? 0) / maxSide) * 88;
  const yNear = 122 - (carryP10 / maxCarry) * 92;
  const yMiddle = 122 - (carryP50 / maxCarry) * 92;
  const yFar = 122 - (carryP90 / maxCarry) * 92;

  return (
    <svg
      viewBox="0 0 240 140"
      role="img"
      aria-label={`${overlay.label} shot pattern overlay`}
      className="mt-3 h-36 w-full rounded-lg border border-slate-200 bg-white"
    >
      <rect width="240" height="140" fill="#F8FAFC" />
      <line x1="120" x2="120" y1="16" y2="126" stroke="#CBD5E1" strokeDasharray="4 4" />
      <line x1="28" x2="212" y1="122" y2="122" stroke="#E2E8F0" />
      <polygon
        points={`${xLeft},${yNear} ${xRight},${yNear} ${xRight},${yFar} ${xLeft},${yFar}`}
        fill="#DCFCE7"
        opacity="0.75"
        stroke="#16A34A"
      />
      <circle cx="120" cy={yMiddle} r="5" fill="#0F766E" />
      <text x="12" y="24" fill="#64748B" fontSize="10">
        left
      </text>
      <text x="210" y="24" textAnchor="end" fill="#64748B" fontSize="10">
        right
      </text>
      <text x="120" y="136" textAnchor="middle" fill="#64748B" fontSize="10">
        {formatCarryYards(carryP50)} median
      </text>
    </svg>
  );
}

function MiniDispersion({
  shots,
  accent,
  carryMedianYd,
}: {
  shots: StockShot[];
  accent: string;
  carryMedianYd: number | null;
}) {
  const visibleShots = shots.filter((shot) => shot.carryYd !== null).slice(0, 40);
  const maxCarry = Math.max(240, ...visibleShots.map((shot) => shot.carryYd ?? 0));
  const maxSide = Math.max(45, ...visibleShots.map((shot) => Math.abs(shot.sideCarryYd ?? 0)));

  return (
    <svg viewBox="0 0 360 150" className="h-36 w-full rounded-xl border bg-white/80">
      <rect x="0" y="0" width="360" height="150" fill="#f9fafb" />
      {[60, 120, 180, 240].map((yard) => {
        const y = 140 - (yard / maxCarry) * 120;
        return (
          <g key={yard}>
            <line x1="18" x2="344" y1={y} y2={y} stroke="#e5e7eb" />
            <text x="22" y={y - 4} fill="#9ca3af" fontSize="10">
              {yard}
            </text>
          </g>
        );
      })}
      <line x1="180" x2="180" y1="10" y2="140" stroke="#e5e7eb" />
      {carryMedianYd ? (
        <line
          x1="18"
          x2="344"
          y1={140 - (carryMedianYd / maxCarry) * 120}
          y2={140 - (carryMedianYd / maxCarry) * 120}
          stroke={accent}
          strokeDasharray="5 5"
          strokeOpacity="0.8"
        />
      ) : null}
      {visibleShots.map((shot, index) => {
        const x = 180 + ((shot.sideCarryYd ?? 0) / maxSide) * 145;
        const y = 140 - ((shot.carryYd ?? 0) / maxCarry) * 120;
        return <circle key={index} cx={x} cy={y} r="4" fill={accent} opacity="0.75" />;
      })}
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function ShotTrendBadge({ trend }: { trend: StockCarryTrend }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${stockTrendToneClass(
          trend.status,
        )}`}
        title={stockTrendTitle(trend)}
      >
        <StockTrendIcon status={trend.status} />
        {stockTrendLabel(trend.status)}
      </span>
      <span className="text-xs text-muted-foreground">{stockTrendDetail(trend)}</span>
    </div>
  );
}

function StockTrendIcon({ status }: { status: StockCarryTrend["status"] }) {
  if (status === "better") {
    return <TrendingUp className="size-3.5" />;
  }

  if (status === "worse") {
    return <TrendingDown className="size-3.5" />;
  }

  return <Minus className="size-3.5" />;
}

function stockTrendLabel(status: StockCarryTrend["status"]) {
  if (status === "better") {
    return "Trending better";
  }

  if (status === "worse") {
    return "Trending worse";
  }

  if (status === "steady") {
    return "Holding steady";
  }

  return "Trend building";
}

function stockTrendDetail(trend: StockCarryTrend) {
  if (trend.deltaYd === null) {
    return "Need 6 clean stock shots";
  }

  return `${formatSignedYards(trend.deltaYd)} vs previous shots`;
}

function stockTrendTitle(trend: StockCarryTrend) {
  if (trend.deltaYd === null) {
    return `${trend.latestSampleSize + trend.previousSampleSize} clean stock shots available`;
  }

  return `Latest ${trend.latestSampleSize}: ${formatMetric(
    trend.latestCarryMedianYd,
  )} yd; previous ${trend.previousSampleSize}: ${formatMetric(trend.previousCarryMedianYd)} yd`;
}

function stockTrendToneClass(status: StockCarryTrend["status"]) {
  if (status === "better") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "worse") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "steady") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatCarryRange(low: number | null, high: number | null) {
  if (low === null || high === null) {
    return "--";
  }

  return `${formatMetric(low)}-${formatMetric(high)} yd`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}%`;
}

function formatSignedDegrees(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)} deg`;
}

function formatSignedStrokes(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function formatLatestReliable(row: GappingRow) {
  if (row.latestReliableCarryYd === null) {
    return "--";
  }

  const range = formatCarryRange(row.latestReliableCarryP25Yd, row.latestReliableCarryP75Yd);

  return range === "--"
    ? `${formatMetric(row.latestReliableCarryYd)} yd`
    : `${formatMetric(row.latestReliableCarryYd)} yd · ${range}`;
}

function hasWedgeRoleReadout(club: BagClub) {
  const clubType = club.type.toLowerCase();

  return (
    ["pw", "gw", "aw", "sw", "lw"].includes(clubType) && club.stock.shotRoleSummaries.length > 0
  );
}

function roleSummaryFor(summaries: StockShotRoleSummary[], role: StockShotRole) {
  return summaries.find((summary) => summary.role === role) ?? null;
}

function wedgeRoleLabel(role: StockShotRole) {
  if (role === "chip-touch") {
    return "Chip/touch";
  }

  return role[0].toUpperCase() + role.slice(1);
}

function formatRoleRange(summary: StockShotRoleSummary) {
  const range = formatCarryRange(summary.carryP25Yd, summary.carryP75Yd);

  if (range === "--") {
    return `best ${formatMetric(summary.longestCarryYd)} yd`;
  }

  return `${range} · best ${formatMetric(summary.longestCarryYd)} yd`;
}

function formatStockExclusionReasons(reasons: BagClub["stock"]["stockExclusionReasons"]) {
  if (reasons.length === 0) {
    return "No exclusions in the current best-stock sample.";
  }

  return reasons
    .slice(0, 3)
    .map((reason) => `${reason.label}: ${reason.count}`)
    .join(" · ");
}

function formatBagDangerousMiss(stock: BagClub["stock"]) {
  const left = stock.dispersionLeftYd ?? 0;
  const right = stock.dispersionRightYd ?? 0;

  if (left === 0 && right === 0) {
    return "Needs side data";
  }

  if (left >= right) {
    return `${formatMetric(left)} yd left`;
  }

  return `${formatMetric(right)} yd right`;
}

function formatSignedYards(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)} yd`;
}
