import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  ClipboardCheck,
  Compass,
  Gauge,
  Radar,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  CompactReadoutGrid,
  DataPanel,
  InsightBlock,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { clubAccent, clubSortValue, formatClubType, isTrackedClubType } from "@/lib/club-format";
import {
  calculateClubAnalytics,
  classifyShotShape,
  likelyMishitTags,
  type BagClubAnalyticsContext,
  type ClubAnalytics,
  type ClubAnalyticsShot,
} from "@/lib/club-analytics";
import { requireCurrentUserId } from "@/lib/current-user";
import { calculateStockYardage } from "@/lib/stock-yardage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    clubId: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ClubAnalyticsPage({ params }: PageProps) {
  const { clubId } = await params;
  const data = await getClubAnalyticsData(clubId);

  if (!data) {
    notFound();
  }

  const { club, analytics, shots: clubShots } = data;
  const accent = clubAccent(club.type);
  const clubName = formatClubType(club.type);
  const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";
  const latestShots = [...clubShots]
    .sort((left, right) => new Date(right.shotAt).getTime() - new Date(left.shotAt).getTime())
    .slice(0, 5);

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href={`/bag/${club.id}`} prefetch={false}>
            <ArrowLeft className="size-4" />
            Club profile
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" />
            Import data
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="sky">Advanced club analytics</StatusPill>}
        title={`${clubName} analytics`}
        description={`${brandModel}. Distance, direction, launch, strike, delivery, trust, gapping, and coach-style recommendations from saved launch-monitor data.`}
        actions={
          <Button
            asChild
            size="lg"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link href={`/bag/${club.id}`} prefetch={false}>
              <Target className="size-4" />
              Standard club view
            </Link>
          </Button>
        }
        metrics={[
          {
            label: "Best stock",
            value: formatYards(analytics.distance.stockCarryYd),
            detail: `${integerFormatter.format(analytics.sample.stockShots)} clean stock shots`,
          },
          {
            label: "Trust index",
            value: `${analytics.consistency.clubTrustIndex}%`,
            detail: analytics.consistency.confidenceLabel,
          },
          {
            label: "Playable rate",
            value: formatRate(analytics.accuracy.playableShotRate),
            detail: `Recommended ${formatYards(analytics.distance.stockPlayNumberYd)}`,
          },
          {
            label: "Launch window",
            value: formatRate(analytics.launch.launchWindowScore),
            detail: `${analytics.launch.launchWindow.low}-${analytics.launch.launchWindow.high} deg target`,
          },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <DataPanel>
          <SectionHeader
            title="Coach readout"
            description="What this club is doing, why it matters, and what to practise next."
            action={<Brain className="size-5 text-emerald-500" />}
          />
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-[#0B7A3B] p-5 text-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/60">Recommended practice</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-normal">
                    {analytics.practice.title}
                  </h2>
                </div>
                <Badge className="bg-white/12 text-white hover:bg-white/12">{clubName}</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/78">{analytics.practice.drill}</p>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/8 p-3 text-sm">
                <span className="text-white/56">Goal: </span>
                {analytics.practice.goal}
              </div>
            </div>

            <CompactReadoutGrid
              columnsClassName="md:grid-cols-2"
              items={analytics.insights.slice(0, 4).map((insight) => ({
                label: insight.title,
                value: insight.body,
                tone: insight.tone,
              }))}
            />
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Trust breakdown"
            description="The overall trust score is built from distance, direction, strike, flight, and sample depth."
            action={<Gauge className="size-5" style={{ color: accent }} />}
          />
          <CardContent className="space-y-4">
            <ScoreBar
              label="Distance reliability"
              value={analytics.consistency.carryConsistencyScore}
            />
            <ScoreBar
              label="Direction stability"
              value={analytics.consistency.directionConsistencyScore}
            />
            <ScoreBar
              label="Strike stability"
              value={analytics.consistency.strikeConsistencyScore}
            />
            <ScoreBar
              label="Flight stability"
              value={analytics.consistency.flightConsistencyScore}
            />
            <div className="apple-panel-strong p-4">
              <p className="text-sm text-muted-foreground">Confidence label</p>
              <p className="mt-1 text-3xl font-semibold tracking-normal">
                {analytics.consistency.confidenceLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {analytics.sample.stockShots < 10
                  ? "This club needs more clean full shots before strong conclusions."
                  : "This combines stock-yardage confidence with derived reliability scores."}
              </p>
            </div>
          </CardContent>
        </DataPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Primary shape"
          value={shapeLabel(analytics.accuracy.primaryShape)}
          detail={`${formatRate(analytics.accuracy.leftMissRate)} left / ${formatRate(analytics.accuracy.rightMissRate)} right`}
          icon={Compass}
          tone="pink"
        />
        <MetricCard
          label="Strike"
          value={formatOptional(analytics.strike.smashAverage)}
          detail={`${formatRate(analytics.strike.lowSmashRate)} low-smash rate`}
          icon={Zap}
          tone="amber"
        />
        <MetricCard
          label="Delivery"
          value={formatDegrees(analytics.delivery.clubPathAverageDeg)}
          detail={`Face/path proxy ${formatDegrees(analytics.delivery.facePathProxyAverageDeg)}`}
          icon={Radar}
          tone="sky"
        />
        <MetricCard
          label="Stopping"
          value={formatRate(analytics.launch.stoppingPowerScore)}
          detail={`Descent ${formatDegrees(analytics.launch.descentAverageDeg)}`}
          icon={TrendingUp}
          tone="green"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <DecisionSupportPanel analytics={analytics} accent={accent} />
        <div className="grid gap-4">
          <DiagnosisPanel analytics={analytics} />
          <ShapeMixPanel analytics={analytics} accent={accent} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <DataPanel>
          <SectionHeader
            title="Shot cloud"
            description="Side carry by distance. Selected clubs should trend tighter and higher trust over time."
            action={<StatusPill tone="green">Yards</StatusPill>}
          />
          <CardContent>
            <ShotCloud shots={clubShots} analytics={analytics} accent={accent} />
          </CardContent>
        </DataPanel>

        <div className="grid gap-4">
          <DataPanel>
            <SectionHeader
              title="Distance profile"
              description="Best stock, personal best, latest reliable, recommended number, and mishit floor."
            />
            <CardContent>
              <DistanceDistribution analytics={analytics} accent={accent} />
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Launch window"
              description="How often clean shots launch inside the club target."
            />
            <CardContent>
              <LaunchWindowChart analytics={analytics} accent={accent} />
            </CardContent>
          </DataPanel>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ProfileCard
          title="Distance"
          icon={BarChart3}
          metrics={[
            ["Best stock", formatYards(analytics.distance.stockCarryYd)],
            ["Personal best", formatYards(analytics.distance.personalBestCarryYd)],
            ["Latest reliable", formatYards(analytics.distance.latestReliableCarryYd)],
            [
              "Latest range",
              formatRange(
                analytics.distance.latestReliableCarryP25Yd,
                analytics.distance.latestReliableCarryP75Yd,
              ),
            ],
            ["Recommended", formatYards(analytics.distance.stockPlayNumberYd)],
            ["Safe carry", formatYards(analytics.distance.safeCarryYd)],
            ["Aggressive", formatYards(analytics.distance.aggressiveCarryYd)],
            ["Mishit floor", formatYards(analytics.distance.mishitFloorYd)],
          ]}
        />
        <ProfileCard
          title="Accuracy"
          icon={Target}
          metrics={[
            ["Avg side", formatSide(analytics.accuracy.averageSideCarryYd)],
            ["Abs offline", formatYards(analytics.accuracy.absoluteOfflineAverageYd)],
            ["Big miss", formatRate(analytics.accuracy.bigMissRate)],
            ["Playable", formatRate(analytics.accuracy.playableShotRate)],
            ["Cone width", formatYards(analytics.accuracy.shotConeWidthYd)],
            ["Start line", formatDegrees(analytics.accuracy.startLineAverageDeg)],
          ]}
        />
        <ProfileCard
          title="Launch"
          icon={TrendingUp}
          metrics={[
            ["Launch avg", formatDegrees(analytics.launch.launchAverageDeg)],
            ["Launch spread", formatDegrees(analytics.launch.launchSpreadDeg)],
            ["Window score", formatRate(analytics.launch.launchWindowScore)],
            ["Apex avg", formatFeet(analytics.launch.apexAverageFt)],
            ["Apex spread", formatFeet(analytics.launch.apexSpreadFt)],
            ["Low flight", formatRate(analytics.launch.lowFlightRate)],
          ]}
        />
        <ProfileCard
          title="Strike"
          icon={Zap}
          metrics={[
            ["Ball speed", formatMph(analytics.strike.ballSpeedAverageMph)],
            ["Ball speed spread", formatMph(analytics.strike.ballSpeedSpreadMph)],
            ["Club speed", formatMph(analytics.strike.clubSpeedAverageMph)],
            ["Smash", formatOptional(analytics.strike.smashAverage)],
            ["High smash", formatRate(analytics.strike.highSmashRate)],
            ["Speed leakage", formatRate(analytics.strike.speedLeakageRate)],
          ]}
        />
        <ProfileCard
          title="Delivery"
          icon={Compass}
          metrics={[
            ["Path avg", formatDegrees(analytics.delivery.clubPathAverageDeg)],
            ["Path spread", formatDegrees(analytics.delivery.clubPathSpreadDeg)],
            ["Attack avg", formatDegrees(analytics.delivery.attackAngleAverageDeg)],
            ["Face/path proxy", formatDegrees(analytics.delivery.facePathProxyAverageDeg)],
            ["Hook risk", formatRate(analytics.delivery.hookRiskScore)],
            ["Block risk", formatRate(analytics.delivery.blockRiskScore)],
          ]}
        />
        <ProfileCard
          title="Gapping"
          icon={Gauge}
          metrics={[
            ["Status", analytics.gapping.status],
            [
              "Prev club",
              analytics.gapping.previousClubType
                ? formatClubType(analytics.gapping.previousClubType)
                : "--",
            ],
            ["Prev gap", formatYards(analytics.gapping.previousGapYd)],
            [
              "Next club",
              analytics.gapping.nextClubType
                ? formatClubType(analytics.gapping.nextClubType)
                : "--",
            ],
            ["Next gap", formatYards(analytics.gapping.nextGapYd)],
            ["Recommended", formatYards(analytics.distance.stockPlayNumberYd)],
          ]}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <DataPanel>
          <SectionHeader
            title="What changed?"
            description="Personal baseline and recent-session comparisons."
          />
          <CardContent className="space-y-3">
            <DeltaPanel title="Latest 30 vs first 30" delta={analytics.progress.baselineDelta} />
            <DeltaPanel
              title="Last session vs previous"
              delta={analytics.progress.lastSessionDelta}
            />
            <DeltaPanel title="This month vs last month" delta={analytics.progress.monthlyDelta} />
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Latest shot tags"
            description="Automatic mishit and shape classification for the newest saved shots."
          />
          <CardContent className="space-y-2">
            {latestShots.map((shot) => {
              const tags = likelyMishitTags({
                clubType: club.type,
                shot,
                stockCarryYd: analytics.distance.stockCarryYd,
              });
              const shape = classifyShotShape(shot);

              return (
                <div key={shot.id} className="apple-panel-strong p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Shot #{shot.shotNumber ?? "--"}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(shot.shotAt)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{shapeLabel(shape)}</Badge>
                    {tags.length > 0 ? (
                      tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary">normal</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </DataPanel>
      </section>

      {analytics.delivery.dataWarning ? (
        <DataPanel className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-950">
            <strong>Data confidence:</strong> {analytics.delivery.dataWarning}
          </CardContent>
        </DataPanel>
      ) : null}
    </PageShell>
  );
}

async function getClubAnalyticsData(clubId: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [clubRows, clubShotRows, activeClubRows, allShotRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
      .limit(1),
    db
      .select(analyticsShotSelection())
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(eq(shots.clubId, clubId))
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
    db
      .select({
        id: clubs.id,
        type: clubs.type,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        clubId: shots.clubId,
        clubType: shots.clubType,
        shotAt: shots.shotAt,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        courseHoleNumber: shots.courseHoleNumber,
        sessionType: sessions.type,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(eq(shots.userId, userId)),
  ]);
  const club = clubRows[0];

  if (!club || !isTrackedClubType(club.type)) {
    return null;
  }

  const shotsByClubId = new Map<string, typeof allShotRows>();
  for (const shot of allShotRows) {
    const group = shotsByClubId.get(shot.clubId) ?? [];
    group.push(shot);
    shotsByClubId.set(shot.clubId, group);
  }
  const bagContext: BagClubAnalyticsContext[] = activeClubRows
    .map((activeClub) => {
      const stock = calculateStockYardage(shotsByClubId.get(activeClub.id) ?? [], 50, {
        clubType: activeClub.type,
      });

      return {
        clubId: activeClub.id,
        clubType: activeClub.type,
        stockCarryYd: stock.bestStockCarryYd,
        confidenceScore: stock.confidenceScore,
        sampleSize: stock.sampleSize,
      };
    })
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
  const analyticsShots = clubShotRows.map((shot) => toAnalyticsShot(shot, club.type));
  const analytics = calculateClubAnalytics({
    clubType: club.type,
    shots: analyticsShots,
    bagContext,
  });

  return {
    club,
    shots: analyticsShots,
    analytics,
  };
}

function analyticsShotSelection() {
  return {
    id: shots.id,
    sessionId: shots.sessionId,
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
    attackAngleDeg: shots.attackAngleDeg,
    clubPathDeg: shots.clubPathDeg,
    descentAngleDeg: shots.descentAngleDeg,
    smashFactor: shots.smashFactor,
    spinRate: shots.spinRate,
    spinAxis: shots.spinAxis,
    clubDataEstType: shots.clubDataEstType,
    shotCategory: shots.shotCategory,
    qualityTag: shots.qualityTag,
    courseHoleNumber: shots.courseHoleNumber,
    sessionType: sessions.type,
  };
}

type AnalyticsShotRow = {
  id: string;
  sessionId: string;
  shotNumber: number | null;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  clubDataEstType: string | null;
  shotCategory: string | null;
  qualityTag: string | null;
  courseHoleNumber: number | null;
  sessionType: string | null;
};

function toAnalyticsShot(shot: AnalyticsShotRow, clubType: string): ClubAnalyticsShot {
  return {
    ...shot,
    clubType,
    shotAt: shot.shotAt.toISOString(),
  };
}

function DecisionSupportPanel({ analytics, accent }: { analytics: ClubAnalytics; accent: string }) {
  return (
    <DataPanel className="overflow-hidden">
      <div
        className="border-b px-5 py-4 text-white"
        style={{
          background: "linear-gradient(135deg, #111827 0%, #172033 52%, rgba(17,24,39,0.92) 100%)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
              Trust this club?
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">
              {analytics.decision.trustVerdict}
            </h2>
          </div>
          <div
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/10"
            style={{ color: accent }}
          >
            <ShieldCheck className="size-5" />
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/74">
          {analytics.decision.recommendedUse}
        </p>
      </div>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <SmallDecisionMetric label="Role" value={analytics.decision.role} />
          <SmallDecisionMetric
            label="Play number"
            value={formatYards(analytics.decision.playNumberYd)}
          />
          <SmallDecisionMetric
            label="Max number"
            value={formatYards(analytics.decision.maxNumberYd)}
          />
          <SmallDecisionMetric
            label="Do not force"
            value={formatYards(analytics.decision.doNotForceOverYd)}
          />
        </div>
        <div className="apple-panel-strong p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-emerald-600" />
            <p className="font-medium">Pressure rule</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {analytics.decision.pressureUse}
          </p>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function DiagnosisPanel({ analytics }: { analytics: ClubAnalytics }) {
  const tone =
    analytics.diagnosis.severity === "high"
      ? "pink"
      : analytics.diagnosis.severity === "medium"
        ? "amber"
        : "green";

  return (
    <DataPanel>
      <SectionHeader
        title="Problem diagnosis"
        description="The current highest-signal explanation from distance, launch, strike, direction, and delivery."
        action={<StatusPill tone={tone}>{analytics.diagnosis.severity}</StatusPill>}
      />
      <CardContent className="space-y-3">
        <InsightBlock
          label={analytics.diagnosis.title}
          value={analytics.diagnosis.likelyCause}
          tone={tone}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SmallDecisionMetric label="Evidence" value={analytics.diagnosis.evidence} />
          <SmallDecisionMetric label="Practice focus" value={analytics.diagnosis.practiceFocus} />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function ShapeMixPanel({ analytics, accent }: { analytics: ClubAnalytics; accent: string }) {
  const total = Object.values(analytics.accuracy.shapeCounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const shapes = Object.entries(analytics.accuracy.shapeCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  return (
    <DataPanel>
      <SectionHeader
        title="Shot shape mix"
        description="Start line plus side carry classification."
      />
      <CardContent className="space-y-3">
        {shapes.length > 0 ? (
          shapes.map(([shape, count]) => (
            <div key={shape} className="grid grid-cols-[86px_1fr_44px] items-center gap-3">
              <span className="text-sm font-medium capitalize">{shape}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: accent }}
                />
              </div>
              <span className="text-right text-sm text-muted-foreground">{count}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Need launch direction and side carry before shape mix is useful.
          </p>
        )}
      </CardContent>
    </DataPanel>
  );
}

function SmallDecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function ProfileCard({
  title,
  icon: Icon,
  metrics,
}: {
  title: string;
  icon: typeof BarChart3;
  metrics: Array<[string, string]>;
}) {
  return (
    <DataPanel>
      <SectionHeader title={title} action={<Icon className="size-5 text-muted-foreground" />} />
      <CardContent className="grid gap-2">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl bg-white/85 px-3 py-2 ring-1 ring-slate-200/80"
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-right font-semibold">{value}</span>
          </div>
        ))}
      </CardContent>
    </DataPanel>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function ShotCloud({
  shots,
  analytics,
  accent,
}: {
  shots: ClubAnalyticsShot[];
  analytics: ClubAnalytics;
  accent: string;
}) {
  const plotted = shots.filter((shot) => shot.carryYd !== null);
  const holeYardage = 350;
  const maxDistance =
    Math.max(holeYardage, ...plotted.map((shot) => shot.totalYd ?? shot.carryYd ?? 0)) * 1.02;
  const maxSide = Math.max(55, ...plotted.map((shot) => Math.abs(shot.sideCarryYd ?? 0))) * 1.15;
  const tee = { x: 322, y: 936 };
  const playHeight = 830;
  const sideScale = 158;
  const xFor = (side: number | null) => tee.x + ((side ?? 0) / maxSide) * sideScale;
  const yFor = (distance: number | null) => tee.y - ((distance ?? 0) / maxDistance) * playHeight;
  const stockY = yFor(analytics.distance.stockCarryYd);
  const coneCenterX = xFor(analytics.accuracy.averageSideCarryYd);
  const coneCenterY = yFor(analytics.distance.stockCarryYd);
  const coneRadiusX = Math.max(
    34,
    ((analytics.accuracy.shotConeWidthYd ?? 0) / maxSide) * sideScale,
  );
  const coneRadiusY = Math.max(30, ((analytics.distance.carrySpreadYd ?? 0) / maxDistance) * 280);
  const yardMarkers = [100, 150, 200, 250].filter((yard) => yard <= maxDistance);

  return (
    <div className="grid h-[420px] min-h-[340px] max-h-[62vh] place-items-center overflow-hidden rounded-2xl border bg-[#0b1411] shadow-inner">
      <svg
        viewBox="60 290 560 480"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label="Shot cloud on a 350 yard hole"
      >
        <defs>
          <filter id="analyticsGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
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
          preserveAspectRatio="xMidYMid slice"
        />
        <rect x="0" y="0" width="644" height="1024" fill="#020617" opacity="0.14" />

        {yardMarkers.map((yard) => {
          const y = yFor(yard);
          const arcWidth = 70 + (yard / holeYardage) * 248;
          return (
            <g key={yard}>
              <path
                d={`M ${tee.x - arcWidth} ${y + 22} Q ${tee.x} ${y - 24} ${tee.x + arcWidth} ${y + 22}`}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.68"
                strokeWidth="2.5"
                strokeDasharray="10 10"
              />
              <text
                x={Math.min(592, tee.x + arcWidth + 12)}
                y={y + 12}
                fill="#f8fafc"
                fontSize="18"
                fontWeight="700"
              >
                {yard}
              </text>
            </g>
          );
        })}

        {[-40, -20, 20, 40].map((side) => (
          <line
            key={side}
            x1={xFor(side)}
            x2={xFor(side)}
            y1={290}
            y2={770}
            stroke="#ffffff"
            strokeDasharray="9 12"
            strokeOpacity="0.34"
            strokeWidth="2"
          />
        ))}
        <line
          x1={tee.x}
          x2={tee.x}
          y1={290}
          y2={770}
          stroke="#ffffff"
          strokeOpacity="0.72"
          strokeWidth="2.5"
        />
        <text
          x={xFor(-40)}
          y="318"
          fill="#e5e7eb"
          fontSize="18"
          fontWeight="700"
          textAnchor="middle"
        >
          Left
        </text>
        <text
          x={xFor(40)}
          y="318"
          fill="#e5e7eb"
          fontSize="18"
          fontWeight="700"
          textAnchor="middle"
        >
          Right
        </text>

        {analytics.distance.stockCarryYd ? (
          <>
            <ellipse
              cx={coneCenterX}
              cy={coneCenterY}
              rx={coneRadiusX}
              ry={coneRadiusY}
              fill="none"
              stroke={accent}
              strokeOpacity="0.72"
              strokeWidth="3"
              filter="url(#analyticsGlow)"
            />
            <line
              x1="92"
              x2="552"
              y1={stockY}
              y2={stockY}
              stroke={accent}
              strokeWidth="3"
              strokeDasharray="8 8"
            />
          </>
        ) : null}
        {plotted.map((shot) => {
          const shape = classifyShotShape(shot);
          const missTags = likelyMishitTags({
            clubType: analytics.clubType,
            shot,
            stockCarryYd: analytics.distance.stockCarryYd,
          });
          return (
            <circle
              key={shot.id}
              cx={xFor(shot.sideCarryYd)}
              cy={yFor(shot.carryYd)}
              r={missTags.length > 0 ? 4 : 5}
              fill={shape === "straight" ? "#ffffff" : accent}
              opacity={missTags.length > 0 ? 0.42 : 0.82}
              stroke="#020617"
              strokeOpacity="0.35"
            />
          );
        })}
      </svg>
    </div>
  );
}

function DistanceDistribution({ analytics, accent }: { analytics: ClubAnalytics; accent: string }) {
  const values: Array<[string, number | null]> = [
    ["Mishit", analytics.distance.mishitFloorYd],
    ["Safe", analytics.distance.safeCarryYd],
    ["Recommended", analytics.distance.stockPlayNumberYd],
    ["Best stock", analytics.distance.stockCarryYd],
    ["Personal best", analytics.distance.personalBestCarryYd],
    ["Aggressive", analytics.distance.aggressiveCarryYd],
    ["Peak", analytics.distance.bestCarryYd],
  ];
  const maxValue = Math.max(1, ...values.map(([, value]) => value ?? 0));

  return (
    <div className="space-y-3">
      {values.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[82px_1fr_70px] items-center gap-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${((value ?? 0) / maxValue) * 100}%`,
                background: label === "Recommended" ? "#111827" : accent,
              }}
            />
          </div>
          <span className="text-right text-sm font-semibold">{formatYards(value)}</span>
        </div>
      ))}
    </div>
  );
}

function LaunchWindowChart({ analytics, accent }: { analytics: ClubAnalytics; accent: string }) {
  const low = analytics.launch.launchWindow.low;
  const high = analytics.launch.launchWindow.high;
  const average = analytics.launch.launchAverageDeg;
  const domainLow = Math.max(0, low - 10);
  const domainHigh = high + 10;
  const percentFor = (value: number) => ((value - domainLow) / (domainHigh - domainLow)) * 100;

  return (
    <div className="space-y-4">
      <div className="relative h-12 rounded-full bg-muted">
        <div
          className="absolute top-0 h-full rounded-full bg-emerald-200"
          style={{ left: `${percentFor(low)}%`, width: `${percentFor(high) - percentFor(low)}%` }}
        />
        {average !== null ? (
          <div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${percentFor(average)}%`, background: accent }}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{domainLow} deg</span>
        <span>
          Window {low}-{high} deg
        </span>
        <span>{domainHigh} deg</span>
      </div>
    </div>
  );
}

function DeltaPanel({
  title,
  delta,
}: {
  title: string;
  delta: ClubAnalytics["progress"]["baselineDelta"];
}) {
  return (
    <div className="apple-panel-strong p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <Badge variant="outline">{delta ? "Compared" : "Needs data"}</Badge>
      </div>
      {delta ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <DeltaMetric label="Carry" value={delta.carryDeltaYd} suffix="yd" goodWhen="positive" />
          <DeltaMetric
            label="Ball speed"
            value={delta.ballSpeedDeltaMph}
            suffix="mph"
            goodWhen="positive"
          />
          <DeltaMetric
            label="Offline"
            value={delta.offlineDeltaYd}
            suffix="yd"
            goodWhen="negative"
          />
          <DeltaMetric
            label="Club path"
            value={delta.clubPathDeltaDeg}
            suffix="deg"
            goodWhen="neutral"
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Need at least two comparable clean shot groups.
        </p>
      )}
    </div>
  );
}

function DeltaMetric({
  label,
  value,
  suffix,
  goodWhen,
}: {
  label: string;
  value: number | null;
  suffix: string;
  goodWhen: "positive" | "negative" | "neutral";
}) {
  const isGood =
    value !== null &&
    (goodWhen === "positive"
      ? value >= 0
      : goodWhen === "negative"
        ? value <= 0
        : Math.abs(value) <= 2);
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          isGood ? "mt-1 font-semibold text-emerald-700" : "mt-1 font-semibold text-amber-700"
        }
      >
        {value === null
          ? "--"
          : `${value > 0 ? "+" : ""}${numberFormatter.format(value)} ${suffix}`}
      </p>
    </div>
  );
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatRange(low: number | null, high: number | null) {
  if (low === null || high === null) {
    return "--";
  }

  return `${numberFormatter.format(low)}-${numberFormatter.format(high)} yd`;
}

function formatFeet(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} ft`;
}

function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function formatDegrees(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} deg`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatOptional(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatSide(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value < 0) {
    return `${numberFormatter.format(Math.abs(value))}L`;
  }

  if (value > 0) {
    return `${numberFormatter.format(value)}R`;
  }

  return "0";
}

function shapeLabel(value: string) {
  return value
    .split(" ")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
