import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  Gauge,
  LineChart,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { CoachDrillAutoSync } from "@/app/coach/coach-drill-auto-sync";
import {
  CompactReadoutGrid,
  DataPanel,
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

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export default async function CoachPage() {
  const data = await getProgressData();
  const coach = buildCoachSummary(data.clubs);
  const topClub = coach.clubCards[0] ?? null;
  const drillChallenges = buildCoachDrillChallenges(coach);
  const drillStatuses = await getCoachDrillAwardStatuses(drillChallenges);
  const shouldSyncDrillAwards = Object.values(drillStatuses).some(
    (status) => (status.completed && !status.completedAwarded) || (status.won && !status.wonAwarded),
  );
  const aiPayload = buildAiCoachPayload(coach);

  return (
    <PageShell>
      <CoachDrillAutoSync enabled={shouldSyncDrillAwards} />
      <div className="flex items-center justify-between gap-4">
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

      <PageHeader
        eyebrow={<StatusPill tone={toneForFocus(coach.focusArea)}>Rule-based coach</StatusPill>}
        title="Coach"
        description={`${coach.headline} ${coach.subhead}`}
        visual={<PageArtwork variant="coach" alt="" className="h-full min-h-44" />}
        actions={
          topClub ? (
            <Button asChild size="lg" className="rounded-xl bg-[#111827] text-white">
              <Link href={`/bag/${topClub.clubId}/analytics`} prefetch={false}>
                <Brain className="size-4" />
                Open {topClub.clubName}
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="rounded-xl bg-[#111827] text-white">
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
            value: coach.summary.totals.trackedCleanShots.toLocaleString("en-GB"),
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
                Import a Rapsodo CSV and ForeKingHell will turn club data into distance,
                strike, launch, direction, and delivery recommendations.
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              value={coach.summary.totals.averageTrust >= 70 ? "Playable" : "Building"}
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
                      href: signal.clubId ? `/bag/${signal.clubId}/analytics` : "/progress",
                    }))}
                  />
                </CardContent>
              </DataPanel>

              <DataPanel>
                <SectionHeader
                  title="AI coach note"
                  description="Optional AI layer for a sharper plain-English readout."
                  action={<Sparkles className="size-5 text-sky-500" />}
                />
                <AiCoachCard payload={aiPayload} />
              </DataPanel>

              <DataPanel>
                <SectionHeader
                  title="AI coach chat"
                  description="Ask questions answered from cited SQL context in your personal shot database."
                  action={<Sparkles className="size-5 text-emerald-500" />}
                />
                <CoachChatCard />
              </DataPanel>
            </div>
          </section>

          <DataPanel>
            <SectionHeader
              title="Club diagnosis"
              description="For each club: what ForeKingHell thinks the issue is, why, and what to practise."
              action={<Brain className="size-5 text-pink-500" />}
            />
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {coach.clubCards.map((card) => (
                <CoachClubDiagnosis key={card.clubId} card={card} />
              ))}
            </CardContent>
          </DataPanel>
        </>
      )}
    </PageShell>
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
  blocks: Array<{ title: string; detail: string; duration: string; tone: "green" | "sky" | "pink" | "amber" | "slate" }>;
  impacts: CoachTrainingImpact[];
  drillChallenges: CoachDrillChallenge[];
  drillStatuses: Record<string, CoachDrillAwardStatus>;
}) {
  return (
    <CardContent className="space-y-4">
      <div className="rounded-xl border bg-emerald-50 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-stretch">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="bg-white text-emerald-700 hover:bg-white">Based on stored shot data</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-normal">
                  {topClub ? `${topClub.clubName}: ${topClub.issueLabel}` : "Build a baseline first"}
                </h2>
              </div>
              <StatusPill tone={topClub?.tone ?? "slate"}>{topClub ? `${topClub.trustIndex}% trust` : "Needs data"}</StatusPill>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SmallMetric label="Main issue" value={topClub?.issueLabel ?? "No priority yet"} />
              <SmallMetric label="Evidence" value={topClub?.reason ?? "Import more clean shots"} />
              <SmallMetric label="Target" value={topClub ? targetForCard(topClub) : "Create a 30-shot sample"} />
            </div>
          </div>
          <PageArtwork variant="coach" alt="" className="h-full min-h-32 rounded-xl" sizes="224px" />
        </div>
      </div>

      {drillChallenges.length > 0 ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Today&apos;s coach drills</p>
            <p className="text-xs text-muted-foreground">
              Progress is read from today&apos;s uploaded shots. XP unlocks automatically when the data proves it.
            </p>
          </div>
          <div className="grid gap-3">
            {drillChallenges.map((challenge) => (
              <CoachDrillChallengeCard
                key={challenge.id}
                challenge={challenge}
                status={drillStatuses[challenge.id] ?? { completed: false, won: false }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {blocks.map((block, index) => (
          <div key={block.title} className="apple-panel-strong p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Drill {index + 1}</Badge>
                <h3 className="mt-2 text-lg font-semibold tracking-normal">{block.title}</h3>
              </div>
              <StatusPill tone={block.tone}>{block.duration}</StatusPill>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{block.detail}</p>
          </div>
        ))}
      </div>
      <TrainingFeedback impacts={impacts} />
    </CardContent>
  );
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
          detail={status.completedAwarded ? `Complete XP awarded (+${challenge.completeXp})` : `Complete unlock: +${challenge.completeXp} XP`}
          tone={status.completed ? "green" : "slate"}
        />
        <DrillProgressTile
          label="Win progress"
          value={`${status.winCount}/${status.winTarget}`}
          detail={status.wonAwarded ? `Win XP awarded (+${challenge.winXp})` : `Win unlock: +${challenge.winXp} XP`}
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
        <StatusPill tone={impacts[0]?.tone ?? "slate"}>{impactLabel(impacts[0]?.status)}</StatusPill>
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
                <div key={metric.label} className="rounded-lg bg-white/85 px-3 py-2 ring-1 ring-slate-200/80">
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
            <h2 className="text-xl font-semibold tracking-normal">{card.clubName}</h2>
            <StatusPill tone={card.tone}>{card.issueLabel}</StatusPill>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{card.brandModel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-normal">{card.trustIndex}%</p>
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

function toneForFocus(focus: CoachFocusArea) {
  const tones: Record<CoachFocusArea, "green" | "sky" | "pink" | "amber" | "slate"> = {
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
