import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { and, asc, countDistinct, desc, eq, gt, inArray, or } from "drizzle-orm";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  CloudSun,
  Cuboid,
  Flag,
  Gauge,
  MapPinned,
  ShieldCheck,
  Target,
  Wind,
} from "lucide-react";

import { LazyPlaySetupDrawer } from "@/app/play/lazy-play-setup-drawer";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { IOSSectionHeader } from "@/components/app/ios-mobile";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import styles from "@/components/app/mobile-companion.module.css";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { courses, holes, sessions, teeSets, weatherSnapshots } from "@/db/schema";
import { getCourseStrategyData } from "@/lib/course-strategy-data";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  activeRoundStrategy,
  companionCourseReadiness,
  findInProgressRound,
  selectCompanionTee,
} from "@/lib/play-companion-state";
import { SELECTED_COURSE_COOKIE, SELECTED_TEE_COOKIE } from "@/lib/selected-course";

export const dynamic = "force-dynamic";

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PlayCompanionPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const [params, cookieStore, twins, availableCourses, activeRound] = await Promise.all([
    searchParams,
    cookies(),
    listAvailableCourseTwins(userId),
    getPlayCourses(userId),
    getInProgressRound(userId),
  ]);
  const requestedCourseId = params.courseId ?? cookieStore.get(SELECTED_COURSE_COOKIE)?.value;
  const fallbackRecentRound = await getMostRecentRound(
    userId,
    requestedCourseId ?? activeRound?.courseId ?? null,
  );
  const selectedCourseId =
    activeRound?.courseId ??
    (requestedCourseId && availableCourses.some((course) => course.id === requestedCourseId)
      ? requestedCourseId
      : null) ??
    fallbackRecentRound?.courseId ??
    availableCourses[0]?.id ??
    null;
  const selected = availableCourses.find((course) => course.id === selectedCourseId) ?? null;
  const tees = selected ? await getCourseTees(selected.id) : [];
  const savedTeeId = cookieStore.get(SELECTED_TEE_COOKIE)?.value;
  const selectedTee = selectCompanionTee({
    tees,
    activeRoundTeeId: activeRound?.teeSetId,
    explicitTeeId: savedTeeId,
    recentRoundTeeId: fallbackRecentRound?.teeSetId,
  });
  const teeIsDefault = Boolean(
    selectedTee &&
    selectedTee.id !== activeRound?.teeSetId &&
    selectedTee.id !== savedTeeId &&
    selectedTee.id !== fallbackRecentRound?.teeSetId,
  );
  const twin = twins.find((course) => course.courseId === selected?.id) ?? null;
  const { strategyReady: mappedStrategyReady } = companionCourseReadiness({
    holeCount: selected?.holeCount ?? 0,
    teeCount: tees.length,
    courseTwinAvailable: Boolean(twin),
  });
  const [strategyData, cachedWeather, recentCourseRounds] = selected
    ? await Promise.all([
        getCourseStrategyData(selected.id, selectedTee?.id, "latest-reliable"),
        getCachedCourseWeather(userId, selected.id),
        getRecentCourseRounds(userId, selected.id),
      ])
    : [null, null, []];
  const trustedBagReady = Boolean(strategyData?.trustedBag.some((club) => club.sampleSize >= 5));
  const weatherLabel = formatWeather(cachedWeather?.conditionsJson);
  const lastPlayed = recentCourseRounds[0]?.date ?? null;
  const trustedClubs =
    strategyData?.trustedBag
      .filter((club) => club.sampleSize >= 5)
      .sort(
        (left, right) => right.confidence - left.confidence || right.sampleSize - left.sampleSize,
      )
      .slice(0, 4) ?? [];
  const strategies = strategyData?.strategies ?? [];
  const strategyReady =
    mappedStrategyReady &&
    trustedClubs.length > 0 &&
    strategies.some((strategy) => strategy.recommendedClub !== "Build bag evidence");
  const actionableStrategies = strategyReady
    ? strategies.filter((strategy) => strategy.recommendedClub !== "Build bag evidence")
    : [];
  const firstPlan = actionableStrategies[0] ?? null;
  const keyHoles = [...actionableStrategies]
    .sort((left, right) => right.yards - left.yards)
    .slice(0, 3);
  const commonMiss = mostCommonMiss(actionableStrategies.map((strategy) => strategy.commonMiss));
  const readiness = [
    { label: "Course selected", ready: Boolean(selected) },
    { label: "Tee selected", ready: Boolean(selectedTee) },
    { label: "Trusted bag available", ready: trustedBagReady },
    { label: "Strategy ready", ready: strategyReady },
    { label: "Course Twin mapped", ready: Boolean(twin) },
  ];
  const strategyHref = selected
    ? `/courses/strategy?courseId=${selected.id}${selectedTee ? `&teeSetId=${selectedTee.id}` : ""}`
    : "/courses/strategy";
  const startRoundHref = selected
    ? `/rounds/new?courseId=${selected.id}${selectedTee ? `&teeSetId=${selectedTee.id}` : ""}`
    : "/rounds/new";
  const twinHref = twin ? `/play/${twin.courseId}?mode=strategy` : "/course-twins";
  const selectionProps = {
    courses: availableCourses.map((course) => ({
      id: course.id,
      name: course.name,
      detail: `${course.holeCount} mapped holes`,
    })),
    tees: tees.map((tee) => ({
      id: tee.id,
      name: tee.name,
      detail: tee.yards ? `${tee.yards.toLocaleString("en-GB")} yd` : undefined,
    })),
    selectedCourseId: selected?.id ?? null,
    selectedTeeId: selectedTee?.id ?? null,
  };

  return (
    <PageShell contentClassName="lg:gap-6">
      <MobileAppShell className="gap-4" data-play-companion-hub>
        <MobileLargeTitle title="Play" />

        {activeRound ? (
          <ActiveRoundMobile round={activeRound} />
        ) : selected ? (
          <>
            <SelectedCourseMobile
              course={selected}
              tee={selectedTee}
              teeIsDefault={teeIsDefault}
              strategyReady={strategyReady}
              twinGrade={twin?.grade ?? null}
              lastPlayed={lastPlayed}
              weatherLabel={weatherLabel}
              strategyHref={strategyHref}
              twinHref={twinHref}
              startRoundHref={startRoundHref}
            />

            <section className="grid gap-2.5" data-course-prep>
              {!strategyReady ? (
                <>
                  <IOSSectionHeader title="Finish course setup" />
                  <ReadinessPanel
                    items={readiness.filter(
                      (item) => !item.ready && item.label !== "Course Twin mapped",
                    )}
                  />
                </>
              ) : null}
              <LazyPlaySetupDrawer {...selectionProps} />
            </section>
          </>
        ) : (
          <PlayEmptyState />
        )}
        <MobileSection
          title="Rounds"
          action={
            <Link href="/rounds" className="flex min-h-11 items-center text-sm text-primary">
              See all
            </Link>
          }
        >
          <MobileGroupedList label="Recent rounds">
            {recentCourseRounds.slice(0, 3).map((round) => (
              <MobileListRow
                key={round.id}
                href={`/rounds/${round.id}`}
                label={selected?.name ?? "Round"}
                detail={shortDateFormatter.format(round.date)}
                value={summarizeScorecard(round.scorecardJson).scoreLabel}
                icon={Flag}
              />
            ))}
            {!recentCourseRounds.length ? (
              <MobileListRow
                href="/rounds"
                label="Round history"
                detail="Your scores and course reviews"
                icon={Flag}
              />
            ) : null}
          </MobileGroupedList>
        </MobileSection>
      </MobileAppShell>

      <section className="hidden lg:grid" data-play-desktop-command-centre>
        {activeRound ? (
          <ActiveRoundDesktop round={activeRound} />
        ) : selected ? (
          <DesktopPreRoundCommandCentre
            course={selected}
            tee={selectedTee}
            strategyReady={strategyReady}
            twinGrade={twin?.grade ?? null}
            lastPlayed={lastPlayed}
            weatherLabel={weatherLabel}
            readiness={readiness}
            strategyHref={strategyHref}
            twinHref={twinHref}
            startRoundHref={startRoundHref}
            selectionProps={selectionProps}
            firstPlan={firstPlan}
            keyHoles={keyHoles}
            trustedClubs={trustedClubs}
            commonMiss={commonMiss}
            recentRounds={recentCourseRounds}
          />
        ) : (
          <PlayEmptyState />
        )}
      </section>
    </PageShell>
  );
}

function SelectedCourseMobile({
  course,
  tee,
  teeIsDefault,
  strategyReady,
  twinGrade,
  lastPlayed,
  weatherLabel,
  strategyHref,
  twinHref,
  startRoundHref,
}: {
  course: PlayCourse;
  tee: PlayTee | null;
  teeIsDefault: boolean;
  strategyReady: boolean;
  twinGrade: string | null;
  lastPlayed: Date | null;
  weatherLabel: string | null;
  strategyHref: string;
  twinHref: string;
  startRoundHref: string;
}) {
  return (
    <Card className="overflow-hidden pt-0" data-selected-course>
      <div className={styles.courseHeading}>
        <Flag className="size-7" aria-hidden />
        <p>Selected course</p>
        <h2>{course.name}</h2>
        <span>
          {tee ? `${teeIsDefault ? "Default · " : ""}${tee.name}` : "Tee not selected"}
          {tee?.par ? ` · Par ${tee.par}` : ""}
          {tee?.yards ? ` · ${tee.yards.toLocaleString("en-GB")} yd` : ""}
        </span>
      </div>

      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3" aria-label="Course briefing">
          <BriefingMetric
            label="Strategy"
            value={strategyReady ? "Ready" : "Needs prep"}
            icon={Target}
          />
          <BriefingMetric
            label="Course Twin"
            value={twinGrade ? `Mapped · ${twinGrade}` : "Not mapped"}
            icon={Cuboid}
          />
          <BriefingMetric
            label="Last played"
            value={lastPlayed ? shortDateFormatter.format(lastPlayed) : "No round yet"}
            icon={CalendarDays}
          />
          {weatherLabel ? (
            <BriefingMetric label="Course weather" value={weatherLabel} icon={CloudSun} />
          ) : (
            <BriefingMetric
              label="Playing context"
              value={tee ? `Par ${tee.par}` : "Choose tee"}
              icon={Gauge}
            />
          )}
        </div>
      </CardContent>

      <CardFooter className="grid gap-2 bg-background/80 p-3" data-primary-action>
        <Button asChild className="min-h-12 w-full rounded-xl text-[15px]">
          <Link href={strategyHref}>
            <MapPinned aria-hidden />
            Prepare Course
          </Link>
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button asChild variant="outline" className="min-h-12 rounded-xl px-2 text-xs">
            <Link href={twinHref} aria-label="Open Course Twin">
              <Cuboid aria-hidden />
              Course Twin
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 rounded-xl px-2 text-xs">
            <Link href={startRoundHref}>
              <Flag aria-hidden />
              Start Round
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 rounded-xl px-2 text-xs">
            <Link href="/quick-bag">
              <ShieldCheck aria-hidden />
              Quick Bag
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function ActiveRoundMobile({ round }: { round: ActiveRound }) {
  const summary = summarizeScorecard(round.scorecardJson);
  const scorecard = round.scorecardJson ?? [];
  const { currentHole, href: strategyHref } = activeRoundStrategy(round);

  return (
    <section className={styles.activeRound} data-active-round aria-label="Round in progress">
      <p className="mobile-type-subheadline text-primary">Round in progress · Hole {currentHole}</p>
      <h2 className="mobile-type-title1">{round.courseName ?? "Current round"}</h2>
      <p className="mobile-type-callout text-muted-foreground">
        {round.teeName ?? "Tee not recorded"}
      </p>
      <div className={styles.activeRoundMetrics}>
        <div>
          <strong>{summary.scoreLabel}</strong>
          <span>strokes</span>
        </div>
        <div>
          <strong>{summary.toParLabel}</strong>
          <span>to par</span>
        </div>
        <div>
          <strong>{scorecard.filter((hole) => hole.score != null).length}</strong>
          <span>holes scored</span>
        </div>
      </div>
      <Button asChild className="min-h-12 w-full" data-primary-action>
        <Link href={`/rounds/${round.id}`}>
          <Flag aria-hidden />
          Continue Round
        </Link>
      </Button>
      <div className={styles.activeRoundActions}>
        {strategyHref ? (
          <Button asChild variant="ghost">
            <Link href={strategyHref}>
              <MapPinned aria-hidden />
              Strategy
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link href="/quick-bag">
            <ShieldCheck aria-hidden />
            Quick Bag
          </Link>
        </Button>
      </div>
    </section>
  );
}

function DesktopPreRoundCommandCentre({
  course,
  tee,
  strategyReady,
  twinGrade,
  lastPlayed,
  weatherLabel,
  readiness,
  strategyHref,
  twinHref,
  startRoundHref,
  selectionProps,
  firstPlan,
  keyHoles,
  trustedClubs,
  commonMiss,
  recentRounds,
}: {
  course: PlayCourse;
  tee: PlayTee | null;
  strategyReady: boolean;
  twinGrade: string | null;
  lastPlayed: Date | null;
  weatherLabel: string | null;
  readiness: ReadinessItem[];
  strategyHref: string;
  twinHref: string;
  startRoundHref: string;
  selectionProps: SelectionProps;
  firstPlan: StrategyPlan | null;
  keyHoles: StrategyPlan[];
  trustedClubs: TrustedClub[];
  commonMiss: string;
  recentRounds: RecentCourseRound[];
}) {
  return (
    <div className="grid gap-6">
      <header className="flex items-end justify-between gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Pre-round command centre
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{course.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your caddie briefing for the next round: the course, the decisions and the clubs you can
            trust.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="min-h-11 px-4">
            <Link href="/quick-bag">
              <ShieldCheck aria-hidden />
              Quick Bag
            </Link>
          </Button>
          <Button asChild className="min-h-11 px-5">
            <Link href={strategyHref}>
              <MapPinned aria-hidden />
              Open Strategy
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid min-h-[25rem] gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(22rem,0.7fr)]">
        <Card className="relative min-h-[25rem] overflow-hidden border-0 py-0 text-white ring-0">
          <Image
            src="/assets/generated/course-twin-premium-desktop.webp"
            alt="Aerial golf-hole planning view"
            fill
            sizes="(min-width: 1280px) 68vw, 62vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/25 to-transparent" />
          <div className="relative flex h-full max-w-xl flex-col justify-between p-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                {tee?.name ?? "Tee not selected"}
              </span>
              {tee ? (
                <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  Par {tee.par}
                  {tee.yards ? ` · ${tee.yards.toLocaleString("en-GB")} yd` : ""}
                </span>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                Caddie call
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                {firstPlan
                  ? `Open with ${firstPlan.recommendedClub} and favour ${firstPlan.safeTarget.toLowerCase()}.`
                  : "Finish the course setup before choosing the opening line."}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/70">
                {strategyReady
                  ? `${strategiesReadyLabel(keyHoles.length)} from mapped holes and your measured bag.`
                  : "A mapped tee and trusted bag are required before this briefing is strategy-ready."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden />
                {lastPlayed
                  ? `Last played ${shortDateFormatter.format(lastPlayed)}`
                  : "No round yet"}
              </span>
              {weatherLabel ? (
                <span className="inline-flex items-center gap-2">
                  <Wind className="size-4" aria-hidden />
                  {weatherLabel}
                </span>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Course prep
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Ready for the first tee</h2>
            </div>
            <CardAction>
              <Badge variant={readiness.every((item) => item.ready) ? "default" : "outline"}>
                {readiness.filter((item) => item.ready).length}/5
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ReadinessPanel items={readiness} desktop />
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link href={twinHref}>
                  <Cuboid aria-hidden />
                  Course Twin
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={startRoundHref}>
                  <Flag aria-hidden />
                  Start Round
                </Link>
              </Button>
            </div>
            <LazyPlaySetupDrawer {...selectionProps} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Strategy summary
              </p>
              <h2 className="mt-1 text-xl font-semibold">The opening brief</h2>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <DesktopBrief label="First shot" value={firstPlan?.recommendedClub ?? "Not ready"} />
            <DesktopBrief label="Safe line" value={firstPlan?.safeTarget ?? "Not available"} />
            <DesktopBrief label="Common miss" value={commonMiss} />
            <DesktopBrief
              label="Course Twin"
              value={twinGrade ? `Mapped · Grade ${twinGrade}` : "Not mapped"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Key holes
              </p>
              <h2 className="mt-1 text-xl font-semibold">Longest mapped decisions</h2>
            </div>
          </CardHeader>
          <CardContent>
            {keyHoles.length ? (
              <div className="divide-y divide-border/70">
                {keyHoles.map((hole) => (
                  <div
                    key={hole.holeNumber}
                    className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Hole {hole.holeNumber}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold">
                        Par {hole.par} · {hole.yards} yd
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{hole.recommendedClub}</p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {hole.safeTarget} · {hole.commonMiss}
                      </p>
                    </div>
                    <Badge variant="outline">{hole.confidence}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Finish the selected tee and trusted bag to reveal the holes that need a decision
                before the round.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Bag and record
              </p>
              <h2 className="mt-1 text-xl font-semibold">Trusted clubs</h2>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            {trustedClubs.length ? (
              <div className="grid grid-cols-2 gap-2">
                {trustedClubs.map((club) => (
                  <div key={club.clubId} className="rounded-lg bg-secondary/55 p-3">
                    <p className="font-semibold">{club.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Math.round(club.minCarryYd)}–{Math.round(club.maxCarryYd)} yd
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No trusted measured clubs yet.</p>
            )}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Recent course record
              </p>
              <div className="mt-3 grid gap-2">
                {recentRounds.length ? (
                  recentRounds.map((round) => {
                    const summary = summarizeScorecard(round.scorecardJson);
                    return (
                      <Link
                        key={round.id}
                        href={`/rounds/${round.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-secondary/45 px-3 py-2 transition-colors hover:bg-secondary motion-reduce:transition-none"
                      >
                        <span className="text-sm font-medium">
                          {shortDateFormatter.format(round.date)}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {summary.scoreLabel} · {summary.toParLabel}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No completed course rounds yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActiveRoundDesktop({ round }: { round: ActiveRound }) {
  const summary = summarizeScorecard(round.scorecardJson);

  return (
    <Card className="relative min-h-[34rem] overflow-hidden border-0 bg-slate-950 py-0 text-white ring-0">
      <Image
        src="/assets/generated/course-twin-premium-desktop.webp"
        alt="Aerial golf-hole planning view"
        fill
        sizes="(min-width: 1024px) calc(100vw - 18rem), 1px"
        className="object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/20" />
      <div className="relative flex min-h-[34rem] max-w-3xl flex-col justify-center p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Active round · first priority
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">
          {round.courseName ?? "Current round"}
        </h1>
        <p className="mt-3 text-lg text-white/65">{round.teeName ?? "Tee not recorded"}</p>
        <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-y border-white/10 py-5">
          <DarkMetric label="Progress" value={summary.progressLabel} />
          <DarkMetric label="Score" value={summary.scoreLabel} />
          <DarkMetric label="To par" value={summary.toParLabel} />
        </div>
        <div className="mt-8 flex gap-3">
          <Button asChild className="min-h-12 px-6 text-base">
            <Link href={`/rounds/${round.id}`}>
              <Flag aria-hidden />
              Continue Round
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-12 border-white/20 bg-white/10 px-5 text-white hover:bg-white/15 hover:text-white"
          >
            <Link href="/quick-bag">
              <ShieldCheck aria-hidden />
              Quick Bag
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReadinessPanel({ items, desktop = false }: { items: ReadinessItem[]; desktop?: boolean }) {
  return (
    <ul
      className={
        desktop
          ? "overflow-hidden rounded-xl border border-border/80 bg-secondary/30"
          : "overflow-hidden rounded-xl bg-card"
      }
      aria-label="Course preparation status"
    >
      {items.map((item) => (
        <li
          key={item.label}
          className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 last:border-b-0"
        >
          <span className="text-[15px] font-medium">{item.label}</span>
          <span
            className={
              item.ready
                ? "inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                : "inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
            }
          >
            {item.ready ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <Circle className="size-4" aria-hidden />
            )}
            {item.ready ? "Ready" : "Needed"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BriefingMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Target;
}) {
  return (
    <div className="min-w-0 border-l-2 border-primary/25 pl-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function DesktopBrief({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="max-w-[60%] text-right text-sm font-semibold">{value}</p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-white/50">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PlayEmptyState() {
  return (
    <AppEmptyState
      icon={<MapPinned aria-hidden />}
      title="Choose a course to prepare"
      description="Add or select a mapped course before building the tee, strategy and trusted-bag setup."
      primaryAction={
        <Button asChild className="min-h-11 w-full sm:w-auto">
          <Link href="/courses/new">Add a course</Link>
        </Button>
      }
      secondaryAction={
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link href="/courses">Browse courses</Link>
        </Button>
      }
    />
  );
}

function summarizeScorecard(scorecard: ActiveRound["scorecardJson"]) {
  const holes = Array.isArray(scorecard) ? scorecard : [];
  const scored = holes.filter((hole) => typeof hole.score === "number");
  if (!scored.length) {
    return { progressLabel: "Not started", scoreLabel: "—", toParLabel: "—" };
  }
  const score = scored.reduce((total, hole) => total + (hole.score ?? 0), 0);
  const par = scored.reduce((total, hole) => total + (hole.par ?? 0), 0);
  const toPar = score - par;
  return {
    progressLabel: `${scored.length} hole${scored.length === 1 ? "" : "s"}`,
    scoreLabel: String(score),
    toParLabel: toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : String(toPar),
  };
}

function mostCommonMiss(values: string[]) {
  const measured = values.filter((value) => !value.toLowerCase().includes("no measured"));
  if (!measured.length) return "No measured pattern";
  const counts = new Map<string, number>();
  for (const value of measured) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? measured[0]!;
}

function strategiesReadyLabel(keyHoleCount: number) {
  if (keyHoleCount === 0) return "No key-hole decisions are ready";
  return `${keyHoleCount} key-hole decision${keyHoleCount === 1 ? " is" : "s are"} ready`;
}

function formatWeather(value: Record<string, unknown> | undefined) {
  if (!value) return null;
  const temperature = finiteNumber(value.temperatureC);
  const windSpeed = finiteNumber(value.windSpeedMph);
  const windDirection =
    typeof value.windDirectionLabel === "string" && value.windDirectionLabel.trim()
      ? value.windDirectionLabel.trim()
      : null;
  const parts = [
    temperature === null ? null : `${Math.round(temperature)}°C`,
    windSpeed === null
      ? null
      : `${windDirection ? `${windDirection} ` : ""}${Math.round(windSpeed)} mph`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function finiteNumber(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function getPlayCourses(userId: string) {
  const rows = await getDb()
    .select({ id: courses.id, name: courses.name, holeCount: countDistinct(holes.holeNumber) })
    .from(courses)
    .leftJoin(holes, eq(holes.courseId, courses.id))
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)))
    .groupBy(courses.id, courses.name)
    .orderBy(asc(courses.name));
  return rows.map((row) => ({ ...row, holeCount: Number(row.holeCount ?? 0) }));
}

async function getCourseTees(courseId: string) {
  return getDb()
    .select({ id: teeSets.id, name: teeSets.name, yards: teeSets.yards, par: teeSets.par })
    .from(teeSets)
    .where(eq(teeSets.courseId, courseId))
    .orderBy(asc(teeSets.name));
}

async function getInProgressRound(userId: string) {
  const rounds = await getDb()
    .select({
      id: sessions.id,
      courseId: sessions.courseId,
      teeSetId: sessions.teeSetId,
      courseName: sessions.courseName,
      teeName: teeSets.name,
      roundStatus: sessions.roundStatus,
      date: sessions.date,
      scorecardJson: sessions.scorecardJson,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(teeSets.id, sessions.teeSetId))
    .where(
      and(
        eq(sessions.userId, userId),
        inArray(sessions.type, ["round", "real_round", "simulator", "simulated_course"]),
      ),
    )
    .orderBy(desc(sessions.date))
    .limit(50);
  return findInProgressRound(rounds);
}

async function getMostRecentRound(userId: string, courseId: string | null) {
  const clauses = [
    eq(sessions.userId, userId),
    inArray(sessions.type, ["round", "real_round", "simulator", "simulated_course"]),
  ];
  if (courseId) clauses.push(eq(sessions.courseId, courseId));
  return (
    (
      await getDb()
        .select({ courseId: sessions.courseId, teeSetId: sessions.teeSetId })
        .from(sessions)
        .where(and(...clauses))
        .orderBy(desc(sessions.date))
        .limit(1)
    )[0] ?? null
  );
}

async function getRecentCourseRounds(userId: string, courseId: string) {
  return getDb()
    .select({ id: sessions.id, date: sessions.date, scorecardJson: sessions.scorecardJson })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.courseId, courseId),
        inArray(sessions.type, ["round", "real_round", "simulator", "simulated_course"]),
      ),
    )
    .orderBy(desc(sessions.date))
    .limit(3);
}

async function getCachedCourseWeather(userId: string, courseId: string) {
  return (
    (
      await getDb()
        .select({ conditionsJson: weatherSnapshots.conditionsJson })
        .from(weatherSnapshots)
        .where(
          and(
            eq(weatherSnapshots.userId, userId),
            eq(weatherSnapshots.courseId, courseId),
            gt(weatherSnapshots.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(weatherSnapshots.fetchedAt))
        .limit(1)
    )[0] ?? null
  );
}

type PlayCourse = Awaited<ReturnType<typeof getPlayCourses>>[number];
type PlayTee = Awaited<ReturnType<typeof getCourseTees>>[number];
type ActiveRound = NonNullable<Awaited<ReturnType<typeof getInProgressRound>>>;
type RecentCourseRound = Awaited<ReturnType<typeof getRecentCourseRounds>>[number];
type StrategyData = NonNullable<Awaited<ReturnType<typeof getCourseStrategyData>>>;
type StrategyPlan = StrategyData["strategies"][number];
type TrustedClub = StrategyData["trustedBag"][number];
type ReadinessItem = { label: string; ready: boolean };
type SelectionProps = {
  courses: Array<{ id: string; name: string; detail: string }>;
  tees: Array<{ id: string; name: string; detail: string | undefined }>;
  selectedCourseId: string | null;
  selectedTeeId: string | null;
};
