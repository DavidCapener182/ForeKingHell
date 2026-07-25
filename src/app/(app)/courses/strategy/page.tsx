import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CloudSun,
  Flag,
  GitCompareArrows,
  MapPinned,
  Sparkles,
  Target,
} from "lucide-react";
import { and, asc, desc, eq, lt } from "drizzle-orm";

import { DataWarning, RecommendedAction } from "@/components/app/evidence-status";
import { PageHeader, PageShell, StatusPill, type Tone } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { savePostRoundReviewAction } from "@/app/courses/strategy/actions";
import { getDashboardData } from "@/app/dashboard/dashboard-data";
import { getDb } from "@/db/client";
import {
  clubs,
  courseFeatures,
  courses,
  holes,
  sessions,
  shots,
  stockYardages,
  teeSets,
} from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import { buildHoleStrategies } from "@/lib/course-strategy";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildPostRoundReview, readStoredPostRoundReview } from "@/lib/post-round-review";

export const dynamic = "force-dynamic";

export default async function CourseStrategyPage({
  searchParams,
}: {
  searchParams?: Promise<{
    mode?: string;
    courseId?: string;
    roundId?: string;
    saved?: string;
  }>;
}) {
  const params = await searchParams;
  const mode = params?.mode === "post" ? "post" : "pre";
  const [data, strategyData, postRoundData] = await Promise.all([
    getDashboardData(),
    getCourseStrategyData(params?.courseId),
    getPostRoundReviewData(params?.roundId),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Course strategy</StatusPill>}
        title={
          mode === "pre"
            ? "Prepare the decisions before you play"
            : "Turn the round into the next decision"
        }
        description={
          mode === "pre"
            ? "Use trusted bag numbers and available conditions to choose pressure clubs without pretending the app knows the exact pin or lie."
            : "Add the scorecard and measured evidence, then review where the plan held up and where it changed."
        }
        actions={
          <div className="flex rounded-xl border border-border bg-card p-1">
            <ModeLink href="/courses/strategy" active={mode === "pre"}>
              Pre-round
            </ModeLink>
            <ModeLink href="/courses/strategy?mode=post" active={mode === "post"}>
              Post-round
            </ModeLink>
          </div>
        }
      />

      <section
        className="grid gap-4 rounded-2xl border bg-card p-4"
        aria-labelledby="hole-strategy-title"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Hole-by-hole plan</p>
            <h2 id="hole-strategy-title" className="mt-1 font-display text-2xl font-semibold">
              {strategyData.selectedCourse?.name ?? "Choose a mapped course"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bag ranges, measured miss direction and mapped course hazards. Recommendations are
              historical guidance, not certainty.
            </p>
          </div>
          <form action="/courses/strategy" className="flex flex-wrap gap-2">
            <input type="hidden" name="mode" value={mode} />
            <label className="grid gap-1 text-sm font-semibold">
              Course
              <select
                name="courseId"
                defaultValue={strategyData.selectedCourse?.id ?? ""}
                className="min-h-11 min-w-64 rounded-xl border bg-background px-3"
              >
                {strategyData.courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" className="min-h-11 self-end">
              Load strategy
            </Button>
          </form>
        </div>
        {strategyData.strategies.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {strategyData.strategies.map((strategy) => (
              <article key={strategy.holeNumber} className="rounded-2xl border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Hole {strategy.holeNumber} · Par {strategy.par} · {strategy.yards} yd
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">{strategy.recommendedClub}</h3>
                  </div>
                  <StatusPill
                    tone={
                      strategy.confidence === "High"
                        ? "green"
                        : strategy.confidence === "Moderate"
                          ? "sky"
                          : "amber"
                    }
                  >
                    {strategy.confidence} confidence
                  </StatusPill>
                </div>
                <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                  <StrategyDetail label="Expected carry" value={strategy.expectedCarryRange} />
                  <StrategyDetail label="Expected leave" value={strategy.expectedLeave} />
                  <StrategyDetail label="Common miss" value={strategy.commonMiss} />
                  <StrategyDetail label="Safe target" value={strategy.safeTarget} />
                </dl>
                <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    Planned clubs
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">First shot</p>
                      <p className="font-semibold">
                        {strategy.recommendedClub}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {strategy.expectedCarryRange}
                        </span>
                      </p>
                    </div>
                    {strategy.followUpClubs.length ? (
                      <>
                        <ArrowRight
                          className="hidden size-4 shrink-0 text-primary sm:block"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {strategy.followUpClubs.length > 1
                              ? "Follow-up shots"
                              : "Club for the leave"}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                            {strategy.followUpClubs.map((club, index) => (
                              <span
                                key={`${strategy.holeNumber}-${club.label}-${index}`}
                                className="inline-flex items-center gap-2"
                              >
                                {index > 0 ? (
                                  <ArrowRight className="size-3.5 text-primary" aria-hidden />
                                ) : null}
                                <span>
                                  {club.label}
                                  <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {club.expectedCarryRange}
                                  </span>
                                </span>
                              </span>
                            ))}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {strategy.followUpClubs.length > 1
                              ? `Combined ${strategy.followUpTotalRange} · `
                              : ""}
                            {strategy.followUpFit}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {strategy.expectedLeaveYd && strategy.expectedLeaveYd > 0
                            ? "Short-game finish"
                            : "No next club needed"}
                        </p>
                        {strategy.expectedLeaveYd && strategy.expectedLeaveYd > 0 ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {strategy.expectedLeaveYd} yd remains — choose the club from the live
                            lie.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="rounded-xl bg-amber-50 p-3 text-amber-950">
                    <span className="font-semibold">Hazard check: </span>
                    {strategy.hazardWarning}
                  </p>
                  <p className="rounded-xl bg-secondary/55 p-3">
                    <span className="font-semibold">Conservative alternative: </span>
                    {strategy.conservativeAlternative}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">{strategy.caveat}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            This course needs a tee set with mapped holes and trusted bag numbers before a hole plan
            can be produced.
          </div>
        )}
      </section>

      {mode === "pre" ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.courseAdvice.map((item) => (
              <Card key={item.key} className="premium-card">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {item.label}
                      </p>
                      <CardTitle className="mt-2 text-xl">{item.value}</CardTitle>
                    </div>
                    <StatusPill tone={item.tone as Tone}>
                      {item.playNumberYd ? `${Math.round(item.playNumberYd)} yd` : "Build evidence"}
                    </StatusPill>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  {item.clubId ? (
                    <Link
                      href={`/bag/${item.clubId}`}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
                    >
                      Open club evidence
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CloudSun className="size-5 text-primary" aria-hidden />
                  Plays-like conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{data.playsLike.summary}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {data.playsLike.rows.slice(0, 3).map((row) => (
                    <div
                      key={`${row.clubId}-${row.baseYards}`}
                      className="rounded-2xl bg-secondary/55 p-3"
                    >
                      <p className="font-semibold">{row.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {Math.round(row.playsLikeYards)} yd
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stock {Math.round(row.baseYards)} yd
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <DataWarning
              title="A plan is not a live caddie"
              detail="Confirm the actual lie, wind, elevation, hazards and pin on the course. Low-confidence stock numbers stay excluded from pressure recommendations."
            />
          </section>

          <RecommendedAction
            title="Save the round context"
            detail="Add the course, tees and conditions before play so the post-round review can separate the plan from the outcome."
            href="/rounds/new"
            actionLabel="Prepare round"
          />
        </>
      ) : (
        <div className="grid gap-4">
          <section className="grid gap-4 rounded-2xl border bg-card p-4 lg:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">Guided post-round review</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">
                  Separate what you felt from what the shots show
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Your answers are saved as context. Strongest club, costly club and the practice
                  recommendation are calculated only from connected measured shots.
                </p>
              </div>
              <form action="/courses/strategy" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="mode" value="post" />
                <label className="grid gap-1 text-sm font-semibold">
                  Round to review
                  <select
                    name="roundId"
                    defaultValue={postRoundData.selectedRound?.id ?? ""}
                    className="min-h-11 min-w-64 rounded-xl border bg-background px-3"
                  >
                    {postRoundData.rounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.courseName ?? "Recorded round"} · {shortDate(round.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="outline" className="min-h-11">
                  Load round
                </Button>
              </form>
            </div>

            {postRoundData.selectedRound ? (
              <>
                {params?.saved === "1" ? (
                  <p className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Review context saved to this round.
                  </p>
                ) : null}
                <form action={savePostRoundReviewAction} className="grid gap-4">
                  <input type="hidden" name="sessionId" value={postRoundData.selectedRound.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <ReviewQuestion
                      label="What felt different?"
                      name="feltDifferent"
                      defaultValue={postRoundData.answers.feltDifferent}
                      placeholder="Tempo, strike, start line or confidence…"
                    />
                    <ReviewQuestion
                      label="Which club caused trouble?"
                      name="troubleClub"
                      defaultValue={postRoundData.answers.troubleClub}
                      placeholder="Club and the decision or miss you noticed…"
                    />
                    <ReviewQuestion
                      label="Did equipment or weather change?"
                      name="contextChange"
                      defaultValue={postRoundData.answers.contextChange}
                      placeholder="Ball, club setting, wind, rain, surface or temperature…"
                    />
                    <ReviewQuestion
                      label="Which shots should be reviewed?"
                      name="shotsToReview"
                      defaultValue={postRoundData.answers.shotsToReview}
                      placeholder="Hole and shot numbers, or the decision to revisit…"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-muted-foreground">
                      Manual answers explain the context; they never improve or reduce the measured
                      performance score.
                    </p>
                    <Button type="submit" className="min-h-11 rounded-xl">
                      Save review context
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                No completed round is available yet. Add a scorecard first, then return here for the
                evidence review.
              </div>
            )}
          </section>

          {postRoundData.selectedRound ? (
            <section className="grid gap-4" aria-labelledby="post-round-results-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Answer</p>
                  <h2
                    id="post-round-results-title"
                    className="mt-1 font-display text-2xl font-semibold"
                  >
                    What the round changed
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {postRoundData.scoreLabel} · {postRoundData.review.evidence}
                  </p>
                </div>
                <StatusPill
                  tone={
                    postRoundData.review.confidence === "High"
                      ? "green"
                      : postRoundData.review.confidence === "Moderate"
                        ? "sky"
                        : "amber"
                  }
                >
                  {postRoundData.review.confidence} confidence
                </StatusPill>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <RoundResultCard
                  label="Strongest club"
                  value={postRoundData.review.strongest.value}
                  detail={postRoundData.review.strongest.detail}
                  tone="green"
                />
                <RoundResultCard
                  label="Most costly club"
                  value={postRoundData.review.mostCostly.value}
                  detail={postRoundData.review.mostCostly.detail}
                  tone="amber"
                />
                <RoundResultCard
                  label="Biggest difference"
                  value={postRoundData.review.biggestDifference.value}
                  detail={postRoundData.review.biggestDifference.detail}
                  tone="sky"
                />
                <RoundResultCard
                  label="Practice recommendation"
                  value={postRoundData.review.practiceRecommendation.value}
                  detail={postRoundData.review.practiceRecommendation.detail}
                  tone="green"
                />
              </div>
              <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4">
                <Button asChild className="min-h-11 rounded-xl">
                  <Link href="/practice" prefetch={false}>
                    <Target className="size-4" aria-hidden />
                    Build recommended practice
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 rounded-xl">
                  <Link
                    href={`/analyse/compare?sessionId=${postRoundData.selectedRound.id}`}
                    prefetch={false}
                  >
                    <GitCompareArrows className="size-4" aria-hidden />
                    Compare with another session
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 rounded-xl">
                  <Link href={`/rounds/${postRoundData.selectedRound.id}`} prefetch={false}>
                    Review scorecard and shots
                  </Link>
                </Button>
              </div>
              {postRoundData.review.confidence === "Low" ? (
                <DataWarning
                  title="Treat this as a provisional read"
                  detail="Fewer than ten measured shots met the club-sample rule. The manual review is saved, but the app will not pretend it has a dependable performance verdict yet."
                />
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-3" aria-label="Post-round setup steps">
            <ReviewStep
              icon={Flag}
              title="Add the scorecard"
              detail="Record scores, penalties, tees and conditions without changing the imported shot evidence."
              href="/rounds/new"
              action="Add round"
            />
            <ReviewStep
              icon={MapPinned}
              title="Connect measured shots"
              detail="Import launch-monitor or simulator evidence and confirm how it maps to the round."
              href="/import"
              action="Import evidence"
            />
            <ReviewStep
              icon={Sparkles}
              title="Continue the improvement loop"
              detail="Track whether the recommended practice changes the next comparable session."
              href="/progress"
              action="Open Progress"
            />
          </section>
        </div>
      )}
    </PageShell>
  );
}

function StrategyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/45 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function ReviewQuestion({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={3}
        maxLength={600}
        className="min-h-24 resize-y rounded-xl border bg-background px-3 py-2 font-normal leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function RoundResultCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "sky";
}) {
  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <StatusPill tone={tone}>{tone === "amber" ? "Watch" : "Measured"}</StatusPill>
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </article>
  );
}

async function getPostRoundReviewData(requestedRoundId?: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const rounds = await db
    .select({
      id: sessions.id,
      date: sessions.date,
      courseName: sessions.courseName,
      notes: sessions.notes,
      scorecard: sessions.scorecardJson,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.type, "real_round")))
    .orderBy(desc(sessions.date))
    .limit(30);
  const selectedRound = rounds.find((round) => round.id === requestedRoundId) ?? rounds[0] ?? null;
  if (!selectedRound) {
    return {
      rounds,
      selectedRound,
      answers: readStoredPostRoundReview(null),
      review: buildPostRoundReview({ currentShots: [], baselineShots: [] }),
      scoreLabel: "No scorecard selected",
    };
  }

  const [currentShots, baselineShots] = await Promise.all([
    db
      .select({
        clubId: shots.clubId,
        clubType: shots.clubType,
        carryYd: shots.carryYd,
        sideYd: shots.sideCarryYd,
      })
      .from(shots)
      .where(and(eq(shots.userId, userId), eq(shots.sessionId, selectedRound.id)))
      .orderBy(asc(shots.shotAt)),
    db
      .select({
        clubId: shots.clubId,
        clubType: shots.clubType,
        carryYd: shots.carryYd,
        sideYd: shots.sideCarryYd,
      })
      .from(shots)
      .innerJoin(sessions, and(eq(sessions.id, shots.sessionId), eq(sessions.userId, userId)))
      .where(and(eq(shots.userId, userId), lt(sessions.date, selectedRound.date)))
      .orderBy(desc(shots.shotAt))
      .limit(2_000),
  ]);

  return {
    rounds,
    selectedRound,
    answers: readStoredPostRoundReview(selectedRound.notes),
    review: buildPostRoundReview({ currentShots, baselineShots }),
    scoreLabel: roundScoreLabel(selectedRound.scorecard),
  };
}

function roundScoreLabel(scorecard: Array<{ score?: number | null; par: number }> | null) {
  const completed = (scorecard ?? []).filter((hole) => typeof hole.score === "number");
  if (!completed.length) return "Scorecard has no completed holes";
  const score = completed.reduce((total, hole) => total + (hole.score ?? 0), 0);
  const par = completed.reduce((total, hole) => total + hole.par, 0);
  const relative = score - par;
  return `${score} (${relative === 0 ? "E" : `${relative > 0 ? "+" : ""}${relative}`}) across ${completed.length} holes`;
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

async function getCourseStrategyData(requestedCourseId?: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const courseOptions = await db
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .orderBy(asc(courses.name))
    .limit(80);
  const selectedCourse =
    courseOptions.find((course) => course.id === requestedCourseId) ?? courseOptions[0] ?? null;
  if (!selectedCourse) return { courseOptions, selectedCourse, strategies: [] };
  const [teeRows, featureRows, stockRows] = await Promise.all([
    db
      .select()
      .from(teeSets)
      .where(eq(teeSets.courseId, selectedCourse.id))
      .orderBy(asc(teeSets.yards))
      .limit(8),
    db
      .select({ holeNumber: courseFeatures.holeNumber, featureType: courseFeatures.featureType })
      .from(courseFeatures)
      .where(eq(courseFeatures.courseId, selectedCourse.id)),
    db
      .select({
        clubId: clubs.id,
        type: clubs.type,
        sampleSize: stockYardages.sampleSize,
        carry: stockYardages.carryMedianYd,
        p25: stockYardages.carryP25Yd,
        p75: stockYardages.carryP75Yd,
        left: stockYardages.dispersionLeftYd,
        right: stockYardages.dispersionRightYd,
        confidence: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .innerJoin(clubs, and(eq(clubs.id, stockYardages.clubId), eq(clubs.userId, userId)))
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt)),
  ]);
  const selectedTee = teeRows[0];
  if (!selectedTee) return { courseOptions, selectedCourse, strategies: [] };
  const holeRows = await db
    .select({ holeNumber: holes.holeNumber, par: holes.par, yards: holes.yards })
    .from(holes)
    .where(eq(holes.teeSetId, selectedTee.id))
    .orderBy(asc(holes.holeNumber));
  const latestStocks = [
    ...new Map(
      stockRows.filter((row) => row.carry !== null).map((row) => [row.clubId, row] as const),
    ).values(),
  ];
  const hazardsByHole = new Map<number, string[]>();
  for (const feature of featureRows) {
    if (feature.holeNumber === null) continue;
    hazardsByHole.set(feature.holeNumber, [
      ...(hazardsByHole.get(feature.holeNumber) ?? []),
      feature.featureType,
    ]);
  }
  return {
    courseOptions,
    selectedCourse,
    strategies: buildHoleStrategies({
      holes: holeRows,
      hazardsByHole,
      clubs: latestStocks.map((row) => ({
        clubId: row.clubId,
        clubType: row.type,
        label: formatClubType(row.type),
        carryYd: row.carry!,
        minCarryYd: row.p25 ?? row.carry! * 0.94,
        maxCarryYd: row.p75 ?? row.carry! * 1.04,
        leftYd: Math.abs(row.left ?? 0),
        rightYd: Math.abs(row.right ?? 0),
        confidence: (row.confidence ?? 0) > 1 ? (row.confidence ?? 0) / 100 : (row.confidence ?? 0),
        sampleSize: row.sampleSize,
      })),
    }),
  };
}

function ModeLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          : "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

function ReviewStep({
  icon: Icon,
  title,
  detail,
  href,
  action,
}: {
  icon: typeof Flag;
  title: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <Card className="premium-card">
      <CardContent className="pt-5">
        <Icon className="size-6 text-primary" aria-hidden />
        <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        <Button asChild variant="outline" className="mt-5 min-h-11 w-full rounded-xl">
          <Link href={href}>
            {action}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
