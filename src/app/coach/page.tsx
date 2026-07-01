import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  Gauge,
  LineChart,
  MessageCircle,
  Sparkles,
  Target,
  Trophy,
  Upload,
} from "lucide-react";

import { CoachDrillAutoSync } from "@/app/coach/coach-drill-auto-sync";
import { CoachPracticeFeaturePanel } from "@/components/features/feature-panels";
import {
  DataPanel,
  MobileCompanionAccordion,
  MobileCompanionHero,
  PageShell,
  SectionHeader,
  StatusPill,
  type Tone,
} from "@/components/premium";
import {
  MobileAppShell,
  MobileRouteTabs,
  MobileTopBar,
  NativeListSection,
  PBCard,
  ProgressCard,
} from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  buildCoachSummary,
  buildCoachDrillChallenges,
  type CoachDrillChallenge,
  type CoachClubCard,
  type CoachSummary,
  type CoachTrainingImpact,
} from "@/lib/coach";
import { getCoachDrillAwardStatuses, type CoachDrillAwardStatus } from "@/lib/coach-drill-awards";
import { getProgressData } from "@/lib/progress-data";
import { buildAiCoachPayload } from "@/lib/ai-coach-summary";
import type { AiCoachPayload } from "@/lib/ai-coach-summary";
import { AiCoachCard } from "@/app/coach/ai-coach-card";
import { CoachChatCard } from "@/app/coach/coach-chat-card";
import { getActivePlanKeyForUser, planAllowsAiCoach } from "@/lib/billing";
import { findRelevantChallenge } from "@/lib/challenge-relevance";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import type { ProgressSignal } from "@/lib/progress-summary";
import { formatSpeed } from "@/lib/speed-training";
import { getSpeedCoachCardData, type SpeedCentreSummary } from "@/lib/speed-training-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const userId = await requireCurrentUserId();
  const [data, activePlanKey, challengeData, featureData, speedCoachData] = await Promise.all([
    getProgressData(userId),
    getActivePlanKeyForUser(userId),
    getChallengesPageData(),
    getFeatureIdeasData(),
    getSpeedCoachCardData(userId),
  ]);
  const coach = buildCoachSummary(data.clubs);
  const topClub = coach.clubCards[0] ?? null;
  const drillChallenges = buildCoachDrillChallenges(coach);
  const drillStatuses = await getCoachDrillAwardStatuses(drillChallenges);
  const shouldSyncDrillAwards = Object.values(drillStatuses).some(
    (status) =>
      (status.completed && !status.completedAwarded) || (status.won && !status.wonAwarded),
  );
  const aiPayload = buildAiCoachPayload(coach);
  const canUseAiCoach = planAllowsAiCoach(activePlanKey);

  return (
    <PageShell>
      <CoachDrillAutoSync enabled={shouldSyncDrillAwards} />
      <style>{`
        @media (min-width: 640px) {
          .coach-ai-grid-item {
            grid-column: span 6 / span 6;
          }

          .coach-ai-grid-item:has(details[open]) {
            grid-column: span 12 / span 12;
          }
        }
      `}</style>
      <MobileAppShell>
        <MobileTopBar title="Improve" />
        <MobileRouteTabs group="improve" activeKey="coach" />
        <MobileCompanionHero
          eyebrow={<StatusPill tone={topClub?.tone ?? "slate"}>Do this next</StatusPill>}
          title={topClub ? `${topClub.clubName}: ${topClub.issueLabel}` : "Build a baseline"}
          description={topClub?.reason ?? coach.headline}
          metricLabel="Start today"
          metricValue={coach.sessionPlan[0]?.duration ?? "12 shots"}
          metricDetail={
            topClub ? `${topClub.trustIndex}% trust · ${targetForCard(topClub)}` : coach.subhead
          }
          action={
            <Button asChild className="premium-action rounded-lg">
              <Link
                href={topClub ? `/bag/${topClub.clubId}/analytics` : "/import"}
                prefetch={false}
              >
                {topClub ? "Start drill" : "Import data"}
              </Link>
            </Button>
          }
        >
          <ProgressCard
            title={coach.sessionPlan[0]?.title ?? "12 stock shots"}
            value={coach.sessionPlan[0]?.duration ?? "12 shots"}
            detail={coach.sessionPlan[0]?.detail ?? "Build a clean comparable sample."}
          />
          <div className="grid grid-cols-2 gap-2">
            <PBCard
              title="Trust"
              value={`${coach.summary.totals.averageTrust}%`}
              detail={`${coach.summary.totals.clubs} clubs`}
            />
            <PBCard
              title="Clean shots"
              value={coach.summary.totals.trackedCleanShots.toLocaleString("en-GB")}
              detail="Tracked"
            />
          </div>
        </MobileCompanionHero>
        <MobileCompanionAccordion
          items={[
            {
              value: "practice-tools",
              title: "Practice tools",
              description: "Active drill, completion and progress.",
              summary: "1 active",
              children: (
                <div className="grid gap-4">
                  <CoachPracticeFeaturePanel
                    data={featureData}
                    compactMobile
                    compactExtras={
                      <NativeListSection
                        id="more-drills"
                        title="Daily XP drills"
                        description="Hit the shot-count target, then win the drill for the bigger XP unlock. Progress reads from today’s uploaded shots."
                      >
                        {drillChallenges.length > 0 ? (
                          drillChallenges.map((challenge) => (
                            <CoachDrillChallengeCard
                              key={challenge.id}
                              challenge={challenge}
                              status={
                                drillStatuses[challenge.id] ?? {
                                  completed: false,
                                  won: false,
                                  uploadedShotCount: 0,
                                  completionTarget: challenge.completionTarget,
                                  winCount: 0,
                                  winTarget: winTargetForChallenge(challenge),
                                  completedAwarded: false,
                                  wonAwarded: false,
                                }
                              }
                            />
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                            Import at least three clean shots with one club to generate today’s XP
                            drills.
                          </div>
                        )}
                      </NativeListSection>
                    }
                  />
                </div>
              ),
            },
            {
              value: "evidence",
              title: "Evidence",
              description: "What changed in your latest baselines.",
              summary: `${coach.trainingImpact.slice(0, 2).length} items`,
              children: <TrainingFeedback impacts={coach.trainingImpact.slice(0, 2)} />,
            },
            {
              value: "club-diagnosis",
              title: "Club diagnosis",
              description: "Every club-specific issue when you need the report.",
              summary: `${coach.clubCards.length} clubs`,
              children: (
                <NativeListSection
                  title="Needs most attention"
                  description="Top club issues stay here. Open the diagnosis page for the full report."
                >
                  {coach.clubCards.length > 0 ? (
                    <>
                      {coach.clubCards.slice(0, 3).map((card) => (
                        <DiagnosisAttentionRow key={card.clubId} card={card} />
                      ))}
                      <Button asChild variant="outline">
                        <Link href="/coach/diagnosis" prefetch={false}>
                          Open diagnosis
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280]">
                      Import launch-monitor shots to unlock club-by-club coach diagnosis.
                    </div>
                  )}
                </NativeListSection>
              ),
            },
          ]}
        />
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/practice" prefetch={false}>
              <Crosshair className="size-4" />
              Practice Planner
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/progress" prefetch={false}>
              <LineChart className="size-4" />
              Progress
            </Link>
          </Button>
          <Button asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import data
            </Link>
          </Button>
        </div>
      </div>

      <div
        className="hidden auto-rows-auto items-stretch gap-4 sm:grid lg:gap-5"
        style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
      >
        {data.clubs.length === 0 ? (
          <CompactCoachEmptyState />
        ) : (
          <>
            <CoachPracticeHero
              coach={coach}
              topClub={topClub}
              primaryChallenge={drillChallenges[0] ?? null}
              primaryStatus={drillChallenges[0] ? drillStatuses[drillChallenges[0].id] : undefined}
            />

            <WhatChangedPanel signals={coach.signals} span={6} />

            <AthleticDevelopmentCoachCard summary={speedCoachData.summary} span={6} />

            <PracticeSessionBuilder
              topClub={topClub}
              drillChallenges={drillChallenges}
              drillStatuses={drillStatuses}
              span={7}
            />
            <RoundReadinessPanel
              coach={coach}
              featureData={featureData}
              topClub={topClub}
              span={5}
            />

            <TodaysPlan cards={coach.clubCards} span={8} />

            <CoachSummaryPanel coach={coach} impacts={coach.trainingImpact.slice(0, 3)} span={4} />
            <RecentSessionFeedback impacts={coach.trainingImpact.slice(0, 2)} span={6} />

            <DiagnosisPreview cards={coach.clubCards} span={6} />

            <AiCoachToolsPanel
              canUseAiCoach={canUseAiCoach}
              aiPayload={aiPayload}
              className="coach-ai-grid-item"
            />

            <details className="group min-w-0" style={bentoSpan(6)}>
              <summary className="premium-card grid h-full cursor-pointer list-none gap-3 rounded-lg px-5 py-4 text-left transition-colors hover:bg-emerald-50/35 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-lg font-semibold tracking-normal">
                    Social comparison
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Hidden by default so this page stays focused on your game.
                  </span>
                </span>
                <StatusPill tone="amber">Secondary</StatusPill>
              </summary>
              <div className="mt-4">
                <CoachSocialPrompt topClub={topClub} challenges={challengeData.active} />
              </div>
            </details>
          </>
        )}
      </div>
    </PageShell>
  );
}

type BentoSpan = 4 | 5 | 6 | 7 | 8 | 12;

function bentoSpan(span: BentoSpan): CSSProperties {
  return { gridColumn: `span ${span} / span ${span}` };
}

function CoachBentoPanel({
  children,
  className,
  span,
}: {
  children: ReactNode;
  className?: string;
  span?: BentoSpan;
}) {
  return (
    <div className={cn("min-w-0 h-full", className)} style={span ? bentoSpan(span) : undefined}>
      <DataPanel className="h-full gap-0 py-0">{children}</DataPanel>
    </div>
  );
}

function CompactPanelHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-white/35 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-normal text-[#111611]">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CompactStatusCard({
  title,
  detail,
  action,
  className,
}: {
  title: ReactNode;
  detail: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 leading-5 text-muted-foreground">{detail}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

function CompactCoachEmptyState() {
  return (
    <CoachBentoPanel span={6}>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <Brain className="size-8 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">Coach is waiting for data</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Import launch-monitor shots and LM World Tour will turn club data into distance, strike,
            launch, direction, and delivery recommendations.
          </p>
        </div>
        <Button asChild className="w-fit">
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" />
            Import data
          </Link>
        </Button>
      </CardContent>
    </CoachBentoPanel>
  );
}

function CoachSocialPrompt({
  topClub,
  challenges,
}: {
  topClub: CoachClubCard | null;
  challenges: ChallengeListItem[];
}) {
  const challenge = findRelevantChallenge(challenges, topClub?.clubType);

  return (
    <DataPanel>
      <SectionHeader
        title="Social comparison"
        description="Framed as a next step, not a judgement against friends."
        action={<Trophy className="size-5 text-amber-600" />}
      />
      <CardContent className="grid gap-3">
        <p className="trust-indicator rounded-lg p-3 text-sm leading-6 text-slate-700">
          {topClub
            ? `${topClub.clubName} is the current practice priority. Use it to pick a challenge, plan a record attempt, or prepare for an event.`
            : "Build a clean club baseline before comparing with friends or entering verified boards."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="w-fit">
            <Link href={challenge ? `/challenges/${challenge.id}` : "/challenges"} prefetch={false}>
              <Trophy className="size-4" />
              {challenge ? `Suggested: ${challenge.title}` : "Open challenges"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/course-records" prefetch={false}>
              <Award className="size-4" />
              Record strategy
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/tournaments" prefetch={false}>
              <Trophy className="size-4" />
              Tournament prep
            </Link>
          </Button>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function AthleticDevelopmentCoachCard({
  summary,
  className,
  span,
}: {
  summary: SpeedCentreSummary;
  className?: string;
  span?: BentoSpan;
}) {
  const targetGap =
    summary.currentSpeedMph !== null && summary.targetSpeedMph !== null
      ? summary.targetSpeedMph - summary.currentSpeedMph
      : null;
  const forecast = formatCoachForecast(summary);
  const needsForecastTrend = forecast === "Need trend";

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Athletic Development"
        description="Speed work, with-ball transfer, and weekly prescription."
        action={
          <Button asChild variant="outline" className="h-8 px-2.5 text-xs">
            <Link href="/speed" prefetch={false}>
              <Gauge className="size-4" />
              Speed Centre
            </Link>
          </Button>
        }
      />
      <CardContent className="grid gap-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CompactStatTile
            label="Driver current"
            value={formatSpeed(summary.currentSpeedMph)}
            tone="sky"
          />
          <CompactStatTile
            label="Target"
            value={formatSpeed(summary.targetSpeedMph)}
            tone="green"
          />
          <CompactStatTile
            label="Gap"
            value={targetGap === null ? "Set target" : formatCoachGap(targetGap)}
            tone={coachSpeedGapTone(targetGap)}
          />
          <CompactStatTile label="Forecast" value={forecast} tone="slate" />
        </div>
        <div className="rounded-lg border border-emerald-100 bg-white/85 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">
                {summary.prescription.headline}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {summary.prescription.recommendation}
              </p>
              {needsForecastTrend ? (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-xs font-medium text-amber-900">
                  Forecast needs a trend. Log another speed session before trusting a 90-day
                  projection.
                </p>
              ) : null}
            </div>
            <StatusPill tone={summary.prescription.priority === "High" ? "amber" : "green"}>
              {summary.prescription.priority}
            </StatusPill>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <SmallMetric
              label="With ball"
              value={formatSpeed(summary.shotSpeed.last20DriverAvgMph)}
            />
            <SmallMetric label="Dry avg" value={formatSpeed(summary.trainingCurrentSpeedMph)} />
            <SmallMetric label="Transfer" value={summary.transferInsight.status} />
            <SmallMetric
              label="Smash"
              value={formatCoachNumber(summary.driverEfficiency.smashFactor)}
            />
          </div>
          <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600">
            {summary.transferInsight.coachMessage}
          </p>
        </div>
      </CardContent>
    </CoachBentoPanel>
  );
}

function CoachPracticeHero({
  coach,
  topClub,
  primaryChallenge,
  primaryStatus,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard | null;
  primaryChallenge: CoachDrillChallenge | null;
  primaryStatus?: CoachDrillAwardStatus;
}) {
  const trust = topClub?.trustIndex ?? coach.summary.totals.averageTrust;
  const heroTone = trust >= 80 ? "green" : trust >= 60 ? "amber" : "pink";
  const focusTitle = topClub
    ? `${topClub.clubName} ${topClub.issueLabel}`
    : "Build a clean baseline";
  const target = practiceTargetFor(topClub, primaryChallenge);
  const href = topClub ? `/bag/${topClub.clubId}/analytics` : "/import";
  const shotTarget = primaryChallenge
    ? `${primaryChallenge.completionTarget} balls`
    : topClub
      ? `${topClub.sampleSize} clean shots`
      : "12 stock shots";
  const status = primaryChallenge ? (primaryStatus ?? defaultDrillStatus(primaryChallenge)) : null;

  return (
    <>
      <section
        className="premium-card min-w-0 h-full overflow-hidden rounded-lg border-0 bg-[#F8FAF5] shadow-[0_18px_50px_rgba(31,49,39,0.11)]"
        style={bentoSpan(8)}
      >
        <div className="grid gap-5 p-5 lg:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-[#0B7A3B] text-white hover:bg-[#0B7A3B]">
                Today&apos;s practice
              </Badge>
              <StatusPill tone={heroTone}>Trust: {trust}%</StatusPill>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-[#111611] xl:text-5xl">
              {focusTitle}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{coach.subhead}</p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <HeroStat label="Expected gain" value={expectedGainFor(topClub)} tone="green" />
            <HeroStat label="Session" value={shotTarget} tone={topClub?.tone ?? "slate"} />
            <HeroStat label="Main miss" value={topClub?.usualMiss ?? "Needs data"} tone="amber" />
          </div>
        </div>
      </section>
      <PracticeTrustPanel
        target={target}
        trust={trust}
        detail={topClub ? `${topClub.sampleSize} clean stock shots` : "Import stock shots"}
        tone={heroTone}
        status={status}
        href={href}
      />
    </>
  );
}

function PracticeTrustPanel({
  target,
  trust,
  detail,
  tone,
  status,
  href,
}: {
  target: string;
  trust: number;
  detail: string;
  tone: Tone;
  status: CoachDrillAwardStatus | null;
  href: string;
}) {
  return (
    <CoachBentoPanel span={4}>
      <CompactPanelHeader
        title="Target"
        description="Practice trust and today's drill state."
        action={<Target className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-3 p-3">
        <div className="rounded-lg border border-emerald-100 bg-white/88 p-3">
          <p className="text-sm leading-6 text-slate-600">{target}</p>
        </div>
        <TrustProgress label="Practice trust" value={trust} detail={detail} tone={tone} />
        {status ? (
          <div className="grid grid-cols-2 gap-2">
            <SmallMetric
              label="Uploaded today"
              value={`${status.uploadedShotCount}/${status.completionTarget}`}
            />
            <SmallMetric label="Win target" value={`${status.winCount}/${status.winTarget}`} />
          </div>
        ) : null}
        <Button asChild className="premium-action h-11 w-full rounded-lg">
          <Link href={href} prefetch={false}>
            <Crosshair className="size-4" />
            Start practice
          </Link>
        </Button>
      </CardContent>
    </CoachBentoPanel>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tonePanelClass(tone)}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function CompactStatTile({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tonePanelClass(tone)}`}>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tracking-normal text-slate-950">
        {value}
      </p>
    </div>
  );
}

function WhatChangedPanel({
  signals,
  className,
  span,
}: {
  signals: ProgressSignal[];
  className?: string;
  span?: BentoSpan;
}) {
  const visibleSignals = signals.slice(0, 4);

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="What changed"
        description="The strongest movement signals since the current personal baseline."
        action={<LineChart className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid flex-1 auto-rows-fr gap-3 p-3 md:grid-cols-2">
        {visibleSignals.length > 0 ? (
          visibleSignals.map((signal) => {
            const tile = (
              <div className={`h-full rounded-lg border p-3 ${tonePanelClass(signal.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{signal.label}</p>
                    <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
                      {signal.value}
                    </p>
                  </div>
                  <span className={`mt-1 size-2.5 rounded-full ${toneDotClass(signal.tone)}`} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p>
              </div>
            );

            if (!signal.clubId) {
              return <div key={`${signal.label}-${signal.value}`}>{tile}</div>;
            }

            return (
              <Link
                key={`${signal.clubId}-${signal.label}`}
                href={`/bag/${signal.clubId}/analytics`}
                prefetch={false}
                className="block h-full transition-transform hover:-translate-y-0.5"
              >
                {tile}
              </Link>
            );
          })
        ) : (
          <div className="md:col-span-2">
            <CompactStatusCard
              title="No strong movement yet"
              detail="Import another comparable session to surface meaningful baseline changes."
            />
          </div>
        )}
      </CardContent>
    </CoachBentoPanel>
  );
}

function PracticeSessionBuilder({
  topClub,
  drillChallenges,
  drillStatuses,
  className,
  span,
}: {
  topClub: CoachClubCard | null;
  drillChallenges: CoachDrillChallenge[];
  drillStatuses: Record<string, CoachDrillAwardStatus>;
  className?: string;
  span?: BentoSpan;
}) {
  const recommended = drillChallenges[0] ?? null;
  const status = recommended
    ? (drillStatuses[recommended.id] ?? defaultDrillStatus(recommended))
    : null;
  const progress = status
    ? Math.min(100, Math.round((status.uploadedShotCount / status.completionTarget) * 100))
    : 0;
  const alternatives = drillChallenges.slice(1, 4);

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Practice session builder"
        description="The old practice mode and challenge template now live as one recommended session."
        action={<StatusPill tone={topClub?.tone ?? "slate"}>Recommended</StatusPill>}
      />
      <CardContent className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={`rounded-lg border p-4 ${tonePanelClass(topClub?.tone ?? "slate")}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge className="bg-white text-emerald-800 ring-1 ring-emerald-100 hover:bg-white">
                Recommended
              </Badge>
              <h2 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
                {recommended?.title ??
                  (topClub ? `${topClub.clubName} ${topClub.issueLabel}` : "Baseline builder")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {recommended?.detail ??
                  topClub?.drill ??
                  "Record a clean stock-shot sample before trusting the coach output."}
              </p>
            </div>
            <StatusPill tone={topClub?.tone ?? "slate"}>{expectedTrustGainFor(topClub)}</StatusPill>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <SmallMetric
              label="Balls"
              value={recommended ? `${recommended.completionTarget}` : "12"}
            />
            <SmallMetric
              label="Target"
              value={recommended?.winCondition ?? practiceTargetFor(topClub, null)}
            />
            <SmallMetric
              label="Expected"
              value={topClub ? expectedTrustGainFor(topClub) : "Build trust"}
            />
          </div>

          {status ? (
            <div className="mt-4">
              <TrustProgress
                label="Today"
                value={progress}
                detail={`${status.uploadedShotCount}/${status.completionTarget} shots uploaded`}
                tone={status.completed ? "green" : (topClub?.tone ?? "slate")}
              />
            </div>
          ) : null}

          <Button asChild className="premium-action mt-4 rounded-lg">
            <Link href={topClub ? `/bag/${topClub.clubId}/analytics` : "/import"} prefetch={false}>
              <Crosshair className="size-4" />
              Start
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white/85 p-3">
          <p className="text-sm font-semibold text-slate-900">Alternatives</p>
          <div className="mt-3 grid gap-2">
            {alternatives.length > 0 ? (
              alternatives.map((challenge) => (
                <Link
                  key={challenge.id}
                  href={`/bag/${challenge.clubId}/analytics`}
                  prefetch={false}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{challenge.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {challenge.completionTarget} balls
                      </p>
                    </div>
                    <StatusPill tone={challenge.tone}>{challenge.issueLabel}</StatusPill>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                Add more clean club samples to unlock alternate practice blocks.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </CoachBentoPanel>
  );
}

function RoundReadinessPanel({
  coach,
  featureData,
  topClub,
  className,
  span,
}: {
  coach: CoachSummary;
  featureData: FeatureIdeasData;
  topClub: CoachClubCard | null;
  className?: string;
  span?: BentoSpan;
}) {
  const playableRate = coach.summary.totals.averagePlayableRate;
  const cleanSampleScore = Math.min(
    100,
    Math.round((coach.summary.totals.trackedCleanShots / 120) * 100),
  );
  const readinessTone =
    coach.summary.totals.averageTrust >= 80 && (playableRate ?? 0) >= 75
      ? "green"
      : coach.summary.totals.averageTrust >= 60
        ? "amber"
        : "pink";

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Round readiness"
        description="Can this bag readout support on-course decisions today?"
        action={
          <StatusPill tone={readinessTone}>
            {readinessTone === "green" ? "Ready" : "Watch"}
          </StatusPill>
        }
      />
      <CardContent className="grid gap-3 p-3">
        <TrustProgress
          label="Bag trust"
          value={coach.summary.totals.averageTrust}
          detail={`${coach.summary.totals.clubs} tracked clubs`}
          tone={readinessTone}
        />
        <TrustProgress
          label="Playable rate"
          value={playableRate ?? 0}
          detail={playableRate === null ? "Needs more scored stock shots" : "Average across clubs"}
          tone={(playableRate ?? 0) >= 75 ? "green" : (playableRate ?? 0) >= 55 ? "amber" : "pink"}
        />
        <TrustProgress
          label="Data trust"
          value={featureData.coachConfidence.score}
          detail={featureData.coachConfidence.detail}
          tone={featureData.coachConfidence.tone as Tone}
        />
        <TrustProgress
          label="Clean sample"
          value={cleanSampleScore}
          detail={`${coach.summary.totals.trackedCleanShots.toLocaleString("en-GB")} stock shots`}
          tone={cleanSampleScore >= 70 ? "green" : cleanSampleScore >= 40 ? "amber" : "pink"}
        />
        <div className="rounded-lg border border-slate-200 bg-white/85 p-3">
          <p className="text-sm font-semibold">Current watch</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {topClub
              ? `${topClub.clubName}: ${topClub.reason}`
              : "Import a clean baseline before trusting round-readiness calls."}
          </p>
        </div>
      </CardContent>
    </CoachBentoPanel>
  );
}

function TodaysPlan({
  cards,
  className,
  span,
}: {
  cards: CoachClubCard[];
  className?: string;
  span?: BentoSpan;
}) {
  const priority = cards[0] ?? null;
  const secondary = cards[1] ?? null;
  const maintenance = cards.slice(2, 4);

  if (!priority) {
    return (
      <CoachBentoPanel className={className} span={span}>
        <CompactPanelHeader
          title="Today's plan"
          description="Three decisions instead of a wall of drill cards."
          action={<Clock className="size-5 text-emerald-700" />}
        />
        <CardContent className="p-3">
          <CompactStatusCard
            title="Plan needs a baseline"
            detail="Import clean stock shots to unlock priority, secondary, and maintenance work."
          />
        </CardContent>
      </CoachBentoPanel>
    );
  }

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Today's plan"
        description="Three decisions instead of a wall of drill cards."
        action={<Clock className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-3 p-3 xl:grid-cols-[1.15fr_0.95fr_0.95fr]">
        <PlanLane label="Priority" card={priority} emphasis />
        <PlanLane label="Secondary" card={secondary} />
        <div className="rounded-lg border border-slate-200 bg-white/85 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Maintenance</p>
            <StatusPill tone="green">{maintenance.length || 1} checks</StatusPill>
          </div>
          <div className="mt-3 grid gap-3">
            {maintenance.length > 0 ? (
              maintenance.map((card) => <PlanMiniCard key={card.clubId} card={card} />)
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                Finish with two five-ball stock sets and keep the sample comparable.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </CoachBentoPanel>
  );
}

function PlanLane({
  label,
  card,
  emphasis = false,
}: {
  label: string;
  card: CoachClubCard | null;
  emphasis?: boolean;
}) {
  if (!card) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
        Add another clean club sample to unlock the {label.toLowerCase()} slot.
      </div>
    );
  }

  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className={`rounded-lg border p-4 transition-colors hover:border-emerald-300 ${
        emphasis ? tonePanelClass(card.tone) : "border-slate-200 bg-white/85"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            {card.clubName} {card.issueLabel}
          </h3>
        </div>
        <StatusPill tone={card.tone}>{card.trustIndex}%</StatusPill>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{card.drill}</p>
      <div className="mt-4">
        <TrustProgress
          label="Trust"
          value={card.trustIndex}
          detail={`${card.sampleSize} clean shots`}
          tone={card.tone}
        />
      </div>
    </Link>
  );
}

function PlanMiniCard({ card }: { card: CoachClubCard }) {
  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{card.clubName}</p>
          <p className="text-sm text-muted-foreground">{card.issueLabel}</p>
        </div>
        <span className="text-lg font-semibold">{card.trustIndex}%</span>
      </div>
      <Progress value={card.trustIndex} className={`mt-3 h-2 ${progressToneClass(card.tone)}`} />
    </Link>
  );
}

function CoachSummaryPanel({
  coach,
  impacts,
  className,
  span,
}: {
  coach: CoachSummary;
  impacts: CoachTrainingImpact[];
  className?: string;
  span?: BentoSpan;
}) {
  const bullets = coachSummaryBullets(coach, impacts);

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Coach summary"
        description="Plain-English readout from the current club signals."
        action={<Sparkles className="size-5 text-emerald-700" />}
      />
      <CardContent className="p-3">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/55 p-3">
          <p className="text-sm font-semibold text-emerald-900">This week</p>
          <div className="mt-3 grid gap-2">
            {bullets.map((bullet) => (
              <div key={bullet} className="flex gap-3 rounded-lg bg-white/80 p-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <p className="text-sm leading-6 text-slate-700">{bullet}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </CoachBentoPanel>
  );
}

function AiCoachToolsPanel({
  canUseAiCoach,
  aiPayload,
  className,
  span,
}: {
  canUseAiCoach: boolean;
  aiPayload: AiCoachPayload;
  className?: string;
  span?: BentoSpan;
}) {
  return (
    <CoachBentoPanel className={className} span={span}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-emerald-50/35 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-base font-semibold tracking-normal">AI coach tools</span>
            <span className="block text-xs leading-5 text-muted-foreground">
              Generate note / Ask coach
            </span>
          </span>
          <StatusPill tone={canUseAiCoach ? "green" : "amber"}>
            {canUseAiCoach ? "Available" : "Pro"}
          </StatusPill>
        </summary>
        <div className="grid gap-3 border-t border-slate-200 p-3 [&>[data-slot=card-content]]:px-0">
          {canUseAiCoach ? (
            <>
              <AiCoachCard payload={aiPayload} />
              <CoachChatCard questionId="coach-question-desktop" />
              <Button asChild variant="outline" className="w-fit">
                <Link href="/data-chat" prefetch={false}>
                  <MessageCircle className="size-4" />
                  Open Data Chat
                </Link>
              </Button>
            </>
          ) : (
            <UpgradeAiCoachCard />
          )}
        </div>
      </details>
    </CoachBentoPanel>
  );
}

function RecentSessionFeedback({
  impacts,
  className,
  span,
}: {
  impacts: CoachTrainingImpact[];
  className?: string;
  span?: BentoSpan;
}) {
  const compactMissingData =
    impacts.length > 0 &&
    impacts.every(
      (impact) =>
        impact.status === "needs-data" || impact.headline === "Needs one more comparable session",
    );

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Recent session feedback"
        description="The latest comparable-session read, kept short."
        action={<Gauge className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-2 p-3">
        {impacts.length === 0 ? (
          <CompactStatusCard
            title="No comparable feedback yet"
            detail="Import another clean session to judge whether the practice block helped."
          />
        ) : compactMissingData ? (
          impacts.map((impact) => <CompactImpactStatusCard key={impact.clubId} impact={impact} />)
        ) : (
          impacts.map((impact) => <ImpactSummaryCard key={impact.clubId} impact={impact} />)
        )}
      </CardContent>
    </CoachBentoPanel>
  );
}

function CompactImpactStatusCard({ impact }: { impact: CoachTrainingImpact }) {
  return (
    <Link
      href={`/bag/${impact.clubId}/analytics`}
      prefetch={false}
      className="rounded-lg border border-slate-200 bg-white/85 p-3 transition-colors hover:border-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-950">{impact.clubName}</p>
            <StatusPill tone={impact.tone}>{impact.issueLabel}</StatusPill>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-800">{impact.headline}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{impact.detail}</p>
        </div>
        <StatusPill tone="slate">Needs data</StatusPill>
      </div>
    </Link>
  );
}

function ImpactSummaryCard({ impact }: { impact: CoachTrainingImpact }) {
  return (
    <Link
      href={`/bag/${impact.clubId}/analytics`}
      prefetch={false}
      className={`rounded-lg border p-3 transition-colors hover:border-emerald-300 ${tonePanelClass(
        impact.tone,
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-normal">{impact.clubName}</p>
            <StatusPill tone={impact.tone}>{impact.issueLabel}</StatusPill>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-800">{impact.headline}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{impact.detail}</p>
        </div>
        <StatusPill tone={impact.tone}>{impactLabel(impact.status)}</StatusPill>
      </div>
      {impact.metrics.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {impact.metrics.slice(0, 4).map((metric) => (
            <SmallMetric key={metric.label} label={metric.label} value={metric.delta} />
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function DiagnosisPreview({
  cards,
  className,
  span,
}: {
  cards: CoachClubCard[];
  className?: string;
  span?: BentoSpan;
}) {
  const attention = cards.slice(0, 3);

  return (
    <CoachBentoPanel className={className} span={span}>
      <CompactPanelHeader
        title="Needs most attention"
        description="Full club diagnosis has moved to its own report page."
        action={
          <Button asChild variant="outline" className="h-8 px-2.5 text-xs">
            <Link href="/coach/diagnosis" prefetch={false}>
              Open diagnosis page
            </Link>
          </Button>
        }
      />
      <CardContent className="grid gap-2 p-3">
        {attention.length > 0 ? (
          attention.map((card) => <CompactDiagnosisCard key={card.clubId} card={card} />)
        ) : (
          <CompactStatusCard
            title="No diagnosis yet"
            detail="Import launch-monitor shots to unlock club-by-club coach diagnosis."
          />
        )}
      </CardContent>
    </CoachBentoPanel>
  );
}

function CompactDiagnosisCard({ card }: { card: CoachClubCard }) {
  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className="rounded-lg border border-slate-200 bg-white/85 p-3 transition-colors hover:border-emerald-300"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold tracking-normal text-slate-950">{card.clubName}</p>
            <StatusPill tone={card.tone}>{card.issueLabel}</StatusPill>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{card.reason}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Trust</span>
            <span className="text-sm font-semibold">{card.trustIndex}%</span>
          </div>
          <Progress value={card.trustIndex} className={`h-2 ${progressToneClass(card.tone)}`} />
        </div>
      </div>
    </Link>
  );
}

function DiagnosisAttentionRow({ card }: { card: CoachClubCard }) {
  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className="rounded-lg border border-slate-200 bg-white/85 p-4 transition-colors hover:border-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold tracking-normal">{card.clubName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{card.issueLabel}</p>
        </div>
        <StatusPill tone={card.tone}>{card.trustIndex}%</StatusPill>
      </div>
      <div className="mt-4">
        <Progress value={card.trustIndex} className={`h-2.5 ${progressToneClass(card.tone)}`} />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{card.reason}</p>
    </Link>
  );
}

function TrustProgress({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: Tone;
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="text-lg font-semibold tracking-normal">{safeValue}%</span>
      </div>
      <Progress value={safeValue} className={`h-2.5 ${progressToneClass(tone)}`} />
    </div>
  );
}

function expectedGainFor(card: CoachClubCard | null) {
  if (!card) {
    return "Build baseline";
  }

  const trustGap = Math.max(0, 85 - card.trustIndex);
  const gain = Math.max(0.2, Math.min(0.9, Math.round((trustGap / 30) * 10) / 10));

  return `+${gain.toFixed(1)} strokes`;
}

function expectedTrustGainFor(card: CoachClubCard | null) {
  if (!card) {
    return "Build trust";
  }

  const gain = Math.max(4, Math.min(10, Math.round((90 - card.trustIndex) / 4)));

  return `+${gain}% trust`;
}

function practiceTargetFor(card: CoachClubCard | null, challenge: CoachDrillChallenge | null) {
  if (challenge) {
    return challenge.target;
  }

  if (!card) {
    return "Record 12 clean stock shots with clear club labels.";
  }

  if (card.issue === "delivery") {
    return "Keep path below +5 deg and finish 10 stock shots inside the window.";
  }

  if (card.issue === "launch") {
    return `Hit 12 balls inside the ${card.launchWindow.low}-${card.launchWindow.high} deg launch window.`;
  }

  if (card.issue === "direction") {
    return "Score 10 stock shots and keep the dangerous miss out of play.";
  }

  if (card.issue === "strike") {
    return "Hit 12 balls at 80% speed and keep ball speed stable.";
  }

  if (card.issue === "distance") {
    return "Build two five-ball sets and keep each carry window tight.";
  }

  return "Add 12 clean full-swing stock shots before changing the play number.";
}

function defaultDrillStatus(challenge: CoachDrillChallenge): CoachDrillAwardStatus {
  return {
    uploadedShotCount: 0,
    completionTarget: challenge.completionTarget,
    winCount: 0,
    winTarget: winTargetForChallenge(challenge),
    completed: false,
    won: false,
    completedAwarded: false,
    wonAwarded: false,
  };
}

function coachSummaryBullets(coach: CoachSummary, impacts: CoachTrainingImpact[]) {
  const bullets: string[] = [];
  const better = impacts.find((impact) => impact.status === "better");
  const watch = impacts.find((impact) => impact.status === "worse" || impact.status === "mixed");
  const topClub = coach.clubCards[0] ?? null;
  const topSignal = coach.signals[0] ?? null;

  if (better) {
    const metric = better.metrics[0];
    bullets.push(
      metric
        ? `${better.clubName} improved: ${metric.label.toLowerCase()} moved ${metric.delta}.`
        : `${better.clubName} improved after the latest comparable session.`,
    );
  }

  if (topClub) {
    bullets.push(
      `${topClub.clubName} is the strongest practice opportunity at ${topClub.trustIndex}% trust.`,
    );
  }

  if (watch) {
    bullets.push(`${watch.clubName} needs a watch: ${watch.detail}`);
  } else if (topSignal) {
    bullets.push(`${topSignal.label}: ${topSignal.value}. ${topSignal.detail}`);
  }

  bullets.push(
    `Bag trust is ${coach.summary.totals.averageTrust}% across ${coach.summary.totals.clubs} tracked clubs.`,
  );

  return bullets.slice(0, 4);
}

function tonePanelClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "border-emerald-200 bg-emerald-50/75",
    sky: "border-sky-200 bg-sky-50/75",
    pink: "border-rose-200 bg-rose-50/75",
    amber: "border-amber-200 bg-amber-50/80",
    slate: "border-slate-200 bg-slate-50/85",
  };

  return classes[tone];
}

function toneDotClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "bg-emerald-500",
    sky: "bg-sky-500",
    pink: "bg-rose-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  };

  return classes[tone];
}

function coachSpeedGapTone(value: number | null): Tone {
  if (value === null) {
    return "slate";
  }

  if (value <= 3) {
    return "green";
  }

  if (value <= 6) {
    return "amber";
  }

  return "pink";
}

function formatCoachForecast(summary: SpeedCentreSummary) {
  if (summary.forecast.status === "needs_more_sessions") {
    return "Need trend";
  }

  if (summary.forecast.status === "flat") {
    return "Trend flat";
  }

  if (summary.forecast.targetEtaIso !== null && summary.targetSpeedMph !== null) {
    return `${formatSpeed(summary.targetSpeedMph)} by ${formatCoachMonth(summary.forecast.targetEtaIso)}`;
  }

  if (summary.forecast.forecastSpeedMph === null) {
    return "Need trend";
  }

  if (summary.currentSpeedMph !== null) {
    const forecastGain = summary.forecast.forecastSpeedMph - summary.currentSpeedMph;

    if (Math.abs(forecastGain) >= 0.1) {
      return `${formatCoachGap(forecastGain)} in 90 days`;
    }
  }

  return `${formatSpeed(summary.forecast.forecastSpeedMph)} in 90 days`;
}

function formatCoachGap(value: number) {
  const rounded = Math.round(value * 10) / 10;

  if (Math.abs(rounded) < 0.1) {
    return "0.0 mph";
  }

  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} mph`;
}

function formatCoachNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(2) : "No data";
}

function formatCoachMonth(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function progressToneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
    sky: "[&_[data-slot=progress-indicator]]:bg-sky-500",
    pink: "[&_[data-slot=progress-indicator]]:bg-rose-500",
    amber: "[&_[data-slot=progress-indicator]]:bg-amber-500",
    slate: "[&_[data-slot=progress-indicator]]:bg-slate-500",
  };

  return classes[tone];
}

function UpgradeAiCoachCard() {
  return (
    <CardContent>
      <div className="rounded-lg border border-dashed bg-[#F5F6F4] p-4 text-sm">
        <p className="font-semibold">AI coach is a Pro feature.</p>
        <p className="mt-1 leading-6 text-muted-foreground">
          Rule-based coaching stays available. Upgrade when you want AI summaries and chat over your
          personal SQL context.
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/billing" prefetch={false}>
            <Sparkles className="size-4" />
            View Pro
          </Link>
        </Button>
      </div>
    </CardContent>
  );
}

function winTargetForChallenge(challenge: CoachDrillChallenge) {
  return "target" in challenge.winRule ? challenge.winRule.target : challenge.completionTarget;
}

function CoachDrillChallengeCard({
  challenge,
  status,
}: {
  challenge: CoachDrillChallenge;
  status: CoachDrillAwardStatus;
}) {
  return (
    <div className="apple-panel-strong p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{challenge.clubName}</Badge>
            <StatusPill tone={challenge.tone}>{challenge.issueLabel}</StatusPill>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-normal">{challenge.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{challenge.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={status.won ? "amber" : status.completed ? "green" : "slate"}>
            {status.won ? "Won" : status.completed ? "Complete" : "Waiting"}
          </StatusPill>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <SmallMetric label="Target" value={challenge.target} />
        <SmallMetric label="Win condition" value={challenge.winCondition} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <DrillProgressTile
          label="Uploaded today"
          value={`${status.uploadedShotCount}/${status.completionTarget}`}
          detail={
            status.completedAwarded
              ? `Complete XP awarded (+${challenge.completeXp})`
              : `Complete unlock: +${challenge.completeXp} XP`
          }
          tone={status.completed ? "green" : "slate"}
        />
        <DrillProgressTile
          label="Win progress"
          value={`${status.winCount}/${status.winTarget}`}
          detail={
            status.wonAwarded
              ? `Win XP awarded (+${challenge.winXp})`
              : `Win unlock: +${challenge.winXp} XP`
          }
          tone={status.won ? "amber" : "slate"}
        />
      </div>
    </div>
  );
}

function DrillProgressTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "slate";
}) {
  const color =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-border bg-white text-foreground";

  return (
    <div className={`rounded-xl border px-3 py-2 ${color}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function TrainingFeedback({ impacts }: { impacts: CoachTrainingImpact[] }) {
  if (impacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Latest session feedback</p>
          <p className="text-xs text-muted-foreground">
            Updates automatically after a new imported session.
          </p>
        </div>
        <StatusPill tone={impacts[0]?.tone ?? "slate"}>
          {impactLabel(impacts[0]?.status)}
        </StatusPill>
      </div>
      <div className="grid gap-3">
        {impacts.map((impact) => (
          <Link
            key={impact.clubId}
            href={`/bag/${impact.clubId}/analytics`}
            prefetch={false}
            className="apple-panel-strong p-4 transition-colors hover:border-emerald-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{impact.clubName}</p>
                  <StatusPill tone={impact.tone}>{impact.issueLabel}</StatusPill>
                </div>
                <p className="mt-2 text-sm font-medium">{impact.headline}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{impact.detail}</p>
              </div>
              <StatusPill tone={impact.tone}>{impactLabel(impact.status)}</StatusPill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {impact.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg bg-white/85 px-3 py-2 ring-1 ring-slate-200/80"
                >
                  <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-sm font-semibold">{metric.after}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {metric.before} {"->"} {metric.delta}
                  </p>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/85 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function impactLabel(status: CoachTrainingImpact["status"] | undefined) {
  if (status === "better") {
    return "Better";
  }

  if (status === "worse") {
    return "Worse";
  }

  if (status === "mixed") {
    return "Mixed";
  }

  return "Needs data";
}

function targetForCard(card: CoachClubCard) {
  if (card.playableRate !== null) {
    return `Push playable rate above ${Math.min(90, Math.round(card.playableRate) + 10)}%`;
  }

  if (card.sampleSize < 20) {
    return "Reach 20 clean shots";
  }

  return "Tighten the primary miss window";
}
