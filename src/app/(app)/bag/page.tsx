import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  CalendarClock,
  ChevronDown,
  CircleDot,
  Database,
  Gauge,
  Grid3X3,
  Layers3,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";

import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  dataChatHref,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Card, CardContent } from "@/components/ui/card";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ballModels,
  clubEquipmentHistory,
  clubs,
  sessions,
  shots,
  userProfiles,
} from "@/db/schema";
import { LazyBagSimulator } from "@/app/bag/lazy-bag-simulator";
import { QuickBagClient, type QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { MobileTopBar } from "@/components/mobile-sports";
import { getDb } from "@/db/client";
import { reportServerFailure } from "@/lib/server-observability";
import {
  buildConfidenceHeatMaps,
  buildShotPatternOverlaySummaries,
  buildSmartBagBuilder,
  buildWedgeMatrix,
  type ConfidenceHeatMap,
  type ShotPatternOverlaySummary,
  type SmartBagBuilder,
  type WedgeMatrixClub,
  type WedgeMatrixShot,
} from "@/lib/bag-intelligence";
import {
  CLUB_BENCHMARK_CARRY_SAMPLE_SIZE,
  buildClubBenchmarkRows,
  type ClubBenchmarkMetricKey,
  type ClubBenchmarkMetricValues,
  type ClubBenchmarkPeerComparison,
  type ClubBenchmarkPeerSummary,
  type ClubBenchmarkRow,
} from "@/lib/club-benchmarks";
import { requireCurrentUserId } from "@/lib/current-user";
import { getClubDecisionLabel, type ClubDecisionLabel } from "@/lib/course-decision-advice";
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
import {
  buildClubEvolutionRows,
  classifyClubEvolutionMovement,
  type ClubEvolutionMeasuredPoint,
} from "@/lib/club-evolution";
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
  type StockShot,
} from "@/lib/stock-yardage";
import { DistanceBenchmarkPanel } from "@/app/bag/distance-benchmark-panel";
import { TargetDistanceSelector, type TargetDistanceRow } from "@/app/bag/target-distance-selector";
import {
  ClubIntelligencePanel,
  type ClubIntelligenceItem,
} from "@/app/bag/club-intelligence-panel";

import styles from "./bag-page.module.css";

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
const bagDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const RECENT_SHOTS_PER_CLUB = 200;
const PEER_SHOT_QUERY_LIMIT = 3000;
const PEER_MIN_STOCK_SHOTS = 3;
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
    href: "/bag?tab=distances#bag-gapping-table",
    detail: "Review clubs where work-on and target fields show the next yardage job.",
  },
  {
    title: "Low confidence clubs",
    href: "/bag?tab=distances#bag-confidence",
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
    href: "/bag?tab=distances#bag-gapping-table",
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
    peers?: string | string[];
    tab?: string | string[];
  }>;
};

const BAG_WORKSPACE_TABS = [
  "distances",
  "clubs",
  "scoring",
  "fitting",
  "history",
  "evidence",
] as const;
type BagWorkspaceTab = (typeof BAG_WORKSPACE_TABS)[number];

function parseBagWorkspaceTab(value: string | string[] | undefined): BagWorkspaceTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BAG_WORKSPACE_TABS.includes(candidate as BagWorkspaceTab)
    ? (candidate as BagWorkspaceTab)
    : "distances";
}

const STICKY_BAG_SUMMARY_TYPES = ["driver", "5w", "7i", "pw", "sw"] as const;
const EVOLUTION_SHOTS_PER_CLUB = 1200;
const BENCHMARK_CARRY_CANDIDATE_SIZE = CLUB_BENCHMARK_CARRY_SAMPLE_SIZE * 2;

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
  clubDataEstType: shots.clubDataEstType,
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
  const activeTab = parseBagWorkspaceTab(resolvedSearchParams.tab);
  const peerBenchmarksLoaded = shouldLoadPeerBenchmarks(resolvedSearchParams.peers);
  const [bag, profile, featureData, speedSummary, equipmentContext] = await Promise.all([
    getBag(),
    ensureCurrentSocialProfile(),
    getFeatureIdeasData(),
    getBagSpeedSummary(),
    getBagEquipmentContext(),
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
  const shotPatternOverlays = buildShotPatternOverlaySummaries(bag);
  const confidenceHeatMaps = buildConfidenceHeatMaps(bag);
  const targetDistanceRows = buildTargetDistanceRows(bag, gappingRows);
  const benchmarkRows = buildBenchmarkRows(bag);
  const peerBenchmarkSummary =
    benchmarkRows.length > 0 && peerBenchmarksLoaded
      ? await getPeerBenchmarkSummary(benchmarkRows)
      : emptyPeerSummary();
  const totalShots = bag.reduce((total, club) => total + club.rawShotCount, 0);
  const stockConfidenceClubs = bag.filter(shouldShowInCarryGapping);
  const bestClub =
    [...stockConfidenceClubs].sort(
      (left, right) => right.stock.confidenceScore - left.stock.confidenceScore,
    )[0] ?? null;
  const averageConfidence =
    stockConfidenceClubs.length === 0
      ? 0
      : Math.round(
          stockConfidenceClubs.reduce((total, club) => total + club.stock.confidenceScore, 0) /
            stockConfidenceClubs.length,
        );
  const maxDisplayCarry = maxVisualCarryYd(gappingRows);
  const bagDoctorFindings = buildBagDoctorFindings(gappingRows);
  const stockFilterClubs = bag.filter((club) => club.stock.stockExclusionReasons.length > 0);
  const weakestClub = findWeakestClub(stockConfidenceClubs);
  const biggestOpportunity = smartBagBuilder.suggestions[0] ?? null;
  const currentGapRisk = buildCurrentGapRisk(gappingRows);
  const trustedClubCount = gappingRows.filter(
    (row) => row.sampleSize >= 10 && row.confidenceScore >= 75,
  ).length;
  const bagScoreTrend = buildBagScoreTrend(bag, {
    handicapBand: profile.handicapBand,
  });
  const clubIntelligenceItems = buildClubIntelligenceItems(bag);
  const quickBagClubs = buildQuickBagClubs(bag);
  const historyTimeline = buildBagHistoryTimeline(bag, equipmentContext);
  return (
    <PageShell contentClassName="overflow-x-clip pb-5">
      <div className={styles.mobileSurface} data-bag-mobile-surface>
        <MobileBagPage
          bag={bag}
          gappingRows={gappingRows}
          benchmarkRows={benchmarkRows}
          peerBenchmarkSummary={peerBenchmarkSummary}
          peerBenchmarksLoaded={peerBenchmarksLoaded}
          quickBagClubs={quickBagClubs}
          accountId={bag[0]?.userId ?? "current"}
          bagScore={smartBagBuilder.currentScore}
          averageConfidence={averageConfidence}
          trustedClubCount={trustedClubCount}
        />
      </div>

      <div className={styles.desktopSurface} data-bag-desktop-surface>
        <DesktopWorkbenchLayout scope="bag">
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
            trustedClubCount={trustedClubCount}
            gappingClubCount={gappingRows.length}
          />

          {bag.length === 0 ? (
            <AppEmptyState
              icon={<Target className="size-5" />}
              title="No clubs imported yet"
              description="Import Rapsodo CSVs to build the bag map. Trusted distances and gapping evidence will appear here."
              primaryAction={
                <Button asChild>
                  <Link href="/import">Import club data</Link>
                </Button>
              }
            />
          ) : (
            <Tabs defaultValue={activeTab} className="min-w-0 gap-5" data-bag-workspace>
              <TabsList variant="line" aria-label="Bag workspace">
                <TabsTrigger value="distances">Distances</TabsTrigger>
                <TabsTrigger value="clubs">Clubs</TabsTrigger>
                <TabsTrigger value="scoring">Scoring</TabsTrigger>
                <TabsTrigger value="fitting">Fitting</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
              </TabsList>

              <TabsContent value="distances" className="grid min-w-0 gap-5">
                <BagConfidenceLadder
                  rows={gappingRows}
                  maxCarryYd={maxDisplayCarry}
                  findings={bagDoctorFindings}
                />
                <BagSupportingEvidence
                  title="Full gapping evidence"
                  description="Open the complete club table, target recommendations and speed context only when you need to audit the decision."
                >
                  {gappingRows.length > 0 ? <CarryGappingTable rows={gappingRows} /> : null}
                  {speedSummary ? <BagSpeedPotentialPanel summary={speedSummary} /> : null}
                  <BagStickySummary rows={gappingRows} />
                </BagSupportingEvidence>
              </TabsContent>

              <TabsContent value="clubs" className="grid min-w-0 gap-5">
                <ClubIntelligencePanel
                  clubs={clubIntelligenceItems}
                  initialClubId={bestClub?.id ?? bag[0]?.id}
                />
                <BagSupportingEvidence
                  title="Club supporting tools"
                  description="Personal bests, target-distance matching and stock-shot filters are grouped behind one review control."
                >
                  <PersonalBestSnapshotPanel clubs={bag} />
                  <TargetDistanceSelector rows={targetDistanceRows} initialTargetYd={150} />
                  {stockFilterClubs.length > 0 ? (
                    <StockFilterPanel clubs={stockFilterClubs} />
                  ) : null}
                </BagSupportingEvidence>
              </TabsContent>

              <TabsContent value="scoring" className="grid min-w-0 gap-5">
                <ConfidenceHeatMapPanel heatMaps={confidenceHeatMaps} />
                <BagSupportingEvidence
                  title="Scoring supporting evidence"
                  description="Shot-pattern and wedge evidence stays available when you need to audit a scoring-club decision."
                >
                  <ShotPatternOverlayPanel overlays={shotPatternOverlays} />
                  <WedgeMatrixPanel matrix={wedgeMatrix} />
                </BagSupportingEvidence>
              </TabsContent>

              <TabsContent value="fitting" className="grid min-w-0 gap-5">
                <FittingStudio
                  bag={bag}
                  equipment={equipmentContext}
                  wedgeMatrix={wedgeMatrix}
                  smartBag={smartBagBuilder}
                />
                <BagSupportingEvidence
                  title="Fitting experiment tools"
                  description="Model a change only after reviewing the current specification and measured evidence."
                >
                  <SmartBagBuilderPanel model={smartBagBuilder} />
                  <LazyBagSimulator
                    clubs={bag.flatMap((club) => {
                      const carry = clubPrimaryCarryYd(club);
                      if (carry === null) return [];
                      return [
                        {
                          id: club.id,
                          label: formatClubType(club.type),
                          carryYd: carry,
                          p25Yd: club.stock.latestReliableCarryP25Yd ?? carry - 6,
                          p75Yd: club.stock.latestReliableCarryP75Yd ?? carry + 6,
                          leftYd: Math.abs(club.stock.dispersionLeftYd ?? 0),
                          rightYd: Math.abs(club.stock.dispersionRightYd ?? 0),
                          confidence: club.stock.confidenceScore,
                        },
                      ];
                    })}
                  />
                </BagSupportingEvidence>
              </TabsContent>

              <TabsContent value="history" className="grid min-w-0 gap-5">
                <BagHistoryTimeline events={historyTimeline} />
              </TabsContent>

              <TabsContent value="evidence" className="grid min-w-0 gap-5">
                <BagScoreTrendPanel
                  points={bagScoreTrend}
                  currentScore={smartBagBuilder.currentScore}
                />
                <ClubEvolutionPanel clubs={bag} />
                {benchmarkRows.length > 0 ? (
                  <BenchmarkReferencePanel
                    rows={benchmarkRows}
                    peerSummary={peerBenchmarkSummary}
                    peerBenchmarksLoaded={peerBenchmarksLoaded}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          )}
        </DesktopWorkbenchLayout>
      </div>
    </PageShell>
  );
}

function MobileBagPage({
  bag,
  gappingRows,
  benchmarkRows,
  peerBenchmarkSummary,
  peerBenchmarksLoaded,
  quickBagClubs,
  accountId,
  bagScore,
  averageConfidence,
  trustedClubCount,
}: {
  bag: BagClub[];
  gappingRows: GappingRow[];
  benchmarkRows: ClubBenchmarkRow[];
  peerBenchmarkSummary: ClubBenchmarkPeerSummary;
  peerBenchmarksLoaded: boolean;
  quickBagClubs: QuickBagClub[];
  accountId: string;
  bagScore: number;
  averageConfidence: number;
  trustedClubCount: number;
}) {
  return (
    <section className="grid gap-5" data-bag-mobile-full>
      <MobileTopBar title="My Bag" />

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bag map</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Know every number</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
            Your playable yardages, gaps, confidence and benchmark progress in one place.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/quick-bag">
            <Target className="size-4" aria-hidden="true" />
            Open Quick Bag
          </Link>
        </Button>
      </div>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Bag sections">
        {[
          ["#bag-yardages", "Yardages"],
          ["#bag-benchmarks", "Benchmarks"],
          ["#bag-quick", "Target finder"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-3 gap-2" aria-label="Bag summary">
        <MobileBagMetric label="Bag score" value={`${bagScore}`} suffix="/100" />
        <MobileBagMetric
          label="Trusted"
          value={`${trustedClubCount}`}
          suffix={`/${gappingRows.length}`}
        />
        <MobileBagMetric label="Confidence" value={`${averageConfidence}`} suffix="%" />
      </div>

      {bag.length === 0 ? (
        <AppEmptyState
          icon={<Target className="size-5" />}
          title="No clubs imported yet"
          description="Import launch-monitor data to build your mobile bag map."
          primaryAction={
            <Button asChild>
              <Link href="/import">Import club data</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section id="bag-yardages" className="scroll-mt-24 space-y-3">
            <SectionHeader
              title="Yardages and gaps"
              description="Recommended course number, reliable range and the next benchmark for every club."
            />
            <div className="grid gap-2">
              {gappingRows.map((row) => (
                <Link
                  key={row.id}
                  href={`/bag/${row.id}`}
                  className="rounded-2xl border bg-card p-4 shadow-sm transition-colors active:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{formatClubType(row.clubType)}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.brandModel}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold tabular-nums">
                        {formatCarryYards(row.gappingCarryYd)}
                      </p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Play number
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                    <MobileBagDatum
                      label="Reliable"
                      value={formatCarryRange(
                        row.latestReliableCarryP25Yd,
                        row.latestReliableCarryP75Yd,
                      )}
                    />
                    <MobileBagDatum
                      label="Gap"
                      value={row.gapToNextYd === null ? "—" : `${Math.round(row.gapToNextYd)} yd`}
                    />
                    <MobileBagDatum label="Confidence" value={`${row.confidenceScore}%`} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-primary">{row.targetMessage}</p>
                </Link>
              ))}
            </div>
          </section>

          <section id="bag-benchmarks" className="scroll-mt-24">
            <DistanceBenchmarkPanel
              rows={benchmarkRows}
              peerSummary={peerBenchmarkSummary}
              peerBenchmarksLoaded={peerBenchmarksLoaded}
            />
          </section>

          <section id="bag-quick" className="scroll-mt-24 space-y-3">
            <SectionHeader
              title="Target finder"
              description="Choose a distance or search a club without leaving your full bag map."
            />
            <QuickBagClient clubs={quickBagClubs} accountId={accountId} />
          </section>
        </>
      )}
    </section>
  );
}

function MobileBagMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {value}
        <span className="text-xs font-semibold text-muted-foreground">{suffix}</span>
      </p>
    </div>
  );
}

function MobileBagDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BagSupportingEvidence({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-bag-supporting-evidence
      className="overflow-hidden rounded-xl border border-border bg-muted/20"
    >
      <Collapsible>
        <div className="p-4">
          <CollapsibleTrigger
            type="button"
            data-variant="ghost"
            className={buttonVariants({
              variant: "ghost",
              className: "h-auto w-full justify-between p-0 text-left",
            })}
          >
            <span className="min-w-0">
              <span className="block text-base font-semibold text-foreground">{title}</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="grid gap-5 border-t border-border p-4">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function FittingStudio({
  bag,
  equipment,
  wedgeMatrix,
  smartBag,
}: {
  bag: BagClub[];
  equipment: BagEquipmentContext;
  wedgeMatrix: WedgeMatrixClub[];
  smartBag: SmartBagBuilder;
}) {
  const currentSetups = equipment.history.filter((row) => row.effectiveTo === null);
  const recordedBallModels = new Set(
    currentSetups
      .map((row) => [row.ballBrand, row.ballModel].filter(Boolean).join(" "))
      .filter(Boolean),
  );
  const specRows = currentSetups.filter(
    (row) => row.loftDeg !== null || row.lieDeg !== null || row.shaft || row.swingWeight,
  );

  return (
    <div className="grid gap-5" data-bag-fitting-studio>
      <div className="grid gap-4 xl:grid-cols-2">
        <FittingFocusSection
          eyebrow="Equipment spec"
          title={`${bag.length} clubs in the active bag`}
          detail={`${bag.filter((club) => club.brand || club.model).length} identify their make or model. Open Equipment to complete the physical build.`}
          href="/equipment"
          icon={<ShoppingBag className="size-5" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {bag.slice(0, 6).map((club) => (
              <div
                key={club.id}
                className="flex items-center justify-between gap-3 border-b border-border/70 py-2 text-sm"
              >
                <span className="font-semibold">{formatClubType(club.type)}</span>
                <span className="truncate text-right text-muted-foreground">{club.brandModel}</span>
              </div>
            ))}
          </div>
        </FittingFocusSection>

        <FittingFocusSection
          eyebrow="Experiment history"
          title={
            equipment.history.length > 0
              ? `${equipment.history.length} recorded setup changes`
              : "No controlled tests recorded"
          }
          detail={
            smartBag.suggestions[0]?.detail ?? "The measured bag has no urgent fitting experiment."
          }
          href="/equipment/experiments"
          icon={<CalendarClock className="size-5" />}
        >
          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Evidence-led next test
            </p>
            <p className="mt-2 font-semibold">
              {smartBag.suggestions[0]?.title ?? "Hold the current setup"}
            </p>
          </div>
        </FittingFocusSection>

        <FittingFocusSection
          eyebrow="Ball model"
          title={recordedBallModels.size > 0 ? [...recordedBallModels].join(", ") : "Not recorded"}
          detail="The ball is part of the fitting baseline. No model is inferred from shot data."
          href="/equipment"
          icon={<CircleDot className="size-5" />}
        />

        <FittingFocusSection
          eyebrow="Loft · lie · shaft"
          title={`${specRows.length} of ${bag.length} clubs have a recorded build`}
          detail="Capture exact loft, lie, shaft and swing weight before comparing equipment changes."
          href="/equipment"
          icon={<Wrench className="size-5" />}
        />
      </div>

      <section aria-labelledby="fitting-wedge-matrix-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Scoring end
            </p>
            <h2
              id="fitting-wedge-matrix-title"
              className="mt-1 text-2xl font-semibold tracking-tight"
            >
              Wedge matrix
            </h2>
          </div>
          <StatusPill tone="sky">{wedgeMatrix.length} wedges</StatusPill>
        </div>
        <WedgeMatrixPanel matrix={wedgeMatrix} />
      </section>
    </div>
  );
}

function FittingFocusSection({
  eyebrow,
  title,
  detail,
  href,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="group overflow-hidden transition-colors hover:border-primary/35">
      <CardContent className="grid h-full content-between gap-5 p-5">
        <div>
          <div className="flex items-center justify-between gap-3 text-primary">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">{eyebrow}</p>
            {icon}
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={href} prefetch={false}>
            Open section
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function BagHistoryTimeline({ events }: { events: BagHistoryEvent[] }) {
  return (
    <DataPanel id="bag-history" className="overflow-hidden">
      <SectionHeader
        title="Bag history"
        description="Equipment changes, trusted baselines, retired clubs and meaningful yardage movements in one chronological record."
        action={<CalendarClock className="size-5 text-primary" />}
      />
      <CardContent className="p-0">
        {events.length > 0 ? (
          <ol className="divide-y divide-border" aria-label="Bag history timeline">
            {events.map((event) => (
              <li
                key={event.id}
                className="grid grid-cols-[9rem_1.5rem_minmax(0,1fr)] gap-4 px-5 py-5"
              >
                <div>
                  <p className="text-sm font-semibold">{bagDateFormatter.format(event.date)}</p>
                  <p className={`mt-1 text-xs font-medium ${toneTextClass(event.tone)}`}>
                    {event.kind}
                  </p>
                </div>
                <div className="relative flex justify-center">
                  <span className="absolute inset-y-[-1.25rem] w-px bg-border" aria-hidden />
                  <span
                    className={`relative mt-1 size-3 rounded-full ring-4 ring-card ${confidenceBarClass(event.tone)}`}
                    aria-hidden
                  />
                </div>
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            History begins when you establish a baseline, record a setup change or retire a club.
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function buildBagHistoryTimeline(
  bag: BagClub[],
  equipment: BagEquipmentContext,
): BagHistoryEvent[] {
  const equipmentEvents = equipment.history.map((row) => {
    const equipmentDetail = [
      row.ballModel ? `ball ${[row.ballBrand, row.ballModel].filter(Boolean).join(" ")}` : null,
      row.loftDeg === null ? null : `${formatMetric(row.loftDeg)}° loft`,
      row.lieDeg === null ? null : `${formatMetric(row.lieDeg)}° lie`,
      row.shaft,
      row.swingWeight ? `${row.swingWeight} swing weight` : null,
      row.notes,
    ].filter(Boolean);

    return {
      id: `equipment-${row.id}`,
      date: row.effectiveFrom,
      kind: "Equipment change" as const,
      title: `${formatClubType(row.clubType)} setup recorded`,
      detail:
        equipmentDetail.length > 0
          ? equipmentDetail.join(" · ")
          : "A setup baseline was recorded without detailed specification.",
      tone: "sky" as const,
    };
  });
  const retiredEvents = equipment.retired.map((club) => ({
    id: `retired-${club.id}`,
    date: club.updatedAt,
    kind: "Retired club" as const,
    title: `${formatClubType(club.type)} removed from the active bag`,
    detail: [club.brand, club.model].filter(Boolean).join(" ") || "No make or model was recorded.",
    tone: "slate" as const,
  }));
  const baselineEvents = bag.flatMap((club) => {
    const latestShot = club.evolutionShots[0]?.shotAt ?? club.shots[0]?.shotAt ?? null;
    const carry = club.stock.latestReliableCarryYd;
    if (!(latestShot instanceof Date) || carry === null) return [];

    return [
      {
        id: `baseline-${club.id}`,
        date: latestShot,
        kind: "New baseline" as const,
        title: `${formatClubType(club.type)} trusted at ${formatCarryYards(carry)}`,
        detail: `${club.stock.latestReliableSampleSize} recent reliable shots · ${club.stock.confidenceScore}% confidence.`,
        tone: club.stock.confidenceScore >= 75 ? ("green" as const) : ("amber" as const),
      },
    ];
  });
  const movementEvents = bag.flatMap((club) => {
    const delta = club.stockTrend?.deltaYd ?? null;
    const latestShot = club.shots[0]?.shotAt ?? null;
    if (delta === null || Math.abs(delta) < 5 || !(latestShot instanceof Date)) return [];

    return [
      {
        id: `movement-${club.id}`,
        date: latestShot,
        kind: "Yardage movement" as const,
        title: `${formatClubType(club.type)} moved ${formatSignedYards(delta)}`,
        detail: `${club.stockTrend?.latestSampleSize ?? 0} recent stock shots compared with ${club.stockTrend?.previousSampleSize ?? 0} previous shots.`,
        tone: "amber" as const,
      },
    ];
  });

  return [...equipmentEvents, ...retiredEvents, ...movementEvents, ...baselineEvents]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 24);
}

function buildQuickBagClubs(bag: BagClub[]): QuickBagClub[] {
  return bag.map((club) => {
    const widerSide =
      club.stock.dispersionLeftYd === null || club.stock.dispersionRightYd === null
        ? null
        : Math.abs(club.stock.dispersionLeftYd) > Math.abs(club.stock.dispersionRightYd)
          ? "Left"
          : Math.abs(club.stock.dispersionRightYd) > Math.abs(club.stock.dispersionLeftYd)
            ? "Right"
            : "Balanced";

    return {
      id: club.id,
      label: formatClubType(club.type),
      model: club.brandModel,
      trustedCarryYd: clubPrimaryCarryYd(club),
      playNumberYd: club.stock.coursePlayCarryYd,
      lowYd: club.stock.latestReliableCarryP25Yd,
      highYd: club.stock.latestReliableCarryP75Yd,
      typicalMiss: clubCurrentMiss(club).label,
      widerSide,
      medianLateralYd: null,
      lateralLowYd: club.stock.dispersionLeftYd,
      lateralHighYd: club.stock.dispersionRightYd,
      patternSampleSize: club.shots.length,
      confidence: clubTrustScore(club),
      sampleSize: club.stock.sampleSize,
      latestEvidenceDate: club.shots[0]?.shotAt?.toISOString() ?? null,
    };
  });
}

async function getBagEquipmentContext() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [history, retired] = await Promise.all([
    db
      .select({
        id: clubEquipmentHistory.id,
        clubType: clubs.type,
        ballBrand: ballModels.brand,
        ballModel: ballModels.model,
        effectiveFrom: clubEquipmentHistory.effectiveFrom,
        effectiveTo: clubEquipmentHistory.effectiveTo,
        loftDeg: clubEquipmentHistory.loftDeg,
        lieDeg: clubEquipmentHistory.lieDeg,
        shaft: clubEquipmentHistory.shaft,
        swingWeight: clubEquipmentHistory.swingWeight,
        notes: clubEquipmentHistory.notes,
      })
      .from(clubEquipmentHistory)
      .innerJoin(clubs, eq(clubs.id, clubEquipmentHistory.clubId))
      .leftJoin(ballModels, eq(ballModels.id, clubEquipmentHistory.ballModelId))
      .where(eq(clubEquipmentHistory.userId, userId))
      .orderBy(desc(clubEquipmentHistory.effectiveFrom)),
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
        updatedAt: clubs.updatedAt,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, false)))
      .orderBy(desc(clubs.updatedAt)),
  ]);

  return { history, retired };
}

async function getBagSpeedSummary(): Promise<SpeedCentreSummary | null> {
  try {
    const userId = await requireCurrentUserId();
    const data = await getSpeedCoachCardData(userId);
    return data.summary;
  } catch (error) {
    reportServerFailure("bag_speed_summary_failed", error, {
      "app.route": "/bag",
      "app.fallback": "empty_speed_summary",
    });
    return null;
  }
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

type BagEquipmentContext = Awaited<ReturnType<typeof getBagEquipmentContext>>;
type BagHistoryEvent = {
  id: string;
  date: Date;
  kind: "Equipment change" | "New baseline" | "Retired club" | "Yardage movement";
  title: string;
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
  trustedClubCount,
  gappingClubCount,
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
  trustedClubCount: number;
  gappingClubCount: number;
}) {
  const healthAnswer =
    gappingClubCount === 0
      ? "Your trusted numbers are still building"
      : `${trustedClubCount} of ${gappingClubCount} clubs have trusted numbers`;

  return (
    <section
      id="bag-health"
      className="scroll-mt-28 overflow-hidden rounded-xl border border-foreground/15 bg-foreground text-background shadow-lg"
      data-bag-health-card
    >
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)] xl:p-8">
        <div className="grid content-between gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-background/65">
              <span>My bag</span>
              <span className="h-px w-10 bg-background/35" aria-hidden />
              <span>
                {clubs} clubs · {shots.toLocaleString("en-GB")} shots
              </span>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-background xl:text-6xl">
              {healthAnswer}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-background/68">
              These are the numbers ready to take to the course. Anything untrusted stays visible,
              but it does not get promoted into a decision.
            </p>
          </div>

          <ConnectedMetricBar
            embedded
            label="Bag health metrics"
            className="border-background/15 bg-background/5 text-background [&_*]:border-background/10 [&_p]:text-background/65"
            metrics={[
              { label: "Bag health", value: `${bagScore}%`, detail: scoreLabel },
              { label: "Average trust", value: `${confidence}%`, detail: `${clubs} active clubs` },
              { label: "Data health", value: dataTrust, detail: dataTrustDetail },
              { label: "Measured", value: shots.toLocaleString("en-GB"), detail: "saved shots" },
            ]}
          />
        </div>

        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-3 border-b border-background/15 pb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-background/60">
              Bag check
            </p>
            <span className="text-sm font-semibold text-background">{scoreLabel}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <BagHealthSignal
              label="Largest gap"
              value={currentGapRisk.value}
              detail={currentGapRisk.detail}
              tone={currentGapRisk.tone}
              href={currentGapRisk.href}
            />
            <BagHealthSignal
              label="Weakest confidence"
              value={weakestClub ? formatClubType(weakestClub.type) : "--"}
              detail={
                weakestClub
                  ? `${clubTrustScore(weakestClub)}% trust · ${weakestClub.stock.sampleSize} stock shots`
                  : "Every active club has usable evidence"
              }
              tone={weakestClub ? clubHealthReadout(weakestClub).tone : "slate"}
              href={weakestClub ? `/bag/${weakestClub.id}` : undefined}
            />
            <BagHealthSignal
              label="Next bag action"
              value={biggestOpportunity?.title ?? "Keep the setup"}
              detail={biggestOpportunity?.detail ?? "No evidence-backed equipment move is urgent."}
              tone={biggestOpportunity?.tone ?? "green"}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <p className="text-xs leading-5 text-background/55">
              Most trusted: {strongestClub ? formatClubType(strongestClub.type) : "building"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                className="bg-background text-foreground hover:bg-background/90"
              >
                <Link
                  href={dataChatHref(
                    "Explain my bag confidence using the visible club trust, gapping and data-health evidence. Do not invent missing yardages.",
                  )}
                  prefetch={false}
                >
                  <Brain className="size-4" />
                  Ask about my bag
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-background hover:bg-background/10 hover:text-background"
              >
                <Link href="/equipment">
                  <Wrench className="size-4" />
                  Equipment
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
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
    <div
      className="grid h-full min-h-36 content-between gap-3 rounded-lg border border-background/20 bg-background p-3 text-foreground"
      data-bag-health-signal
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-3 text-xl font-semibold leading-6 tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
      <span
        className={`size-2.5 rounded-full ${
          tone === "violet" ? "bg-primary" : confidenceBarClass(tone)
        }`}
        aria-hidden
      />
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className="focus-aaa block h-full rounded-xl outline-none transition-opacity hover:opacity-90"
    >
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
    <div className="rounded-lg border border-border bg-card/82 p-3">
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
          <div key={point.key} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {point.label}
              </span>
              <span className={`font-semibold ${toneTextClass(point.tone)}`}>{point.score}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-card">
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

function SmartBagBuilderPanel({ model }: { model: SmartBagBuilder }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Gap wedge integration"
        description="Smart bag builder scores the current setup and ranks the next bag move."
        action={<ShoppingBag className="size-5 text-primary" />}
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
                className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3"
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
            <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] p-3 text-sm font-medium text-[var(--status-success-foreground)]">
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
        action={<Grid3X3 className="size-5 text-[var(--status-warning-foreground)]" />}
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
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                  <TableRow>
                    <TableHead
                      data-column="club"
                      className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                          className="sticky left-0 z-10 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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

function ShotPatternOverlayPanel({ overlays }: { overlays: ShotPatternOverlaySummary[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Shot pattern overlays"
        description="Carry cone, offline window, and playable rate from actual shot patterns."
        action={<Layers3 className="size-5 text-primary" />}
      />
      <CardContent>
        {overlays.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {overlays.map((overlay) => (
              <div key={overlay.clubId} className="rounded-lg border border-border bg-muted/30 p-3">
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
                  className="mt-2 bg-card/70"
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

function ConfidenceHeatMapPanel({ heatMaps }: { heatMaps: ConfidenceHeatMap[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Confidence heat maps"
        description="Green, amber, and red carry windows by club."
        action={<Sparkles className="size-5 text-primary" />}
      />
      <CardContent>
        {heatMaps.length > 0 ? (
          <div className="grid gap-3">
            {heatMaps.slice(0, 4).map((heatMap) => (
              <div key={heatMap.clubId} className="rounded-lg border border-border bg-muted/30 p-3">
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

function EmptyPanelMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
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
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border/70 bg-card/86 px-2.5 text-sm font-semibold shadow-sm transition-colors hover:border-primary/40"
            >
              <span className="text-muted-foreground">{compactClubLabel(row.clubType)}</span>
              <span className="text-foreground">{compactCarryYards(visualCarryYd(row))}</span>
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
      <Collapsible className="group">
        <CollapsibleTrigger
          type="button"
          data-variant="ghost"
          data-size="lg"
          className={buttonVariants({
            variant: "ghost",
            size: "lg",
            className:
              "grid h-auto w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 whitespace-normal rounded-none border-b border-transparent px-4 py-3 text-left transition-colors hover:bg-muted/50 group-data-[state=open]:border-border",
          })}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Database className="size-5 text-[var(--status-information-foreground)]" />
              <h2 className="text-lg font-semibold tracking-normal text-foreground sm:text-xl">
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
            <ChevronDown className="size-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <StockFilterCards clubs={clubs} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
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
          className="rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-[var(--status-information-border)]"
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
  const leadFinding = findings.find((finding) => finding.tone !== "green") ?? findings[0];

  return (
    <section
      id="bag-confidence"
      className="grid min-w-0 scroll-mt-28 gap-4 overflow-x-clip xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)] xl:items-start"
    >
      <DataPanel className="min-w-0 overflow-x-clip">
        <SectionHeader
          title="Distance ladder"
          description="Your trusted carry is the marker. The shaded rail is the expected range; the connector is the measured gap to the next club."
          action={<Gauge className="size-5 text-primary" />}
        />
        <CardContent className="p-0">
          <div
            aria-label="Bag distance ladder"
            className="divide-y divide-border/70"
            data-bag-distance-ladder
          >
            {rows.map((row, index) => {
              const confidence = confidenceReadout(row);
              const gap = gapReadout(row);
              const visualCarry = visualCarryYd(row);
              const rangeLow = row.latestReliableCarryP25Yd ?? visualCarry;
              const rangeHigh = row.latestReliableCarryP75Yd ?? visualCarry;
              const hasRange = rangeLow !== null && rangeHigh !== null;
              const nextRow = rows[index + 1] ?? null;

              return (
                <div key={row.id} className="group relative">
                  <Link
                    href={`/bag/${row.id}`}
                    prefetch={false}
                    className="focus-aaa grid min-h-24 grid-cols-[minmax(120px,0.34fr)_minmax(260px,1fr)_110px] items-center gap-5 px-5 py-4 outline-none transition-colors hover:bg-muted/35"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2.5 shrink-0 rounded-full ${confidenceBarClass(confidence.tone)}`}
                          aria-hidden
                        />
                        <p className="text-xl font-semibold tracking-tight">
                          {formatClubType(row.clubType)}
                        </p>
                      </div>
                      <p className="mt-1 truncate pl-[1.125rem] text-xs text-muted-foreground">
                        {row.brandModel}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <div className="relative h-9" aria-hidden>
                        <span className="absolute inset-x-0 top-4 h-px bg-border" />
                        {hasRange ? (
                          <span
                            className="absolute top-2 h-5 rounded-full bg-primary/18 ring-1 ring-inset ring-primary/25"
                            style={{
                              left: `${carryWidthPercent(rangeLow, maxCarryYd)}%`,
                              width: `${Math.max(3, carryWidthPercent(rangeHigh, maxCarryYd) - carryWidthPercent(rangeLow, maxCarryYd))}%`,
                            }}
                          />
                        ) : null}
                        <span
                          className="absolute left-0 top-[0.875rem] h-1 rounded-full bg-primary/45 transition-colors group-hover:bg-primary"
                          style={{
                            width: `${carryWidthPercent(visualCarry, maxCarryYd)}%`,
                          }}
                        />
                        <span
                          className="absolute top-1 size-7 -translate-x-1/2 rounded-full border-4 border-card bg-primary shadow-md ring-1 ring-primary/30"
                          style={{ left: `${carryWidthPercent(visualCarry, maxCarryYd)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <span>
                          <span className="text-muted-foreground">Range </span>
                          {formatCarryRange(rangeLow, rangeHigh)}
                        </span>
                        <span>
                          <span className="text-muted-foreground">Trust </span>
                          {row.confidenceScore}%
                        </span>
                        <span>
                          <span className="text-muted-foreground">Sample </span>
                          {row.sampleSize}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-semibold tabular-nums tracking-tight">
                        {compactCarryYards(visualCarry)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">yd</span>
                      </p>
                      <StatusPill tone={confidence.tone} className="mt-2">
                        {confidence.label}
                      </StatusPill>
                    </div>
                  </Link>
                  {nextRow ? (
                    <div className="pointer-events-none absolute -bottom-3 right-[7.35rem] z-10 flex translate-y-1/2 items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                      <span className="text-muted-foreground">Gap</span>
                      <span className={toneTextClass(gap.tone)}>{gap.value}</span>
                      <span className="sr-only">to {formatClubType(nextRow.clubType)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </DataPanel>

      <div className="grid gap-3" data-bag-gapping-doctor>
        {leadFinding ? (
          <Alert variant={leadFinding.tone === "pink" ? "destructive" : "default"}>
            {leadFinding.tone === "green" ? (
              <ShieldCheck className="size-4" aria-hidden />
            ) : (
              <AlertTriangle className="size-4" aria-hidden />
            )}
            <AlertTitle className="flex flex-wrap items-center gap-2">
              {leadFinding.title}
              <Badge variant="secondary">{leadFinding.label}</Badge>
            </AlertTitle>
            <AlertDescription>{leadFinding.detail}</AlertDescription>
          </Alert>
        ) : null}
        <Collapsible>
          <CollapsibleTrigger
            type="button"
            className={buttonVariants({
              variant: "outline",
              className: "w-full justify-between",
            })}
          >
            Review all gap findings
            <Badge variant="secondary">{findings.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-2 pt-2">
            {findings.map((finding) => (
              <Link
                key={`${finding.title}-${finding.detail}`}
                href={finding.href ?? "/import"}
                prefetch={false}
              >
                <Item variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{finding.title}</ItemTitle>
                    <ItemDescription>{finding.detail}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="secondary">{finding.label}</Badge>
                  </ItemActions>
                </Item>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
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
    bag.map((club) => {
      const { filteredShots: benchmarkCandidates } = selectStockYardageShots(
        club.evolutionShots,
        EVOLUTION_SHOTS_PER_CLUB,
        {
          clubType: club.type,
          averageSampleSize: BENCHMARK_CARRY_CANDIDATE_SIZE,
        },
      );
      const benchmarkShots = benchmarkCandidates.slice(0, CLUB_BENCHMARK_CARRY_SAMPLE_SIZE);
      const sampleCarryYards = benchmarkShots.map((shot) => shot.carryYd).filter(isFiniteMetric);
      const carryYd = averageBenchmarkMetric(benchmarkShots, (shot) => shot.carryYd);

      return {
        clubId: club.id,
        clubType: club.type,
        brandModel: club.brandModel,
        carryYd,
        bestSampleFloorYd:
          sampleCarryYards.length === 0 ? null : roundOneNumber(Math.min(...sampleCarryYards)),
        sampleSize: benchmarkShots.length,
        reviewedShotCount: club.evolutionShots.length,
        savedShotCount: club.rawShotCount,
        sampleCarryYards,
        confidenceScore: club.stock.confidenceScore,
        metrics: buildBenchmarkMetricValues(benchmarkShots, carryYd),
      };
    }),
  );
}

function buildBenchmarkMetricValues(
  benchmarkShots: BagClub["evolutionShots"],
  carryYd: number | null,
): ClubBenchmarkMetricValues {
  return {
    carryYd,
    clubSpeedMph: averageBenchmarkMetric(benchmarkShots, (shot) => shot.clubSpeedMph),
    ballSpeedMph: averageBenchmarkMetric(benchmarkShots, (shot) => shot.ballSpeedMph),
    smashFactor: averageBenchmarkMetric(benchmarkShots, (shot) => shot.smashFactor, 2),
    maxHeightYd: averageBenchmarkMetric(
      benchmarkShots,
      (shot) => (shot.apexFt === null || shot.apexFt === undefined ? null : shot.apexFt / 3),
      1,
    ),
    landAngleDeg: averageBenchmarkMetric(benchmarkShots, (shot) => shot.descentAngleDeg),
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
    const averageApexFt = averageNumber(
      club.shots.flatMap((shot) => (isFiniteMetric(shot.apexFt) ? [shot.apexFt] : [])),
    );
    const averageBallSpeedMph =
      club.stock.averageBallSpeedMph ??
      averageNumber(
        club.shots.flatMap((shot) =>
          isFiniteMetric(shot.ballSpeedMph) ? [shot.ballSpeedMph] : [],
        ),
      );
    const dispersionWidth =
      club.stock.dispersionLeftYd === null || club.stock.dispersionRightYd === null
        ? null
        : Math.abs(club.stock.dispersionLeftYd) + Math.abs(club.stock.dispersionRightYd);
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
      totalLabel: formatCarryYards(club.stock.totalMedianYd),
      dispersionLabel:
        dispersionWidth === null ? "Building" : `${formatMetric(dispersionWidth)} yd wide`,
      commonMissLabel: miss.label,
      launchLabel:
        club.stock.averageLaunchAngleDeg === null
          ? "Building"
          : `${formatMetric(club.stock.averageLaunchAngleDeg)}°`,
      apexLabel: averageApexFt === null ? "Building" : `${formatMetric(averageApexFt)} ft`,
      speedLabel:
        averageBallSpeedMph === null ? "Building" : `${formatMetric(averageBallSpeedMph)} mph`,
      latestChangeLabel: trend?.label ?? "Baseline building",
      latestChangeDetail: trend?.detail ?? "Add two clean stock samples to establish movement.",
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

function PersonalBestSnapshotPanel({ clubs }: { clubs: BagClub[] }) {
  const rows = clubs
    .filter((club) => club.personalBest.carryYd !== null || club.personalBest.totalYd !== null)
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));

  return (
    <DataPanel id="personal-bests" className="scroll-mt-28 overflow-x-clip">
      <SectionHeader
        title="Personal bests"
        description="Compact peak-distance reference without a full-screen bar chart."
        action={<Trophy className="size-5 text-[var(--status-warning-foreground)]" />}
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
                  className="grid min-w-32 rounded-lg border border-border bg-muted/30 px-3 py-3 transition-colors hover:border-[var(--status-warning-border)]"
                >
                  <span className="text-sm font-semibold">{formatClubType(club.type)}</span>
                  <span className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
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

function CarryGappingTable({ rows }: { rows: GappingRow[] }) {
  const targetGapYd = rows.find((row) => row.targetGapYd !== null)?.targetGapYd ?? null;

  return (
    <section className="min-w-0 overflow-hidden" data-full-gapping-evidence>
      <div className="pb-4">
        <h3 className="text-xl font-semibold tracking-normal sm:text-2xl">
          Carry gapping reference
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Target gap stays visible. The full club table is available when you need the detail.
        </p>
      </div>
      <div className="space-y-4 sm:space-y-5">
        {targetGapYd !== null ? (
          <GappingRecommendations rows={rows} targetGapYd={targetGapYd} />
        ) : null}
        <CarryGappingBars rows={rows} />
        <div
          id="bag-gapping-table"
          className="min-w-0 scroll-mt-28 overflow-hidden"
          data-bag-gapping-table
        >
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold">
            <span>Full gapping table</span>
            <StatusPill tone="sky">{rows.length} clubs</StatusPill>
          </div>
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
                Full bag gapping table with stock carry, latest reliable carry, recommended number,
                personal best, target gap, sample size and decision confidence.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead
                    data-column="club"
                    className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                      className="sticky left-0 z-10 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
      </div>
    </section>
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
            className="grid gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-card/80"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{formatClubType(row.clubType)}</span>
              {carryBarReadout(row)}
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
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
        <span className="font-semibold text-foreground">
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
        <span className="font-semibold text-foreground">{formatMetric(row.carryYd)} yd stock</span>
        <span className="text-xs text-muted-foreground">recommended building</span>
      </span>
    );
  }

  return <span className="text-foreground">Needs calibration</span>;
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
      ? "border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-destructive"
      : gapYd < 8
        ? "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]"
        : gapYd > 18 && isScoringEndGap(input)
          ? "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]"
          : gapYd > 18 && isMissingYardageWindowGap(input)
            ? "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]"
            : gapYd > 18 && isManageableTopEndGap(input)
              ? "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]"
              : gapYd > 18
                ? "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]"
                : "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";

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
    return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
  }

  if (tone === "sky") {
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }

  if (tone === "amber") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
  }

  if (tone === "pink") {
    return "border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-destructive";
  }

  return "border-border bg-muted/50 text-muted-foreground";
}

function confidenceBarClass(tone: BagDoctorFinding["tone"]) {
  if (tone === "green") {
    return "bg-[var(--confidence-high)]";
  }

  if (tone === "sky") {
    return "bg-[var(--chart-2)]";
  }

  if (tone === "amber") {
    return "bg-[var(--confidence-medium)]";
  }

  if (tone === "pink") {
    return "bg-[var(--confidence-low)]";
  }

  return "bg-muted-foreground";
}

function intelligenceToneClass(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  if (tone === "green") {
    return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
  }

  if (tone === "sky") {
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }

  if (tone === "amber") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
  }

  if (tone === "pink") {
    return "border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-destructive";
  }

  return "border-border bg-muted/50 text-muted-foreground";
}

function toneTextClass(tone: BagDoctorFinding["tone"]) {
  if (tone === "green") {
    return "text-[var(--status-success-foreground)]";
  }

  if (tone === "sky") {
    return "text-[var(--status-information-foreground)]";
  }

  if (tone === "amber") {
    return "text-[var(--status-warning-foreground)]";
  }

  if (tone === "pink") {
    return "text-destructive";
  }

  return "text-muted-foreground";
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
      className="clubhouse-chart-plot mt-3 h-36 w-full rounded-lg border border-border bg-card"
    >
      <rect width="240" height="140" fill="var(--chart-plot-background, #F8FAFC)" />
      <line
        x1="120"
        x2="120"
        y1="16"
        y2="126"
        stroke="var(--chart-grid-strong, #CBD5E1)"
        strokeDasharray="4 4"
      />
      <line x1="28" x2="212" y1="122" y2="122" stroke="var(--chart-grid, #E2E8F0)" />
      <polygon
        points={`${xLeft},${yNear} ${xRight},${yNear} ${xRight},${yFar} ${xLeft},${yFar}`}
        fill="var(--chart-zone-fill, #DCFCE7)"
        opacity="0.75"
        stroke="var(--chart-positive, #16A34A)"
      />
      <circle cx="120" cy={yMiddle} r="5" fill="var(--chart-comparison, #0F766E)" />
      <text x="12" y="24" fill="var(--chart-axis, #64748B)" fontSize="10">
        left
      </text>
      <text x="210" y="24" textAnchor="end" fill="var(--chart-axis, #64748B)" fontSize="10">
        right
      </text>
      <text x="120" y="136" textAnchor="middle" fill="var(--chart-axis, #64748B)" fontSize="10">
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
    <DataPanel id="club-evolution" className="scroll-mt-28">
      <SectionHeader
        title="Club evolution"
        description="Monthly median carry and offline control from the same clean-stock shots."
        action={<TrendingUp className="size-5 text-primary" />}
      />
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_7rem_8rem_10rem] gap-3 border-b border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Club</span>
            <span>Last three months</span>
            <span className="text-right">Carry</span>
            <span className="text-right">Control</span>
            <span className="text-right">Read</span>
          </div>
          {clubLines.map(({ club, measuredPoints, points }) => {
            const readout = clubEvolutionReadout(club, measuredPoints);

            return (
              <Link
                key={club.id}
                href={`/bag/${club.id}`}
                prefetch={false}
                className="grid grid-cols-[7rem_minmax(0,1fr)_7rem_8rem_10rem] items-center gap-3 border-b border-border px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-card"
              >
                <span className="font-semibold">{formatClubType(club.type)}</span>
                <span className="grid grid-cols-3 gap-2">
                  {points.map((point) => (
                    <span
                      key={point.key}
                      className={`rounded-md px-2 py-1 ${
                        point.carryYd === null ? "bg-card/45 text-muted-foreground" : "bg-card/80"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {point.label}
                      </span>
                      <span className="block font-semibold">
                        {point.carryYd === null ? "No shots" : `${formatMetric(point.carryYd)} yd`}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {point.medianAbsoluteOfflineYd === null
                          ? "No side data"
                          : `${formatMetric(point.medianAbsoluteOfflineYd)} yd median offline`}
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
                  <span
                    className={`block font-semibold ${clubEvolutionControlTextClass(measuredPoints)}`}
                  >
                    {clubEvolutionControlDelta(measuredPoints)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">median offline</span>
                </span>
                <span className="text-right">
                  <StatusPill tone={readout.tone}>{readout.label}</StatusPill>
                </span>
              </Link>
            );
          })}
        </div>
        {driverContext ? <DriverEvolutionContextCard context={driverContext} /> : null}
        <Collapsible className="group mt-3">
          <CollapsibleTrigger
            type="button"
            data-variant="outline"
            className={buttonVariants({
              variant: "outline",
              className:
                "h-auto w-full cursor-pointer items-center justify-between gap-3 whitespace-normal px-3 py-2 text-sm font-semibold transition-colors hover:border-primary/40",
            })}
          >
            <span>Expand evolution notes</span>
            <ChevronDown className="size-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clubLines.map(({ club, measuredPoints }) => {
              const readout = clubEvolutionReadout(club, measuredPoints);

              return (
                <div key={club.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold">{formatClubType(club.type)}</p>
                    <StatusPill tone={readout.tone}>{readout.label}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{readout.detail}</p>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </DataPanel>
  );
}

type DriverEvolutionContext = {
  latestSession: DriverLatestSessionSummary;
  latestMonth: ClubEvolutionMeasuredPoint;
  baselineMonth: ClubEvolutionMeasuredPoint;
  deltaYd: number;
  controlDeltaYd: number | null;
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
  const isStraighterTradeoff = context.deltaYd <= -5 && (context.controlDeltaYd ?? 0) <= -3;

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Driver read
          </p>
          <p className="mt-1 text-sm font-semibold">
            {isStraighterTradeoff
              ? `Carry is down, but the monthly pattern is ${formatMetric(
                  Math.abs(context.controlDeltaYd ?? 0),
                )} yd tighter.`
              : `Playable today, carry down versus ${context.baselineMonth.label}.`}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {isStraighterTradeoff
              ? "Action: treat this as a possible distance-for-control trade-off. Confirm ball speed and strike before changing the swing or course number."
              : "Action: monitor carry over the next 2 stock sessions. Do not change swing unless ball speed also drops."}
          </p>
        </div>
        <StatusPill tone="sky">
          {isStraighterTradeoff ? "Straighter trade-off" : "Monitor carry"}
        </StatusPill>
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
          detail={`${integerFormatter.format(context.latestMonth.sampleSize)} clean · ${monthlyControlDetail(context.latestMonth)}`}
        />
        <DriverContextMetric
          label={context.baselineMonth.label}
          value={baselineCarryLabel}
          detail={`${integerFormatter.format(context.baselineMonth.sampleSize)} clean · ${monthlyControlDetail(context.baselineMonth)}`}
        />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
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
        <Metric
          label="Control movement"
          value={`${clubEvolutionControlDelta([
            context.baselineMonth,
            context.latestMonth,
          ])} vs ${context.baselineMonth.label}`}
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
  const movement = classifyClubEvolutionMovement(driverLine.measuredPoints);

  return {
    latestSession,
    latestMonth,
    baselineMonth,
    deltaYd: roundOneNumber(latestMonth.carryYd - baselineMonth.carryYd),
    controlDeltaYd: movement.controlDeltaYd,
  };
}

function monthlyControlDetail(point: ClubEvolutionMeasuredPoint) {
  if (point.medianAbsoluteOfflineYd === null) {
    return "no side data";
  }

  return `${formatMetric(point.medianAbsoluteOfflineYd)} yd median offline`;
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
  const { carryDeltaYd } = classifyClubEvolutionMovement(points);

  if (carryDeltaYd === null) {
    return "Building";
  }

  if (carryDeltaYd === 0) {
    return "Stable";
  }

  return formatSignedYards(carryDeltaYd);
}

function clubEvolutionControlDelta(points: ClubEvolutionMeasuredPoint[]) {
  const { controlDeltaYd } = classifyClubEvolutionMovement(points);

  if (controlDeltaYd === null) {
    return "No comparison";
  }

  if (controlDeltaYd === 0) {
    return "Stable";
  }

  return controlDeltaYd < 0
    ? `${formatMetric(Math.abs(controlDeltaYd))} yd tighter`
    : `${formatMetric(controlDeltaYd)} yd wider`;
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
  const movement = classifyClubEvolutionMovement(points);
  const delta = movement.carryDeltaYd ?? 0;
  const confidenceLabel = clubEvolutionConfidenceLabel(points);
  const sampleDetail = `${latest.label} has ${integerFormatter.format(
    latest.sampleSize,
  )} clean stock shots; ${first.label} had ${integerFormatter.format(first.sampleSize)}.`;
  const directionalDetail =
    movement.controlDeltaYd === null
      ? "There is not enough side-carry evidence in both months to judge straightness."
      : `Median offline moved ${clubEvolutionControlDelta(points)}.`;
  const signedDelta = delta === 0 ? "stable" : formatSignedYards(delta);

  if (movement.kind === "low-confidence") {
    return {
      label: "Low confidence",
      detail: `${first.label} to ${latest.label} carry is ${signedDelta}, but the month sample is thin. Retest 10 stock shots before changing the play number. ${directionalDetail} ${sampleDetail}`,
      confidenceLabel,
      tone: "amber",
    };
  }

  if (movement.kind === "shorter-straighter") {
    return {
      label: "Straighter trade-off",
      detail: `${first.label} to ${latest.label} carry is ${formatSignedYards(
        delta,
      )}, while median offline tightened by ${formatMetric(
        Math.abs(movement.controlDeltaYd ?? 0),
      )} yd. That can be a worthwhile control trade-off, not a distance regression. Confirm ball speed and strike before changing the course number. ${sampleDetail}`,
      confidenceLabel,
      tone: "sky",
    };
  }

  if (movement.kind === "longer-wider") {
    return {
      label: "Longer, wider",
      detail: `${first.label} to ${latest.label} carry is ${formatSignedYards(
        delta,
      )}, but median offline widened by ${formatMetric(
        movement.controlDeltaYd ?? 0,
      )} yd. Confirm the extra carry is worth the wider pattern before promoting the number. ${sampleDetail}`,
      confidenceLabel,
      tone: "amber",
    };
  }

  if (movement.kind === "control-improved") {
    return {
      label: "Control improved",
      detail: `${first.label} to ${latest.label} median offline tightened by ${formatMetric(
        Math.abs(movement.controlDeltaYd ?? 0),
      )} yd, with carry ${signedDelta}. The pattern improvement is the useful change. ${sampleDetail}`,
      confidenceLabel,
      tone: "green",
    };
  }

  if (movement.kind === "control-wider") {
    return {
      label: "Pattern wider",
      detail: `${first.label} to ${latest.label} median offline widened by ${formatMetric(
        movement.controlDeltaYd ?? 0,
      )} yd, with carry ${signedDelta}. Use a more conservative target until the next clean stock set confirms the pattern. ${sampleDetail}`,
      confidenceLabel,
      tone: "amber",
    };
  }

  if (movement.kind === "distance-down") {
    const isRetest = delta <= -8;

    return {
      label: isRetest ? "Distance retest" : "Monitor carry",
      detail: `${first.label} to ${latest.label} carry is ${formatSignedYards(
        delta,
      )}. Directional control did not improve enough to explain the loss. ${
        isRetest
          ? "Retest 10 stock shots and check ball speed and strike."
          : "Keep the course number conservative and compare after the next stock-distance set."
      } ${directionalDetail} ${sampleDetail}`,
      confidenceLabel,
      tone: isRetest ? "amber" : "sky",
    };
  }

  if (movement.kind === "carry-up") {
    return {
      label: "Carry up",
      detail: `${first.label} to ${latest.label} carry is ${formatSignedYards(
        delta,
      )}. Keep the gain visible but confirm it with the next clean stock set. ${directionalDetail} ${sampleDetail}`,
      confidenceLabel,
      tone: "green",
    };
  }

  return {
    label: stableBagLabel(club),
    detail: `${first.label} to ${latest.label} carry and measured lateral control are within normal variation. ${directionalDetail} ${sampleDetail}`,
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
  const movement = classifyClubEvolutionMovement(points);

  if (["carry-up", "control-improved", "stable"].includes(movement.kind)) {
    return "green";
  }

  if (["longer-wider", "control-wider"].includes(movement.kind)) {
    return "amber";
  }

  if (movement.kind === "distance-down" && (movement.carryDeltaYd ?? 0) <= -8) {
    return "amber";
  }

  if (movement.kind === "building") {
    return "slate";
  }

  return "sky";
}

function clubEvolutionControlTextClass(points: ClubEvolutionMeasuredPoint[]) {
  const { controlDeltaYd } = classifyClubEvolutionMovement(points);

  if (controlDeltaYd === null) {
    return "text-muted-foreground";
  }

  if (controlDeltaYd <= -3) {
    return "text-[var(--status-success-foreground)]";
  }

  if (controlDeltaYd >= 3) {
    return "text-[var(--status-warning-foreground)]";
  }

  return "text-[var(--status-information-foreground)]";
}

function clubEvolutionTextClass(points: ClubEvolutionMeasuredPoint[]) {
  const tone = clubEvolutionTone(points);

  if (tone === "green") {
    return "text-[var(--status-success-foreground)]";
  }

  if (tone === "amber" || tone === "pink") {
    return "text-[var(--status-warning-foreground)]";
  }

  if (tone === "sky") {
    return "text-[var(--status-information-foreground)]";
  }

  return "text-muted-foreground";
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
