import Link from "next/link";
import { Activity, Gauge, Radar, Target, Upload } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { PracticePlannerClient } from "@/app/practice/practice-planner-client";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { DataPair, PageShell, StatusPill, StickyMobileAction } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  generatePracticePlan,
  getLatestPracticeSessionReview,
  getPracticePlannerPageData,
  savedPracticePlanToPracticePlan,
  type GeneratePracticePlanOptions,
  type PracticeLatestSessionReview,
  type PracticePlan,
} from "@/lib/practice-planner";

export const dynamic = "force-dynamic";

type PracticePlannerPageProps = {
  searchParams?: Promise<{
    source?: string;
    time?: string;
    intent?: string;
    energy?: string;
    session?: string;
    balls?: string;
  }>;
};

export default async function PracticePlannerPage({ searchParams }: PracticePlannerPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const data = await getPracticePlannerPageData(userId);
  const requestedOptions = practiceOptionsFromSearchParams(params);
  const generatedPlan = generatePracticePlan(data.context, requestedOptions);
  const latestOpenPlan =
    data.savedPlans.find(
      (plan) =>
        plan.status === "planned" ||
        plan.status === "awaiting_import" ||
        plan.status === "match_found",
    ) ?? null;
  const latestOpenPracticePlan = latestOpenPlan
    ? savedPracticePlanToPracticePlan(latestOpenPlan, data.context)
    : null;
  const initialPlan = latestOpenPracticePlan ?? generatedPlan;
  const latestSessionReview =
    latestOpenPlan && !latestOpenPlan.result && latestOpenPracticePlan
      ? await getLatestPracticeSessionReviewSafely(userId, latestOpenPracticePlan)
      : null;
  const initialOptions = practicePlanOptionsFromPlan(initialPlan, requestedOptions);
  const cockpit = await getPracticeCockpitMetrics(userId, latestSessionReview);
  const planVolume =
    initialPlan.totalBalls === null
      ? `Timed | ${initialPlan.estimatedTimeMinutes} min`
      : `${initialPlan.totalBalls} balls | ${initialPlan.estimatedTimeMinutes} min`;
  const latestOpportunity = data.context.latestPractice.biggestOpportunity
    ? data.context.latestPractice.biggestOpportunity.toUpperCase()
    : "Building";
  const roadmapPriority = data.context.progress.priorities[0]?.clubType.toUpperCase() ?? "Baseline";

  return (
    <PageShell size="full">
      <MobileRouteHeader title="Coach" group="improve" activeKey="practice" />
      <PracticeSessionCockpit
        metrics={cockpit}
        plan={initialPlan}
        latestSessionReview={latestSessionReview}
        trainingLoad={{
          statusLabel: data.context.trainingLoad.statusLabel,
          highRecentLoad: data.context.trainingLoad.highRecentLoad,
          recommendation: data.context.trainingLoad.recommendation,
        }}
      />
      <header className="rounded-xl border bg-white/85 p-3 shadow-sm ring-1 ring-emerald-950/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Practice Planner</h1>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Create today&apos;s session from latest practice, progress roadmap, bag trust, and
              training load.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={data.context.trainingLoad.highRecentLoad ? "amber" : "green"}>
              {data.context.trainingLoad.statusLabel}
            </StatusPill>
            <StatusPill tone="amber">Latest opportunity: {latestOpportunity}</StatusPill>
            <StatusPill tone="sky">Roadmap: {roadmapPriority}</StatusPill>
            <StatusPill tone="green">{planVolume}</StatusPill>
            <StatusPill tone="green">Confidence {initialPlan.confidenceLabel}</StatusPill>
          </div>
        </div>
      </header>

      <PracticePlannerClient
        context={data.context}
        initialPlan={initialPlan}
        savedPlans={data.savedPlans}
        templates={data.templates}
        importOptions={data.importOptions}
        latestSessionReview={latestSessionReview}
        initialOptions={initialOptions}
      />
      <StickyMobileAction>
        <Button asChild className="premium-action min-h-12 w-full rounded-lg">
          <a href="#practice-plan">
            <Target className="size-4" />
            Start today&apos;s drill
          </a>
        </Button>
      </StickyMobileAction>
    </PageShell>
  );
}

function practiceOptionsFromSearchParams(
  params: Awaited<PracticePlannerPageProps["searchParams"]>,
): GeneratePracticePlanOptions {
  return {
    sessionType: parseSessionType(params?.session),
    ballCount: parseBallCount(params?.balls),
    timeMinutes: parsePracticeTime(params?.time),
    energy: parseEnergy(params?.energy),
    intent: parseIntent(params?.intent),
    facility: {
      chippingGreen: true,
      bunker: true,
      puttingGreen: true,
      golfClubOnly: true,
      rapsodoSpeed: true,
    },
  };
}

function practicePlanOptionsFromPlan(
  plan: PracticePlan,
  fallback: GeneratePracticePlanOptions,
): GeneratePracticePlanOptions {
  return {
    ...fallback,
    sessionType: plan.sessionType,
    ballCount: plan.totalBalls ?? fallback.ballCount,
    timeMinutes: plan.estimatedTimeMinutes,
    energy: plan.energy,
    intent: plan.intent,
  };
}

function parsePracticeTime(value: string | undefined) {
  const minutes = Number(value);

  if (minutes === 20 || minutes === 30 || minutes === 45 || minutes === 60 || minutes === 90) {
    return minutes;
  }

  return 45;
}

function parseBallCount(value: string | undefined) {
  const balls = Number(value);

  if (balls === 30 || balls === 50 || balls === 80 || balls === 100 || balls === 120) {
    return balls;
  }

  return 80;
}

function parseSessionType(value: string | undefined): GeneratePracticePlanOptions["sessionType"] {
  if (
    value === "range" ||
    value === "short_game" ||
    value === "speed" ||
    value === "putting" ||
    value === "course_warmup" ||
    value === "mixed"
  ) {
    return value;
  }

  return "range";
}

function parseEnergy(value: string | undefined): GeneratePracticePlanOptions["energy"] {
  if (value === "fresh" || value === "normal" || value === "tired" || value === "niggle") {
    return value;
  }

  return "normal";
}

function parseIntent(value: string | undefined): GeneratePracticePlanOptions["intent"] {
  if (
    value === "scoring" ||
    value === "confidence" ||
    value === "latest_weakness" ||
    value === "round_preparation" ||
    value === "distance_mapping" ||
    value === "speed"
  ) {
    return value;
  }

  return "latest_weakness";
}

async function getLatestPracticeSessionReviewSafely(
  userId: string,
  plan: PracticePlan,
): Promise<PracticeLatestSessionReview | null> {
  try {
    return await getLatestPracticeSessionReview(userId, plan);
  } catch (error) {
    console.error("[practice] Latest session review unavailable", error);
    return null;
  }
}

type PracticeCockpitMetrics = {
  sourceLabel: string;
  sessionId: string | null;
  shotCount: number;
  carryAverageYd: number | null;
  spinAverageRpm: number | null;
  smashAverage: number | null;
  playableRate: number | null;
};

async function getPracticeCockpitMetrics(
  userId: string,
  latestSessionReview: PracticeLatestSessionReview | null,
): Promise<PracticeCockpitMetrics> {
  const db = getDb();
  const reviewedSessionId = latestSessionReview?.sourceSessionId ?? null;
  const latestSession =
    reviewedSessionId === null
      ? (
          await db
            .select({ id: sessions.id, date: sessions.date })
            .from(sessions)
            .where(eq(sessions.userId, userId))
            .orderBy(desc(sessions.date))
            .limit(1)
        )[0]
      : null;
  const sessionId = reviewedSessionId ?? latestSession?.id ?? null;

  if (!sessionId) {
    return {
      sourceLabel: "Waiting for import",
      sessionId: null,
      shotCount: 0,
      carryAverageYd: null,
      spinAverageRpm: null,
      smashAverage: null,
      playableRate: null,
    };
  }

  const rows = await db
    .select({
      carryYd: shots.carryYd,
      spinRate: shots.spinRate,
      smashFactor: shots.smashFactor,
      sideCarryYd: shots.sideCarryYd,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.sessionId, sessionId)))
    .limit(220);
  const sideRows = rows.filter((row) => isPracticeMetric(row.sideCarryYd));
  const playableRows = sideRows.filter((row) => Math.abs(Number(row.sideCarryYd)) <= 20);

  return {
    sourceLabel: latestSessionReview
      ? `${latestSessionReview.importedSession.shotCount}-shot reviewed session`
      : latestSession?.date
        ? `Latest import ${latestSession.date.toISOString().slice(0, 10)}`
        : "Latest import",
    sessionId,
    shotCount: rows.length,
    carryAverageYd: averagePracticeMetric(rows.map((row) => row.carryYd)),
    spinAverageRpm: averagePracticeMetric(rows.map((row) => row.spinRate)),
    smashAverage: averagePracticeMetric(rows.map((row) => row.smashFactor)),
    playableRate:
      sideRows.length > 0 ? Math.round((playableRows.length / sideRows.length) * 100) : null,
  };
}

function PracticeSessionCockpit({
  metrics,
  plan,
  latestSessionReview,
  trainingLoad,
}: {
  metrics: PracticeCockpitMetrics;
  plan: PracticePlan;
  latestSessionReview: PracticeLatestSessionReview | null;
  trainingLoad: {
    statusLabel: string;
    highRecentLoad: boolean;
    recommendation: string;
  };
}) {
  const readiness = latestSessionReview
    ? `${latestSessionReview.score.score}/100`
    : trainingLoad.highRecentLoad
      ? "Ease off"
      : "Ready";
  const readinessDetail = latestSessionReview
    ? latestSessionReview.score.verdict
    : trainingLoad.recommendation;

  return (
    <section className="apple-panel-strong grid gap-4 rounded-lg p-4 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active session mode
          </p>
          <h2 className="mt-1 text-3xl font-semibold leading-tight tracking-normal text-foreground">
            {plan.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {metrics.sourceLabel}. Practice scoring is driven by imported launch-monitor shots.
          </p>
        </div>
        <StatusPill tone={trainingLoad.highRecentLoad ? "amber" : "green"}>
          {trainingLoad.statusLabel}
        </StatusPill>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PracticeCockpitMetric
          icon={Target}
          label="Carry"
          value={formatPracticeYards(metrics.carryAverageYd)}
          detail={`${metrics.shotCount} shots`}
          emphasis
        />
        <PracticeCockpitMetric
          icon={Radar}
          label="Spin"
          value={formatPracticeSpin(metrics.spinAverageRpm)}
          detail="Session avg"
        />
        <PracticeCockpitMetric
          icon={Gauge}
          label="Smash"
          value={formatPracticeDecimal(metrics.smashAverage)}
          detail="Efficiency"
        />
        <PracticeCockpitMetric
          icon={Activity}
          label="Readiness"
          value={readiness}
          detail={readinessDetail}
        />
      </div>
      <div className="grid gap-2 rounded-lg border border-emerald-950/10 bg-white/80 p-3 text-sm">
        <DataPair
          label="Playable rate"
          value={metrics.playableRate === null ? "--" : `${metrics.playableRate}%`}
        />
        <DataPair
          label="Next drill"
          value={plan.blocks[0]?.title ?? latestSessionReview?.score.nextAction ?? "Import session"}
        />
      </div>
      {metrics.sessionId ? (
        <Button asChild variant="outline" className="min-h-11 rounded-lg">
          <Link href={`/shots?sessionId=${encodeURIComponent(metrics.sessionId)}`}>
            <Upload className="size-4" />
            Review session shots
          </Link>
        </Button>
      ) : (
        <Button asChild className="premium-action min-h-11 rounded-lg">
          <Link href="/import">
            <Upload className="size-4" />
            Import session
          </Link>
        </Button>
      )}
    </section>
  );
}

function PracticeCockpitMetric({
  icon: Icon,
  label,
  value,
  detail,
  emphasis = false,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`grid min-h-[7.25rem] content-between rounded-lg border p-3 ${
        emphasis
          ? "border-emerald-800/25 bg-emerald-950 text-white"
          : "border-emerald-950/10 bg-white/84 text-foreground"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
            emphasis ? "text-emerald-50/78" : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        <Icon className={`size-4 ${emphasis ? "text-emerald-100" : "text-emerald-700"}`} />
      </div>
      <div>
        <p className="text-4xl font-semibold leading-none tracking-normal">{value}</p>
        <p
          className={`mt-1 line-clamp-1 text-xs leading-4 ${
            emphasis ? "text-emerald-50/78" : "text-muted-foreground"
          }`}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}

function isPracticeMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function averagePracticeMetric(values: Array<number | null>) {
  const finite = values.filter(isPracticeMetric);

  if (finite.length === 0) {
    return null;
  }

  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function formatPracticeYards(value: number | null) {
  return value === null ? "--" : Math.round(value).toString();
}

function formatPracticeSpin(value: number | null) {
  return value === null ? "--" : Math.round(value).toLocaleString("en-GB");
}

function formatPracticeDecimal(value: number | null) {
  return value === null ? "--" : value.toFixed(2);
}
