import { getRequestAppSurface } from "@/lib/app-surface-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Database,
  Link2,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { MobileLargeTitle } from "@/components/app/mobile-screen";
import { MobileMetricStory } from "@/components/app/mobile-metric-story";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { LazyMobileShotPatternCharts as MobileShotPatternCharts } from "@/components/app/lazy-mobile-shot-pattern-charts";
import { ResultHero } from "@/components/app/result-hero";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlanForSourceSessions } from "@/lib/practice-planner";
import {
  buildShotPatternPoints,
  shotPatternClubs,
  shotPatternConfidence,
  summarizeShotPattern,
} from "@/lib/shot-pattern-chart-data";
import { getTodayPracticeData, type ClubDayComparison } from "@/lib/today-session-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PracticeSessionReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const surface = await getRequestAppSurface();
  const userId = await requireCurrentUserId();
  const data = await getTodayPracticeData({ sessionId });

  if (!data.sessions.some((session) => session.id === sessionId)) notFound();

  const plan = await getPracticePlanForSourceSessions(userId, [sessionId]);
  const comparisons = [...data.clubComparisons].sort((left, right) => left.score - right.score);
  const remaining = comparisons[0] ?? null;
  const bestClub = comparisons.at(-1) ?? null;
  const improved =
    comparisons
      .filter((comparison) => comparison.verdict === "better")
      .sort((left, right) => right.score - left.score)[0] ?? null;
  const shots = data.shots.filter((shot) => shot.sessionId === sessionId);
  const rawShots = data.rawShots.filter((shot) => shot.sessionId === sessionId);
  const patternPoints = buildShotPatternPoints(rawShots);
  const clubs = shotPatternClubs(patternPoints);
  const preferredClub =
    plan?.comparisonSummary && plan.blocks[0]?.clubs[0]
      ? plan.blocks[0].clubs[0]
      : (remaining?.clubType ?? patternPoints[0]?.clubType ?? null);
  const trustedFocusPoints = patternPoints.filter(
    (point) => point.trusted && (!preferredClub || point.clubType === preferredClub),
  );
  const sessionConfidence = shotPatternConfidence(patternPoints.filter((point) => point.trusted));
  const focusConfidence = shotPatternConfidence(trustedFocusPoints);
  const patternSummary = summarizeShotPattern(trustedFocusPoints);
  const verdict = verdictPresentation(data.overall.verdict);
  const source = formatSource(rawShots[0]?.source ?? "session");
  const clubList = compactClubList(clubs.map((club) => club.label));
  const linkedPlan = plan?.title ?? "No plan linked";
  const nextAction = remaining
    ? `Work on ${remaining.clubLabel}: ${sentenceCase(remaining.summary)}`
    : "Repeat the same measured block to build a comparable baseline.";

  const importantMetrics = [
    {
      label: "Trusted shots",
      value: String(shots.length),
      detail:
        rawShots.length === shots.length
          ? "All imported shots used"
          : `${rawShots.length} imported`,
    },
    {
      label: "Median carry",
      value: formatYards(patternSummary.medianCarryYd),
      detail: preferredClub ? `${clubLabel(preferredClub)} selection` : "Selected chart view",
    },
    {
      label: "Average offline",
      value: formatYards(data.overall.today.offlineAverageYd),
      detail: "Lower is better",
    },
    {
      label: "Playable rate",
      value: formatPercent(data.overall.today.playableRate),
      detail: formatRateChange(data.overall.playableRateDelta),
    },
  ];

  const focusShots = shots.filter((shot) => !preferredClub || shot.clubType === preferredClub);
  const averageMetric = (
    key: "ballSpeedMph" | "clubSpeedMph" | "launchAngleDeg" | "smashFactor",
  ) => {
    const values = focusShots
      .map((shot) => shot[key])
      .filter((value): value is number => value != null && Number.isFinite(value));
    return values.length
      ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
          key === "smashFactor" ? 2 : 1,
        )
      : null;
  };
  const mobileMetrics = [
    ...(patternSummary.medianCarryYd != null
      ? [
          {
            label: "carry",
            value: String(Math.round(patternSummary.medianCarryYd)),
            unit: "yd",
            detail: "Median trusted carry",
          },
        ]
      : []),
    ...(
      [
        ["Ball speed", "ballSpeedMph", "mph"],
        ["Club speed", "clubSpeedMph", "mph"],
        ["Launch", "launchAngleDeg", "°"],
        ["Smash", "smashFactor", ""],
      ] as const
    ).flatMap(([label, key, unit]) => {
      const value = averageMetric(key);
      return value == null
        ? []
        : [{ label, value, unit, detail: "Average of available trusted readings" }];
    }),
  ];
  return (
    <PageShell>
      {surface === "workbench" ? (
        <div className="hidden min-w-0 gap-6 lg:grid" data-session-performance-report>
          <DesktopVerdictHeader
            verdict={verdict}
            title={data.overall.title}
            summary={data.overall.summary}
            confidence={`${sessionConfidence.label} confidence`}
            date={data.dateLabel}
            source={source}
            clubs={clubList}
            linkedPlan={linkedPlan}
            nextAction={nextAction}
          />

          <Card
            className="min-w-0 gap-0 overflow-hidden py-0 shadow-md"
            data-primary-dispersion-stage
          >
            <CardHeader className="border-b bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-5 text-white xl:px-8">
              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Main visual
                  </p>
                  <CardTitle className="mt-1 text-2xl text-white">Dispersion report</CardTitle>
                  <CardDescription className="mt-1 text-slate-300">
                    Landing pattern, trusted spread and measured ball flight for each club.
                  </CardDescription>
                </div>
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                  {focusConfidence.sampleSize} trusted landing points
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-5 xl:px-8 xl:py-7">
              <MobileShotPatternCharts
                points={patternPoints}
                preferredClub={preferredClub}
                layout="desktop"
              />
            </CardContent>
          </Card>

          <WhatHappened
            improved={improved}
            remaining={remaining}
            bestClub={bestClub}
            pattern={patternReadout(patternSummary, preferredClub)}
          />

          <section className="grid gap-3" aria-labelledby="important-numbers-title">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Performance snapshot
              </p>
              <h2
                id="important-numbers-title"
                className="mt-1 text-2xl font-semibold tracking-tight"
              >
                Important numbers
              </h2>
            </div>
            <ConnectedMetricBar metrics={importantMetrics} label="Four important session numbers" />
          </section>

          {plan ? <PlanVersusActual plan={plan} /> : null}

          <ClubSummary comparisons={comparisons} />

          <EvidenceDisclosure
            source={source}
            fileName={rawShots[0]?.fileName ?? null}
            importedCount={rawShots.length}
            trustedCount={shots.length}
            excludedCount={Math.max(0, rawShots.length - shots.length)}
            confidence={`${sessionConfidence.label} confidence`}
          />
        </div>
      ) : null}

      {surface === "companion" ? (
        <MobileAppShell className="gap-6" data-practice-session-review>
          <MobileLargeTitle
            title="Session review"
            eyebrow={data.dateLabel}
            detail={`${rawShots.length} shots · ${clubList} · ${source}`}
          />
          <ResultHero
            eyebrow="Session verdict"
            title={verdict.label}
            summary={
              <div className="grid gap-2">
                <p className="font-semibold text-foreground">{data.overall.title}</p>
                <p>{data.overall.summary}</p>
                <p className="text-xs">
                  {data.dateLabel} · {source} · {clubList} ·{" "}
                  {plan ? "Plan linked" : "No linked plan"}
                </p>
              </div>
            }
            confidence={{
              label: `${sessionConfidence.label} confidence`,
              tone: sessionConfidence.label === "Low" ? "outline" : "secondary",
            }}
            className={verdict.mobileClassName}
          />

          <Card className="gap-3 py-3" data-mobile-primary-chart>
            <CardHeader className="px-3">
              <CardTitle>Dispersion</CardTitle>
              <CardDescription>
                Tap a shot to inspect it. Switch to Flight for ball shape.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3">
              <MobileShotPatternCharts points={patternPoints} preferredClub={preferredClub} />
            </CardContent>
          </Card>

          <MobileMetricStory
            metrics={mobileMetrics}
            context={`${preferredClub ? clubLabel(preferredClub) : "Selected club"} · ${focusShots.length} trusted shots`}
          />
          <Button asChild variant="outline" className="min-h-12">
            <Link href={`/shots?sessionId=${sessionId}`}>View shots</Link>
          </Button>

          <Card size="sm">
            <CardHeader>
              <CardTitle>What changed</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-0 overflow-hidden rounded-xl border p-0">
              <MobileFinding
                icon={TrendingUp}
                label="What improved"
                title={improved?.clubLabel ?? "Baseline built"}
                detail={
                  improved?.summary ??
                  "There is no prior like-for-like baseline strong enough for an improvement claim."
                }
                tone="positive"
              />
              <Separator />
              <MobileFinding
                icon={TrendingDown}
                label="What needs work"
                title={remaining?.clubLabel ?? "Retest"}
                detail={
                  remaining?.summary ?? "Repeat the same measured block before changing focus."
                }
                tone="negative"
              />
            </CardContent>
          </Card>

          <ButtonGroup className="w-full">
            <Button asChild className="min-h-12 flex-1 rounded-xl text-base">
              <Link href="/practice?intent=latest_weakness">
                Build next plan
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
          </ButtonGroup>
        </MobileAppShell>
      ) : null}
    </PageShell>
  );
}

function DesktopVerdictHeader({
  verdict,
  title,
  summary,
  confidence,
  date,
  source,
  clubs,
  linkedPlan,
  nextAction,
}: {
  verdict: ReturnType<typeof verdictPresentation>;
  title: string;
  summary: string;
  confidence: string;
  date: string;
  source: string;
  clubs: string;
  linkedPlan: string;
  nextAction: string;
}) {
  const metadata = [
    { icon: CalendarDays, label: "Date", value: date },
    { icon: Database, label: "Source", value: source },
    { icon: Trophy, label: "Clubs", value: clubs },
    { icon: Link2, label: "Linked plan", value: linkedPlan },
  ];

  return (
    <header
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border p-6 shadow-sm xl:p-8",
        verdict.desktopClassName,
      )}
      data-session-verdict
    >
      <div
        className="absolute -right-16 -top-24 size-72 rounded-full bg-white/45 blur-3xl"
        aria-hidden
      />
      <div className="relative grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)] xl:items-stretch">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-foreground/65">
              Session verdict
            </p>
            <Badge variant="outline" className="border-current/20 bg-white/45 text-foreground">
              {confidence}
            </Badge>
          </div>
          <h1 className="mt-3 text-6xl font-black tracking-[-0.055em] text-foreground xl:text-7xl">
            {verdict.label}
          </h1>
          <p className="mt-3 text-xl font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-2 max-w-4xl text-base leading-7 text-foreground/70">{summary}</p>

          <div className="mt-6 grid overflow-hidden rounded-xl border border-foreground/10 bg-white/45 sm:grid-cols-2 xl:grid-cols-4">
            {metadata.map(({ icon: Icon, label, value }, index) => (
              <div key={label} className="relative min-w-0 px-4 py-3.5">
                {index > 0 ? (
                  <Separator
                    orientation="vertical"
                    className="absolute inset-y-3 -left-px hidden h-auto xl:block"
                  />
                ) : null}
                {index > 1 ? (
                  <Separator className="absolute inset-x-4 top-0 hidden w-auto sm:block xl:hidden" />
                ) : null}
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/55">
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col justify-between rounded-2xl bg-slate-950 p-5 text-white shadow-lg xl:p-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <Target className="size-4" aria-hidden />
              Primary next action
            </p>
            <p className="mt-4 text-xl font-semibold leading-7">{nextAction}</p>
          </div>
          <Button
            asChild
            size="lg"
            className="mt-6 w-full bg-white text-slate-950 hover:bg-slate-100"
          >
            <Link href="/practice?intent=latest_weakness">
              Build next plan
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        </aside>
      </div>
    </header>
  );
}

function WhatHappened({
  improved,
  remaining,
  bestClub,
  pattern,
}: {
  improved: ClubDayComparison | null;
  remaining: ClubDayComparison | null;
  bestClub: ClubDayComparison | null;
  pattern: string;
}) {
  const items = [
    {
      icon: TrendingUp,
      label: "Main improvement",
      title: improved?.clubLabel ?? "Baseline built",
      detail:
        improved?.summary ?? "No like-for-like change is strong enough to call an improvement yet.",
      iconClass: "bg-emerald-100 text-emerald-700",
    },
    {
      icon: TrendingDown,
      label: "Remaining weakness",
      title: remaining?.clubLabel ?? "Retest needed",
      detail: remaining?.summary ?? "Repeat the same measured block before changing focus.",
      iconClass: "bg-rose-100 text-rose-700",
    },
    {
      icon: Target,
      label: "Main miss pattern",
      title: "Trusted dispersion",
      detail: pattern,
      iconClass: "bg-sky-100 text-sky-700",
    },
    {
      icon: Trophy,
      label: "Best club",
      title: bestClub?.clubLabel ?? "No club call yet",
      detail: bestClub?.summary ?? "More measured shots are needed to rank the clubs.",
      iconClass: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <section className="grid gap-3" aria-labelledby="what-happened-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Session readout
        </p>
        <h2 id="what-happened-title" className="mt-1 text-2xl font-semibold tracking-tight">
          What happened?
        </h2>
      </div>
      <Card className="grid gap-0 overflow-hidden py-0 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ icon: Icon, label, title, detail, iconClass }, index) => (
          <div key={label} className="relative min-w-0 p-5">
            {index > 0 ? (
              <Separator
                orientation="vertical"
                className="absolute inset-y-5 -left-px hidden h-auto xl:block"
              />
            ) : null}
            {index > 1 ? (
              <Separator className="absolute inset-x-5 top-0 hidden w-auto sm:block xl:hidden" />
            ) : null}
            <span className={cn("grid size-9 place-items-center rounded-full", iconClass)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </Card>
    </section>
  );
}

function PlanVersusActual({
  plan,
}: {
  plan: NonNullable<Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>>;
}) {
  const metrics = [
    { label: "Planned blocks", value: plan.totalBlocks },
    { label: "Targets passed", value: plan.passedBlocks },
    { label: "Mixed", value: plan.mixedBlocks },
    { label: "Needs evidence", value: plan.incompleteBlocks },
  ];

  return (
    <section className="grid gap-3" aria-labelledby="plan-actual-title" data-plan-versus-actual>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Linked practice
          </p>
          <h2 id="plan-actual-title" className="mt-1 text-2xl font-semibold tracking-tight">
            Plan vs actual
          </h2>
        </div>
        <Badge variant="secondary">{plan.score === null ? "Measured" : `${plan.score}/100`}</Badge>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(440px,1.2fr)] xl:items-center xl:p-6">
          <div>
            <p className="text-lg font-semibold">{plan.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{plan.verdict}</p>
            <Progress
              value={plan.score ?? 0}
              className="mt-4"
              aria-label={
                plan.score === null
                  ? "Practice plan was measured without a numeric score"
                  : `Practice plan score: ${plan.score} out of 100`
              }
            />
          </div>
          <ConnectedMetricBar metrics={metrics} embedded label="Practice plan result" />
        </div>
      </Card>
    </section>
  );
}

function ClubSummary({ comparisons }: { comparisons: ClubDayComparison[] }) {
  return (
    <section className="grid gap-3" aria-labelledby="club-summary-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Bag readout
        </p>
        <h2 id="club-summary-title" className="mt-1 text-2xl font-semibold tracking-tight">
          Club summary
        </h2>
      </div>
      <Card className="overflow-hidden py-0">
        {comparisons.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Shots</TableHead>
                <TableHead className="text-right">Carry</TableHead>
                <TableHead className="text-right">Offline</TableHead>
                <TableHead className="text-right">Playable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((comparison) => (
                <TableRow key={comparison.clubType}>
                  <TableCell className="font-semibold">{comparison.clubLabel}</TableCell>
                  <TableCell>
                    <VerdictBadge verdict={comparison.verdict} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {comparison.today.shotCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatYards(comparison.today.carryAverageYd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatYards(comparison.today.offlineAverageYd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(comparison.today.playableRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No club has enough comparable measured shots for a summary row yet.
          </p>
        )}
      </Card>
    </section>
  );
}

function EvidenceDisclosure({
  source,
  fileName,
  importedCount,
  trustedCount,
  excludedCount,
  confidence,
}: {
  source: string;
  fileName: string | null;
  importedCount: number;
  trustedCount: number;
  excludedCount: number;
  confidence: string;
}) {
  return (
    <details className="group rounded-xl border bg-card shadow-sm" data-session-evidence>
      <summary className="focus-aaa flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 outline-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-semibold">Evidence</span>
          <span className="ml-2 text-sm text-muted-foreground">Collapsed by default</span>
        </span>
        <Badge variant="outline">{confidence}</Badge>
      </summary>
      <div className="border-t px-5 py-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <EvidenceFact label="Source" value={source} />
          <EvidenceFact label="File" value={fileName ?? "Stored session"} />
          <EvidenceFact label="Shot use" value={`${trustedCount} trusted of ${importedCount}`} />
          <EvidenceFact label="Excluded" value={String(excludedCount)} />
        </dl>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Trusted views remove tagged mishits, deleted rows and shots with detected data-integrity
          issues. Plan scoring comes from linked imported shot rows.
        </p>
      </div>
    </details>
  );
}

function EvidenceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

function MobileFinding({
  icon: Icon,
  label,
  title,
  detail,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  title: string;
  detail: string;
  tone: "positive" | "negative";
}) {
  return (
    <div className="flex gap-3 p-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          tone === "positive" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: ClubDayComparison["verdict"] }) {
  return (
    <Badge
      variant={verdict === "worse" ? "destructive" : verdict === "new" ? "outline" : "secondary"}
      className={cn(
        verdict === "better" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
        verdict === "mixed" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
      )}
    >
      {verdict === "better" ? "Better" : sentenceCase(verdict)}
    </Badge>
  );
}

function verdictPresentation(verdict: "better" | "worse" | "mixed" | "new") {
  if (verdict === "better") {
    return {
      label: "GOOD",
      desktopClassName: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50",
      mobileClassName: "border-emerald-200 from-card via-card to-emerald-500/[0.08]",
    };
  }
  if (verdict === "worse") {
    return {
      label: "WEAK",
      desktopClassName: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50",
      mobileClassName: "border-rose-200 from-card via-card to-rose-500/[0.08]",
    };
  }
  if (verdict === "mixed") {
    return {
      label: "MIXED",
      desktopClassName: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50",
      mobileClassName: "border-amber-200 from-card via-card to-amber-500/[0.08]",
    };
  }
  return {
    label: "BASELINE",
    desktopClassName: "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50",
    mobileClassName: "border-sky-200 from-card via-card to-sky-500/[0.08]",
  };
}

function patternReadout(
  summary: ReturnType<typeof summarizeShotPattern>,
  preferredClub: string | null,
) {
  if (summary.sampleSize === 0 || summary.medianSideYd === null) {
    return "No trusted landing pattern is available for this selection.";
  }
  const club = preferredClub ? clubLabel(preferredClub) : "The selection";
  const centre =
    Math.abs(summary.medianSideYd) < 1
      ? "centred on target"
      : `centred ${Math.abs(Math.round(summary.medianSideYd))} yd ${summary.medianSideYd < 0 ? "left" : "right"}`;
  const pattern = summary.typicalMiss
    ? `${summary.typicalMiss.toLowerCase()} is the repeat miss`
    : "there is no dominant one-way miss yet";
  return `${club} is ${centre}; ${pattern}. ${summary.insideCorridor} of ${summary.sampleSize} finished in the playable corridor.`;
}

function formatSource(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "rapsodo_cloud") return "Rapsodo Cloud";
  if (normalized === "rapsodo" || normalized === "csv") return "Rapsodo CSV";
  if (normalized === "trackman") return "TrackMan";
  return sentenceCase(value.replace(/[_-]+/g, " "));
}

function compactClubList(labels: string[]) {
  if (labels.length === 0) return "No measured clubs";
  if (labels.length <= 4) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

function clubLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function sentenceCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRateChange(value: number | null) {
  if (value === null) return "No prior comparison";
  if (Math.abs(value) < 0.5) return "No meaningful change";
  return `${value > 0 ? "+" : ""}${Math.round(value)} pts vs baseline`;
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}
