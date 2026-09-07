import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs as clubTable } from "@/db/schema";
import { getTodayShotDetailRows } from "@/lib/today-shot-detail-data";
import { formatClubType } from "@/lib/club-format";
import { ImportPracticeReview } from "@/app/import/import-result-sections";
import { SessionShotPreview } from "@/app/sessions/session-shot-preview-lazy";
import { TodayDataQuality } from "@/app/today/today-data-quality";
import { SessionAlignmentPanel } from "@/components/analysis/session-alignment-panel";
import { mobileComparisonSummary } from "@/lib/mobile-review-copy";
import { UrlTabs } from "@/components/untitled-ui/url-tabs";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionReviewMetadata } from "@/lib/session-review-metadata";
import { companionReviewRoute } from "@/lib/session-review-route";
import { MobileUnmeasuredSession } from "@/app/sessions/mobile-unmeasured-session";
import { ArrowRight, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";

import { MobileSection } from "@/components/app/mobile-screen";
import { MobileSessionPattern } from "@/app/sessions/mobile-session-pattern";
import { SessionReviewStory as MobileSessionStory } from "@/app/sessions/session-review-story";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { LazyMobileShotPatternCharts as MobileShotPatternCharts } from "@/components/app/lazy-mobile-shot-pattern-charts";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import {
  mobileSessionGroups,
  sessionFocusClub,
  mobileSessionVerdict,
  sessionPracticeHref,
} from "@/lib/mobile-session-review";
import { MobileAppShell } from "@/components/app/mobile-app-shell";
import { PageShell } from "@/components/app/page-shell";
import { UntitledPageHeader as PageHeader } from "@/components/untitled-ui/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  getPracticePlanForSourceSessions,
  getPracticePlanReviewForSourceSession,
} from "@/lib/practice-planner";
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
  const metadata = await getSessionReviewMetadata(userId, sessionId);
  if (!metadata) notFound();
  if (metadata && companionReviewRoute(metadata).startsWith("/rounds/")) {
    redirect(companionReviewRoute(metadata));
  }
  if (metadata?.shotCount === 0) {
    const plan = await getPracticePlanForSourceSessions(userId, [sessionId]);
    return <MobileUnmeasuredSession session={metadata} plan={plan} />;
  }
  const data = await getTodayPracticeData({ sessionId });

  const plan = await getPracticePlanForSourceSessions(userId, [sessionId]);
  if (metadata && !data.rawShots.some((shot) => shot.sessionId === sessionId)) {
    return <MobileUnmeasuredSession session={metadata} plan={plan} />;
  }
  if (!data.sessions.some((session) => session.id === sessionId)) notFound();
  const comparisons = [...data.clubComparisons].sort((left, right) => left.score - right.score);
  const supportedComparisons = comparisons.filter(
    (row) => row.today.shotCount >= 5 && row.previous.shotCount >= 5,
  );
  const remaining = supportedComparisons[0] ?? null;
  const bestClub = supportedComparisons.at(-1) ?? null;
  const improved =
    supportedComparisons
      .filter((comparison) => comparison.verdict === "better")
      .sort((left, right) => right.score - left.score)[0] ?? null;
  const shots = data.shots.filter((shot) => shot.sessionId === sessionId);
  const rawShots = data.rawShots.filter((shot) => shot.sessionId === sessionId);
  const trustedShotIds = new Set(shots.map((shot) => shot.id));
  const patternPoints = buildShotPatternPoints(rawShots, { trustedShotIds });
  const mobilePatternPoints = buildShotPatternPoints(rawShots, { trustedShotIds });
  const mobileConfidence = shotPatternConfidence(
    mobilePatternPoints.filter((point) => point.trusted),
  );
  const clubs = shotPatternClubs(patternPoints);
  const preferredClub = sessionFocusClub(
    plan?.comparisonSummary ? plan.blocks[0]?.clubs[0] : null,
    remaining?.clubType,
    shots.map((shot) => shot.clubType),
    patternPoints.map((point) => point.clubType),
  );
  const trustedFocusPoints = patternPoints.filter(
    (point) => point.trusted && (!preferredClub || point.clubType === preferredClub),
  );
  const sessionConfidence = shotPatternConfidence(patternPoints.filter((point) => point.trusted));
  const focusConfidence = shotPatternConfidence(trustedFocusPoints);
  const patternSummary = summarizeShotPattern(trustedFocusPoints);
  const verdict = verdictPresentation(supportedComparisons.length ? data.overall.verdict : "new");
  const evidenceSummary = supportedComparisons.length
    ? data.overall.summary
    : `${shots.length} usable shots saved. More comparable evidence for the same club is needed before calling a performance change.`;
  const source = formatSource(rawShots[0]?.source ?? "session");
  const storyGroups = mobileSessionGroups(rawShots, shots);
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

  const mobileSessionTitle =
    rawShots[0]?.courseName ??
    (clubs.length === 1 ? `${clubs[0].label} practice` : "Practice session");
  const sessionPractice = sessionPracticeHref(
    remaining?.clubType ?? null,
    remaining?.clubLabel ?? null,
    remaining?.verdict === "new" ? "baseline" : "control",
    sessionId,
  );

  const [details, correctionClubRows, planReview] = await Promise.all([
    getTodayShotDetailRows({ userId, shotIds: rawShots.map((shot) => shot.id) }),
    getDb()
      .select({
        id: clubTable.id,
        type: clubTable.type,
        brand: clubTable.brand,
        model: clubTable.model,
      })
      .from(clubTable)
      .where(and(eq(clubTable.userId, userId), eq(clubTable.active, true))),
    getPracticePlanReviewForSourceSession(userId, sessionId),
  ]);
  const correctionClubs = correctionClubRows.map((club) => ({
    value: club.id,
    label: [formatClubType(club.type), club.brand, club.model].filter(Boolean).join(" · "),
  }));
  return (
    <PageShell>
      <PageHeader
        title={metadata.fileName ?? metadata.courseName ?? mobileSessionTitle}
        description={`${data.dateLabel} · ${metadata.type} · ${source} · ${rawShots.length} imported shots`}
        actions={
          <Button asChild className="min-h-11">
            <Link href={sessionPractice}>
              Next practice
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />
      <TodayDataQuality shots={rawShots} compact />
      {surface === "workbench" ? (
        <div className="grid min-w-0 gap-5" data-session-performance-report>
          <DesktopVerdictHeader
            practiceHref={sessionPractice}
            verdict={verdict}
            title={supportedComparisons.length ? data.overall.title : "Build a comparable baseline"}
            summary={evidenceSummary}
            confidence={`${sessionConfidence.label} sample coverage`}
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
            <CardHeader className="border-b px-4 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Main visual
                  </p>
                  <CardTitle className="mt-1 text-xl">Dispersion report</CardTitle>
                  <CardDescription className="mt-1 text-muted-foreground">
                    Landing pattern, trusted spread and measured ball flight for each club.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {focusConfidence.sampleSize} trusted landing points
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-5 xl:px-8 xl:py-7">
              <MobileShotPatternCharts
                details={details}
                correctionClubs={correctionClubs}
                points={patternPoints}
                preferredClub={preferredClub}
                layout="desktop"
              />
            </CardContent>
          </Card>

          <WhatHappened
            sessionId={sessionId}
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

          {plan ? <PlanVersusActual plan={plan} review={planReview} sessionId={sessionId} /> : null}

          <ClubSummary comparisons={comparisons} />
          <BaselineSources data={data} />

          <EvidenceDisclosure
            source={source}
            fileName={rawShots[0]?.fileName ?? null}
            importedCount={rawShots.length}
            trustedCount={shots.length}
            excludedCount={Math.max(0, rawShots.length - shots.length)}
            confidence={`${sessionConfidence.label} sample coverage`}
          />
        </div>
      ) : null}

      {surface === "companion" ? (
        <MobileAppShell className="gap-6" data-practice-session-review>
          <section className="mobile-section" aria-label="Session verdict">
            <p className="mobile-type-footnote text-muted-foreground">Session verdict</p>
            <h2 className="mobile-type-title2">{mobileSessionVerdict(supportedComparisons)}</h2>
            <MobileStatus
              label={`${mobileConfidence.label} sample coverage · ${shots.length} included shots`}
              tone={mobileConfidence.label === "Low" ? "attention" : "neutral"}
            />
            <details>
              <summary className="mobile-type-callout flex min-h-11 items-center text-primary">
                Comparison evidence
              </summary>
              <p className="mobile-type-callout text-muted-foreground">{evidenceSummary}</p>
              <BaselineSources data={data} />
              <p className="mobile-type-footnote mt-2 text-muted-foreground">
                {shots.length} of {rawShots.length} imported shots used. Full-shot comparisons use
                prior evidence for the same clubs.
              </p>
            </details>
          </section>
          <UrlTabs
            className="companion-review-tabs"
            defaultTabKey="review"
            label="Session review sections"
            tabs={[
              {
                id: "review",
                label: "Review",
                content: (
                  <div className="grid gap-5">
                    {" "}
                    <MobileSection title="What changed">
                      <MobileGroupedList>
                        <MobileListRow
                          label="Best signal"
                          value={improved?.clubLabel ?? "Baseline"}
                          detail={
                            (improved ? mobileComparisonSummary(improved) : null) ??
                            "No supported improvement yet. Repeat the same measured block to build a comparison."
                          }
                        />
                        <MobileListRow
                          label={remaining?.verdict === "worse" ? "Main problem" : "Next focus"}
                          value={remaining?.clubLabel ?? "Build evidence"}
                          detail={
                            (remaining ? mobileComparisonSummary(remaining) : null) ??
                            "There is not enough comparable evidence to identify a weakness."
                          }
                        />
                      </MobileGroupedList>
                    </MobileSection>
                    <MobileSection title="Shot pattern">
                      <div data-mobile-primary-chart>
                        <MobileSessionPattern
                          details={details}
                          correctionClubs={correctionClubs}
                          points={mobilePatternPoints}
                          initiallyOpen
                          preferredClub={preferredClub}
                        />
                      </div>
                    </MobileSection>
                  </div>
                ),
              },
              {
                id: "clubs",
                label: "Clubs & shots",
                content: (
                  <>
                    {" "}
                    <MobileSessionStory
                      groups={storyGroups}
                      preferredClub={preferredClub}
                      sessionId={sessionId}
                    />
                  </>
                ),
              },
              {
                id: "next",
                label: "Next practice",
                content: (
                  <>
                    {" "}
                    <MobileSection title="Next practice">
                      <p className="mobile-type-callout text-muted-foreground">
                        {remaining
                          ? remaining.verdict === "new"
                            ? `Record another measured ${remaining.clubLabel} block to build a comparable baseline.`
                            : `Work on ${remaining.clubLabel} control, then import measured shots to check the result.`
                          : "Repeat a measured session before choosing a new focus."}
                      </p>
                      <Button asChild className="min-h-12">
                        <Link href={sessionPractice}>
                          {remaining
                            ? remaining.verdict === "new"
                              ? `Build ${remaining.clubLabel} baseline`
                              : `Practise ${remaining.clubLabel}`
                            : "Choose practice"}
                          <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      {plan ? (
                        <PlanVersusActual plan={plan} review={planReview} sessionId={sessionId} />
                      ) : null}
                      {plan ? (
                        <MobileGroupedList>
                          <MobileListRow
                            label="Linked practice"
                            detail={plan.title}
                            href={`/practice?planId=${plan.id}`}
                          />
                        </MobileGroupedList>
                      ) : null}
                    </MobileSection>
                  </>
                ),
              },
            ]}
          />
        </MobileAppShell>
      ) : null}
      <section
        className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:p-5"
        aria-label="Complete shot evidence"
      >
        <h2 className="text-xl font-semibold">Shot evidence ledger</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Inspect every saved field, original source and review history. Keep, exclude or correct a
          club without rewriting raw measurements.
        </p>
        <SessionShotPreview sessionId={sessionId} editable correctionClubs={correctionClubs} />
      </section>
      <SessionAlignmentPanel sessionId={sessionId} />
    </PageShell>
  );
}

function DesktopVerdictHeader({
  practiceHref,
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
  practiceHref: string;
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
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:p-5"
      data-session-verdict
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Badge variant="secondary">
          {verdict.label} · {confidence}
        </Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
      <dl className="grid gap-3 border-y py-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Date", date],
          ["Source", source],
          ["Clubs", clubs],
          ["Linked plan", linkedPlan],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm leading-6">{nextAction}</p>
        <Button asChild className="min-h-11">
          <Link href={practiceHref}>Build next plan</Link>
        </Button>
      </div>
    </section>
  );
}

function BaselineSources({ data }: { data: Awaited<ReturnType<typeof getTodayPracticeData>> }) {
  const rows = data.previousComparisonShots ?? [];
  const sources = [...new Map(rows.map((shot) => [shot.sessionId, shot])).values()];
  return (
    <details className="rounded-lg border p-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
        Comparison baseline sources
      </summary>
      <p className="text-sm leading-6 text-muted-foreground">
        Current period: {data.dateLabel}. Earlier clean full-shot samples are matched by club; a
        small or missing baseline is not a performance diagnosis.
      </p>
      {sources.length ? (
        <ul className="mt-2 divide-y">
          {sources.map((shot) => (
            <li key={shot.sessionId}>
              <Link
                href={`/sessions/${shot.sessionId}`}
                className="flex min-h-11 flex-wrap items-center gap-2 py-2 text-sm text-primary underline"
              >
                {shot.fileName ?? "Earlier session"} ·{" "}
                {new Date(shot.shotAt).toLocaleDateString("en-GB", { timeZone: "UTC" })} ·{" "}
                {rows.filter((row) => row.sessionId === shot.sessionId).length} baseline shots
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No earlier comparable source sessions available.
        </p>
      )}
    </details>
  );
}

function WhatHappened({
  sessionId,
  improved,
  remaining,
  bestClub,
  pattern,
}: {
  sessionId: string;
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
      label: remaining?.verdict === "worse" ? "Remaining weakness" : "Next focus",
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
            <Link
              href={`/shots?sessionId=${sessionId}`}
              className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline"
            >
              Review supporting shots
            </Link>
          </div>
        ))}
      </Card>
    </section>
  );
}

function PlanVersusActual({
  plan,
  review,
  sessionId,
}: {
  plan: NonNullable<Awaited<ReturnType<typeof getPracticePlanForSourceSessions>>>;
  review: Awaited<ReturnType<typeof getPracticePlanReviewForSourceSession>>;
  sessionId: string;
}) {
  const measured = Boolean(review?.comparison?.decisions.length);
  return (
    <section className="grid min-w-0 gap-3" aria-label="Plan versus actual" data-plan-versus-actual>
      <h2 className="text-xl font-semibold">Plan vs actual</h2>
      <p className="text-sm text-muted-foreground">
        {plan.title} · {plan.blocks.length} prescribed blocks. Guided completion is separate from
        imported target evidence.
      </p>
      <ol className="divide-y rounded-xl border bg-card">
        {plan.blocks.map((block, index) => (
          <li key={block.id} className="p-3">
            <p className="font-medium">
              {index + 1}. {block.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {block.ballCount ?? "Unspecified"} planned balls ·{" "}
              {block.clubs.map(formatClubType).join(", ") || "No club prescribed"}
            </p>
          </li>
        ))}
      </ol>
      {measured && review ? (
        <ImportPracticeReview review={review} sessionId={sessionId} source="session" />
      ) : (
        <div className="rounded-lg border p-4">
          <p className="text-sm leading-6">
            No imported block result is available yet. Recorded practice does not establish that a
            measured target passed.
          </p>
          <Button asChild variant="outline" className="mt-3 min-h-11">
            <Link href={`/import?practicePlanId=${plan.id}`}>Add measured evidence</Link>
          </Button>
        </div>
      )}
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
                <TableHead className="text-right">Carry (yd)</TableHead>
                <TableHead className="text-right">Offline (yd)</TableHead>
                <TableHead className="text-right">Playable (%)</TableHead>
                <TableHead className="text-right">Ball speed (mph)</TableHead>
                <TableHead className="text-right">Carry spread (yd)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((comparison) => (
                <TableRow key={comparison.clubType}>
                  <TableCell className="font-semibold">{comparison.clubLabel}</TableCell>
                  <TableCell>
                    {comparison.today.shotCount < 5 ? (
                      <Badge variant="outline">Small sample</Badge>
                    ) : (
                      <VerdictBadge verdict={comparison.verdict} />
                    )}
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
                  <TableCell className="text-right tabular-nums">
                    {comparison.today.ballSpeedAverageMph?.toFixed(1) ?? "Unavailable"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {comparison.today.carryRobustStdDevYd?.toFixed(1) ?? "Unavailable"}
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
