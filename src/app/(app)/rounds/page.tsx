import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Brain,
  ClipboardCheck,
  Database,
  FileText,
  Flag,
  Lightbulb,
  Plus,
  Target,
  Trophy,
  Upload,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { createLatestRoundRecapAction } from "@/app/feature-actions";
import {
  DesktopInsightRail,
  DesktopWorkbenchLayout,
  commonAiPrompts,
} from "@/components/app/desktop-workbench";
import { RoundOpportunityFeaturePanel } from "@/components/features/feature-panels";
import { Button } from "@/components/ui/button";
import { MobileSectionChips, PageShell, StatusPill } from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { rapsodoSyncSessions, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { isPlaywrightE2eAuthBypassEnabled, requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { reportServerFailure } from "@/lib/server-observability";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  formatHandicapValue,
  type HandicapSummary,
} from "@/lib/round-handicap";
import {
  RoundsMobileList,
  RoundsWorkspace,
  type RoundsWorkspaceRound,
} from "@/app/rounds/rounds-workspace";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const handicapDeltaFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const roundWorkbenchPrompts = [
  {
    label: "Explain latest round",
    prompt:
      "Explain my latest round from saved scorecard and shot-linked evidence. Cite the round, score, data status and weak evidence.",
    icon: Lightbulb,
  },
  {
    label: "What cost shots?",
    prompt:
      "Find what most likely cost shots across my saved rounds. Separate real rounds from simulator rounds and avoid inventing missing strokes-gained numbers.",
    icon: Target,
  },
  {
    label: "Build cleanup plan",
    prompt:
      "Build a round cleanup plan: scorecards needing shot data, rounds worth reviewing, and the next action before the next tee time.",
    icon: ClipboardCheck,
  },
  {
    label: "Generate round report",
    prompt:
      "Generate a round performance report with latest result, handicap context, scorecard-only caveats, and one practice action.",
    icon: FileText,
  },
  ...commonAiPrompts("rounds"),
];

export default async function RoundsPage() {
  const [rounds, featureData] = await Promise.all([getRounds(), getFeatureIdeasData()]);
  const latestRound = rounds[0] ?? null;
  const realRounds = rounds.filter((round) => round.type === "real_round");
  const simulatorRounds = rounds.filter((round) => round.type !== "real_round");
  const scorecardOnlyRounds = rounds.filter((round) => round.shotCount === 0);
  const shotLinkedRounds = rounds.filter((round) => round.shotCount > 0);
  const shotCountTotal = rounds.reduce((total, round) => total + round.shotCount, 0);
  const realHandicap = calculateHandicapSummary(
    realRounds.map((round) => round.handicapDifferential),
  );
  const simHandicap = calculateHandicapSummary(
    simulatorRounds.map((round) => round.handicapDifferential),
  );
  const combinedHandicap = calculateHandicapSummary(
    rounds.map((round) => round.handicapDifferential),
  );
  const roundsForWorkspace = rounds.map(toWorkspaceRound);

  return (
    <PageShell>
      <MobileRouteHeader title="Play" group="play" activeKey="rounds" />
      <RoundsMobileOverview
        rounds={roundsForWorkspace}
        latestRound={latestRound}
        combinedHandicap={combinedHandicap}
        realRounds={realRounds.length}
        simulatorRounds={simulatorRounds.length}
        scorecardOnlyRounds={scorecardOnlyRounds}
        shotLinkedRounds={shotLinkedRounds.length}
        shotCountTotal={shotCountTotal}
      />

      <div className="hidden flex-col items-start gap-3 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <DesktopWorkbenchLayout
        scope="rounds"
        className="hidden lg:grid"
        rail={
          <DesktopInsightRail
            title="AI round rail"
            description="Explain round form, scorecard trust, cleanup tasks and what to review before the next tee time."
            metrics={[
              {
                label: "Latest round",
                value: latestRound ? formatScoreSummary(latestRound) : "None",
                detail: latestRound
                  ? `${roundTitle(latestRound)} · ${formatDate(latestRound.date)}`
                  : "Add or import a round to start the review loop.",
                tone: latestRound ? "green" : "slate",
              },
              {
                label: "Cleanup",
                value:
                  scorecardOnlyRounds.length > 0
                    ? integerFormatter.format(scorecardOnlyRounds.length)
                    : "Clear",
                detail:
                  scorecardOnlyRounds.length > 0
                    ? "Scorecard-only rounds need shot data before deeper analysis."
                    : "Saved rounds have shot-linked review paths or no active cleanup.",
                tone: scorecardOnlyRounds.length > 0 ? "amber" : "green",
              },
              {
                label: "Handicap context",
                value: formatHandicapValue(combinedHandicap.value),
                detail: handicapTrendText(combinedHandicap),
              },
            ]}
            evidence={[
              "Latest scorecard and score-to-par",
              "Real vs simulator round split",
              "Scorecard-only vs shot-linked data status",
              "Handicap differential sample size",
            ]}
            prompts={roundWorkbenchPrompts.slice(0, 5)}
            actions={[
              {
                label: "Add real round",
                href: "/rounds/new",
                detail: "Keyboard-friendly scorecard entry.",
                icon: Plus,
              },
              {
                label: "Coach review",
                href: "/coach",
                detail: "Turn the round into drills and follow-up work.",
                icon: Brain,
              },
            ]}
          />
        }
      >
        <RoundsHero
          combinedHandicap={combinedHandicap}
          latestRound={latestRound}
          realHandicap={realHandicap}
          realRounds={realRounds.length}
          roundsSaved={rounds.length}
          simHandicap={simHandicap}
          simulatorRounds={simulatorRounds.length}
        />

        <RoundTasks latestRound={latestRound} scorecardOnlyRounds={scorecardOnlyRounds} />

        <RoundOpportunityFeaturePanel data={featureData} />

        <MobileSectionChips
          items={[
            { label: "Tasks", href: "#tasks" },
            { label: "History", href: "#history" },
            { label: "Types", href: "#types" },
          ]}
        />

        <RoundsWorkspace rounds={roundsForWorkspace}>
          <RoundTypeBreakdown
            realRounds={realRounds.length}
            scorecardOnlyRounds={scorecardOnlyRounds.length}
            shotCountTotal={shotCountTotal}
            shotLinkedRounds={shotLinkedRounds.length}
            simulatorRounds={simulatorRounds.length}
          />
        </RoundsWorkspace>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function RoundsMobileOverview({
  rounds,
  latestRound,
  combinedHandicap,
  realRounds,
  simulatorRounds,
  scorecardOnlyRounds,
  shotLinkedRounds,
  shotCountTotal,
}: {
  rounds: RoundsWorkspaceRound[];
  latestRound: Awaited<ReturnType<typeof getRounds>>[number] | null;
  combinedHandicap: HandicapSummary;
  realRounds: number;
  simulatorRounds: number;
  scorecardOnlyRounds: Awaited<ReturnType<typeof getRounds>>;
  shotLinkedRounds: number;
  shotCountTotal: number;
}) {
  const firstScorecardOnlyRound = scorecardOnlyRounds[0] ?? null;

  return (
    <section className="grid gap-4 lg:hidden" aria-label="Rounds mobile overview">
      <section className="grid gap-3" aria-labelledby="latest-round-mobile">
        <IOSSectionHeader
          title={<span id="latest-round-mobile">Latest round</span>}
          description="The newest result and anything that needs attention."
        />
        <IOSGroupedList label="Latest round summary">
          {latestRound ? (
            <IOSListRow
              label={roundTitle(latestRound)}
              value={formatScoreSummary(latestRound)}
              detail={`${formatDate(latestRound.date)} · ${formatSessionType(latestRound.type)}`}
              href={`/rounds/${latestRound.id}`}
              icon={Flag}
              status={
                <IOSInlineStatus
                  label={latestRound.shotCount > 0 ? "Shot-linked review ready" : "Scorecard only"}
                  tone={latestRound.shotCount > 0 ? "positive" : "attention"}
                />
              }
            />
          ) : (
            <IOSListRow
              label="No saved rounds yet"
              detail="Add a scorecard or import a measured round to begin."
              href="/rounds/new"
              icon={Flag}
            />
          )}
          <IOSMetricRow
            label="Playing estimate"
            value={formatHandicapValue(combinedHandicap.value)}
            detail={handicapTrendText(combinedHandicap)}
            href="/handicap"
          />
          {firstScorecardOnlyRound ? (
            <IOSListRow
              label="Round needs shot data"
              value={`${scorecardOnlyRounds.length}`}
              detail={`${roundTitle(firstScorecardOnlyRound)} is limited to scorecard analysis.`}
              href={`/rounds/${firstScorecardOnlyRound.id}`}
              icon={Database}
              status={<IOSInlineStatus label="Add evidence" tone="attention" />}
            />
          ) : null}
        </IOSGroupedList>
        <Button asChild className="min-h-12 w-full rounded-xl" data-primary-action>
          <Link href="/rounds/new">
            <Plus className="size-4" />
            Add a real round
          </Link>
        </Button>
      </section>

      <RoundsMobileList rounds={rounds} />

      <section className="grid gap-3" aria-labelledby="round-depth-mobile">
        <IOSSectionHeader
          title={<span id="round-depth-mobile">Round detail</span>}
          description="Evidence mix and secondary actions stay out of the recent-round scan."
        />
        <IOSDisclosureGroup
          label="Round supporting detail"
          items={[
            {
              value: "mix",
              title: "Round types and data",
              summary: `${rounds.length} saved`,
              description: "Real, simulator and shot-linked evidence",
              content: (
                <IOSGroupedList label="Round type metrics" className="bg-card">
                  <IOSMetricRow
                    label="Real rounds"
                    value={integerFormatter.format(realRounds)}
                    detail="Real-course scorecards and handicap context"
                  />
                  <IOSMetricRow
                    label="Simulator rounds"
                    value={integerFormatter.format(simulatorRounds)}
                    detail="Form and shot-linked practice evidence"
                  />
                  <IOSMetricRow
                    label="Shot-linked"
                    value={integerFormatter.format(shotLinkedRounds)}
                    detail={`${integerFormatter.format(shotCountTotal)} shots support deeper review`}
                  />
                  <IOSMetricRow
                    label="Scorecard only"
                    value={integerFormatter.format(scorecardOnlyRounds.length)}
                    detail="Scoring history without shot-level evidence"
                  />
                </IOSGroupedList>
              ),
            },
            {
              value: "actions",
              title: "Round actions",
              summary: latestRound ? "3 available" : "Add first",
              description: "Recap, records and import",
              content: (
                <div className="grid gap-3">
                  {latestRound ? (
                    <form action={createLatestRoundRecapAction}>
                      <Button
                        type="submit"
                        variant="outline"
                        className="min-h-11 w-full rounded-xl"
                      >
                        <ClipboardCheck className="size-4" />
                        Create latest-round recap
                      </Button>
                    </form>
                  ) : null}
                  <IOSGroupedList label="Round action links" className="bg-card">
                    <IOSListRow
                      label="Check course records"
                      detail="See whether a saved result qualifies for a board."
                      href="/course-records"
                      icon={Trophy}
                    />
                    <IOSListRow
                      label="Import round data"
                      detail="Add shot-level evidence from a launch monitor."
                      href="/import"
                      icon={Upload}
                    />
                    <IOSListRow
                      label="Coach review"
                      detail="Turn the latest result into the next practice action."
                      href="/coach"
                      icon={Brain}
                    />
                  </IOSGroupedList>
                </div>
              ),
            },
          ]}
        />
      </section>
    </section>
  );
}

function RoundsHero({
  combinedHandicap,
  latestRound,
  realHandicap,
  realRounds,
  roundsSaved,
  simHandicap,
  simulatorRounds,
}: {
  combinedHandicap: HandicapSummary;
  latestRound: Awaited<ReturnType<typeof getRounds>>[number] | null;
  realHandicap: HandicapSummary;
  realRounds: number;
  roundsSaved: number;
  simHandicap: HandicapSummary;
  simulatorRounds: number;
}) {
  return (
    <section className="premium-hero min-w-0 overflow-hidden p-4 sm:p-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="order-2 min-w-0 space-y-4 xl:order-none">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <StatusPill tone="sky">Round tracker</StatusPill>
              <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-normal text-balance">
                  Saved rounds
                </h1>
                {latestRound ? (
                  <Button asChild size="sm" className="mt-3 w-fit" data-primary-action>
                    <Link href={`/rounds/${latestRound.id}`} prefetch={false}>
                      <Flag className="size-4" />
                      Open latest round
                    </Link>
                  </Button>
                ) : null}
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {roundsDatabaseCopy(roundsSaved, realRounds, simulatorRounds)}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {roundsScoringCopy(combinedHandicap, realHandicap, simHandicap)}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap lg:justify-end">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/rounds/new">
                  <Plus className="size-4" />
                  Add real round
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/import">
                  <Upload className="size-4" />
                  Import round CSV
                </Link>
              </Button>
              <Button asChild variant="outline" className="hidden w-full sm:inline-flex sm:w-auto">
                <Link href="/achievements">
                  <Award className="size-4" />
                  Achievements
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <HeroMetric
              label="Rounds saved"
              value={integerFormatter.format(roundsSaved)}
              detail={`${integerFormatter.format(realRounds)} real · ${integerFormatter.format(simulatorRounds)} simulator`}
            />
            <HeroMetric
              label="Best form"
              value={formatHandicapValue(combinedHandicap.value)}
              detail={handicapTrendText(combinedHandicap)}
            />
            <HeroMetric
              label="Real ceiling"
              value={formatHandicapValue(realHandicap.value)}
              detail={handicapTrendText(realHandicap)}
            />
            <HeroMetric
              label="Sim ceiling"
              value={formatHandicapValue(simHandicap.value)}
              detail={handicapTrendText(simHandicap)}
            />
          </div>
        </div>

        <div className="order-1 min-w-0 xl:order-none">
          <LatestRoundSpotlight latestRound={latestRound} />
        </div>
      </div>
    </section>
  );
}

function LatestRoundSpotlight({
  latestRound,
}: {
  latestRound: Awaited<ReturnType<typeof getRounds>>[number] | null;
}) {
  if (!latestRound) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold">Latest round</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Real and simulator rounds will appear here after they are saved.
        </p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/rounds/new">
            <Plus className="size-4" />
            Add real round
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <PageArtwork
        variant="fairway"
        alt=""
        crop="random"
        cropKey={latestRound.id}
        className="hidden h-24 min-h-0 rounded-lg sm:block"
        sizes="(min-width: 1280px) 360px, 100vw"
        priority
      />
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Latest round
          </p>
          <h2 className="mt-1 line-clamp-2 break-words text-lg font-semibold tracking-normal sm:truncate sm:text-xl">
            {roundTitle(latestRound)}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {formatDate(latestRound.date)} · {formatSessionType(latestRound.type)}
          </p>
          <Button asChild variant="outline" className="mt-3 w-full sm:hidden" data-primary-action>
            <Link href={`/rounds/${latestRound.id}`}>
              <Flag className="size-4" />
              Review round
            </Link>
          </Button>
        </div>
        <div className="apple-panel-strong p-3">
          <p className="text-2xl font-semibold tracking-normal">
            {formatScoreSummary(latestRound)}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Score {formatInteger(latestRound.totalScore)} · Par{" "}
            {formatInteger(latestRound.totalPar)}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="hidden w-full sm:inline-flex"
          data-primary-action
        >
          <Link href={`/rounds/${latestRound.id}`}>
            <Flag className="size-4" />
            Review round
          </Link>
        </Button>
      </div>
    </div>
  );
}

function HeroMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-semibold tracking-normal sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function RoundTasks({
  latestRound,
  scorecardOnlyRounds,
}: {
  latestRound: Awaited<ReturnType<typeof getRounds>>[number] | null;
  scorecardOnlyRounds: Awaited<ReturnType<typeof getRounds>>;
}) {
  const firstScorecardOnlyRound = scorecardOnlyRounds[0] ?? null;

  return (
    <section id="tasks" className="premium-card scroll-mt-28 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Round tasks</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Review and clean up the latest saved scorecard.
          </p>
        </div>
        <StatusPill tone={latestRound ? "green" : "slate"}>
          {latestRound ? "Latest ready" : "No active tasks"}
        </StatusPill>
      </div>

      {latestRound ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <form
            action={createLatestRoundRecapAction}
            className="grid min-h-28 grid-rows-[1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            <RoundTaskHeader
              icon={ClipboardCheck}
              title="Latest recap"
              detail={`Create a recap from ${roundTitle(latestRound)}.`}
            />
            <Button type="submit" variant="outline" size="sm" className="w-fit">
              Create recap
            </Button>
          </form>

          <RoundTaskLink
            detail="Check whether this round created a record."
            href="/course-records"
            icon={Trophy}
            title="PB / records"
          >
            Check records
          </RoundTaskLink>

          <RoundTaskLink
            detail={dataStatusTaskCopy(scorecardOnlyRounds.length)}
            href={firstScorecardOnlyRound ? `/rounds/${firstScorecardOnlyRound.id}` : "/shots"}
            icon={Database}
            title="Data status"
          >
            {firstScorecardOnlyRound ? "Add shot data" : "Review data"}
          </RoundTaskLink>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-muted-foreground">
          No active round tasks. Add or import a new round to unlock recap, PB and record prompts.
        </div>
      )}
    </section>
  );
}

function RoundTaskLink({
  children,
  detail,
  href,
  icon: Icon,
  title,
}: {
  children: string;
  detail: string;
  href: string;
  icon: typeof ClipboardCheck;
  title: string;
}) {
  return (
    <div className="grid min-h-28 grid-rows-[1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <RoundTaskHeader icon={Icon} title={title} detail={detail} />
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={href} prefetch={false}>
          {children}
        </Link>
      </Button>
    </div>
  );
}

function RoundTaskHeader({
  detail,
  icon: Icon,
  title,
}: {
  detail: string;
  icon: typeof ClipboardCheck;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-5">{title}</span>
        <span className="mt-1 block line-clamp-2 leading-5 text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

function RoundTypeBreakdown({
  realRounds,
  scorecardOnlyRounds,
  shotCountTotal,
  shotLinkedRounds,
  simulatorRounds,
}: {
  realRounds: number;
  scorecardOnlyRounds: number;
  shotCountTotal: number;
  shotLinkedRounds: number;
  simulatorRounds: number;
}) {
  return (
    <section id="types" className="premium-card scroll-mt-28 p-4">
      <div>
        <h2 className="text-lg font-semibold tracking-normal">Round type breakdown</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Track real scorecards and simulator rounds separately so form, scoring and shot data stay
          clean.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BreakdownCard
          label="Real rounds"
          value={realRounds}
          detail="Used for real-course scoring and handicap-style context."
        />
        <BreakdownCard
          label="Simulator rounds"
          value={simulatorRounds}
          detail="Used for form, practice scoring and shot-linked review."
        />
        <BreakdownCard
          label="Scorecard-only"
          value={scorecardOnlyRounds}
          detail="Useful for scoring history, but limited for shot analysis."
        />
        <BreakdownCard
          label="Shot-linked"
          value={shotLinkedRounds}
          detail={`${integerFormatter.format(shotCountTotal)} club shots can support strokes gained, club review and recap insights.`}
        />
      </div>
    </section>
  );
}

function BreakdownCard({ detail, label, value }: { detail: string; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-normal">
        {integerFormatter.format(value)}
      </p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

async function getRounds() {
  try {
    return await getLiveRounds();
  } catch (error) {
    if (isPlaywrightE2eAuthBypassEnabled()) {
      reportServerFailure("rounds_e2e_fallback", error, {
        "app.route": "/rounds",
        "app.fallback": "empty_round_history",
      });
      return [];
    }

    throw error;
  }
}

async function getLiveRounds() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [sessionRows, shotCounts] = await Promise.all([
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
        roundStatus: sessions.roundStatus,
        weatherJson: sessions.weatherJson,
        equipmentNotes: sessions.equipmentNotes,
        scorecardJson: sessions.scorecardJson,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes])))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        sessionId: shots.sessionId,
        count: count(),
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.sessionId),
  ]);
  const shotCountBySessionId = new Map(shotCounts.map((row) => [row.sessionId, row.count]));

  return sessionRows.filter(isRoundHistorySession).map((session) => {
    const scorecard = session.scorecardJson ?? [];
    const totalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
    const totalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
    const totalPar =
      scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
    const handicapDifferential = calculateRoundDifferential({
      totalScore,
      totalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
      holesPlayed: scorecard.length,
    });

    return {
      ...session,
      shotCount: shotCountBySessionId.get(session.id) ?? 0,
      totalScore,
      totalPutts,
      totalPar,
      handicapDifferential,
    };
  });
}

function toWorkspaceRound(
  round: Awaited<ReturnType<typeof getRounds>>[number],
): RoundsWorkspaceRound {
  const holeResults = (round.scorecardJson ?? [])
    .slice()
    .sort((left, right) => left.holeNumber - right.holeNumber)
    .map(formatHoleResult)
    .filter(Boolean);

  return {
    id: round.id,
    courseName: round.courseName,
    fileName: round.fileName,
    dateLabel: formatDate(round.date),
    dateIso: round.date.toISOString(),
    type: round.type,
    typeLabel: formatSessionType(round.type),
    roundStatus: round.roundStatus,
    totalScore: round.totalScore,
    totalPar: round.totalPar,
    totalPutts: round.totalPutts,
    handicapDifferential: round.handicapDifferential,
    handicapDifferentialLabel: formatHandicapValue(round.handicapDifferential),
    scoreSummary: formatScoreSummary(round),
    shotCount: round.shotCount,
    dataLabel: roundDataLabel(round),
    rowDataLabel: roundRowDataLabel(round),
    statusLabel:
      round.shotCount > 0 ? "Shot-linked · SG eligible" : "Scorecard only · add shot data",
    holeResults,
    scorecardHoles: (round.scorecardJson ?? [])
      .slice()
      .sort((left, right) => left.holeNumber - right.holeNumber)
      .map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        yards: hole.yards,
        score: hole.score ?? null,
        putts: hole.putts ?? null,
        penalties: hole.penalties ?? null,
        shotCount: hole.csvShotCount ?? null,
      })),
  };
}

function roundsDatabaseCopy(roundsSaved: number, realRounds: number, simulatorRounds: number) {
  if (roundsSaved === 0) {
    return "No rounds saved yet. Add a real scorecard or import a simulator round to start the database.";
  }

  return `${integerFormatter.format(roundsSaved)} ${pluralise("round", roundsSaved)} saved: ${integerFormatter.format(realRounds)} real ${pluralise("round", realRounds)} and ${integerFormatter.format(simulatorRounds)} simulator ${pluralise("round", simulatorRounds)}.`;
}

function roundsScoringCopy(
  combinedHandicap: HandicapSummary,
  realHandicap: HandicapSummary,
  simHandicap: HandicapSummary,
) {
  if (typeof combinedHandicap.value !== "number") {
    return "Track real scorecards and simulator rounds separately so form, scoring and shot data stay clean.";
  }

  const scoringContext =
    typeof realHandicap.value === "number" && typeof simHandicap.value === "number"
      ? realHandicap.value > simHandicap.value
        ? "Real-round scoring is still higher than simulator scoring, so keep both tracked separately."
        : "Simulator scoring is still higher than real-round scoring, so keep both tracked separately."
      : "Keep real scorecards and simulator scoring tracked separately.";

  return `Best form is ${formatHandicapValue(combinedHandicap.value)}. ${scoringContext}`;
}

function handicapTrendText(summary: HandicapSummary) {
  const direction = summary.trend.direction;

  if (summary.sampleSize === 0) {
    return "No scorecards";
  }

  if (direction === "none") {
    return `${summary.sampleSize} round sample`;
  }

  if (direction === "flat") {
    return "Stable";
  }

  const amount = formatTrendAmount(summary.trend.delta);
  return direction === "down" ? `Improved by ${amount}` : `Higher by ${amount}`;
}

function dataStatusTaskCopy(scorecardOnlyRoundCount: number) {
  if (scorecardOnlyRoundCount === 0) {
    return "Shot-linked rounds are ready for review.";
  }

  return `${integerFormatter.format(scorecardOnlyRoundCount)} scorecard-only ${pluralise("round", scorecardOnlyRoundCount)} need shot data.`;
}

function formatTrendAmount(value: number | null) {
  return typeof value === "number" ? handicapDeltaFormatter.format(Math.abs(value)) : "--";
}

function roundTitle(round: Awaited<ReturnType<typeof getRounds>>[number]) {
  return round.courseName ?? round.fileName ?? "Untitled round";
}

function formatScoreSummary(round: { totalPar: number | null; totalScore: number | null }) {
  if (typeof round.totalScore !== "number") {
    return "--";
  }

  return `${integerFormatter.format(round.totalScore)} (${formatScoreToPar(round)})`;
}

function formatScoreToPar(round: { totalPar: number | null; totalScore: number | null }) {
  if (typeof round.totalScore !== "number" || typeof round.totalPar !== "number") {
    return "--";
  }

  const scoreToPar = round.totalScore - round.totalPar;
  if (scoreToPar === 0) {
    return "E";
  }

  return scoreToPar > 0
    ? `+${integerFormatter.format(scoreToPar)}`
    : integerFormatter.format(scoreToPar);
}

function roundDataLabel(round: { shotCount: number }) {
  return round.shotCount > 0
    ? `${integerFormatter.format(round.shotCount)} shots`
    : "Scorecard only";
}

function roundRowDataLabel(round: { shotCount: number }) {
  return round.shotCount > 0
    ? `${integerFormatter.format(round.shotCount)} shots · SG ready`
    : "Scorecard only";
}

function formatHoleResult(hole: { par: number; score?: number | null }) {
  if (typeof hole.score !== "number") {
    return "";
  }

  const scoreToPar = hole.score - hole.par;
  if (scoreToPar === -3) {
    return "Albatross";
  }
  if (scoreToPar === -2) {
    return "Eagle";
  }
  if (scoreToPar === -1) {
    return "Birdie";
  }
  if (scoreToPar === 0) {
    return "Par";
  }
  if (scoreToPar === 1) {
    return "Bog";
  }
  if (scoreToPar === 2) {
    return "+2";
  }

  return scoreToPar > 0
    ? `+${integerFormatter.format(scoreToPar)}`
    : integerFormatter.format(scoreToPar);
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatInteger(value: number | null) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}

function pluralise(word: string, countValue: number) {
  return countValue === 1 ? word : `${word}s`;
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real round";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
