import { getPostRoundReviewData } from "@/lib/post-round-review-data";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CloudSun, Flag, MapPinned, Sparkles } from "lucide-react";

import { DataWarning, RecommendedAction } from "@/components/app/evidence-status";
import { PageHeader, PageShell, StatusPill, type Tone } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { PostRoundResults } from "@/app/courses/strategy/post-round-results";
import { PostRoundReviewForm } from "@/app/courses/strategy/post-round-review-form";
import {
  StrategyContextFields,
  StrategyCourseSelection,
  StrategyModeNavigation,
} from "@/app/courses/strategy/strategy-navigation";
import { DigitalCaddieBook } from "@/app/courses/strategy/digital-caddie-book";
import { getDashboardData } from "@/app/dashboard/dashboard-data";
import { getCourseStrategyData } from "@/lib/course-strategy-data";
import { courseStrategyMapFromManifest } from "@/lib/course-strategy-map";
import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function CourseStrategyPage({
  searchParams,
}: {
  searchParams?: Promise<{
    mode?: string;
    courseId?: string;
    teeSetId?: string;
    roundId?: string;
    saved?: string;
  }>;
}) {
  const params = await searchParams;
  const mode = params?.mode === "post" ? "post" : "pre";
  const userId = await requireCurrentUserId();
  const [data, strategyData, postRoundData] = await Promise.all([
    getDashboardData(),
    getCourseStrategyData(params?.courseId, params?.teeSetId, "latest-reliable"),
    getPostRoundReviewData(params?.roundId),
  ]);
  const courseTwinManifest = strategyData.selectedCourse
    ? await getCourseTwinManifest({ userId, courseId: strategyData.selectedCourse.id })
    : null;
  const courseMap = courseStrategyMapFromManifest(courseTwinManifest);

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
          <StrategyModeNavigation
            mode={mode}
            courseId={strategyData.selectedCourse?.id}
            teeSetId={strategyData.selectedTee?.id}
          />
        }
      />

      {mode === "pre" ? (
        <div className="grid gap-3" data-course-strategy-plan>
          <StrategyCourseSelection
            key={`${strategyData.selectedCourse?.id}-${strategyData.selectedTee?.id}`}
            courses={strategyData.courseOptions}
            tees={strategyData.teeOptions}
            courseId={strategyData.selectedCourse?.id}
            teeSetId={strategyData.selectedTee?.id}
          />
          {strategyData.selectedCourse && strategyData.strategies.length ? (
            <DigitalCaddieBook
              strategies={strategyData.strategies}
              course={strategyData.selectedCourse}
              teeName={strategyData.selectedTee?.name}
              teeSetId={strategyData.selectedTee?.id}
              courseTwinAvailable={Boolean(courseTwinManifest)}
              courseMap={courseMap}
            />
          ) : (
            <Alert>
              <MapPinned aria-hidden="true" />
              <AlertTitle>Course strategy needs more evidence</AlertTitle>
              <AlertDescription>
                This course needs a tee set with mapped holes and trusted bag numbers before a hole
                plan can be produced.
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      {mode === "pre" ? (
        <div className="grid gap-4">
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
                  Modelled plays-like conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  {data.playsLike.summary} Confirm actual conditions on the course before using
                  these estimates.
                </p>
                <div className="mt-4 grid divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {data.playsLike.rows.slice(0, 3).map((row) => (
                    <div key={`${row.clubId}-${row.baseYards}`} className="bg-muted/35 p-3">
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
            href={`/rounds/new?${new URLSearchParams({
              ...(strategyData.selectedCourse ? { courseId: strategyData.selectedCourse.id } : {}),
              ...(strategyData.selectedTee ? { teeSetId: strategyData.selectedTee.id } : {}),
            })}`}
            actionLabel="Prepare round"
          />
        </div>
      ) : (
        <div className="grid gap-4">
          <Card data-course-strategy-post-round>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">Guided post-round review</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">
                  Separate what you felt from what the shots show
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Your answers are saved as context. Lateral-control readings use connected measured
                  shots; they do not determine which club cost you the most strokes.
                </p>
              </div>
              <form action="/courses/strategy" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="mode" value="post" />
                <StrategyContextFields
                  courseId={strategyData.selectedCourse?.id}
                  teeSetId={strategyData.selectedTee?.id}
                />
                <label className="grid gap-1 text-sm font-semibold">
                  Round to review
                  <select
                    name="roundId"
                    defaultValue={postRoundData.selectedRound?.id ?? ""}
                    className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base"
                  >
                    <option value="" disabled>
                      Choose a completed round
                    </option>
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
            </CardHeader>

            <CardContent className="grid gap-4">
              {postRoundData.selectedRound ? (
                <>
                  {params?.saved === "1" ? (
                    <Alert className="border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]">
                      <CheckCircle2 aria-hidden="true" />
                      <AlertTitle>Review context saved</AlertTitle>
                      <AlertDescription className="text-[var(--status-success-foreground)]">
                        The answers are attached to this round.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <PostRoundReviewForm key={postRoundData.selectedRound.id}>
                    <input type="hidden" name="sessionId" value={postRoundData.selectedRound.id} />
                    <StrategyContextFields
                      courseId={strategyData.selectedCourse?.id}
                      teeSetId={strategyData.selectedTee?.id}
                    />
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
                        Manual answers explain the context; they never improve or reduce the
                        measured performance score.
                      </p>
                      <Button type="submit" className="min-h-11 rounded-xl">
                        Save review context
                      </Button>
                    </div>
                  </PostRoundReviewForm>
                </>
              ) : (
                <Alert>
                  <Flag aria-hidden="true" />
                  <AlertTitle>
                    {params?.roundId
                      ? "This completed round is unavailable"
                      : "No completed round yet"}
                  </AlertTitle>
                  <AlertDescription>
                    {params?.roundId
                      ? "Choose one of your completed rounds to continue."
                      : "Add a scorecard first, then return here for the evidence review."}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {postRoundData.selectedRound ? (
            <PostRoundResults
              review={postRoundData.review}
              roundId={postRoundData.selectedRound.id}
            />
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
      <Textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={3}
        maxLength={600}
        className="min-h-24 resize-y font-normal leading-6"
      />
    </label>
  );
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
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
