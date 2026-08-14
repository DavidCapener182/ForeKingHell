import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  FileText,
  UsersRound,
  Gauge,
  LineChart,
  MessageCircle,
  Sparkles,
  Target,
  Trophy,
  Upload,
} from "lucide-react";

import { CoachDrillAutoSync } from "@/app/coach/coach-drill-auto-sync";
import { LazyCoachAiToolsPanel } from "@/app/coach/lazy-coach-ai-tools-panel";
import { CoachSupportingEvidencePanel } from "@/app/coach/coach-supporting-evidence-panel";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { ResultHero } from "@/components/app/result-hero";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { CoachPracticeFeaturePanel } from "@/components/features/feature-panels";
import {
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
  MobileCompanionAccordion,
  MobileCompanionHero,
  PageShell,
  SectionHeader,
  StatusPill,
  type Tone,
} from "@/components/premium";
import {
  MobileAppShell,
  MobileTopBar,
  NativeListSection,
  PBCard,
  ProgressCard,
} from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
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
import { getActivePlanKeyForUser, planAllowsAiCoach } from "@/lib/billing";
import { findRelevantChallenge } from "@/lib/challenge-relevance";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import type { ProgressSignal } from "@/lib/progress-summary";
import { formatSpeed } from "@/lib/speed-training";
import { getSpeedCoachCardData, type SpeedCentreSummary } from "@/lib/speed-training-data";
import { cn } from "@/lib/utils";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type CoachSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type CoachSocialContext = {
  loaded: boolean;
  challenges: ChallengeListItem[];
};
type DesktopTableWorkbenchControlsComponent =
  (typeof import("@/components/app/desktop-workbench"))["DesktopTableWorkbenchControls"];

const coachEvidenceColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "issue", label: "Issue" },
  { id: "trust", label: "Trust" },
  { id: "sample", label: "Sample" },
  { id: "stock", label: "Stock carry" },
  { id: "playable", label: "Playable" },
  { id: "miss", label: "Usual miss" },
  { id: "drill", label: "Drill" },
  { id: "action", label: "Action" },
];

const coachEvidenceSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Low-trust clubs",
    href: "/coach?tab=evidence#coach-evidence-ledger",
    detail: "Sort the evidence table by trust and sample size before practising.",
  },
  {
    title: "Practice plan",
    href: "/practice",
    detail: "Move from diagnosis evidence to a planned session.",
  },
  {
    title: "Full diagnosis",
    href: "/coach/diagnosis",
    detail: "Open the full coach report for all clubs.",
  },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function shouldLoadCoachSocial(value: string) {
  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseCoachWorkbenchTab(value: string): "diagnosis" | "evidence" | "ask" {
  return value === "evidence" || value === "ask" ? value : "diagnosis";
}

export default async function CoachPage({ searchParams }: { searchParams: CoachSearchParams }) {
  const params = await searchParams;
  const socialLoaded = shouldLoadCoachSocial(first(params.social));
  const activeWorkbenchTab = parseCoachWorkbenchTab(first(params.tab));
  const [userId, surface] = await Promise.all([requireCurrentUserId(), getRequestAppSurface()]);
  const [data, activePlanKey, challengeData, featureData, speedCoachData] = await Promise.all([
    getProgressData(userId),
    getActivePlanKeyForUser(userId),
    socialLoaded ? getChallengesPageData() : Promise.resolve(null),
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
  const socialContext: CoachSocialContext = {
    loaded: socialLoaded,
    challenges: challengeData?.active ?? [],
  };
  const coachPromptContext = topClub
    ? `${topClub.clubName}: ${topClub.issueLabel}. ${topClub.reason}`
    : "my current ForeKingHell coach baseline";
  const coachWorkbenchPrompts = [
    {
      label: "Regenerate plan",
      prompt: `Regenerate my coach practice plan from ${coachPromptContext}. Use only my available LM World Tour data and call out low-confidence evidence.`,
      icon: Sparkles,
    },
    {
      label: "Make it 30 minutes",
      prompt: `Turn the current coach plan into a 30 minute practice session. Base it on ${coachPromptContext} and keep the drill order practical for the range.`,
      icon: Clock,
    },
    {
      label: "Range-only version",
      prompt: `Convert the current coach recommendation into a range-only plan. Use ${coachPromptContext} and avoid course-only tasks.`,
      icon: Target,
    },
    {
      label: "Pre-round warm-up",
      prompt: `Make a pre-round warm-up from ${coachPromptContext}. Keep it short, confidence-first, and avoid mechanical overcorrection.`,
      icon: Gauge,
    },
    {
      label: "Confidence focus",
      prompt: `Rewrite the current coach plan to focus on confidence and trust rather than mechanics. Use ${coachPromptContext} and cite the evidence quality.`,
      icon: CheckCircle2,
    },
  ];
  const workbenchModule =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const aiWorkbenchModule =
    surface === "workbench" ? await import("@/components/app/ai-desktop-workbench") : null;
  const DesktopInsightRail = workbenchModule?.DesktopInsightRail;
  const DesktopTableWorkbenchControls = workbenchModule?.DesktopTableWorkbenchControls;
  const DesktopWorkbenchLayout = workbenchModule?.DesktopWorkbenchLayout;
  const commonAiPrompts = workbenchModule?.commonAiPrompts;
  const AiDesktopWorkbench = aiWorkbenchModule?.AiDesktopWorkbench;

  return (
    <PageShell>
      <CoachDrillAutoSync enabled={shouldSyncDrillAwards} />
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar title="Coach" />
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
          <MobileCoachRecommendationEvidence
            card={topClub}
            challenge={drillChallenges[0] ?? null}
          />
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
                      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                        Import launch-monitor shots to unlock club-by-club coach diagnosis.
                      </div>
                    )}
                  </NativeListSection>
                ),
              },
            ]}
          />
        </MobileAppShell>
      ) : DesktopInsightRail &&
        DesktopTableWorkbenchControls &&
        DesktopWorkbenchLayout &&
        commonAiPrompts &&
        AiDesktopWorkbench ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/dashboard" prefetch={false}>
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/coach/workspace" prefetch={false}>
                  <UsersRound className="size-4" />
                  Player workspace
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/coach/reports" prefetch={false}>
                  <FileText className="size-4" />
                  Share report
                </Link>
              </Button>
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

          <DesktopWorkbenchLayout scope="coach">
            <AiDesktopWorkbench
              defaultTab={activeWorkbenchTab}
              diagnosis={
                <div className="grid min-w-0 gap-5" data-coach-diagnosis-workspace>
                  {data.clubs.length === 0 ? (
                    <CompactCoachEmptyState />
                  ) : (
                    <>
                      <CoachDiagnosisHero coach={coach} topClub={topClub} />
                      <CoachDiagnosisMetrics
                        coach={coach}
                        topClub={topClub}
                        featureData={featureData}
                      />
                      <CoachPracticeRecommendation
                        topClub={topClub}
                        drillChallenges={drillChallenges}
                        drillStatuses={drillStatuses}
                      />
                      <CoachSupportingEvidence
                        coach={coach}
                        topClub={topClub}
                        speedSummary={speedCoachData.summary}
                        signals={coach.signals}
                        featureData={featureData}
                      />
                    </>
                  )}
                </div>
              }
              evidence={
                <div className="grid min-w-0 gap-5" data-coach-evidence-workspace>
                  {coach.trainingImpact.some(
                    (impact) =>
                      impact.status === "needs-data" ||
                      impact.headline === "Needs one more comparable session",
                  ) ? (
                    <Alert>
                      <Gauge className="size-4" aria-hidden="true" />
                      <AlertTitle>Some coach evidence is still provisional</AlertTitle>
                      <AlertDescription>
                        Import one more comparable session before treating every club movement as a
                        confirmed change.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <CoachEvidenceTable
                    cards={coach.clubCards}
                    DesktopTableWorkbenchControls={DesktopTableWorkbenchControls}
                  />
                  <Collapsible
                    id="coach-social-comparison"
                    className="group min-w-0 scroll-mt-28"
                    defaultOpen={socialContext.loaded}
                    style={bentoSpan(12)}
                  >
                    <CollapsibleTrigger
                      type="button"
                      data-variant="outline"
                      className={buttonVariants({
                        variant: "outline",
                        className:
                          "grid h-auto w-full gap-3 bg-card px-5 py-4 text-left shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                      })}
                    >
                      <span>
                        <span className="block text-lg font-semibold tracking-normal">
                          Social comparison
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Challenge context loads only when you ask for it.
                        </span>
                      </span>
                      <StatusPill tone={socialContext.loaded ? "green" : "amber"}>
                        {socialContext.loaded ? "Loaded" : "On demand"}
                      </StatusPill>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      <CoachSocialPrompt
                        topClub={topClub}
                        socialContext={socialContext}
                        loadHref="/coach?tab=evidence&social=1#coach-social-comparison"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              }
              ask={
                <div className="grid min-w-0 gap-5" data-coach-ask-workspace>
                  <LazyCoachAiToolsPanel
                    canUseAiCoach={canUseAiCoach}
                    aiPayload={aiPayload}
                    suggestions={coachWorkbenchPrompts.map(({ label, prompt }) => ({
                      label,
                      prompt,
                    }))}
                  />
                </div>
              }
              context={
                <DesktopInsightRail
                  title="AI coach context"
                  description="Diagnosis, evidence and drill-plan controls for the current focus."
                  metrics={[
                    {
                      label: "Primary focus",
                      value: topClub ? topClub.clubName : "Baseline",
                      detail: topClub ? topClub.reason : coach.headline,
                      tone: topClub?.tone ?? "slate",
                    },
                    {
                      label: "Bag trust",
                      value: `${coach.summary.totals.averageTrust}%`,
                      detail: `${coach.summary.totals.clubs} clubs, ${coach.summary.totals.trackedCleanShots.toLocaleString(
                        "en-GB",
                      )} clean shots in the coach model.`,
                      tone: coach.summary.totals.averageTrust >= 70 ? "green" : "amber",
                    },
                    {
                      label: "AI access",
                      value: canUseAiCoach ? "Available" : "Plan",
                      detail: canUseAiCoach
                        ? "Coach AI tools can generate summaries and drill language."
                        : "AI coaching remains gated by the active plan.",
                      tone: canUseAiCoach ? "green" : "amber",
                    },
                  ]}
                  evidence={[
                    topClub
                      ? `${topClub.clubName} is the current practice priority.`
                      : "No club has enough clean evidence for a priority yet.",
                    `${coach.sessionPlan.length} practice blocks are available in the generated plan.`,
                    "Uploaded shot data remains the source of truth for drill completion and trust.",
                  ]}
                  prompts={[...coachWorkbenchPrompts, ...commonAiPrompts("coach desk").slice(0, 2)]}
                  actions={[
                    {
                      label: "Open diagnosis",
                      href: "/coach/diagnosis",
                      detail: "Full club-by-club evidence report.",
                      icon: Brain,
                    },
                    {
                      label: "Practice planner",
                      href: "/practice",
                      detail: "Turn the coach plan into a session.",
                      icon: Crosshair,
                    },
                    {
                      label: "Data Chat",
                      href: "/data-chat",
                      detail: "Ask for a cited explanation.",
                      icon: MessageCircle,
                    },
                  ]}
                />
              }
            />
          </DesktopWorkbenchLayout>
        </>
      ) : null}
    </PageShell>
  );
}

function CoachDiagnosisHero({
  coach,
  topClub,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard | null;
}) {
  const trust = topClub?.trustIndex ?? coach.summary.totals.averageTrust;

  return (
    <ResultHero
      eyebrow="Coach diagnosis"
      title={topClub ? `${topClub.clubName}: ${topClub.issueLabel}` : "Build a measured baseline"}
      summary={topClub?.reason ?? coach.headline}
      confidence={{
        label: `${trust}% evidence trust`,
        tone: trust >= 70 ? "secondary" : "outline",
      }}
      action={
        <Button asChild>
          <Link href="/practice" prefetch={false}>
            <Crosshair className="size-4" aria-hidden="true" />
            Build Practice Plan
          </Link>
        </Button>
      }
      data-coach-diagnosis-hero
    />
  );
}

function CoachDiagnosisMetrics({
  coach,
  topClub,
  featureData,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard | null;
  featureData: FeatureIdeasData;
}) {
  const playableRate = topClub?.playableRate ?? coach.summary.totals.averagePlayableRate;
  const trust = topClub?.trustIndex ?? coach.summary.totals.averageTrust;

  return (
    <div className="grid min-w-0 gap-3" data-coach-diagnosis-metrics>
      <ConnectedMetricBar
        label="Current coach diagnosis evidence"
        metrics={[
          {
            label: "Evidence trust",
            value: `${trust}%`,
            detail: topClub
              ? `${topClub.sampleSize} clean ${topClub.clubName} shots`
              : "Bag average",
          },
          {
            label: "Playable rate",
            value: playableRate === null ? "--" : `${playableRate}%`,
            detail: playableRate === null ? "Needs scored stock shots" : "Current measured sample",
          },
          {
            label: "Clean shots",
            value: coach.summary.totals.trackedCleanShots.toLocaleString("en-GB"),
            detail: `${coach.summary.totals.clubs} tracked clubs`,
          },
          {
            label: "Coach confidence",
            value: featureData.coachConfidence.metric,
            detail: featureData.coachConfidence.detail,
          },
        ]}
      />
      {trust < 60 ? (
        <Alert>
          <Gauge className="size-4" aria-hidden="true" />
          <AlertTitle>Use this diagnosis as a provisional next step</AlertTitle>
          <AlertDescription>
            The measured sample is still light. Keep the practice block simple and import the next
            comparable session before changing mechanics or equipment.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function CoachPracticeRecommendation({
  topClub,
  drillChallenges,
  drillStatuses,
}: {
  topClub: CoachClubCard | null;
  drillChallenges: CoachDrillChallenge[];
  drillStatuses: Record<string, CoachDrillAwardStatus>;
}) {
  const recommendation = drillChallenges[0] ?? null;
  const status = recommendation
    ? (drillStatuses[recommendation.id] ?? defaultDrillStatus(recommendation))
    : null;
  const progress = status
    ? Math.min(100, Math.round((status.uploadedShotCount / status.completionTarget) * 100))
    : 0;

  return (
    <Card className="shadow-sm" data-coach-practice-recommendation>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Recommended block</Badge>
          <StatusPill tone={topClub?.tone ?? "slate"}>
            {recommendation ? `${recommendation.completionTarget} balls` : "Baseline"}
          </StatusPill>
        </div>
        <CardTitle className="text-2xl">
          {recommendation?.title ??
            (topClub ? `${topClub.clubName} ${topClub.issueLabel}` : "Clean stock-shot baseline")}
        </CardTitle>
        <CardDescription className="max-w-3xl leading-6">
          {recommendation?.detail ??
            topClub?.drill ??
            "Record a comparable stock-shot sample before trusting a more detailed coach plan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Today&apos;s uploaded evidence</span>
          <span className="text-muted-foreground">
            {status ? `${status.uploadedShotCount}/${status.completionTarget}` : "Not started"}
          </span>
        </div>
        <Progress value={progress} aria-label="Recommended practice evidence progress" />
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {recommendation?.winCondition ?? "Complete the block, then review measured evidence."}
        </p>
        <Button asChild>
          <Link href="/practice" prefetch={false}>
            Open Practice Planner
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function CoachSupportingEvidence({
  coach,
  topClub,
  speedSummary,
  signals,
  featureData,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard | null;
  speedSummary: SpeedCentreSummary;
  signals: ProgressSignal[];
  featureData: FeatureIdeasData;
}) {
  const playableRate = coach.summary.totals.averagePlayableRate;

  return (
    <CoachSupportingEvidencePanel>
      <div className="grid gap-2" aria-label="Coach movement signals">
        {signals.slice(0, 4).map((signal) => (
          <Item key={`${signal.label}-${signal.value}`} variant="muted" size="sm">
            <ItemContent>
              <ItemTitle>{signal.label}</ItemTitle>
              <ItemDescription className="whitespace-normal">{signal.detail}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">{signal.value}</Badge>
            </ItemActions>
          </Item>
        ))}
        {signals.length === 0 ? (
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>No confirmed movement yet</ItemTitle>
              <ItemDescription>
                Import another comparable session to surface a meaningful change.
              </ItemDescription>
            </ItemContent>
          </Item>
        ) : null}
      </div>

      <ConnectedMetricBar
        label="Athletic development evidence"
        className="sm:grid-cols-2 xl:grid-cols-2"
        metrics={[
          {
            label: "Driver speed",
            value: formatSpeed(speedSummary.currentSpeedMph),
            detail: "Current measured speed",
          },
          {
            label: "Speed target",
            value: formatSpeed(speedSummary.targetSpeedMph),
            detail: speedSummary.prescription.headline,
          },
          {
            label: "Playable rate",
            value: playableRate === null ? "--" : `${playableRate}%`,
            detail: "Average across tracked clubs",
          },
          {
            label: "Data trust",
            value: `${featureData.coachConfidence.score}%`,
            detail: featureData.coachConfidence.metric,
          },
        ]}
      />

      <Alert>
        <Target className="size-4" aria-hidden="true" />
        <AlertTitle>Current watch</AlertTitle>
        <AlertDescription>
          {topClub
            ? `${topClub.clubName}: ${topClub.reason}`
            : "Import a clean baseline before trusting round-readiness calls."}
        </AlertDescription>
      </Alert>
    </CoachSupportingEvidencePanel>
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
      <Card className="h-full gap-0 overflow-hidden py-0 shadow-sm">{children}</Card>
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
    <CardHeader className="flex-row items-start justify-between gap-3 border-b bg-muted/25 px-4 py-3">
      <div className="min-w-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <CardDescription className="mt-0.5 text-xs leading-5">{description}</CardDescription>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </CardHeader>
  );
}

function CompactCoachEmptyState() {
  return (
    <CoachBentoPanel span={6}>
      <CardContent className="p-4">
        <AppEmptyState
          icon={<Brain className="size-5" />}
          title="Coach is waiting for data"
          description="Import launch-monitor shots and LM World Tour will turn club data into distance, strike, launch, direction, and delivery recommendations."
          primaryAction={
            <Button asChild>
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import data
              </Link>
            </Button>
          }
          className="border-0 bg-transparent"
        />
      </CardContent>
    </CoachBentoPanel>
  );
}

function CoachSocialPrompt({
  topClub,
  socialContext,
  loadHref,
}: {
  topClub: CoachClubCard | null;
  socialContext: CoachSocialContext;
  loadHref: string;
}) {
  const challenge = socialContext.loaded
    ? findRelevantChallenge(socialContext.challenges, topClub?.clubType)
    : null;

  return (
    <DataPanel>
      <SectionHeader
        title="Social comparison"
        description="Framed as a next step, not a judgement against friends."
        action={<Trophy className="size-5 text-[var(--status-warning-foreground)]" />}
      />
      <CardContent className="grid gap-3">
        <p className="trust-indicator rounded-lg p-3 text-sm leading-6 text-foreground">
          {!socialContext.loaded
            ? "Social comparison is on demand. Load challenge context when you want a challenge, record attempt, or event next step."
            : topClub
              ? `${topClub.clubName} is the current practice priority. Use it to pick a challenge, plan a record attempt, or prepare for an event.`
              : "Build a clean club baseline before comparing with friends or entering verified boards."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!socialContext.loaded ? (
            <Button asChild variant="outline" className="w-fit">
              <Link href={loadHref} prefetch={false}>
                <Trophy className="size-4" />
                Load challenge context
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-fit">
              <Link
                href={challenge ? `/challenges/${challenge.id}` : "/challenges"}
                prefetch={false}
              >
                <Trophy className="size-4" />
                {challenge ? `Suggested: ${challenge.title}` : "Open challenges"}
              </Link>
            </Button>
          )}
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

function CoachEvidenceTable({
  cards,
  DesktopTableWorkbenchControls,
}: {
  cards: CoachClubCard[];
  DesktopTableWorkbenchControls: DesktopTableWorkbenchControlsComponent;
}) {
  return (
    <section
      id="coach-evidence-ledger"
      data-workbench-scope="coach-evidence"
      className="min-w-0"
      style={bentoSpan(12)}
    >
      <DataPanel className="gap-0 py-0">
        <CompactPanelHeader
          title="Coach evidence ledger"
          description="Exportable diagnosis evidence for every tracked club before choosing the drill."
          action={
            <StatusPill tone={cards.length > 0 ? "green" : "slate"}>
              {cards.length} clubs
            </StatusPill>
          }
        />
        <CardContent className="grid gap-3 p-3">
          <DesktopTableWorkbenchControls
            viewKey="coach-evidence"
            scope="coach-evidence"
            currentViewLabel="Coach evidence"
            resultLabel={`${cards.length} clubs`}
            columns={coachEvidenceColumns}
            suggestedViews={coachEvidenceSuggestedViews}
            exportTableId="coach-evidence"
            exportFileName="forekinghell-coach-evidence.csv"
          />
          <DataTableFrame mainTable mainTableLabel="Coach evidence table" stickyFirstColumn>
            <Table
              data-workbench-export-table="coach-evidence"
              aria-describedby="coach-evidence-summary"
            >
              <TableCaption id="coach-evidence-summary" className="sr-only">
                Coach evidence table showing club, issue, trust, sample, stock carry, playable rate,
                usual miss, drill and action.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead
                    data-column="club"
                    className="sticky left-0 z-20 min-w-52 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    Club
                  </TableHead>
                  <TableHead data-column="issue">Issue</TableHead>
                  <TableHead data-column="trust">Trust</TableHead>
                  <TableHead data-column="sample">Sample</TableHead>
                  <TableHead data-column="stock">Stock carry</TableHead>
                  <TableHead data-column="playable">Playable</TableHead>
                  <TableHead data-column="miss">Usual miss</TableHead>
                  <TableHead data-column="drill">Drill</TableHead>
                  <TableHead data-column="action" className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.length > 0 ? (
                  cards.map((card) => (
                    <TableRow key={card.clubId} tabIndex={0} className="focus-aaa outline-none">
                      <TableCell
                        data-column="club"
                        className="sticky left-0 z-10 min-w-52 bg-card font-medium shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                      >
                        <span className="block max-w-60 truncate">{card.clubName}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {card.brandModel}
                        </span>
                      </TableCell>
                      <TableCell data-column="issue">{card.issueLabel}</TableCell>
                      <TableCell data-column="trust">
                        <StatusPill tone={card.tone}>{card.trustIndex}%</StatusPill>
                      </TableCell>
                      <TableCell data-column="sample">{card.sampleSize} shots</TableCell>
                      <TableCell data-column="stock">
                        {card.stockCarryYd === null ? "--" : `${card.stockCarryYd} yd`}
                      </TableCell>
                      <TableCell data-column="playable">
                        {card.playableRate === null ? "--" : `${card.playableRate}%`}
                      </TableCell>
                      <TableCell data-column="miss">{card.usualMiss ?? "Needs data"}</TableCell>
                      <TableCell data-column="drill" className="max-w-[24rem] whitespace-normal">
                        {card.drill}
                      </TableCell>
                      <TableCell data-column="action" className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/bag/${card.clubId}/analytics`} prefetch={false}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Import clean stock shots to build coach evidence.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </section>
  );
}

function DiagnosisAttentionRow({ card }: { card: CoachClubCard }) {
  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className="rounded-lg border border-border bg-card/85 p-4 transition-colors hover:border-primary/40"
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
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{card.reason}</p>
    </Link>
  );
}

function MobileCoachRecommendationEvidence({
  card,
  challenge,
}: {
  card: CoachClubCard | null;
  challenge: CoachDrillChallenge | null;
}) {
  if (!card) {
    return (
      <section className="ios-grouped-list p-4 lg:hidden">
        <h2 className="text-[17px] font-semibold">Why this recommendation</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          There is not enough clean club evidence for a recommendation yet. Import a measured
          stock-shot session to build the baseline.
        </p>
      </section>
    );
  }

  const rows = [
    { label: "Observation", value: `${card.clubName}: ${card.issueLabel}` },
    { label: "Evidence", value: card.reason },
    {
      label: "Confidence",
      value: `${coachEvidenceConfidence(card)} · ${card.sampleSize} clean shots`,
    },
    {
      label: "Why it matters",
      value: targetForCard(card),
    },
    { label: "Suggested drill", value: card.drill },
    {
      label: "Success measure",
      value: challenge?.winCondition ?? "Complete a comparable clean stock-shot set.",
    },
    {
      label: "Reassess when",
      value: challenge
        ? `${challenge.completionTarget} new clean ${card.clubName} shots are imported.`
        : "A new comparable club session is imported.",
    },
  ];

  return (
    <MobileAccordionSection
      title="Why this recommendation"
      description="Measured evidence, success criteria and the next reassessment point."
      count={coachEvidenceConfidence(card)}
    >
      <dl className="ios-grouped-list">
        {rows.map((row) => (
          <div key={row.label} className="ios-grouped-row px-4 py-3">
            <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 text-[15px] font-medium leading-5">{row.value}</dd>
          </div>
        ))}
      </dl>
    </MobileAccordionSection>
  );
}

function coachEvidenceConfidence(card: CoachClubCard | null) {
  if (!card || card.sampleSize < 5 || card.trustIndex < 40) {
    return "Early signal";
  }
  if (card.sampleSize < 12 || card.trustIndex < 60) {
    return "Developing";
  }
  if (card.sampleSize < 25 || card.trustIndex < 80) {
    return "Reliable";
  }

  return "Strong evidence";
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

function progressToneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "[&_[data-slot=progress-indicator]]:bg-primary",
    sky: "[&_[data-slot=progress-indicator]]:bg-[var(--status-information-foreground)]",
    pink: "[&_[data-slot=progress-indicator]]:bg-destructive",
    amber: "[&_[data-slot=progress-indicator]]:bg-[var(--status-warning-foreground)]",
    slate: "[&_[data-slot=progress-indicator]]:bg-muted-foreground",
  };

  return classes[tone];
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
      ? "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]"
      : tone === "amber"
        ? "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]"
        : "border-border bg-card text-foreground";

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
            className="apple-panel-strong p-4 transition-colors hover:border-primary/40"
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
                  className="rounded-lg bg-card/85 px-3 py-2 ring-1 ring-border"
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
    <div className="rounded-xl bg-card/85 px-3 py-2 ring-1 ring-border">
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
