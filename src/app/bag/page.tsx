import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bot,
  Brain,
  ChevronDown,
  Database,
  Gauge,
  Grid3X3,
  Layers3,
  MapPinned,
  Radar,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Target,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";

import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  commonAiPrompts,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Button } from "@/components/ui/button";
import { BagFeaturePanel } from "@/components/features/feature-panels";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { FacePathDeliveryChart } from "@/components/visuals/face-path-delivery-chart";
import { PageArtwork } from "@/components/visuals/page-artwork";
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
  PageShell,
  SectionHeader,
  StatusPill,
  StickyMobileAction,
} from "@/components/premium";
import {
  MobileAppShell,
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
  TableCaption,
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
  type WedgeMatrixShot,
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
import { buildClubEvolutionRows, type ClubEvolutionMeasuredPoint } from "@/lib/club-evolution";
import { ensureCurrentSocialProfile, getBlockedUserIds, getFriendIds } from "@/lib/social";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { getSpeedCoachCardData, type SpeedCentreSummary } from "@/lib/speed-training-data";
import { formatSpeed } from "@/lib/speed-training";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import { excludedRecordQualityTags, excludedRecordShotCategories } from "@/lib/shot-records";
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
import { ClubIntelligencePanel, type ClubIntelligenceItem } from "./club-intelligence-panel";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
});

const RECENT_SHOTS_PER_CLUB = 200;
const PEER_SHOT_QUERY_LIMIT = 3000;
const PEER_MIN_STOCK_SHOTS = 3;
const PERSONAL_STROKES_GAINED_LIMIT = 200;
const bagGappingColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "model", label: "Model" },
  { id: "best-stock", label: "Best stock" },
  { id: "latest-reliable", label: "Latest reliable" },
  { id: "recommended", label: "Recommended" },
  { id: "personal-best", label: "Personal best" },
  { id: "gap", label: "Gap" },
  { id: "target", label: "Target" },
  { id: "work-on", label: "Work on" },
  { id: "sample", label: "Sample" },
  { id: "decision", label: "Decision", locked: true },
];
const bagGappingSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Clubs below target",
    href: "/bag#reference-data",
    detail: "Review clubs where work-on and target fields show the next yardage job.",
  },
  {
    title: "Low confidence clubs",
    href: "/bag#bag-trust",
    detail: "Start with sample size and trust before changing the course number.",
  },
  {
    title: "Equipment impact",
    href: "/equipment",
    detail: "Compare bag changes against carry, gap and recommended-number movement.",
  },
];
const wedgeMatrixColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "full", label: "Full" },
  { id: "three-quarter", label: "3/4" },
  { id: "half", label: "Half" },
  { id: "status", label: "Status", locked: true },
];
const wedgeMatrixSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Shot explorer",
    href: "/shots",
    detail: "Filter wedge shots by club, shot type and quality before trusting the matrix.",
  },
  {
    title: "Practice planner",
    href: "/practice",
    detail: "Build a scoring-end session from the weakest partial carry window.",
  },
  {
    title: "Full bag gapping",
    href: "/bag#reference-data",
    detail: "Compare partial wedge windows against the full bag carry ladder.",
  },
];
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
    peers?: string | string[];
  }>;
};

const WEDGE_ROLE_ORDER: StockShotRole[] = ["full", "pitch", "chip-touch"];
const STICKY_BAG_SUMMARY_TYPES = ["driver", "5w", "7i", "pw", "sw"] as const;
const EVOLUTION_SHOTS_PER_CLUB = 1200;

const bagShotSelect = {
  id: shots.id,
  sessionId: shots.sessionId,
  clubId: shots.clubId,
  clubType: shots.clubType,
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
  faceAngleDeg: shots.faceAngleDeg,
  spinRate: shots.spinRate,
  smashFactor: shots.smashFactor,
  spinAxis: shots.spinAxis,
  courseHoleNumber: shots.courseHoleNumber,
  sessionType: sessions.type,
  shotCategory: shots.shotCategory,
  qualityTag: shots.qualityTag,
};

export default async function BagPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const personalBestMetric = parsePersonalBestMetric(resolvedSearchParams.pb);
  const peerBenchmarksLoaded = shouldLoadPeerBenchmarks(resolvedSearchParams.peers);
  const [bag, profile, challengeData, featureData, personalStrokesGainedEvents, speedSummary] =
    await Promise.all([
      getBag(),
      ensureCurrentSocialProfile(),
      getBagChallengeData(),
      getFeatureIdeasData(),
      getPersonalStrokesGainedEvents(),
      getBagSpeedSummary(),
    ]);
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
    benchmarkRows.length > 0 && peerBenchmarksLoaded
      ? await getPeerBenchmarkSummary(benchmarkRows)
      : emptyPeerSummary();
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
  const weakestClub = findWeakestClub(stockConfidenceClubs);
  const biggestOpportunity = smartBagBuilder.suggestions[0] ?? null;
  const currentGapRisk = buildCurrentGapRisk(gappingRows);
  const bagScoreTrend = buildBagScoreTrend(bag, {
    handicapBand: profile.handicapBand,
  });
  const clubIntelligenceItems = buildClubIntelligenceItems(bag);
  const bagWorkbenchPrompts = [
    {
      label: "Explain bag confidence",
      prompt:
        "Explain my ForeKingHell bag confidence using the visible bag score, club trust, gapping and data-health evidence. Do not invent missing yardages.",
      icon: Brain,
    },
    {
      label: "Which club is weak?",
      prompt:
        "Identify the club dragging down my bag confidence. Use visible trust, shot count, dispersion and gapping evidence, and call out low sample sizes.",
      icon: AlertTriangle,
    },
    {
      label: "Build practice plan",
      prompt:
        "Build a bag-focused practice plan from my current ForeKingHell bag evidence. Prioritise course-useful confidence and scoring-zone gaps.",
      icon: Target,
    },
    {
      label: "Equipment impact",
      prompt:
        "Summarise likely equipment or gapping actions from this bag workspace. Separate evidence-backed recommendations from low-confidence ideas.",
      icon: ShoppingBag,
    },
  ];

  return (
    <PageShell contentClassName="overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5">
      <MobileAppShell>
        <MobileTopBar title="Bag" />
        <MobileTabBar
          activeKey="gapping"
          className="-mt-4 text-sm"
          tabs={[
            { key: "gapping", label: "Health", href: "/bag" },
            { key: "clubs", label: "Clubs", href: "#club-intelligence" },
            { key: "decisions", label: "Reference", href: "#reference-data" },
            { key: "longest", label: "Longest", href: "/bag/longest" },
          ]}
        />
        <MobileBentoSummary
          items={[
            {
              label: "Bag score",
              value: `${smartBagBuilder.currentScore}%`,
              detail: smartBagBuilder.scoreLabel,
              tone: smartBagBuilder.currentScore >= 85 ? "green" : "amber",
            },
            {
              label: "Confidence",
              value: `${averageConfidence}%`,
              detail: `${bag.length} clubs · ${totalShots} shots`,
              tone: averageConfidence >= 75 ? "green" : "sky",
            },
            {
              label: "Opportunity",
              value: biggestOpportunity?.title ?? "Clean",
              detail: biggestOpportunity?.detail ?? "No urgent move",
              tone: biggestOpportunity ? "amber" : "green",
            },
            {
              label: "Gap risk",
              value: currentGapRisk.value,
              detail: currentGapRisk.detail,
              tone: currentGapRisk.tone,
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
              value: "benchmarks",
              title: "Distance benchmarks",
              description: "Carry, speed, smash, height, land angle and peers.",
              summary: benchmarkRows.length > 0 ? `${benchmarkRows.length} clubs` : "Building",
              children:
                benchmarkRows.length > 0 ? (
                  <DistanceBenchmarkPanel
                    rows={benchmarkRows}
                    peerSummary={peerBenchmarkSummary}
                    peerBenchmarksLoaded={peerBenchmarksLoaded}
                  />
                ) : (
                  <NativeListSection title="Distance benchmarks">
                    <p className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm leading-5 text-[#6B7280]">
                      Import more stock shots to unlock club speed, smash and peer benchmarks.
                    </p>
                  </NativeListSection>
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
                  <NativeListSection title="Target lookup">
                    <TargetDistanceSelector rows={targetDistanceRows} initialTargetYd={150} />
                  </NativeListSection>
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
                  <MobileClubArtworkCarousel clubs={bag} />
                </div>
              ),
            },
            {
              value: "fitting",
              title: "Fitting",
              description: "Feature checks, target links and club identities.",
              summary: "Full analysis",
              children: <BagFeaturePanel data={featureData} compactMobile />,
            },
          ]}
        />
        <StickyMobileAction>
          <Button asChild className="premium-action w-full rounded-lg">
            <Link
              href={
                currentGapRisk.href ?? "/practice?source=bag&intent=latest_weakness#practice-plan"
              }
              prefetch={false}
            >
              <Target className="size-4" aria-hidden />
              Review next bag move
            </Link>
          </Button>
        </StickyMobileAction>
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

      <DesktopWorkbenchLayout
        scope="bag"
        className="hidden lg:grid"
        railBreakpoint="wide"
        rail={
          <DesktopInsightRail
            title="AI bag rail"
            description="Club trust, gaps and equipment actions stay visible while reviewing the bag."
            metrics={[
              {
                label: "Bag score",
                value: `${smartBagBuilder.currentScore}%`,
                detail: smartBagBuilder.scoreLabel,
                tone: smartBagBuilder.currentScore >= 85 ? "green" : "amber",
              },
              {
                label: "Average confidence",
                value: `${averageConfidence}%`,
                detail: `${bag.length} clubs and ${totalShots.toLocaleString(
                  "en-GB",
                )} shots feed this readout.`,
                tone: averageConfidence >= 75 ? "green" : "sky",
              },
              {
                label: "Gap risk",
                value: currentGapRisk.value,
                detail: currentGapRisk.detail,
                tone: currentGapRisk.tone,
              },
              {
                label: "Next action",
                value: biggestOpportunity ? "Review" : "Maintain",
                detail: biggestOpportunity?.detail ?? "No urgent equipment or gapping move.",
                tone: biggestOpportunity ? "amber" : "green",
              },
            ]}
            evidence={[
              "Recommended course numbers stay primary; Best Stock remains supporting context.",
              "Weak or low-shot clubs should be treated as low confidence, especially wedges.",
              "Gapping and equipment actions should cite visible club trust and shot evidence.",
            ]}
            prompts={[...bagWorkbenchPrompts, ...commonAiPrompts("bag intelligence").slice(1, 3)]}
            actions={[
              {
                label: "Shot explorer",
                href: "/shots",
                detail: "Open the raw shot evidence behind club trust.",
                icon: Database,
              },
              {
                label: "Compare",
                href: "/compare",
                detail: "Review club or session changes side by side.",
                icon: Layers3,
              },
              {
                label: "Practice planner",
                href: "/practice",
                detail: "Turn the bag issue into a practice block.",
                icon: Target,
              },
            ]}
          />
        }
      >
        <BagHealthHero
          bagScore={smartBagBuilder.currentScore}
          scoreLabel={smartBagBuilder.scoreLabel}
          confidence={averageConfidence}
          dataTrust={featureData.dataHealth.metric ?? "--"}
          dataTrustDetail={featureData.dataHealth.status ?? "Data health building"}
          shots={totalShots}
          clubs={bag.length}
          strongestClub={bestClub}
          weakestClub={weakestClub}
          biggestOpportunity={biggestOpportunity}
          currentGapRisk={currentGapRisk}
          trend={bagScoreTrend}
        />

        {speedSummary ? <BagSpeedPotentialPanel summary={speedSummary} /> : null}

        <MobileSectionChips
          items={[
            { label: "Health", href: "#bag-health" },
            { label: "Core", href: "#core-intelligence" },
            { label: "Club", href: "#club-intelligence" },
            { label: "Analytics", href: "#advanced-analytics" },
            { label: "Equipment", href: "#equipment-development" },
            { label: "Reference", href: "#reference-data" },
          ]}
        />

        <BagStickySummary rows={gappingRows} />

        <section id="core-intelligence" className="grid min-w-0 scroll-mt-28 gap-4">
          <BagZoneHeader
            eyebrow="Core bag intelligence"
            title="How healthy is the bag?"
            description="Confidence, gapping and movement sit together so the first screen explains the bag rather than sending you club by club."
          />
          <BagConfidenceLadder
            rows={gappingRows}
            maxCarryYd={maxDisplayCarry}
            findings={bagDoctorFindings}
          />
          <ClubEvolutionPanel clubs={bag} />
        </section>

        <ClubIntelligencePanel
          clubs={clubIntelligenceItems}
          initialClubId={bestClub?.id ?? bag[0]?.id}
        />

        <section id="advanced-analytics" className="grid min-w-0 scroll-mt-28 gap-4">
          <BagZoneHeader
            eyebrow="Advanced analytics"
            title="Why does the bag behave like this?"
            description="The diagnostic modules now live together: confidence windows, face-to-path, pattern overlays and personal strokes gained."
          />
          <div className="grid gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <ConfidenceHeatMapPanel heatMaps={confidenceHeatMaps} />
              <ShotPatternOverlayPanel overlays={shotPatternOverlays} />
            </div>
            <PathTrendPanel trend={pathTrend} />
            <PersonalStrokesGainedModelPanel model={personalStrokesGained} />
          </div>
        </section>

        <section id="equipment-development" className="grid min-w-0 scroll-mt-28 gap-4">
          <BagZoneHeader
            eyebrow="Equipment development"
            title="What should change next?"
            description="Gap-wedge integration, wedge windows and equipment decisions are grouped as development work, not scattered through the readout."
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <SmartBagBuilderPanel model={smartBagBuilder} />
            <WedgeMatrixPanel matrix={wedgeMatrix} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AiCaddiePanel cards={aiCaddieCards} />
            <BagFeaturePanel data={featureData} />
          </div>
          {wedgeRoleClubs.length > 0 ? <WedgeRolePanel clubs={wedgeRoleClubs} /> : null}
        </section>

        <section id="reference-data" className="grid min-w-0 scroll-mt-28 gap-4">
          <BagZoneHeader
            eyebrow="Reference data"
            title="Useful detail, kept out of the first read"
            description="Personal bests, target lookup, benchmarks, gapping tables and course reminders are still here, but they no longer dominate the bag readout."
          />
          <PersonalBestSnapshotPanel clubs={bag} />
          <TargetDistanceSelector rows={targetDistanceRows} initialTargetYd={150} />
          {benchmarkRows.length > 0 ? (
            <BenchmarkReferencePanel
              rows={benchmarkRows}
              peerSummary={peerBenchmarkSummary}
              peerBenchmarksLoaded={peerBenchmarksLoaded}
            />
          ) : null}
          {gappingRows.length > 0 ? <CarryGappingTable rows={gappingRows} /> : null}
          <CourseDecisionPanel advice={courseAdvice} />
          {stockFilterClubs.length > 0 ? <StockFilterPanel clubs={stockFilterClubs} /> : null}
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
      </DesktopWorkbenchLayout>
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

async function getBagSpeedSummary(): Promise<SpeedCentreSummary | null> {
  try {
    const userId = await requireCurrentUserId();
    const data = await getSpeedCoachCardData(userId);
    return data.summary;
  } catch (error) {
    console.error("[bag] Speed summary unavailable", error);
    return null;
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
  if (allClubMemberIds.length === 0) {
    return [];
  }

  const excludedRecordQualityValues = sql.join(
    excludedRecordQualityTags.map((tag) => sql`${tag}`),
    sql`, `,
  );
  const excludedRecordCategoryValues = sql.join(
    excludedRecordShotCategories.map((category) => sql`${category}`),
    sql`, `,
  );

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
              sql`lower(coalesce(${shots.qualityTag}, '')) not in (${excludedRecordQualityValues})`,
              sql`lower(coalesce(${shots.shotCategory}, '')) not in (${excludedRecordCategoryValues})`,
              sql`lower(${sessions.source}) not in ('manual', 'manual_edit')`,
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

  const rankedClubShots = db
    .select({
      ...bagShotSelect,
      clubRank: sql<number>`row_number() over (
        partition by ${shots.clubType}
        order by ${shots.shotAt} desc, ${shots.shotNumber} desc nulls last
      )`.as("club_rank"),
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .where(
      and(
        eq(shots.userId, userId),
        eq(sessions.userId, userId),
        inArray(shots.clubId, allClubMemberIds),
      ),
    )
    .as("ranked_club_shots");

  const rankedBagShotSelect = {
    id: rankedClubShots.id,
    sessionId: rankedClubShots.sessionId,
    clubId: rankedClubShots.clubId,
    clubType: rankedClubShots.clubType,
    shotNumber: rankedClubShots.shotNumber,
    shotAt: rankedClubShots.shotAt,
    carryYd: rankedClubShots.carryYd,
    totalYd: rankedClubShots.totalYd,
    sideCarryYd: rankedClubShots.sideCarryYd,
    ballSpeedMph: rankedClubShots.ballSpeedMph,
    clubSpeedMph: rankedClubShots.clubSpeedMph,
    launchAngleDeg: rankedClubShots.launchAngleDeg,
    launchDirectionDeg: rankedClubShots.launchDirectionDeg,
    apexFt: rankedClubShots.apexFt,
    descentAngleDeg: rankedClubShots.descentAngleDeg,
    attackAngleDeg: rankedClubShots.attackAngleDeg,
    clubPathDeg: rankedClubShots.clubPathDeg,
    faceAngleDeg: rankedClubShots.faceAngleDeg,
    spinRate: rankedClubShots.spinRate,
    smashFactor: rankedClubShots.smashFactor,
    spinAxis: rankedClubShots.spinAxis,
    courseHoleNumber: rankedClubShots.courseHoleNumber,
    sessionType: rankedClubShots.sessionType,
    shotCategory: rankedClubShots.shotCategory,
    qualityTag: rankedClubShots.qualityTag,
  };

  const [recentShotRows, evolutionShotRows, shotCountRows] = await Promise.all([
    db
      .select({
        ...rankedBagShotSelect,
      })
      .from(rankedClubShots)
      .where(lte(rankedClubShots.clubRank, RECENT_SHOTS_PER_CLUB))
      .orderBy(desc(rankedClubShots.shotAt), desc(rankedClubShots.shotNumber)),
    db
      .select({
        ...rankedBagShotSelect,
      })
      .from(rankedClubShots)
      .where(lte(rankedClubShots.clubRank, EVOLUTION_SHOTS_PER_CLUB))
      .orderBy(desc(rankedClubShots.shotAt), desc(rankedClubShots.shotNumber)),
    db
      .select({
        clubType: shots.clubType,
        value: count(),
      })
      .from(shots)
      .where(and(eq(shots.userId, userId), inArray(shots.clubId, allClubMemberIds)))
      .groupBy(shots.clubType),
  ]);

  const recentShotsByClubType = new Map<string, typeof recentShotRows>();
  for (const shot of recentShotRows) {
    const existing = recentShotsByClubType.get(shot.clubType) ?? [];
    existing.push(shot);
    recentShotsByClubType.set(shot.clubType, existing);
  }

  const evolutionShotsByClubType = new Map<string, typeof evolutionShotRows>();
  for (const shot of evolutionShotRows) {
    const existing = evolutionShotsByClubType.get(shot.clubType) ?? [];
    existing.push(shot);
    evolutionShotsByClubType.set(shot.clubType, existing);
  }

  const shotCountByClubType = new Map(shotCountRows.map((row) => [row.clubType, row.value]));

  const clubData = mergedClubRows.map((club) => ({
    club,
    recentShots: recentShotsByClubType.get(club.type) ?? [],
    evolutionShots: evolutionShotsByClubType.get(club.type) ?? [],
    personalBestRows: club.memberIds.flatMap((clubId) =>
      personalBestByClubId.get(clubId) ? [personalBestByClubId.get(clubId)!] : [],
    ),
    rawShotCount: shotCountByClubType.get(club.type) ?? 0,
  }));

  return clubData
    .filter(({ club }) => isTrackedClubType(club.type))
    .map(({ club, recentShots, evolutionShots, personalBestRows, rawShotCount }) => {
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
        evolutionShots,
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

type BagGapRisk = {
  label: string;
  value: string;
  detail: string;
  tone: BagDoctorFinding["tone"];
  href?: string;
};

type BagScoreTrendPoint = {
  key: string;
  label: string;
  score: number;
  detail: string;
  tone: BagDoctorFinding["tone"];
};

function BagSpeedPotentialPanel({ summary }: { summary: SpeedCentreSummary }) {
  const carryGain = summary.carryProjection.carryGainYd;
  const projectedCarry =
    summary.carryProjection.targetCarryYd === null
      ? "Set target"
      : formatProjectedCarry(summary.carryProjection.targetCarryYd, carryGain);

  return (
    <DataPanel>
      <SectionHeader
        title="Speed potential"
        description="Read-only speed projection from Speed Centre; bag recommendations stay unchanged."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/speed" prefetch={false}>
              <Gauge className="size-4" />
              Speed Centre
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 p-4 md:grid-cols-4">
        <DataPair label="Driver speed" value={formatSpeed(summary.currentSpeedMph)} />
        <DataPair label="Target speed" value={formatSpeed(summary.targetSpeedMph)} />
        <DataPair
          label="Current carry"
          value={formatCarryYards(summary.carryProjection.currentCarryYd)}
        />
        <DataPair label="Projected carry" value={projectedCarry} />
      </div>
    </DataPanel>
  );
}

function formatProjectedCarry(targetCarryYd: number, carryGainYd: number | null) {
  const gainSuffix =
    carryGainYd === null
      ? ""
      : ` (${carryGainYd >= 0 ? "+" : ""}${numberFormatter.format(carryGainYd)} yd)`;

  return `${formatCarryYards(targetCarryYd)}${gainSuffix}`;
}

function BagHealthHero({
  bagScore,
  scoreLabel,
  confidence,
  dataTrust,
  dataTrustDetail,
  shots,
  clubs,
  strongestClub,
  weakestClub,
  biggestOpportunity,
  currentGapRisk,
  trend,
}: {
  bagScore: number;
  scoreLabel: string;
  confidence: number;
  dataTrust: string;
  dataTrustDetail: string;
  shots: number;
  clubs: number;
  strongestClub: BagClub | null;
  weakestClub: BagClub | null;
  biggestOpportunity: SmartBagBuilder["suggestions"][number] | null;
  currentGapRisk: BagGapRisk;
  trend: BagScoreTrendPoint[];
}) {
  return (
    <section id="bag-health" className="premium-hero grid scroll-mt-28 gap-4 p-4 lg:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.52fr)]">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <StatusPill tone={bagScore >= 85 ? "green" : bagScore >= 70 ? "sky" : "amber"}>
                Bag health
              </StatusPill>
              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                Bag health
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                How the bag is performing, where the weak points are, and what has changed across
                the current stock-yardage model.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <BagHealthMetric
              label="Bag score"
              value={`${bagScore}%`}
              detail={scoreLabel}
              tone={bagScore >= 85 ? "green" : bagScore >= 70 ? "sky" : "amber"}
            />
            <BagHealthMetric
              label="Confidence"
              value={`${confidence}%`}
              detail={`${clubs} active clubs`}
              tone={confidence >= 75 ? "green" : confidence >= 60 ? "sky" : "amber"}
            />
            <BagHealthMetric
              label="Data trust"
              value={dataTrust}
              detail={dataTrustDetail}
              tone="sky"
            />
            <BagHealthMetric
              label="Shots"
              value={shots.toString()}
              detail="Saved rows"
              tone="slate"
            />
          </div>

          <BagScoreTrendPanel points={trend} currentScore={bagScore} />
        </div>

        <div className="grid gap-3">
          <PageArtwork variant="stockYardages" alt="" className="h-48 rounded-lg" priority />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <BagHealthSignal
              label="Strongest club"
              value={strongestClub ? formatClubType(strongestClub.type) : "--"}
              detail={
                strongestClub
                  ? `${clubTrustScore(strongestClub)}% trust · ${clubHealthReadout(strongestClub).label}`
                  : "Need stock samples"
              }
              tone="green"
              href={strongestClub ? `/bag/${strongestClub.id}` : undefined}
            />
            <BagHealthSignal
              label="Weakest club"
              value={weakestClub ? formatClubType(weakestClub.type) : "--"}
              detail={
                weakestClub
                  ? `${clubTrustScore(weakestClub)}% trust · ${clubCurrentMiss(weakestClub).label}`
                  : "No weak club yet"
              }
              tone={weakestClub ? clubHealthReadout(weakestClub).tone : "slate"}
              href={weakestClub ? `/bag/${weakestClub.id}` : undefined}
            />
            <BagHealthSignal
              label="Biggest opportunity"
              value={biggestOpportunity?.title ?? "No urgent move"}
              detail={
                biggestOpportunity?.detail ?? "Current equipment setup has no obvious red flag."
              }
              tone={biggestOpportunity ? "violet" : "green"}
            />
            <BagHealthSignal
              label="Current gap risk"
              value={currentGapRisk.value}
              detail={currentGapRisk.detail}
              tone={currentGapRisk.tone}
              href={currentGapRisk.href}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BagHealthMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: BagDoctorFinding["tone"];
}) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${intelligenceToneClass(tone)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none tracking-normal text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

function BagHealthSignal({
  label,
  value,
  detail,
  tone,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  tone: BagDoctorFinding["tone"] | "violet";
  href?: string;
}) {
  const content = (
    <div className={`h-full rounded-lg border px-3 py-3 ${bagSignalToneClass(tone)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-2 text-xl font-semibold leading-6 tracking-normal text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} prefetch={false} className="block h-full transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}

function BagScoreTrendPanel({
  points,
  currentScore,
}: {
  points: BagScoreTrendPoint[];
  currentScore: number;
}) {
  const visiblePoints =
    points.length > 0
      ? points
      : [
          {
            key: "current",
            label: "Now",
            score: currentScore,
            detail: "Trend building",
            tone: "slate" as const,
          },
        ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white/82 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Bag score trend</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Month-end snapshots from the current stock-yardage model.
          </p>
        </div>
        <StatusPill tone={visiblePoints.at(-1)?.tone ?? "slate"}>
          {visiblePoints.at(-1)?.score ?? currentScore}%
        </StatusPill>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {visiblePoints.map((point) => (
          <div key={point.key} className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {point.label}
              </span>
              <span className={`font-semibold ${toneTextClass(point.tone)}`}>{point.score}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white">
              <span
                className={`block h-2 rounded-full ${confidenceBarClass(point.tone)}`}
                style={{ width: `${Math.max(4, Math.min(100, point.score))}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-4 text-muted-foreground">{point.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BagZoneHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function parsePersonalBestMetric(value: string | string[] | undefined): PersonalBestMetric {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue === "total" ? "total" : "carry";
}

function shouldLoadPeerBenchmarks(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
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

function formatSideYards(sideYd: number | null) {
  if (sideYd === null) {
    return "--";
  }

  if (sideYd < 0) {
    return `${formatMetric(Math.abs(sideYd))} yd left`;
  }

  if (sideYd > 0) {
    return `${formatMetric(sideYd)} yd right`;
  }

  return "0 yd";
}

function compactCarryYards(carryYd: number | null) {
  return carryYd === null ? "--" : `${Math.round(carryYd)}`;
}

function compactClubLabel(clubType: string) {
  return clubType === "driver" ? "D" : formatClubType(clubType);
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
        title="Wedge matrix"
        description="Full, 3/4, and half-shot carry windows in one compact scoring table."
        action={<Grid3X3 className="size-5 text-amber-600" />}
      />
      <CardContent>
        {matrix.length > 0 ? (
          <div data-workbench-scope="bag-wedge-matrix">
            <DesktopTableWorkbenchControls
              viewKey="bag-wedge-matrix"
              scope="bag-wedge-matrix"
              currentViewLabel="Wedge matrix carry windows"
              resultLabel={`${numberFormatter.format(matrix.length)} scoring clubs`}
              columns={wedgeMatrixColumns}
              suggestedViews={wedgeMatrixSuggestedViews}
              exportTableId="bag-wedge-matrix"
              exportFileName="forekinghell-wedge-matrix.csv"
              className="mb-3"
            />
            <DataTableFrame label="Wedge matrix carry table" stickyFirstColumn>
              <Table
                className="min-w-[760px]"
                data-workbench-scope="bag-wedge-matrix"
                data-workbench-export-table="bag-wedge-matrix"
                aria-describedby="wedge-matrix-carry-summary"
              >
                <TableCaption id="wedge-matrix-carry-summary" className="sr-only">
                  Wedge matrix carry table showing club, full-shot carry, three-quarter carry, half
                  carry and scoring-window status.
                </TableCaption>
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                  <TableRow>
                    <TableHead
                      data-column="club"
                      className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      Club
                    </TableHead>
                    <TableHead data-column="full" className="text-right">
                      Full
                    </TableHead>
                    <TableHead data-column="three-quarter" className="text-right">
                      3/4
                    </TableHead>
                    <TableHead data-column="half" className="text-right">
                      Half
                    </TableHead>
                    <TableHead data-column="status" className="text-right">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.map((club) => {
                    const full = wedgeMatrixRow(club, "full");
                    const threeQuarter = wedgeMatrixRow(club, "threeQuarter");
                    const half = wedgeMatrixRow(club, "half");

                    return (
                      <TableRow key={club.id} tabIndex={0} className="focus-aaa outline-none">
                        <TableCell
                          data-column="club"
                          className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          <div className="grid gap-0.5">
                            <span className="font-semibold">{club.label}</span>
                            <span className="max-w-56 truncate text-xs text-muted-foreground">
                              {club.brandModel}
                            </span>
                          </div>
                        </TableCell>
                        <WedgeMatrixCarryCell column="full" row={full} />
                        <WedgeMatrixCarryCell column="three-quarter" row={threeQuarter} />
                        <WedgeMatrixCarryCell column="half" row={half} />
                        <TableCell data-column="status" className="text-right">
                          <StatusPill
                            tone={
                              club.isSuggested ? "amber" : club.matrixScore >= 70 ? "green" : "sky"
                            }
                          >
                            {club.isSuggested ? "Target" : `${club.matrixScore}%`}
                          </StatusPill>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTableFrame>
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

function WedgeMatrixCarryCell({
  column,
  row,
}: {
  column: "full" | "three-quarter" | "half";
  row: WedgeMatrixShot | null;
}) {
  return (
    <TableCell data-column={column} className="text-right">
      <span className="font-semibold">{formatCarryYards(row?.carryYd ?? null)}</span>
      <span className="block text-xs text-muted-foreground">
        {row === null ? "building" : row.sampleSize > 0 ? `${row.sampleSize} shots` : row.status}
      </span>
    </TableCell>
  );
}

function wedgeMatrixRow(club: WedgeMatrixClub, key: WedgeMatrixShot["key"]) {
  return club.rows.find((row) => row.key === key) ?? null;
}

function PathTrendPanel({ trend }: { trend: PathTrendTracking }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Face-to-path trend"
        description="Delivery diagnostics for where the face points compared with the swing path."
        action={<Radar className="size-5 text-sky-600" />}
      />
      <CardContent className="grid gap-3">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-base font-semibold">{trend.label}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{trend.detail}</p>
            <div className="mt-3 grid gap-2 text-xs font-semibold sm:grid-cols-3">
              <span className="rounded-lg bg-white px-3 py-2 text-slate-950">
                Black line: club face
              </span>
              <span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
                Red line: swing path
              </span>
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                Face-to-path: face minus path
              </span>
            </div>
          </div>
          <StatusPill tone={pathTrendStatusTone(trend.status)}>
            {pathTrendStatusLabel(trend.status)}
          </StatusPill>
        </div>
        {trend.clubs.length > 1 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold">Club delivery reads</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {trend.clubs.map((club) => (
                <Link
                  key={club.clubId}
                  href={`/bag/${club.clubId}/analytics`}
                  prefetch={false}
                  className="grid gap-2 rounded-lg bg-[#F5F6F4] px-3 py-2 text-xs transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">
                        {club.label}
                      </span>
                      <span className="text-muted-foreground">
                        {club.patternLabel} · {club.sampleSize} shots
                      </span>
                    </span>
                    <StatusPill tone={facePathPatternTone(club.patternCode)}>
                      {club.patternLabel}
                    </StatusPill>
                  </span>
                  <span className="grid grid-cols-3 gap-1.5 font-semibold">
                    <span>Path {formatSignedDegrees(club.pathDeg)}</span>
                    <span>Face {formatSignedDegrees(club.faceDeg)}</span>
                    <span className="text-emerald-700">
                      Face-path {formatSignedDegrees(club.faceToPathProxyDeg)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {trend.points.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
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
                    {point.patternLabel}
                  </StatusPill>
                </div>
                <FacePathDeliveryChart
                  datum={{
                    label: point.label,
                    patternLabel: point.patternLabel,
                    pathDeg: point.pathDeg,
                    faceDeg: point.faceDeg,
                    faceToPathDeg: point.faceToPathProxyDeg,
                    sampleSize: point.sampleSize,
                  }}
                  idPrefix={`bag-month-${point.monthKey}`}
                  className="mt-3"
                  chartClassName="bg-white"
                />
                <p className="mt-2 min-h-8 text-xs leading-4 text-muted-foreground">
                  {point.patternDetail}
                </p>
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
          <details className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-950 marker:hidden">
              <span>Expand shot-by-shot diagrams</span>
              <span className="text-xs font-medium text-muted-foreground">
                {trend.recentShots.length} recent shots
              </span>
            </summary>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {trend.recentShots.map((shot) => (
                <div key={shot.key} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold">{shot.patternLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {shot.shotAtLabel} · face-to-path{" "}
                      {formatSignedDegrees(shot.faceToPathProxyDeg)}
                    </p>
                  </div>
                  <FacePathDeliveryChart
                    datum={{
                      label: shot.label,
                      patternLabel: shot.patternLabel,
                      pathDeg: shot.pathDeg,
                      faceDeg: shot.faceDeg,
                      faceToPathDeg: shot.faceToPathProxyDeg,
                    }}
                    idPrefix={`bag-shot-${shot.key}`}
                    className="mt-3"
                    chartClassName="bg-white"
                    showMetricPills={false}
                  />
                </div>
              ))}
            </div>
          </details>
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
                <ChartAccessibleFallback
                  title={`${overlay.label} shot pattern`}
                  summary={shotPatternOverlaySummary(overlay)}
                  columns={[
                    { key: "metric", label: "Metric" },
                    { key: "value", label: "Value" },
                    { key: "context", label: "Context" },
                  ]}
                  rows={shotPatternOverlayRows(overlay)}
                  className="mt-2 bg-white/70"
                />
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
        title="Future recommendations"
        description="Number-led development calls from bag, wedge, strategy, and SG evidence."
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

function BagStickySummary({ rows }: { rows: GappingRow[] }) {
  const preferredRows = STICKY_BAG_SUMMARY_TYPES.map((type) =>
    rows.find((row) => row.clubType === type),
  ).filter((row): row is GappingRow => Boolean(row));
  const fallbackRows = rows
    .filter((row) => !preferredRows.some((preferred) => preferred.id === row.id))
    .slice(0, Math.max(0, 5 - preferredRows.length));
  const summaryRows = [...preferredRows, ...fallbackRows].slice(0, 5);

  if (summaryRows.length === 0) {
    return null;
  }

  return (
    <section className="sticky top-3 z-20 hidden sm:block">
      <div className="premium-command-surface flex items-center justify-between gap-3 rounded-lg px-3 py-2">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Mini caddie
        </p>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
          {summaryRows.map((row) => (
            <Link
              key={row.id}
              href={`/bag/${row.id}`}
              prefetch={false}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200/70 bg-white/86 px-2.5 text-sm font-semibold shadow-sm transition-colors hover:border-emerald-300"
            >
              <span className="text-muted-foreground">{compactClubLabel(row.clubType)}</span>
              <span className="text-slate-950">{compactCarryYards(visualCarryYd(row))}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function StockFilterPanel({ clubs }: { clubs: BagClub[] }) {
  return (
    <DataPanel id="best-stock-filters" className="scroll-mt-28">
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-transparent px-4 py-3 transition-colors hover:bg-slate-50/70 group-open:border-border [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Database className="size-5 text-sky-600" />
              <h2 className="text-lg font-semibold tracking-normal text-[#111611] sm:text-xl">
                Best-stock filters
              </h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Shows why rows did not feed the Best Stock median. Personal Best is tracked separately
              so one long clean shot still appears.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone="sky">Secondary</StatusPill>
            <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <CardContent>
          <StockFilterCards clubs={clubs} />
        </CardContent>
      </details>
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
    <section
      id="bag-confidence"
      className="grid min-w-0 scroll-mt-28 gap-4 overflow-x-clip xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)] xl:items-start"
    >
      <DataPanel className="min-w-0 overflow-x-clip">
        <SectionHeader
          title="Bag confidence ladder"
          description="Recommended is the primary course number. Best Stock stays visible as potential."
          action={<Gauge className="size-5 text-emerald-600" />}
        />
        <CardContent>
          <div className="max-w-full overflow-hidden">
            <div
              aria-label="Bag confidence ladder"
              tabIndex={0}
              className="-mx-4 flex max-w-full gap-3 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mx-0 sm:px-0"
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
                      <div className="rounded-md bg-[#F5F6F4] px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Trust</span>
                          <span className="font-semibold">{row.confidenceScore}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white">
                          <span
                            className={`block h-full rounded-full ${confidenceBarClass(
                              confidence.tone,
                            )}`}
                            style={{ width: `${Math.max(5, Math.min(100, row.confidenceScore))}%` }}
                          />
                        </div>
                      </div>
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
      title: scoringGap ? "Scoring yardage window" : "Long-game flight option",
      detail: scoringGap
        ? `${formatClubType(missingWindow.clubType)} leaves a ${formatGap(
            missingWindow.gapToNextYd,
          )} scoring-end gap. Add the missing wedge, choke-down, or flighted option.`
        : `${formatClubType(missingWindow.clubType)} leaves a ${formatGap(
            missingWindow.gapToNextYd,
          )} long-game gap. Treat it as a flighted-shot option, behind wedge calibration and driver speed.`,
      label: scoringGap ? "Scoring" : "Option",
      tone: scoringGap ? "amber" : "sky",
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

function findWeakestClub(clubs: BagClub[]) {
  const scoredClubs = clubs
    .filter((club) => club.rawShotCount > 0)
    .map((club) => ({ club, score: clubWeaknessScore(club) }))
    .sort((left, right) => left.score - right.score);

  return scoredClubs[0]?.club ?? null;
}

function clubWeaknessScore(club: BagClub) {
  const health = clubHealthReadout(club);
  const miss = clubCurrentMiss(club);
  let score = clubTrustScore(club);

  if (health.tone === "pink") {
    score -= 26;
  } else if (health.tone === "amber") {
    score -= 18;
  } else if (health.tone === "sky") {
    score -= 6;
  }

  if (miss.tone === "amber") {
    score -= 8;
  } else if (miss.tone === "pink") {
    score -= 14;
  }

  if (club.stockTrend?.status === "worse") {
    score -= 10;
  }

  return score;
}

function buildCurrentGapRisk(rows: GappingRow[]): BagGapRisk {
  const riskyRow =
    [...rows]
      .filter((row) => row.gapToNextYd !== null)
      .sort((left, right) => gapRiskScore(right) - gapRiskScore(left))[0] ?? null;

  if (!riskyRow || gapRiskScore(riskyRow) <= 0) {
    return {
      label: "Current gap risk",
      value: "No urgent gap",
      detail: "Current recommended carries do not show a high-priority missing window.",
      tone: "green",
    };
  }

  const gap = gapReadout(riskyRow);
  const value = gapRangeLabel(riskyRow);

  return {
    label: gap.label,
    value,
    detail: `${formatClubType(riskyRow.clubType)} to ${
      riskyRow.nextClubType ? formatClubType(riskyRow.nextClubType) : "next club"
    } · ${formatGap(riskyRow.gapToNextYd)}.`,
    tone: gap.tone,
    href: `/bag/${riskyRow.id}`,
  };
}

function gapRiskScore(row: GappingRow) {
  if (row.gapToNextYd === null) {
    return 0;
  }

  if (isScoringEndGap(gapWindowInput(row)) && row.gapToNextYd > 18) {
    return 120 + row.gapToNextYd;
  }

  if (isMissingYardageWindowGap(gapWindowInput(row)) && row.gapToNextYd > 18) {
    return 80 + row.gapToNextYd;
  }

  if (row.gapToNextYd < 8) {
    return isSevereGapCompression(row) ? 70 + (8 - row.gapToNextYd) : 35 + (8 - row.gapToNextYd);
  }

  return 0;
}

function gapRangeLabel(row: GappingRow) {
  if (row.gappingCarryYd === null || row.gapToNextYd === null) {
    return "--";
  }

  const shorterCarry = row.gappingCarryYd - row.gapToNextYd;
  const low = Math.min(shorterCarry, row.gappingCarryYd);
  const high = Math.max(shorterCarry, row.gappingCarryYd);

  return `${formatMetric(roundOneNumber(low))}-${formatMetric(roundOneNumber(high))} yd`;
}

function buildBagScoreTrend(
  bag: BagClub[],
  options: { handicapBand?: string | null } = {},
): BagScoreTrendPoint[] {
  const stockShotsByClub = bag.map((club) => {
    const { filteredShots } = selectStockYardageShots(club.shots, RECENT_SHOTS_PER_CLUB, {
      clubType: club.type,
    });

    return { club, filteredShots };
  });
  const months = new Map<string, Date>();

  for (const { filteredShots } of stockShotsByClub) {
    for (const shot of filteredShots) {
      const date = shotDate(shot.shotAt);

      if (!date) {
        continue;
      }

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.set(key, new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-3)
    .map(([key, monthDate]) => {
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      const snapshotRows = stockShotsByClub
        .flatMap(({ club, filteredShots }) => {
          const shotsThroughMonth = filteredShots.filter((shot) => {
            const shotMonthDate = shotDate(shot.shotAt);

            return shotMonthDate !== null && shotMonthDate <= monthEnd;
          });
          const stock = calculateStockYardage(shotsThroughMonth, RECENT_SHOTS_PER_CLUB, {
            clubType: club.type,
          });

          if (stock.sampleSize === 0) {
            return [];
          }

          if (
            club.isShortGameTouch &&
            (stock.bestStockCarryYd ?? 0) < SAND_WEDGE_STOCK_MIN_CARRY_YD
          ) {
            return [];
          }

          return [
            {
              clubType: club.type,
              carryYd: stock.coursePlayCarryYd ?? stock.bestStockCarryYd,
              confidenceScore: stock.confidenceScore,
              sampleSize: stock.sampleSize,
            },
          ];
        })
        .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
      const gappingSnapshots = snapshotRows.map((row, index) => {
        const next = snapshotRows.slice(index + 1).find((candidate) => candidate.carryYd !== null);
        const gapToNextYd =
          row.carryYd !== null && next !== undefined && next.carryYd !== null
            ? row.carryYd - next.carryYd
            : null;

        return {
          ...row,
          id: row.clubType,
          nextClubType: next?.clubType ?? null,
          gapToNextYd: gapToNextYd === null ? null : roundOneNumber(gapToNextYd),
        };
      });
      const confidenceAverage =
        gappingSnapshots.length === 0
          ? 0
          : (averageNumber(gappingSnapshots.map((row) => row.confidenceScore)) ?? 0);
      const rowsWithTargets = buildPersonalGappingTargets(
        gappingSnapshots.map((row) => ({
          id: row.id,
          clubType: row.clubType,
          carryYd: row.carryYd,
          gappingCarryYd: row.carryYd,
          gapToNextYd: row.gapToNextYd,
          nextClubType: row.nextClubType,
          confidenceScore: row.confidenceScore,
          sampleSize: row.sampleSize,
        })),
        { handicapBand: options.handicapBand },
      );
      const gapPenalty = rowsWithTargets.reduce((total, row) => {
        const input = {
          longerClubType: row.clubType,
          shorterClubType: row.nextClubType,
          gapYd: row.gapToNextYd,
        };

        if (!isMissingYardageWindowGap(input)) {
          return total;
        }

        const gap = row.gapToNextYd ?? 0;

        return total + Math.min(isScoringEndGap(input) ? 12 : 8, (gap - 18) / 2);
      }, 0);
      const score = clampPercent(Math.round(confidenceAverage - gapPenalty));

      return {
        key,
        label: shortMonthFormatter.format(monthDate),
        score,
        detail: `${gappingSnapshots.length} clubs · ${gappingSnapshots.reduce(
          (total, row) => total + row.sampleSize,
          0,
        )} stock shots`,
        tone: score >= 85 ? "green" : score >= 70 ? "sky" : score >= 55 ? "amber" : "pink",
      } satisfies BagScoreTrendPoint;
    });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
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

    const scoringGap = isScoringEndGap(gapWindowInput(row));

    return {
      value: formatGap(row.gapToNextYd),
      label: scoringGap ? "Scoring gap" : "Flight option",
      tone: scoringGap ? "amber" : "sky",
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

function buildClubIntelligenceItems(bag: BagClub[]): ClubIntelligenceItem[] {
  return bag.map((club) => {
    const health = clubHealthReadout(club);
    const miss = clubCurrentMiss(club);
    const trend =
      club.stockTrend === null
        ? null
        : {
            label: stockTrendLabel(club.stockTrend.status),
            detail: stockTrendDetail(club.stockTrend),
            tone: stockTrendTone(club.stockTrend.status),
          };
    const primaryCarryYd = clubPrimaryCarryYd(club);
    const secondaryCarryYd = clubSecondaryCarryYd(club);
    const chartShots = club.shots
      .flatMap((shot) =>
        typeof shot.carryYd === "number" && Number.isFinite(shot.carryYd)
          ? [
              {
                carryYd: shot.carryYd,
                sideCarryYd: isFiniteMetric(shot.sideCarryYd) ? shot.sideCarryYd : null,
              },
            ]
          : [],
      )
      .slice(0, 40);

    return {
      id: club.id,
      type: club.type,
      label: formatClubType(club.type),
      brand: club.brand,
      model: club.model,
      brandModel: club.brandModel,
      accent: club.accent,
      primaryLabel: club.isShortGameTouch ? "Touch median" : "Recommended",
      primaryCarryLabel: formatCarryYards(primaryCarryYd),
      secondaryLabel: club.isShortGameTouch ? "Full stock" : "Best stock",
      secondaryCarryLabel: formatCarryYards(secondaryCarryYd),
      bestStockLabel: formatCarryYards(club.stock.bestStockCarryYd),
      latestReliableLabel: formatCarryYards(club.stock.latestReliableCarryYd),
      latestReliableRangeLabel:
        formatCarryRange(
          club.stock.latestReliableCarryP25Yd,
          club.stock.latestReliableCarryP75Yd,
        ) === "--"
          ? "Range building"
          : formatCarryRange(
              club.stock.latestReliableCarryP25Yd,
              club.stock.latestReliableCarryP75Yd,
            ),
      personalBestLabel: formatCarryYards(club.stock.personalBestCarryYd),
      trustScore: clubTrustScore(club),
      sampleSize:
        club.isShortGameTouch && club.type !== "sw" ? club.touch.sampleSize : club.stock.sampleSize,
      shotCount: club.rawShotCount,
      decisionLabel: club.decisionLabel,
      health,
      miss,
      trend,
      carryMedianYd: club.isShortGameTouch ? club.touch.carryMedianYd : club.stock.bestStockCarryYd,
      shots: chartShots,
    } satisfies ClubIntelligenceItem;
  });
}

function MobileClubArtworkCarousel({ clubs }: { clubs: BagClub[] }) {
  if (clubs.length === 0) {
    return null;
  }

  return (
    <NativeListSection
      title="Swipe your bag"
      description="Trust-first club cards. Recommended is the number to take to the course."
    >
      <div className="-mx-4 max-w-[100vw] overflow-hidden">
        <div
          aria-label="Swipe through clubs"
          tabIndex={0}
          className="focus-aaa flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 outline-none"
        >
          {clubs.map((club, index) => {
            const health = clubHealthReadout(club);
            const miss = clubCurrentMiss(club);
            const primaryCarry = clubPrimaryCarryYd(club);
            const secondaryCarry = clubSecondaryCarryYd(club);

            return (
              <Link
                key={club.id}
                href={`/bag/${club.id}`}
                prefetch={false}
                className="focus-aaa apple-panel-strong grid min-h-[25rem] w-[85vw] max-w-[22rem] shrink-0 snap-center content-between gap-3 rounded-lg p-3 outline-none transition-transform duration-150 ease-out active:scale-[0.985]"
              >
                <div className="grid gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {health.label}
                      </p>
                      <h3 className="truncate text-3xl font-semibold leading-tight tracking-normal text-foreground">
                        {formatClubType(club.type)}
                      </h3>
                      <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
                        {club.brandModel}
                      </p>
                    </div>
                    <StatusPill tone={health.tone}>{clubTrustScore(club)}%</StatusPill>
                  </div>
                  <ClubArtwork
                    clubType={club.type}
                    brand={club.brand}
                    model={club.model}
                    alt=""
                    view={index % 2 === 0 ? "side" : "top"}
                    source="generated-v2"
                    className="h-32 rounded-lg border-emerald-950/10 bg-[linear-gradient(180deg,#ffffff,#eef6ef)]"
                    imageClassName="px-4 py-3"
                    sizes="85vw"
                    priority={index === 0}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <ClubCarouselMetric
                      label={club.isShortGameTouch ? "Touch median" : "Recommended"}
                      value={formatCarryYards(primaryCarry)}
                      emphasis
                    />
                    <ClubCarouselMetric
                      label={club.isShortGameTouch ? "Full stock" : "Best Stock"}
                      value={formatCarryYards(secondaryCarry)}
                    />
                    <ClubCarouselMetric
                      label="Latest Reliable"
                      value={formatCarryYards(club.stock.latestReliableCarryYd)}
                    />
                    <ClubCarouselMetric
                      label="Personal Best"
                      value={formatCarryYards(club.stock.personalBestCarryYd)}
                    />
                  </div>
                </div>
                <div className="grid gap-2 rounded-lg border border-emerald-950/10 bg-white/78 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{miss.label}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {club.rawShotCount} shots
                    </span>
                  </div>
                  <p className="line-clamp-2 leading-5 text-muted-foreground">{health.detail}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </NativeListSection>
  );
}

function ClubCarouselMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        emphasis
          ? "border-emerald-800/25 bg-emerald-950 text-white"
          : "border-emerald-950/10 bg-white/82 text-foreground"
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
          emphasis ? "text-emerald-50/80" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-semibold tracking-normal">{value}</p>
    </div>
  );
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

function PersonalBestSnapshotPanel({ clubs }: { clubs: BagClub[] }) {
  const rows = clubs
    .filter((club) => club.personalBest.carryYd !== null || club.personalBest.totalYd !== null)
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));

  return (
    <DataPanel id="personal-bests" className="scroll-mt-28 overflow-x-clip">
      <SectionHeader
        title="Personal bests"
        description="Compact peak-distance reference without a full-screen bar chart."
        action={<Trophy className="size-5 text-amber-600" />}
      />
      <CardContent>
        {rows.length > 0 ? (
          <div className="max-w-full overflow-hidden">
            <div
              aria-label="Personal bests by club"
              tabIndex={0}
              className="-mx-4 flex max-w-full gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mx-0 sm:px-0"
            >
              {rows.map((club) => (
                <Link
                  key={club.id}
                  href={`/bag/${club.id}`}
                  prefetch={false}
                  className="grid min-w-32 rounded-lg border border-slate-200 bg-[#F5F6F4] px-3 py-3 transition-colors hover:border-amber-300"
                >
                  <span className="text-sm font-semibold">{formatClubType(club.type)}</span>
                  <span className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                    {formatMetric(club.personalBest.carryYd)}
                    {club.personalBest.carryYd === null ? "" : " yd"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Total {formatMetric(club.personalBest.totalYd)}
                    {club.personalBest.totalYd === null ? "" : " yd"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EmptyPanelMessage
            title="Personal bests building"
            detail="Clean stock-shot imports will unlock carry and total personal bests."
          />
        )}
      </CardContent>
    </DataPanel>
  );
}

function BenchmarkReferencePanel({
  rows,
  peerSummary,
  peerBenchmarksLoaded,
}: {
  rows: ClubBenchmarkRow[];
  peerSummary: ClubBenchmarkPeerSummary;
  peerBenchmarksLoaded: boolean;
}) {
  return (
    <section id="distance-benchmarks" className="scroll-mt-28">
      <DistanceBenchmarkPanel
        rows={rows}
        peerSummary={peerSummary}
        peerBenchmarksLoaded={peerBenchmarksLoaded}
      />
    </section>
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
    <Card className="premium-card min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-xl tracking-normal sm:text-2xl">
          Carry gapping reference
        </CardTitle>
        <CardDescription className="hidden sm:block">
          Target gap stays visible. The full club table is available when you need the detail.
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
        <details
          open
          className="group hidden min-w-0 overflow-hidden sm:block"
          data-bag-gapping-table
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold transition-colors hover:border-sky-300 [&::-webkit-details-marker]:hidden">
            <span>Full gapping table</span>
            <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <DesktopTableWorkbenchControls
              viewKey="bag-gapping"
              scope="bag"
              currentViewLabel="Full bag gapping reference"
              resultLabel={`${numberFormatter.format(rows.length)} clubs`}
              columns={bagGappingColumns}
              suggestedViews={bagGappingSuggestedViews}
              exportTableId="bag-gapping"
              exportFileName="forekinghell-bag-gapping-view.csv"
              className="mb-3"
            />
            <DataTableFrame mainTable mainTableLabel="Full bag gapping table" stickyFirstColumn>
              <Table
                className="min-w-[1220px]"
                data-workbench-scope="bag"
                data-workbench-export-table="bag-gapping"
                aria-describedby="bag-gapping-table-summary"
              >
                <TableCaption id="bag-gapping-table-summary" className="sr-only">
                  Full bag gapping table with stock carry, latest reliable carry, recommended
                  number, personal best, target gap, sample size and decision confidence.
                </TableCaption>
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                  <TableRow>
                    <TableHead
                      data-column="club"
                      className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      Club
                    </TableHead>
                    <TableHead data-column="model">Model</TableHead>
                    <TableHead data-column="best-stock" className="text-right">
                      Best stock
                    </TableHead>
                    <TableHead data-column="latest-reliable" className="text-right">
                      Latest reliable
                    </TableHead>
                    <TableHead data-column="recommended" className="text-right">
                      Recommended
                    </TableHead>
                    <TableHead data-column="personal-best" className="text-right">
                      Personal best
                    </TableHead>
                    <TableHead data-column="gap" className="text-right">
                      Gap
                    </TableHead>
                    <TableHead data-column="target" className="text-right">
                      Target
                    </TableHead>
                    <TableHead data-column="work-on" className="text-right">
                      Work on
                    </TableHead>
                    <TableHead data-column="sample" className="text-right">
                      Sample
                    </TableHead>
                    <TableHead data-column="decision" className="text-right">
                      Decision
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} tabIndex={0} className="focus-aaa outline-none">
                      <TableCell
                        data-column="club"
                        className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        <Link
                          href={`/bag/${row.id}`}
                          className="font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                          {formatClubType(row.clubType)}
                        </Link>
                      </TableCell>
                      <TableCell
                        data-column="model"
                        className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground"
                      >
                        {row.brandModel}
                      </TableCell>
                      <TableCell data-column="best-stock" className="text-right font-semibold">
                        {formatMetric(row.carryYd)}
                        {row.carryYd === null ? "" : " yd"}
                      </TableCell>
                      <TableCell data-column="latest-reliable" className="text-right">
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
                      <TableCell data-column="recommended" className="text-right">
                        {formatMetric(row.playNumberYd)}
                        {row.playNumberYd === null ? "" : " yd"}
                      </TableCell>
                      <TableCell data-column="personal-best" className="text-right">
                        {formatMetric(row.personalBestCarryYd)}
                        {row.personalBestCarryYd === null ? "" : " yd"}
                      </TableCell>
                      <TableCell data-column="gap" className="text-right">
                        <GapBadge row={row} />
                      </TableCell>
                      <TableCell data-column="target" className="text-right">
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
                      <TableCell data-column="work-on" className="text-right">
                        <WorkOnBadge row={row} />
                      </TableCell>
                      <TableCell data-column="sample" className="text-right">
                        {row.sampleSize}
                      </TableCell>
                      <TableCell data-column="decision" className="text-right">
                        <span className="font-medium">{row.confidenceScore}%</span>
                        <span className="ml-2 text-muted-foreground">{row.decisionLabel}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableFrame>
          </div>
        </details>
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

  const input = gapWindowInput(row);
  const tone =
    gapYd < 8 && isSevereGapCompression(row)
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : gapYd < 8
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : gapYd > 18 && isScoringEndGap(input)
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : gapYd > 18 && isMissingYardageWindowGap(input)
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : gapYd > 18 && isManageableTopEndGap(input)
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : gapYd > 18
                ? "border-sky-200 bg-sky-50 text-sky-700"
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

function confidenceBarClass(tone: BagDoctorFinding["tone"]) {
  if (tone === "green") {
    return "bg-emerald-600";
  }

  if (tone === "sky") {
    return "bg-sky-500";
  }

  if (tone === "amber") {
    return "bg-amber-500";
  }

  if (tone === "pink") {
    return "bg-pink-600";
  }

  return "bg-slate-400";
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

function bagSignalToneClass(tone: BagDoctorFinding["tone"] | "violet") {
  if (tone === "violet") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return intelligenceToneClass(tone);
}

function toneTextClass(tone: BagDoctorFinding["tone"]) {
  if (tone === "green") {
    return "text-emerald-700";
  }

  if (tone === "sky") {
    return "text-sky-700";
  }

  if (tone === "amber") {
    return "text-amber-800";
  }

  if (tone === "pink") {
    return "text-rose-700";
  }

  return "text-slate-600";
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

function shotPatternOverlaySummary(overlay: ShotPatternOverlaySummary) {
  return `${overlay.label} uses ${overlay.sampleSize} saved shots. Median carry is ${formatCarryYards(overlay.carryP50Yd)}, the carry window runs ${formatCarryYards(overlay.carryP10Yd)} to ${formatCarryYards(overlay.carryP90Yd)}, side window is ${formatSideYards(overlay.sideP10Yd)} to ${formatSideYards(overlay.sideP90Yd)}, and playable rate is ${formatMetric(overlay.playableRate)}%.`;
}

function shotPatternOverlayRows(overlay: ShotPatternOverlaySummary): ChartFallbackRow[] {
  return [
    {
      _key: "sample",
      metric: "Sample",
      value: `${overlay.sampleSize} shots`,
      context: "Saved shots feeding this pattern overlay.",
    },
    {
      _key: "carry-p10",
      metric: "Carry P10",
      value: formatCarryYards(overlay.carryP10Yd),
      context: "Lower carry edge of the pattern window.",
    },
    {
      _key: "carry-median",
      metric: "Median carry",
      value: formatCarryYards(overlay.carryP50Yd),
      context: "Centre carry shown by the overlay dot.",
    },
    {
      _key: "carry-p90",
      metric: "Carry P90",
      value: formatCarryYards(overlay.carryP90Yd),
      context: "Upper carry edge of the pattern window.",
    },
    {
      _key: "side-window",
      metric: "Side window",
      value: `${formatSideYards(overlay.sideP10Yd)} to ${formatSideYards(overlay.sideP90Yd)}`,
      context: `${overlay.primaryMiss} miss tendency from the side-carry window.`,
    },
    {
      _key: "playable",
      metric: "Playable rate",
      value: `${formatMetric(overlay.playableRate)}%`,
      context: "Share of shots treated as playable for this club pattern.",
    },
  ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function DriverContextMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="apple-panel p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ClubEvolutionPanel({ clubs }: { clubs: BagClub[] }) {
  const clubLines = buildClubEvolutionRows(
    clubs.map((club) => ({
      ...club,
      shots: club.evolutionShots,
    })),
    {
      maxShots: RECENT_SHOTS_PER_CLUB,
      monthCount: 3,
      monthFormatter: shortMonthFormatter,
    },
  ).slice(0, 12);

  if (clubLines.length === 0) {
    return null;
  }

  const driverContext = buildDriverEvolutionContext(clubLines);

  return (
    <DataPanel>
      <SectionHeader
        title="Club evolution"
        description="Monthly median carry from clean-stock shots, with sample size and retest confidence."
        action={<TrendingUp className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#F5F6F4]">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_8rem_10rem] gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Club</span>
            <span>Last three months</span>
            <span className="text-right">Change</span>
            <span className="text-right">Read</span>
          </div>
          {clubLines.map(({ club, measuredPoints, points }) => {
            const readout = clubEvolutionReadout(club, measuredPoints);

            return (
              <Link
                key={club.id}
                href={`/bag/${club.id}`}
                prefetch={false}
                className="grid grid-cols-[7rem_minmax(0,1fr)_8rem_10rem] items-center gap-3 border-b border-slate-200 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-white"
              >
                <span className="font-semibold">{formatClubType(club.type)}</span>
                <span className="grid grid-cols-3 gap-2">
                  {points.map((point) => (
                    <span
                      key={point.key}
                      className={`rounded-md px-2 py-1 ${
                        point.carryYd === null ? "bg-white/45 text-muted-foreground" : "bg-white/80"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {point.label}
                      </span>
                      <span className="block font-semibold">
                        {point.carryYd === null ? "No shots" : `${formatMetric(point.carryYd)} yd`}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {point.sampleSize > 0
                          ? `${integerFormatter.format(point.sampleSize)} clean`
                          : "No clean sample"}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="text-right">
                  <span className={`block font-semibold ${clubEvolutionTextClass(measuredPoints)}`}>
                    {clubEvolutionDelta(measuredPoints)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {readout.confidenceLabel}
                  </span>
                </span>
                <span className="text-right">
                  <StatusPill tone={readout.tone}>{readout.label}</StatusPill>
                </span>
              </Link>
            );
          })}
        </div>
        {driverContext ? <DriverEvolutionContextCard context={driverContext} /> : null}
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold transition-colors hover:border-emerald-300 [&::-webkit-details-marker]:hidden">
            <span>Expand evolution notes</span>
            <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clubLines.map(({ club, measuredPoints }) => {
              const readout = clubEvolutionReadout(club, measuredPoints);

              return (
                <div key={club.id} className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold">{formatClubType(club.type)}</p>
                    <StatusPill tone={readout.tone}>{readout.label}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{readout.detail}</p>
                </div>
              );
            })}
          </div>
        </details>
      </CardContent>
    </DataPanel>
  );
}

type DriverEvolutionContext = {
  latestSession: DriverLatestSessionSummary;
  latestMonth: ClubEvolutionMeasuredPoint;
  baselineMonth: ClubEvolutionMeasuredPoint;
  deltaYd: number;
};

type DriverLatestSessionSummary = {
  shotCount: number;
  carryAverageYd: number | null;
  playableRate: number | null;
  ballSpeedAverageMph: number | null;
  ballSpeedBestMph: number | null;
};

function DriverEvolutionContextCard({ context }: { context: DriverEvolutionContext }) {
  const todayCarryLabel = formatCarryYards(context.latestSession.carryAverageYd);
  const latestMonthCarryLabel = formatCarryYards(context.latestMonth.carryYd);
  const baselineCarryLabel = formatCarryYards(context.baselineMonth.carryYd);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Driver read
          </p>
          <p className="mt-1 text-sm font-semibold">
            Playable today, carry down versus {context.baselineMonth.label}.
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Action: monitor carry over the next 2 stock sessions. Do not change swing unless ball
            speed also drops.
          </p>
        </div>
        <StatusPill tone="sky">Monitor carry</StatusPill>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <DriverContextMetric
          label="Today"
          value={todayCarryLabel}
          detail={`${formatMetric(context.latestSession.playableRate)}% playable · ${integerFormatter.format(
            context.latestSession.shotCount,
          )} clean shots`}
        />
        <DriverContextMetric
          label={context.latestMonth.label}
          value={latestMonthCarryLabel}
          detail={`${integerFormatter.format(context.latestMonth.sampleSize)} clean monthly stock shots`}
        />
        <DriverContextMetric
          label={context.baselineMonth.label}
          value={baselineCarryLabel}
          detail={`${integerFormatter.format(context.baselineMonth.sampleSize)} clean monthly stock shots`}
        />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Metric
          label="Driver ball speed today"
          value={formatDriverBallSpeed(
            context.latestSession.ballSpeedAverageMph,
            context.latestSession.ballSpeedBestMph,
          )}
        />
        <Metric
          label="Carry movement"
          value={`${formatSignedYards(context.deltaYd)} vs ${context.baselineMonth.label}`}
        />
      </div>
    </div>
  );
}

function buildDriverEvolutionContext(
  clubLines: Array<{
    club: BagClub;
    measuredPoints: ClubEvolutionMeasuredPoint[];
  }>,
): DriverEvolutionContext | null {
  const driverLine = clubLines.find((row) => row.club.type === "driver") ?? null;

  if (!driverLine || driverLine.measuredPoints.length < 2) {
    return null;
  }

  const latestSession = buildLatestDriverSessionSummary(driverLine.club.shots);

  if (!latestSession) {
    return null;
  }

  const baselineMonth = driverLine.measuredPoints[0];
  const latestMonth = driverLine.measuredPoints[driverLine.measuredPoints.length - 1];

  return {
    latestSession,
    latestMonth,
    baselineMonth,
    deltaYd: roundOneNumber(latestMonth.carryYd - baselineMonth.carryYd),
  };
}

function buildLatestDriverSessionSummary(
  shots: BagClub["shots"],
): DriverLatestSessionSummary | null {
  const cleanDriverShots = shots
    .filter((shot) => shot.clubType === "driver" && isCleanFullBagShot(shot))
    .sort((left, right) => shotTime(right.shotAt) - shotTime(left.shotAt));
  const bySession = new Map<string, typeof cleanDriverShots>();

  for (const shot of cleanDriverShots) {
    const existing = bySession.get(shot.sessionId) ?? [];
    existing.push(shot);
    bySession.set(shot.sessionId, existing);
  }

  const latestSessionShots =
    [...bySession.values()]
      .filter((rows) => rows.length >= 5)
      .sort((left, right) => shotTime(right[0]?.shotAt) - shotTime(left[0]?.shotAt))[0] ?? null;

  if (!latestSessionShots) {
    return null;
  }

  const carryValues = latestSessionShots.map((shot) => shot.carryYd).filter(isFiniteMetric);
  const playableShots = latestSessionShots.filter(
    (shot) =>
      isFiniteMetric(shot.sideCarryYd) && Math.abs(shot.sideCarryYd) <= playableLimit("driver"),
  );
  const directionalShots = latestSessionShots.filter((shot) => isFiniteMetric(shot.sideCarryYd));
  const ballSpeedValues = latestSessionShots
    .map((shot) => shot.ballSpeedMph)
    .filter(isFiniteMetric);

  return {
    shotCount: latestSessionShots.length,
    carryAverageYd: roundOne(averageNumber(carryValues)),
    playableRate:
      directionalShots.length === 0
        ? null
        : roundOneNumber((playableShots.length / directionalShots.length) * 100),
    ballSpeedAverageMph: roundOne(averageNumber(ballSpeedValues)),
    ballSpeedBestMph: roundOne(maxNumberOrNull(ballSpeedValues)),
  };
}

function isCleanFullBagShot(shot: BagClub["shots"][number]) {
  const qualityTag = shot.qualityTag?.trim().toLowerCase();
  const category = shot.shotCategory?.trim().toLowerCase();

  if (!isFiniteMetric(shot.carryYd)) {
    return false;
  }

  if (
    qualityTag &&
    ["top", "mishit", "thin", "fat", "bad_data", "bad-data", "misread"].includes(qualityTag)
  ) {
    return false;
  }

  return !category || category === "full";
}

function playableLimit(clubType: string) {
  if (clubType === "driver") return 45;
  if (clubType.endsWith("w")) return 36;
  if (clubType.endsWith("h")) return 32;
  if (clubType.endsWith("i")) return 26;
  return 18;
}

function shotTime(value: StockShot["shotAt"]) {
  return shotDate(value)?.getTime() ?? 0;
}

function formatDriverBallSpeed(average: number | null, best: number | null) {
  if (average === null && best === null) {
    return "--";
  }

  if (average === null) {
    return `PB ${formatMetric(best)} mph`;
  }

  if (best === null) {
    return `${formatMetric(average)} mph avg`;
  }

  return `${formatMetric(average)} avg / ${formatMetric(best)} PB`;
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

function stockTrendTone(status: StockCarryTrend["status"]): BagDoctorFinding["tone"] {
  if (status === "better") {
    return "green";
  }

  if (status === "worse") {
    return "pink";
  }

  if (status === "steady") {
    return "sky";
  }

  return "slate";
}

function clubTrustScore(club: BagClub) {
  if (club.isShortGameTouch && club.type !== "sw") {
    return Math.min(90, Math.round((club.touch.sampleSize / 50) * 100));
  }

  return club.stock.confidenceScore;
}

function clubHealthReadout(club: BagClub): {
  label: string;
  detail: string;
  tone: BagDoctorFinding["tone"];
} {
  const trust = clubTrustScore(club);
  const stockSampleSize =
    club.isShortGameTouch && club.type !== "sw" ? club.touch.sampleSize : club.stock.sampleSize;
  const missSize = Math.max(club.stock.dispersionLeftYd ?? 0, club.stock.dispersionRightYd ?? 0);

  if (
    stockSampleSize < 10 ||
    trust < 55 ||
    (club.type === "sw" && club.stock.coursePlayCarryYd === null)
  ) {
    return {
      label: "Low confidence",
      detail: `${stockSampleSize} usable shots. Add more proof before changing the play number.`,
      tone: "amber",
    };
  }

  if (club.stockTrend?.status === "worse") {
    return {
      label: "Distance retest",
      detail: `${stockTrendDetail(club.stockTrend)}. Retest 10 clean stock shots before calling this a real regression.`,
      tone: "amber",
    };
  }

  if (missSize >= 28) {
    return {
      label: "Pattern check",
      detail: `Miss window reaches ${formatMetric(missSize)} yd. Treat the carry number separately from start-line control.`,
      tone: "pink",
    };
  }

  if (trust >= 75) {
    return {
      label: stableBagLabel(club),
      detail: `${trust}% trust from the current stock window.`,
      tone: "green",
    };
  }

  return {
    label: "Course usable",
    detail: `${trust}% trust. Fine with a conservative target.`,
    tone: "sky",
  };
}

function stableBagLabel(club: BagClub) {
  return club.isShortGameTouch || isScoringWedgeClub(club.type) ? "Gapping stable" : "Carry stable";
}

function isScoringWedgeClub(clubType: string) {
  return ["pw", "gw", "aw", "sw"].includes(clubType.toLowerCase());
}

function clubCurrentMiss(club: BagClub): {
  label: string;
  detail: string;
  tone: BagDoctorFinding["tone"];
} {
  const sideValues = club.shots.map((shot) => shot.sideCarryYd).filter(isFiniteMetric);

  if (sideValues.length === 0) {
    return {
      label: "Needs side data",
      detail: "Import offline values to show the miss.",
      tone: "slate",
    };
  }

  const averageSide = averageNumber(sideValues);
  const averageStart = averageNumber(
    club.shots.map((shot) => shot.launchDirectionDeg).filter(isFiniteMetric),
  );
  const averagePath = averageNumber(
    club.shots.map((shot) => shot.clubPathDeg).filter(isFiniteMetric),
  );
  const averageCarry = averageNumber(club.shots.map((shot) => shot.carryYd).filter(isFiniteMetric));
  const primaryCarry = clubPrimaryCarryYd(club);
  const sideAbs = Math.abs(averageSide ?? 0);
  const direction =
    averageSide === null || sideAbs <= 4 ? "center" : averageSide > 0 ? "right" : "left";
  const short = primaryCarry !== null && averageCarry !== null && averageCarry <= primaryCarry - 5;
  const label =
    short && direction !== "center"
      ? `Short ${direction}`
      : club.type === "driver" &&
          averagePath !== null &&
          averagePath >= 2.5 &&
          averageStart !== null &&
          averageStart >= 2
        ? "Push draw"
        : direction === "right" && averageStart !== null && averageStart >= 3
          ? "Push right"
          : direction === "left" && averageStart !== null && averageStart <= -2
            ? "Pull left"
            : direction === "right"
              ? "Right miss"
              : direction === "left"
                ? "Left miss"
                : "Playable window";
  const tone = sideAbs <= 8 ? "green" : sideAbs <= 18 ? "sky" : "amber";

  return {
    label,
    detail: `${formatSignedYards(roundOneNumber(averageSide ?? 0))} average side`,
    tone,
  };
}

function clubEvolutionDelta(points: ClubEvolutionMeasuredPoint[]) {
  if (points.length < 2) {
    return "Building";
  }

  const delta = roundOneNumber(points[points.length - 1].carryYd - points[0].carryYd);

  if (delta === 0) {
    return "Stable";
  }

  return formatSignedYards(delta);
}

function clubEvolutionReadout(
  club: BagClub,
  points: ClubEvolutionMeasuredPoint[],
): {
  label: string;
  detail: string;
  confidenceLabel: string;
  tone: BagDoctorFinding["tone"];
} {
  if (points.length < 2) {
    return {
      label: "Low confidence",
      detail: "Need two measured months before calling this a carry trend.",
      confidenceLabel: "low confidence",
      tone: "slate",
    };
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const delta = roundOneNumber(latest.carryYd - first.carryYd);
  const confidenceLabel = clubEvolutionConfidenceLabel(points);
  const sampleDetail = `${latest.label} has ${integerFormatter.format(
    latest.sampleSize,
  )} clean stock shots; ${first.label} had ${integerFormatter.format(first.sampleSize)}.`;
  const signedDelta = delta === 0 ? "stable" : formatSignedYards(delta);

  if (Math.min(first.sampleSize, latest.sampleSize) < 6) {
    return {
      label: "Low confidence",
      detail: `${first.label} to ${latest.label} is ${signedDelta}, but the month sample is thin. Retest 10 stock shots before changing the play number. ${sampleDetail}`,
      confidenceLabel,
      tone: "amber",
    };
  }

  if (delta <= -8) {
    return {
      label: "Distance retest",
      detail: `${first.label} to ${latest.label} is ${formatSignedYards(
        delta,
      )}. Controlled or start-line practice can pull carry lower without proving strike regressed. Retest 10 stock shots. ${sampleDetail}`,
      confidenceLabel,
      tone: "amber",
    };
  }

  if (delta <= -5) {
    return {
      label: "Monitor carry",
      detail: `${first.label} to ${latest.label} is ${formatSignedYards(
        delta,
      )}. Keep the course number conservative and compare after the next stock-distance set. ${sampleDetail}`,
      confidenceLabel,
      tone: "sky",
    };
  }

  if (delta >= 5) {
    return {
      label: "Carry up",
      detail: `${first.label} to ${latest.label} is ${formatSignedYards(
        delta,
      )}. Keep the gain visible but confirm it with the next clean stock set. ${sampleDetail}`,
      confidenceLabel,
      tone: "green",
    };
  }

  return {
    label: stableBagLabel(club),
    detail: `${first.label} to ${latest.label} is within normal variation for median clean-stock carry. ${sampleDetail}`,
    confidenceLabel,
    tone: "green",
  };
}

function clubEvolutionConfidenceLabel(points: ClubEvolutionMeasuredPoint[]) {
  if (points.length < 2) {
    return "low confidence";
  }

  const boundarySample = Math.min(points[0].sampleSize, points[points.length - 1].sampleSize);

  if (boundarySample >= 12) {
    return "high confidence";
  }

  if (boundarySample >= 6) {
    return "medium confidence";
  }

  return "low confidence";
}

function clubEvolutionTone(points: ClubEvolutionMeasuredPoint[]): BagDoctorFinding["tone"] {
  if (points.length < 2) {
    return "slate";
  }

  const delta = points[points.length - 1].carryYd - points[0].carryYd;

  if (delta >= 5) {
    return "green";
  }

  if (delta <= -8) {
    return "amber";
  }

  return "sky";
}

function clubEvolutionTextClass(points: ClubEvolutionMeasuredPoint[]) {
  const tone = clubEvolutionTone(points);

  if (tone === "green") {
    return "text-emerald-700";
  }

  if (tone === "amber" || tone === "pink") {
    return "text-amber-800";
  }

  if (tone === "sky") {
    return "text-sky-700";
  }

  return "text-slate-600";
}

function averageNumber(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundOneNumber(value: number) {
  return Math.round(value * 10) / 10;
}

function shotDate(value: StockShot["shotAt"]) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
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

function formatSignedYards(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)} yd`;
}
