import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BarChart3,
  MapPinned,
  Trophy,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { and, asc, count, desc, eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { BagFeaturePanel } from "@/components/features/feature-panels";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { MobileSummaryHero } from "@/components/visuals/mobile-summary-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
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
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { findRelevantChallenge } from "@/lib/challenge-relevance";
import { buildClubBenchmarkRows, type ClubBenchmarkRow } from "@/lib/club-benchmarks";
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
import { ensureCurrentSocialProfile } from "@/lib/social";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import { calculateStockYardage, type StockShot } from "@/lib/stock-yardage";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const RECENT_SHOTS_PER_CLUB = 200;

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
  const benchmarkRows = buildBenchmarkRows(bag);
  const courseAdvice = buildCourseDecisionAdvice(bag);
  const totalShots = bag.reduce((total, club) => total + club.rawShotCount, 0);
  const stockConfidenceClubs = bag.filter((club) => !club.isShortGameTouch);
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
        <MobileStatusAction
          label="Gapping ladder"
          value={bestClub ? formatClubType(bestClub.type) : "--"}
          detail={
            weakestGap
              ? `Problem gap: ${formatClubType(weakestGap.clubType)} · ${workOnText(weakestGap)}`
              : `${bag.length} clubs · ${totalShots} shots`
          }
          action={
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href="/import" prefetch={false}>
                Import
              </Link>
            </Button>
          }
        />
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
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm"
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
        <TargetDistanceSelector rows={gappingRows} targetYd={150} />
        <NativeListSection title="Club rail">
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {bag.map((club) => (
              <Link
                key={club.id}
                href={`/bag/${club.id}`}
                prefetch={false}
                className="grid min-w-36 gap-2 rounded-lg border border-[#E5E7EB] bg-white p-3"
              >
                <ClubArtwork
                  clubType={club.type}
                  brand={club.brand}
                  model={club.model}
                  alt=""
                  className="h-14 rounded-lg"
                  sizes="144px"
                />
                <span className="font-semibold">{formatClubType(club.type)}</span>
                <span className="text-sm text-[#6B7280]">
                  {formatMetric(club.stock.carryMedianYd)} yd
                </span>
              </Link>
            ))}
          </div>
        </NativeListSection>
        <BagFeaturePanel data={featureData} />
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
          visual={<PageArtwork variant="stockYardages" alt="" className="h-full min-h-44" />}
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

        <TargetDistanceSelector rows={gappingRows} targetYd={150} />

        {gappingRows.length > 0 ? (
          <section id="gapping" className="scroll-mt-28">
            <CarryGappingTable rows={gappingRows} />
          </section>
        ) : null}

        {benchmarkRows.length > 0 ? (
          <section id="levels" className="scroll-mt-28">
            <DistanceBenchmarkPanel rows={benchmarkRows} />
          </section>
        ) : null}

        <section id="decisions" className="scroll-mt-28">
          <CourseDecisionPanel advice={courseAdvice} />
        </section>

        <section
          id="clubs"
          className="-mx-4 flex scroll-mt-28 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3"
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
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {club.isShortGameTouch ? "Full stock" : "Play"}
                      </p>
                      <p className="text-2xl font-semibold tracking-normal sm:text-3xl">
                        {formatMetric(
                          club.isShortGameTouch ? null : club.stock.recommendedPlayNumberYd,
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
                          ? "Touch"
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
                        {club.isShortGameTouch
                          ? `${club.touch.sampleSize} shots`
                          : `${club.stock.confidenceScore}%`}
                      </span>
                    </div>
                    <Progress
                      value={
                        club.isShortGameTouch
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

  const clubData = await Promise.all(
    clubRows.map(async (club) => {
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
            spinRate: shots.spinRate,
            spinAxis: shots.spinAxis,
            courseHoleNumber: shots.courseHoleNumber,
            sessionType: sessions.type,
            shotCategory: shots.shotCategory,
            qualityTag: shots.qualityTag,
          })
          .from(shots)
          .innerJoin(sessions, eq(shots.sessionId, sessions.id))
          .where(
            and(eq(shots.userId, userId), eq(sessions.userId, userId), eq(shots.clubId, club.id)),
          )
          .orderBy(desc(shots.shotAt))
          .limit(RECENT_SHOTS_PER_CLUB),
        db
          .select({ value: count() })
          .from(shots)
          .where(and(eq(shots.userId, userId), eq(shots.clubId, club.id))),
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
      const touch = calculateShortGameTouchSummary(recentShots, RECENT_SHOTS_PER_CLUB, {
        clubType: club.type,
      });
      const stock = calculateStockYardage(recentShots, RECENT_SHOTS_PER_CLUB, {
        clubType: club.type,
      });
      const decisionLabel = getClubDecisionLabel({
        isShortGameTouch,
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
      };
    })
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));
}

type BagClub = Awaited<ReturnType<typeof getBag>>[number];

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

function buildBenchmarkRows(bag: BagClub[]): ClubBenchmarkRow[] {
  return buildClubBenchmarkRows(
    bag.map((club) => ({
      clubId: club.id,
      clubType: club.type,
      brandModel: club.brandModel,
      carryYd: club.stock.carryMedianYd,
      sampleSize: club.stock.sampleSize,
      confidenceScore: club.stock.confidenceScore,
    })),
  );
}

function buildGappingRows(
  bag: BagClub[],
  options: { handicapBand?: string | null } = {},
): GappingRow[] {
  const stockBag = bag.filter((club) => !club.isShortGameTouch);

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

function TargetDistanceSelector({ rows, targetYd }: { rows: GappingRow[]; targetYd: number }) {
  const candidates = rows
    .filter(
      (
        row,
      ): row is GappingRow & {
        carryYd: number;
        playNumberYd: number;
      } => row.carryYd !== null && row.playNumberYd !== null,
    )
    .sort(
      (left, right) =>
        Math.abs(left.playNumberYd - targetYd) - Math.abs(right.playNumberYd - targetYd) ||
        right.confidenceScore - left.confidenceScore,
    );
  const recommended = candidates[0] ?? null;
  const alternatives = candidates.slice(1, 4);
  const missYd = recommended ? Math.round((recommended.playNumberYd - targetYd) * 10) / 10 : null;
  const risk =
    missYd === null
      ? "Need stock carry samples"
      : Math.abs(missYd) <= 4
        ? "Matched window"
        : missYd > 0
          ? `${formatMetric(missYd)} yd long`
          : `${formatMetric(Math.abs(missYd))} yd short`;

  return (
    <DataPanel>
      <SectionHeader
        title="Target distance selector"
        description={`I need ${targetYd} yd: pick the club with the closest play number and enough trust to use on course.`}
        action={<Target className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border bg-[#F5F6F4] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Target
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-normal">{targetYd} yd</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[120, 150, 175, 200].map((distance) => (
              <Badge key={distance} variant={distance === targetYd ? "default" : "outline"}>
                {distance} yd
              </Badge>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Recommended</p>
                <p className="mt-1 text-2xl font-semibold tracking-normal">
                  {recommended ? formatClubType(recommended.clubType) : "--"}
                </p>
              </div>
              <StatusPill
                tone={recommended && recommended.confidenceScore >= 70 ? "green" : "amber"}
              >
                {recommended ? `${recommended.confidenceScore}% trust` : "Needs data"}
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <DataPair
                label="Play number"
                value={recommended ? `${formatMetric(recommended.playNumberYd)} yd` : "--"}
              />
              <DataPair label="Risk" value={risk} />
              <DataPair
                label="Sample"
                value={recommended ? `${recommended.sampleSize} shots` : "--"}
              />
            </div>
          </div>
          {alternatives.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {alternatives.map((row) => (
                <Link
                  key={row.id}
                  href={`/bag/${row.id}`}
                  prefetch={false}
                  className="rounded-lg border bg-white p-3 text-sm hover:border-emerald-300"
                >
                  <p className="font-semibold">{formatClubType(row.clubType)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatMetric(row.playNumberYd)} yd · {row.confidenceScore}% trust
                  </p>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
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
        <div className="rounded-lg border bg-[#F5F6F4] p-3 text-sm leading-6 text-muted-foreground">
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

function DistanceBenchmarkPanel({ rows }: { rows: ClubBenchmarkRow[] }) {
  const rowsWithData = rows.filter((row) => row.comparison.levelIndex !== null);
  const averageLevel =
    rowsWithData.length === 0
      ? null
      : Math.round(
          rowsWithData.reduce((total, row) => total + (row.comparison.levelIndex ?? 0), 0) /
            rowsWithData.length,
        );
  const strongest =
    [...rowsWithData].sort(
      (left, right) =>
        (right.comparison.levelIndex ?? -1) - (left.comparison.levelIndex ?? -1) ||
        right.comparison.progressPercent - left.comparison.progressPercent,
    )[0] ?? null;
  const closestNext =
    [...rows]
      .filter(
        (
          row,
        ): row is ClubBenchmarkRow & {
          comparison: ClubBenchmarkRow["comparison"] & { yardsToNextLevel: number };
        } => row.comparison.yardsToNextLevel !== null,
      )
      .sort(
        (left, right) => left.comparison.yardsToNextLevel - right.comparison.yardsToNextLevel,
      )[0] ?? null;

  return (
    <DataPanel>
      <SectionHeader
        title="Distance benchmarks"
        description="Your rolling stock carry against broad club-distance reference levels."
        action={<BarChart3 className="size-5 text-emerald-500" />}
      />
      <CardContent className="space-y-4">
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-3"
          items={[
            {
              label: "Bag average",
              value: averageLevel === null ? "--" : benchmarkLevelFromIndex(averageLevel),
              detail:
                rowsWithData.length === 0
                  ? "Need stock carry samples"
                  : `${rowsWithData.length} club${rowsWithData.length === 1 ? "" : "s"} compared`,
              tone: benchmarkTone(
                averageLevel === null ? "no-data" : benchmarkLevelKeyFromIndex(averageLevel),
              ),
            },
            {
              label: "Strongest match",
              value: strongest ? formatClubType(strongest.clubType) : "--",
              detail: strongest
                ? `${strongest.comparison.levelLabel} at ${formatMetric(strongest.carryYd)} yd`
                : "Need stock carry samples",
              tone: benchmarkTone(strongest?.comparison.levelKey ?? "no-data"),
              href: strongest ? `/bag/${strongest.clubId}` : undefined,
            },
            {
              label: "Closest next level",
              value: closestNext ? formatClubType(closestNext.clubType) : "--",
              detail: closestNext
                ? `${formatMetric(closestNext.comparison.yardsToNextLevel)} yd to ${closestNext.comparison.nextLevel?.label}`
                : "No next target yet",
              tone: closestNext ? "amber" : "slate",
              href: closestNext ? `/bag/${closestNext.clubId}` : undefined,
            },
          ]}
        />

        <MobileAccordionSection title="Club level table" count={`${rows.length} clubs`}>
          <MobileDataList>
            {rows.map((row) => (
              <MobileDataCard
                key={row.clubId}
                href={`/bag/${row.clubId}`}
                title={formatClubType(row.clubType)}
                subtitle={row.brandModel}
                action={<BenchmarkBadge row={row} />}
              >
                <DataPair
                  label="Carry"
                  value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`}
                />
                <DataPair label="Sample" value={row.sampleSize.toString()} />
                <DataPair label="Next" value={benchmarkNextText(row)} />
                <DataPair label="Reference" value={benchmarkReferenceText(row)} />
                <BenchmarkMeter row={row} />
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
                  <TableHead className="text-right">Your carry</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Next</TableHead>
                  <TableHead className="min-w-[280px]">Benchmark band</TableHead>
                  <TableHead className="text-right">Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.clubId}>
                    <TableCell>
                      <Link
                        href={`/bag/${row.clubId}`}
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
                    <TableCell>
                      <BenchmarkBadge row={row} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {benchmarkNextText(row)}
                    </TableCell>
                    <TableCell>
                      <BenchmarkMeter row={row} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{row.sampleSize}</span>
                      <span className="ml-2 text-muted-foreground">{row.confidenceScore}%</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function BenchmarkMeter({ row }: { row: ClubBenchmarkRow }) {
  const marker = row.comparison.carryYd === null ? null : row.comparison.progressPercent;

  return (
    <div className="min-w-0 space-y-2">
      <div className="relative h-3 rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-600"
          style={{ width: `${row.comparison.progressPercent}%` }}
        />
        {marker === null ? null : (
          <span
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow-sm"
            style={{ left: `calc(${marker}% - 0.5rem)` }}
            aria-hidden
          />
        )}
      </div>
      <div className="grid grid-cols-5 gap-1 text-[10px] leading-4 text-muted-foreground">
        {row.comparison.benchmark.levels.map((level) => (
          <span key={level.key} className="truncate">
            {level.shortLabel} {level.yards}
          </span>
        ))}
      </div>
    </div>
  );
}

function BenchmarkBadge({ row }: { row: ClubBenchmarkRow }) {
  return (
    <span
      className={`inline-flex min-w-24 justify-center rounded-full border px-2 py-1 text-xs font-semibold ${benchmarkBadgeClass(
        row.comparison.levelKey,
      )}`}
    >
      {row.comparison.levelLabel}
    </span>
  );
}

function benchmarkNextText(row: ClubBenchmarkRow) {
  if (row.comparison.carryYd === null) {
    return "Needs full-swing stock data";
  }

  if (!row.comparison.nextLevel || row.comparison.yardsToNextLevel === null) {
    return "Above top reference";
  }

  return `${formatMetric(row.comparison.yardsToNextLevel)} yd to ${row.comparison.nextLevel.label}`;
}

function benchmarkReferenceText(row: ClubBenchmarkRow) {
  const first = row.comparison.benchmark.levels[0];
  const last = row.comparison.benchmark.levels[row.comparison.benchmark.levels.length - 1];

  return `${first.yards}-${last.yards} yd ${row.comparison.benchmark.label}`;
}

function benchmarkLevelFromIndex(index: number) {
  return ["Beginner", "Average", "Good", "Advanced", "Tour"][index] ?? "--";
}

function benchmarkLevelKeyFromIndex(index: number) {
  return (["beginner", "average", "good", "advanced", "tour"] as const)[index] ?? "no-data";
}

function benchmarkTone(levelKey: ClubBenchmarkRow["comparison"]["levelKey"]) {
  if (levelKey === "tour" || levelKey === "tour-plus" || levelKey === "advanced") {
    return "green";
  }

  if (levelKey === "good") {
    return "sky";
  }

  if (levelKey === "average" || levelKey === "beginner" || levelKey === "building") {
    return "amber";
  }

  return "slate";
}

function benchmarkBadgeClass(levelKey: ClubBenchmarkRow["comparison"]["levelKey"]) {
  if (levelKey === "tour" || levelKey === "tour-plus") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (levelKey === "advanced" || levelKey === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (levelKey === "average") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (levelKey === "beginner" || levelKey === "building") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function CarryGappingTable({ rows }: { rows: GappingRow[] }) {
  const targetGapYd = rows.find((row) => row.targetGapYd !== null)?.targetGapYd ?? null;

  return (
    <Card className="premium-card">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-xl tracking-normal sm:text-2xl">Carry gapping</CardTitle>
        <CardDescription className="hidden sm:block">
          Stock carry by club, with realistic next-step targets from the current bag data.
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
              <span className="text-muted-foreground">
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

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}
