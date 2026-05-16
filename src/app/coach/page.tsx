import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  Gauge,
  LineChart,
  Sparkles,
  Target,
  Trophy,
  Upload,
} from "lucide-react";

import { CoachDrillAutoSync } from "@/app/coach/coach-drill-auto-sync";
import {
  CompactReadoutGrid,
  DataPanel,
  MetricCard,
  MobileAccordionSection,
  MobileBentoSummary,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { formatClubType } from "@/lib/club-format";
import {
  buildCoachSummary,
  buildCoachDrillChallenges,
  type CoachDrillChallenge,
  type CoachClubCard,
  type CoachFocusArea,
  type CoachTrainingImpact,
} from "@/lib/coach";
import {
  getCoachDrillAwardStatuses,
  type CoachDrillAwardStatus,
} from "@/lib/coach-drill-awards";
import { getProgressData } from "@/lib/progress-data";
import { buildAiCoachPayload } from "@/lib/ai-coach-summary";
import { AiCoachCard } from "@/app/coach/ai-coach-card";
import { CoachChatCard } from "@/app/coach/coach-chat-card";
import { getActivePlanKeyForUser, planAllowsAiCoach } from "@/lib/billing";
import { findRelevantChallenge } from "@/lib/challenge-relevance";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export default async function CoachPage() {
  const userId = await requireCurrentUserId();
  const [data, activePlanKey, challengeData] = await Promise.all([
    getProgressData(userId),
    getActivePlanKeyForUser(userId),
    getChallengesPageData(),
  ]);
  const coach = buildCoachSummary(data.clubs);
  const topClub = coach.clubCards[0] ?? null;
  const drillChallenges = buildCoachDrillChallenges(coach);
  const drillStatuses = await getCoachDrillAwardStatuses(drillChallenges);
  const shouldSyncDrillAwards = Object.values(drillStatuses).some(
    (status) =>
      (status.completed && !status.completedAwarded) ||
      (status.won && !status.wonAwarded),
  );
  const aiPayload = buildAiCoachPayload(coach);
  const canUseAiCoach = planAllowsAiCoach(activePlanKey);

  return (
    <PageShell>
      <CoachDrillAutoSync enabled={shouldSyncDrillAwards} />
      <MobileAppShell>
        <MobileTopBar title="Improve" />
        <MobileRouteTabs group="improve" activeKey="coach" />
        <MobileStatusAction
          label="Do this next"
          value={topClub ? `${topClub.clubName}: ${topClub.issueLabel}` : "Build a baseline"}
          detail={topClub?.drill ?? "Import enough clean shots for a prescription."}
        />
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-3">
          <p className="text-sm font-semibold text-[#0B7A3B]">Why</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{topClub?.reason ?? coach.headline}</h2>
          <p className="mt-1 text-sm leading-5 text-[#6B7280]">
            {topClub ? `${topClub.trustIndex}% trust · ${targetForCard(topClub)}` : coach.subhead}
          </p>
        </section>
        <MobileTabBar
          activeKey="drill"
          tabs={[
            { key: "drill", label: "Drill", href: "/coach" },
            { key: "more", label: "More drills", href: "#more-drills" },
            { key: "evidence", label: "Evidence", href: "#evidence" },
            { key: "history", label: "History", href: "/progress" },
          ]}
        />
        <NativeListSection title="Drill">
          <ProgressCard
            title={coach.sessionPlan[0]?.title ?? "12 stock shots"}
            value={coach.sessionPlan[0]?.duration ?? "12 shots"}
            detail={coach.sessionPlan[0]?.detail ?? "Build a clean comparable sample."}
          />
          <div className="grid grid-cols-2 gap-2">
            <PBCard title="Trust" value={`${coach.summary.totals.averageTrust}%`} detail={`${coach.summary.totals.clubs} clubs`} />
            <PBCard title="Clean shots" value={coach.summary.totals.trackedCleanShots.toLocaleString("en-GB")} detail="Tracked" />
          </div>
        </NativeListSection>
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
            <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280]">
              Import at least three clean shots with one club to generate today’s XP drills.
            </div>
          )}
        </NativeListSection>
        <NativeListSection id="evidence" title="Evidence" description="What changed in your latest baselines.">
          <TrainingFeedback impacts={coach.trainingImpact.slice(0, 2)} />
        </NativeListSection>
        <NativeListSection title="Club diagnosis" description="Every club-specific issue is visible on mobile again.">
          {coach.clubCards.length > 0 ? (
            coach.clubCards.map((card) => <CoachClubDiagnosis key={card.clubId} card={card} />)
          ) : (
            <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280]">
              Import a Rapsodo CSV to unlock club-by-club coach diagnosis.
            </div>
          )}
        </NativeListSection>
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
            <Link href="/progress" prefetch={false}>
              <LineChart className="size-4" />
              Progress
            </Link>
          </Button>
          <Button asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden sm:contents">
      <PageHeader
        eyebrow={
          <StatusPill tone={toneForFocus(coach.focusArea)}>
            Rule-based coach
          </StatusPill>
        }
        title="Coach"
        description={`${coach.headline} ${coach.subhead}`}
        visual={
          <PageArtwork variant="coach" alt="" className="h-full min-h-44" />
        }
        actions={
          topClub ? (
            <Button
              asChild
              size="lg"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link href={`/bag/${topClub.clubId}/analytics`} prefetch={false}>
                <Brain className="size-4" />
                Open {topClub.clubName}
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import first CSV
              </Link>
            </Button>
          )
        }
        metrics={[
          {
            label: "Next focus",
            value: topClub?.clubName ?? "--",
            detail: topClub?.issueLabel ?? "Needs shot data",
          },
          {
            label: "Bag trust",
            value: `${coach.summary.totals.averageTrust}%`,
            detail: `${coach.summary.totals.clubs} clubs tracked`,
          },
          {
            label: "Clean shots",
            value:
              coach.summary.totals.trackedCleanShots.toLocaleString("en-GB"),
            detail: "Used for stock and trend checks",
          },
          {
            label: "Playable rate",
            value: formatRate(coach.summary.totals.averagePlayableRate),
            detail: "Average across clubs with side data",
          },
        ]}
      />

      {data.clubs.length === 0 ? (
        <DataPanel>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Brain className="size-10 text-emerald-500" />
            <div>
              <p className="text-xl font-semibold">Coach is waiting for data</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Import a Rapsodo CSV and ForeKingHell will turn club data into
                distance, strike, launch, direction, and delivery
                recommendations.
              </p>
            </div>
            <Button asChild>
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </CardContent>
        </DataPanel>
      ) : (
        <>
          <MobileBentoSummary
            items={[
              {
                label: "Do this next",
                value: topClub
                  ? `${topClub.clubName}: ${topClub.issueLabel}`
                  : "Build a baseline",
                detail:
                  topClub?.drill ??
                  "Import enough clean shots for a recommendation.",
                href: topClub ? `/bag/${topClub.clubId}/analytics` : "/import",
                tone: topClub?.tone ?? "slate",
              },
              {
                label: "Trust",
                value: `${coach.summary.totals.averageTrust}%`,
                detail: `${coach.summary.totals.clubs} clubs`,
                tone: "green",
              },
              {
                label: "Clean shots",
                value:
                  coach.summary.totals.trackedCleanShots.toLocaleString(
                    "en-GB",
                  ),
                detail: "Tracked",
                tone: "sky",
              },
              {
                label: "Playable",
                value: formatRate(coach.summary.totals.averagePlayableRate),
                detail: "Average",
                tone: "amber",
              },
            ]}
          />
          <section className="hidden gap-4 sm:grid md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Practice priority"
              value={topClub?.clubName ?? "--"}
              detail={topClub?.reason ?? "Need more clean data"}
              href={topClub ? `/bag/${topClub.clubId}/analytics` : undefined}
              icon={Target}
              tone={topClub?.tone ?? "slate"}
            />
            <MetricCard
              label="Main issue"
              value={topClub?.issueLabel ?? "--"}
              detail={topClub?.drill ?? "Build comparable samples first"}
              icon={Crosshair}
              tone={toneForFocus(coach.focusArea)}
            />
            <MetricCard
              label="Most trusted"
              value={
                coach.summary.rankings.mostTrusted
                  ? formatClubType(coach.summary.rankings.mostTrusted.clubType)
                  : "--"
              }
              detail={
                coach.summary.rankings.mostTrusted
                  ? `${coach.summary.rankings.mostTrusted.trustIndex}% trust`
                  : "Need more clubs"
              }
              href={
                coach.summary.rankings.mostTrusted
                  ? `/bag/${coach.summary.rankings.mostTrusted.clubId}/analytics`
                  : undefined
              }
              icon={Gauge}
              tone="green"
            />
            <MetricCard
              label="Readiness"
              value={
                coach.summary.totals.averageTrust >= 70
                  ? "Playable"
                  : "Building"
              }
              detail="Based on trust, sample size, direction, and strike stability."
              icon={CheckCircle2}
              tone={coach.summary.totals.averageTrust >= 70 ? "green" : "amber"}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.85fr)] xl:items-start">
            <DataPanel>
              <SectionHeader
                title="Practice plan"
                description="Decision aid first: issue, evidence, drill sequence, and target."
                action={<Clock className="size-5 text-emerald-500" />}
              />
              <CoachPracticePlan
                topClub={topClub}
                blocks={coach.sessionPlan}
                impacts={coach.trainingImpact.slice(0, 2)}
                drillChallenges={drillChallenges}
                drillStatuses={drillStatuses}
              />
            </DataPanel>

            <div className="grid gap-4 xl:sticky xl:top-24">
              <DataPanel>
                <SectionHeader
                  title="What changed"
                  description="The strongest movement signals in the current personal baseline."
                  action={<LineChart className="size-5 text-sky-500" />}
                />
                <CardContent>
                  <CompactReadoutGrid
                    columnsClassName="sm:grid-cols-2"
                    items={coach.signals.map((signal) => ({
                      label: signal.label,
                      value: signal.value,
                      detail: signal.detail,
                      tone: signal.tone,
                      href: signal.clubId
                        ? `/bag/${signal.clubId}/analytics`
                        : "/progress",
                    }))}
                  />
                </CardContent>
              </DataPanel>

              <CoachSocialPrompt topClub={topClub} challenges={challengeData.active} />

              <DataPanel className="hidden sm:flex">
                <SectionHeader
                  title="AI coach note"
                  description={canUseAiCoach ? "Optional AI layer for a sharper plain-English readout." : "AI coaching is a Pro entitlement."}
                  action={<Sparkles className="size-5 text-sky-500" />}
                />
                {canUseAiCoach ? <AiCoachCard payload={aiPayload} /> : <UpgradeAiCoachCard />}
              </DataPanel>

              <MobileAccordionSection
                title="AI notes"
                description="Optional AI readout and chat."
                count="2 tools"
              >
                <div className="grid gap-3">
                  {canUseAiCoach ? (
                    <>
                      <AiCoachCard payload={aiPayload} />
                      <CoachChatCard questionId="coach-question-mobile" />
                    </>
                  ) : (
                    <UpgradeAiCoachCard />
                  )}
                </div>
              </MobileAccordionSection>

              <DataPanel className="hidden sm:flex">
                <SectionHeader
                  title="AI coach chat"
                  description={canUseAiCoach ? "Ask questions answered from cited SQL context in your personal shot database." : "Upgrade to Pro for AI coach chat."}
                  action={<Sparkles className="size-5 text-emerald-500" />}
                />
                {canUseAiCoach ? <CoachChatCard /> : <UpgradeAiCoachCard />}
              </DataPanel>
            </div>
          </section>

          <MobileAccordionSection
            title="Club diagnosis"
            description="All club-specific issues collapsed by default."
            count={`${coach.clubCards.length} clubs`}
          >
            <div className="grid gap-3">
              {coach.clubCards.map((card) => (
                <CoachClubDiagnosis key={card.clubId} card={card} />
              ))}
            </div>
          </MobileAccordionSection>

          <DataPanel className="hidden sm:flex">
            <SectionHeader
              title="Club diagnosis"
              description="For each club: what ForeKingHell thinks the issue is, why, and what to practise."
              action={<Brain className="size-5 text-pink-500" />}
            />
            <CardContent>
              <div className="grid gap-3 lg:grid-cols-2">
                {coach.clubCards.map((card) => (
                  <CoachClubDiagnosis key={card.clubId} card={card} />
                ))}
              </div>
            </CardContent>
          </DataPanel>
        </>
      )}
      </div>
    </PageShell>
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
        <p className="rounded-lg border bg-[#F5F6F4] p-3 text-sm leading-6 text-muted-foreground">
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

function UpgradeAiCoachCard() {
  return (
    <CardContent>
      <div className="rounded-lg border border-dashed bg-[#F5F6F4] p-4 text-sm">
        <p className="font-semibold">AI coach is a Pro feature.</p>
        <p className="mt-1 leading-6 text-muted-foreground">
          Rule-based coaching stays available. Upgrade when you want AI summaries and chat over your personal SQL context.
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

function CoachPracticePlan({
  topClub,
  blocks,
  impacts,
  drillChallenges,
  drillStatuses,
}: {
  topClub: CoachClubCard | null;
  blocks: Array<{
    title: string;
    detail: string;
    duration: string;
    tone: "green" | "sky" | "pink" | "amber" | "slate";
  }>;
  impacts: CoachTrainingImpact[];
  drillChallenges: CoachDrillChallenge[];
  drillStatuses: Record<string, CoachDrillAwardStatus>;
}) {
  return (
    <CardContent className="space-y-4">
      <div className="rounded-xl border bg-emerald-50 p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-stretch">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="bg-white text-emerald-700 hover:bg-white">
                  Based on stored shot data
                </Badge>
                <h2 className="mt-2 text-xl font-semibold tracking-normal sm:mt-3 sm:text-2xl">
                  {topClub
                    ? `${topClub.clubName}: ${topClub.issueLabel}`
                    : "Build a baseline first"}
                </h2>
              </div>
              <StatusPill tone={topClub?.tone ?? "slate"}>
                {topClub ? `${topClub.trustIndex}% trust` : "Needs data"}
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <SmallMetric
                label="Main issue"
                value={topClub?.issueLabel ?? "No priority yet"}
              />
              <SmallMetric
                label="Evidence"
                value={topClub?.reason ?? "Import more clean shots"}
              />
              <SmallMetric
                label="Target"
                value={
                  topClub ? targetForCard(topClub) : "Create a 30-shot sample"
                }
              />
            </div>
          </div>
          <PageArtwork
            variant="coach"
            alt=""
            className="h-full min-h-32 rounded-xl"
            sizes="224px"
          />
        </div>
      </div>

      {drillChallenges.length > 0 ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Today&apos;s coach drills</p>
            <p className="text-xs text-muted-foreground">
              Progress is read from today&apos;s uploaded shots. XP unlocks
              automatically when the data proves it.
            </p>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:px-0">
            {drillChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="min-w-[82vw] shrink-0 snap-start sm:min-w-0"
              >
                <CoachDrillChallengeCard
                  challenge={challenge}
                  status={
                    drillStatuses[challenge.id] ?? {
                      completed: false,
                      won: false,
                    }
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {blocks.slice(0, 1).map((block, index) => (
          <div key={block.title} className="apple-panel-strong p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Drill {index + 1}</Badge>
                <h3 className="mt-2 text-lg font-semibold tracking-normal">
                  {block.title}
                </h3>
              </div>
              <StatusPill tone={block.tone}>{block.duration}</StatusPill>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {block.detail}
            </p>
          </div>
        ))}
        {blocks.length > 1 ? (
          <MobileAccordionSection
            title="Full practice plan"
            description="Remaining drills, collapsed on mobile."
            count={`${blocks.length - 1} more`}
          >
            <div className="grid gap-3">
              {blocks.slice(1).map((block, index) => (
                <div key={block.title} className="apple-panel-strong p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline">Drill {index + 2}</Badge>
                      <h3 className="mt-2 text-lg font-semibold tracking-normal">
                        {block.title}
                      </h3>
                    </div>
                    <StatusPill tone={block.tone}>{block.duration}</StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {block.detail}
                  </p>
                </div>
              ))}
            </div>
          </MobileAccordionSection>
        ) : null}
        <div className="hidden gap-3 sm:grid">
          {blocks.slice(1).map((block, index) => (
            <div key={block.title} className="apple-panel-strong p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline">Drill {index + 2}</Badge>
                  <h3 className="mt-2 text-lg font-semibold tracking-normal">
                    {block.title}
                  </h3>
                </div>
                <StatusPill tone={block.tone}>{block.duration}</StatusPill>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {block.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
      <MobileAccordionSection
        title="Evidence"
        description="Latest session feedback."
        count={`${impacts.length} items`}
      >
        <TrainingFeedback impacts={impacts} />
      </MobileAccordionSection>
      <div className="hidden sm:block">
        <TrainingFeedback impacts={impacts} />
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
            <StatusPill tone={challenge.tone}>
              {challenge.issueLabel}
            </StatusPill>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-normal">
            {challenge.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {challenge.detail}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            tone={status.won ? "amber" : status.completed ? "green" : "slate"}
          >
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
                  <StatusPill tone={impact.tone}>
                    {impact.issueLabel}
                  </StatusPill>
                </div>
                <p className="mt-2 text-sm font-medium">{impact.headline}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {impact.detail}
                </p>
              </div>
              <StatusPill tone={impact.tone}>
                {impactLabel(impact.status)}
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {impact.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg bg-white/85 px-3 py-2 ring-1 ring-slate-200/80"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </p>
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

function CoachClubDiagnosis({ card }: { card: CoachClubCard }) {
  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className="apple-panel-strong grid gap-4 p-4 transition-colors hover:border-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-normal">
              {card.clubName}
            </h2>
            <StatusPill tone={card.tone}>{card.issueLabel}</StatusPill>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {card.brandModel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-normal">
            {card.trustIndex}%
          </p>
          <p className="text-xs text-muted-foreground">trust</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <SmallMetric label="Stock" value={formatYards(card.stockCarryYd)} />
        <SmallMetric label="Playable" value={formatRate(card.playableRate)} />
        <SmallMetric label="Miss" value={card.usualMiss} />
        <SmallMetric label="Sample" value={`${card.sampleSize} clean`} />
      </div>

      <div>
        <Progress value={card.trustIndex} />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SmallMetric label="Evidence" value={card.reason} />
          <SmallMetric label="Drill" value={card.drill} />
          <SmallMetric label="Retest" value="After two comparable sessions" />
        </div>
      </div>
    </Link>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
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

function toneForFocus(focus: CoachFocusArea) {
  const tones: Record<
    CoachFocusArea,
    "green" | "sky" | "pink" | "amber" | "slate"
  > = {
    distance: "sky",
    strike: "pink",
    launch: "amber",
    direction: "pink",
    delivery: "amber",
    data: "slate",
  };

  return tones[focus];
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

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}
