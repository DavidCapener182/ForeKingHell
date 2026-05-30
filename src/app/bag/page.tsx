import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Gauge,
  MapPinned,
  Minus,
  ShieldCheck,
  Trophy,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

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
  MobileStatusAction,
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
import { clubs, sessions, shots, userProfiles } from "@/db/schema";
import { getDb } from "@/db/client";
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
  type StockShot,
} from "@/lib/stock-yardage";
import { DistanceBenchmarkPanel } from "./distance-benchmark-panel";
import { TargetDistanceSelector, type TargetDistanceRow } from "./target-distance-selector";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const RECENT_SHOTS_PER_CLUB = 200;
const PEER_SHOT_QUERY_LIMIT = 12000;
const PEER_MIN_STOCK_SHOTS = 3;
const PEER_PERCENTILE_METRIC_KEYS: ClubBenchmarkMetricKey[] = [
  "carryYd",
  "clubSpeedMph",
  "ballSpeedMph",
  "smashFactor",
  "maxHeightYd",
  "landAngleDeg",
];

export default async function BagPage() {
  const [bag, profile, challengeData, featureData] = await Promise.all([
    getBag(),
    ensureCurrentSocialProfile(),
    getChallengesPageData(),
    getFeatureIdeasData(),
  ]);
  const gappingRows = buildGappingRows(bag, {
    handicapBand: profile.handicapBand,
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
  const maxGappingCarry = maxCarryYd(gappingRows);
  const bagDoctorFindings = buildBagDoctorFindings(gappingRows);

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
        <MobileStatusAction
          label="Gapping ladder"
          value={bestClub ? formatClubType(bestClub.type) : "--"}
          detail={
            weakestGap
              ? `Problem gap: ${formatClubType(weakestGap.clubType)} · ${workOnText(weakestGap)}`
              : `${bag.length} clubs · ${totalShots} shots`
          }
          action={
            <Button asChild className="premium-action rounded-full">
              <Link href="/import" prefetch={false}>
                Import
              </Link>
            </Button>
          }
        />
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
        <MobileAccordionSection
          title="Full gapping ladder"
          description="Carry ladder, trust and strongest numbers."
          count={`${gappingRows.length} clubs`}
        >
          <NativeListSection title="Gapping">
            <ProgressCard
              title="Bag trust"
              value={`${averageConfidence}%`}
              detail={`${bag.length} active clubs · ${totalShots} tracked shots`}
            >
              <div className="grid gap-2">
                {gappingRows.slice(0, 8).map((row) => (
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
                          width: `${carryWidthPercent(row.carryYd, maxGappingCarry)}%`,
                        }}
                      />
                    </span>
                    <span className="font-semibold">{formatMetric(row.carryYd)} yd</span>
                  </Link>
                ))}
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
        </MobileAccordionSection>
        <MobileAccordionSection
          title="Gapping doctor"
          description="Overlap, missing yardage and weak samples."
          count={`${bagDoctorFindings.length} checks`}
        >
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
                      <p className="mt-1 text-xs leading-5 text-[#6B7280]">{finding.detail}</p>
                    </div>
                    <StatusPill tone={finding.tone}>{finding.label}</StatusPill>
                  </div>
                </Link>
              ))}
            </div>
          </NativeListSection>
        </MobileAccordionSection>
        <MobileAccordionSection
          title="Club rail"
          description="Open any club detail."
          count={`${bag.length} clubs`}
        >
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
                    {formatMetric(club.stock.carryMedianYd)} yd
                  </span>
                </Link>
              ))}
            </div>
          </NativeListSection>
        </MobileAccordionSection>
        <MobileAccordionSection
          title="Fitting and benchmarks"
          description="Feature checks, target links and club identities."
          count="Full analysis"
        >
          <BagFeaturePanel data={featureData} />
        </MobileAccordionSection>
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
          description="Rolling median carry, outlier filtering, dispersion, and course-decision trust by club."
          visual={
            <PageArtwork variant="stockYardages" alt="" className="h-full min-h-44" priority />
          }
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
            { label: "Levels", href: "#levels" },
            { label: "Decisions", href: "#decisions" },
            { label: "Clubs", href: "#clubs" },
          ]}
        />

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

        <BagConfidenceLadder
          rows={gappingRows}
          maxCarryYd={maxGappingCarry}
          findings={bagDoctorFindings}
        />

        <TargetDistanceSelector rows={targetDistanceRows} initialTargetYd={150} />

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
                        {club.isShortGameTouch ? "Touch median" : "Stock carry"}
                      </p>
                      <p className="text-4xl font-semibold tracking-normal sm:text-5xl">
                        {formatMetric(
                          club.isShortGameTouch
                            ? club.touch.carryMedianYd
                            : club.stock.carryMedianYd,
                        )}
                        <span className="ml-1 text-lg text-muted-foreground">yd</span>
                      </p>
                      {club.stockTrend ? <ShotTrendBadge trend={club.stockTrend} /> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {club.isShortGameTouch ? "Full stock" : "Play"}
                      </p>
                      <p className="text-2xl font-semibold tracking-normal sm:text-3xl">
                        {formatMetric(
                          club.isShortGameTouch
                            ? club.type === "sw"
                              ? club.stock.carryMedianYd
                              : null
                            : club.stock.recommendedPlayNumberYd,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <MiniDispersion
                      shots={club.shots}
                      accent={club.accent}
                      carryMedianYd={
                        club.isShortGameTouch ? club.touch.carryMedianYd : club.stock.carryMedianYd
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
                      label={club.isShortGameTouch ? "Upper touch" : "Good carry"}
                      value={formatMetric(
                        club.isShortGameTouch ? club.touch.carryP75Yd : club.stock.carryP75Yd,
                      )}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Longest touch" : "Total"}
                      value={formatMetric(
                        club.isShortGameTouch
                          ? club.touch.longestCarryYd
                          : club.stock.totalMedianYd,
                      )}
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
        rawShotCount: shotCount?.value ?? 0,
      };
    }),
  );

  return clubData
    .filter(({ club }) => isTrackedClubType(club.type))
    .map(({ club, recentShots, rawShotCount }) => {
      const accent = clubAccent(club.type);
      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";
      const isShortGameTouch = isShortGameTouchClubType(club.type);
      const isTouchOnlyClub = isShortGameTouch && club.type !== "sw";
      const touch = calculateShortGameTouchSummary(recentShots, RECENT_SHOTS_PER_CLUB, {
        clubType: club.type,
      });
      const stock = calculateStockYardage(recentShots, RECENT_SHOTS_PER_CLUB, {
        clubType: club.type,
      });
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
  playNumberYd: number | null;
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
          description="Carry, trust, gapping and safe-play numbers from driver down through scoring clubs."
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

                    <p className="mt-4 text-3xl font-semibold tracking-normal">
                      {formatMetric(row.carryYd)}
                      <span className="ml-1 text-sm text-muted-foreground">yd</span>
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <span
                        className="block h-2 rounded-full bg-[#0B7A3B]"
                        style={{ width: `${carryWidthPercent(row.carryYd, maxCarryYd)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs">
                    <div className="flex items-center justify-between gap-2 rounded-md bg-[#F5F6F4] px-2 py-1.5">
                      <span className="text-muted-foreground">Safe play</span>
                      <span className="font-semibold">
                        {row.playNumberYd === null ? "--" : `${formatMetric(row.playNumberYd)} yd`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-[#F5F6F4] px-2 py-1.5">
                      <span className="text-muted-foreground">Next gap</span>
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
          description="Flags overlap, missing yardage windows, and numbers that need more clean shots."
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
  const missingWindow = rows.find((row) => row.gapToNextYd !== null && row.gapToNextYd > 18);
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
    findings.push({
      title: `${formatClubType(overlap.clubType)} overlaps the next club`,
      detail: `${formatGap(overlap.gapToNextYd)} to the next club. Check strike quality, loft setup, or club mapping.`,
      label: "Overlap",
      tone: "pink",
      href: `/bag/${overlap.id}`,
    });
  }

  if (missingWindow) {
    findings.push({
      title: "Missing yardage window",
      detail: `${formatClubType(missingWindow.clubType)} leaves ${formatGap(
        missingWindow.gapToNextYd,
      )} to the next club. Add a choke-down or flighted option.`,
      label: "Gap",
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
    const strongest = [...rows].sort((left, right) => right.confidenceScore - left.confidenceScore)[0];

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
    return { value: formatGap(row.gapToNextYd), label: "Overlap risk", tone: "pink" };
  }

  if (row.gapToNextYd > 18) {
    return { value: formatGap(row.gapToNextYd), label: "Missing window", tone: "amber" };
  }

  return { value: formatGap(row.gapToNextYd), label: "Gap ok", tone: "green" };
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
      carryYd: club.stock.carryMedianYd,
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
    carryYd: club.stock.carryMedianYd,
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
    .where(and(inArray(shots.userId, eligibleUserIds), eq(clubs.active, true)))
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

function buildGappingRows(
  bag: BagClub[],
  options: { handicapBand?: string | null } = {},
): GappingRow[] {
  const stockBag = bag.filter(shouldShowInCarryGapping);

  const baseRows: GappingRow[] = stockBag.map((club, index) => {
    const nextClub = stockBag
      .slice(index + 1)
      .find((candidate) => candidate.stock.carryMedianYd !== null);
    const gapToNextYd =
      club.stock.carryMedianYd !== null &&
      nextClub !== undefined &&
      nextClub.stock.carryMedianYd !== null
        ? club.stock.carryMedianYd - nextClub.stock.carryMedianYd
        : null;

    return {
      id: club.id,
      clubType: club.type,
      brandModel: club.brandModel,
      carryYd: club.stock.carryMedianYd,
      playNumberYd: club.stock.recommendedPlayNumberYd,
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

  return club.type === "sw" && (club.stock.carryMedianYd ?? 0) > SAND_WEDGE_STOCK_MIN_CARRY_YD;
}

function buildTargetDistanceRows(bag: BagClub[], gappingRows: GappingRow[]): TargetDistanceRow[] {
  const stockRows: TargetDistanceRow[] = gappingRows.map((row) => ({
    id: row.id,
    clubType: row.clubType,
    carryYd: row.carryYd,
    playNumberYd: row.playNumberYd,
    sampleSize: row.sampleSize,
    confidenceScore: row.confidenceScore,
    shotRole: "stock",
  }));
  const stockIds = new Set(stockRows.map((row) => row.id));
  const touchRows: TargetDistanceRow[] = bag
    .filter((club) => club.isShortGameTouch && !stockIds.has(club.id) && club.touch.sampleSize > 0)
    .flatMap((club) => {
      const touchPlayNumberYd =
        club.touch.carryMedianYd ?? club.touch.carryP75Yd ?? club.touch.longestCarryYd;
      const touchMaxYd = club.touch.longestCarryYd ?? club.touch.carryP75Yd ?? touchPlayNumberYd;

      if (touchPlayNumberYd === null || touchMaxYd === null) {
        return [];
      }

      return [
        {
          id: club.id,
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
        description="Course-number reminders from the current bag map."
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
          Best-20 stock carry by club, with realistic next-step targets from the current bag data.
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
                action={<GapBadge gapYd={row.gapToNextYd} />}
              >
                <DataPair
                  label="Carry"
                  value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`}
                />
                <DataPair
                  label="Play"
                  value={`${formatMetric(row.playNumberYd)}${row.playNumberYd === null ? "" : " yd"}`}
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
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Carry</TableHead>
                  <TableHead className="text-right">Play</TableHead>
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
                      {formatMetric(row.playNumberYd)}
                      {row.playNumberYd === null ? "" : " yd"}
                    </TableCell>
                    <TableCell className="text-right">
                      <GapBadge gapYd={row.gapToNextYd} />
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
          Personal gap from your current reliable carries. Progress targets are capped by club type,
          confidence, and handicap band.
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
  const maxCarry = maxCarryYd(rows);

  return (
    <div className="apple-panel grid gap-3 p-3 sm:p-4">
      {rows.map((row) => {
        const width = carryWidthPercent(row.carryYd, maxCarry);

        return (
          <Link
            key={row.id}
            href={`/bag/${row.id}`}
            className="grid gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-white/80"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{formatClubType(row.clubType)}</span>
              <span className="text-slate-700">
                {formatMetric(row.carryYd)} yd carry · {formatMetric(row.playNumberYd)} yd play
              </span>
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

function maxCarryYd(rows: Array<Pick<GappingRow, "carryYd">>) {
  return Math.max(1, ...rows.map((row) => row.carryYd ?? 0));
}

function carryWidthPercent(carryYd: number | null, maxCarry: number) {
  return Math.max(8, ((carryYd ?? 0) / maxCarry) * 100);
}

function GapBadge({ gapYd }: { gapYd: number | null }) {
  if (gapYd === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const tone =
    gapYd < 8
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
