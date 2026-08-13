import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { and, asc, countDistinct, desc, eq, inArray, or } from "drizzle-orm";
import { Cuboid, Flag, MapPinned, ShieldCheck } from "lucide-react";

import { PlaySelectionControls } from "@/app/play/play-selection-controls";
import { PlaySetupDrawer } from "@/app/play/play-setup-drawer";
import { OperationStepper, type OperationStep } from "@/components/app/operation-stepper";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { getDb } from "@/db/client";
import { courses, holes, sessions, stockYardages, teeSets } from "@/db/schema";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  companionCourseReadiness,
  findInProgressRound,
  selectCompanionTee,
} from "@/lib/play-companion-state";
import { SELECTED_COURSE_COOKIE, SELECTED_TEE_COOKIE } from "@/lib/selected-course";

export const dynamic = "force-dynamic";

export default async function PlayCompanionPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const [params, cookieStore, twins, availableCourses, activeRound, trustedBagCount] =
    await Promise.all([
      searchParams,
      cookies(),
      listAvailableCourseTwins(userId),
      getPlayCourses(userId),
      getInProgressRound(userId),
      getTrustedBagCount(userId),
    ]);
  const requestedCourseId = params.courseId ?? cookieStore.get(SELECTED_COURSE_COOKIE)?.value;
  const recentRound = await getMostRecentRound(
    userId,
    requestedCourseId ?? activeRound?.courseId ?? null,
  );
  const selectedCourseId =
    activeRound?.courseId ??
    (requestedCourseId && availableCourses.some((course) => course.id === requestedCourseId)
      ? requestedCourseId
      : null) ??
    recentRound?.courseId ??
    availableCourses[0]?.id ??
    null;
  const selected = availableCourses.find((course) => course.id === selectedCourseId) ?? null;
  const tees = selected ? await getCourseTees(selected.id) : [];
  const savedTeeId = cookieStore.get(SELECTED_TEE_COOKIE)?.value;
  const selectedTee = selectCompanionTee({
    tees,
    activeRoundTeeId: activeRound?.teeSetId,
    explicitTeeId: savedTeeId,
    recentRoundTeeId: recentRound?.teeSetId,
  });
  const teeIsDefault = Boolean(
    selectedTee &&
    selectedTee.id !== activeRound?.teeSetId &&
    selectedTee.id !== savedTeeId &&
    selectedTee.id !== recentRound?.teeSetId,
  );
  const twin = twins.find((course) => course.courseId === selected?.id) ?? null;
  const { strategyReady } = companionCourseReadiness({
    holeCount: selected?.holeCount ?? 0,
    teeCount: tees.length,
    courseTwinAvailable: Boolean(twin),
  });
  const playReady = strategyReady && trustedBagCount > 0;
  const selectionControls = (
    <PlaySelectionControls
      courses={availableCourses.map((course) => ({
        id: course.id,
        name: course.name,
        detail: `${course.holeCount} mapped holes`,
      }))}
      tees={tees.map((tee) => ({
        id: tee.id,
        name: tee.name,
        detail: tee.yards ? `${tee.yards.toLocaleString("en-GB")} yd` : undefined,
      }))}
      selectedCourseId={selected?.id ?? null}
      selectedTeeId={selectedTee?.id ?? null}
    />
  );

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-play-companion-hub>
        <MobileTopBar title="Play" />

        {activeRound ? (
          <Card className="border-primary/30 bg-primary/5" data-active-round>
            <CardHeader>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Round in progress
                </p>
                <h1 className="mt-1 text-2xl font-bold">
                  {activeRound.courseName ?? "Current round"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeRound.teeName ?? "Tee not recorded"}
                </p>
              </div>
              <CardAction>
                <Badge>In progress</Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="bg-background/70 p-3">
              <Button asChild className="min-h-12 w-full rounded-xl text-base">
                <Link href={`/rounds/${activeRound.id}`}>Continue Round</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {!activeRound && playReady ? (
          <Card className="overflow-hidden pt-0" data-selected-course>
            <div className="relative h-28 overflow-hidden border-b">
              <Image
                src="/assets/generated/course-twin-premium-desktop.webp"
                alt="Aerial golf-hole strategy view"
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover brightness-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <p className="absolute bottom-3 left-4 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Selected course
              </p>
            </div>
            <CardHeader>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {selected?.name ?? "Choose a course"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTee
                    ? `${teeIsDefault ? "Default: " : ""}${selectedTee.name}${selectedTee.yards ? ` · ${selectedTee.yards.toLocaleString("en-GB")} yd` : ""}`
                    : "Choose a tee"}
                </p>
              </div>
              <CardAction>
                <Badge>Ready</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-2">
              <SetupItem label="Course strategy" value="Ready" icon={MapPinned} />
              <SetupItem
                label="Course Twin"
                value={twin ? `Ready · Grade ${twin.grade}` : "Not built"}
                icon={Cuboid}
              />
              <SetupItem label="Selected tee" value={selectedTee?.name ?? "Not selected"} />
            </CardContent>
            <CardFooter className="grid gap-2 bg-background/70 p-3">
              <Button asChild className="min-h-12 rounded-xl text-base">
                <Link
                  href={`/courses/strategy?courseId=${selected!.id}${selectedTee ? `&teeSetId=${selectedTee.id}` : ""}`}
                >
                  <MapPinned className="size-4" aria-hidden />
                  Open course strategy
                </Link>
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="min-h-11 rounded-xl">
                  <Link
                    href={`/rounds/new?courseId=${selected!.id}${selectedTee ? `&teeSetId=${selectedTee.id}` : ""}`}
                  >
                    <Flag className="size-4" aria-hidden />
                    Start round
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 rounded-xl">
                  <Link href={twin ? `/play/${twin.courseId}?mode=strategy` : "/course-twins"}>
                    <Cuboid className="size-4" aria-hidden />
                    Course Twin
                  </Link>
                </Button>
              </div>
              <PlaySetupDrawer>{selectionControls}</PlaySetupDrawer>
            </CardFooter>
          </Card>
        ) : null}

        {!activeRound && !playReady ? (
          <Card data-play-setup-guide>
            <CardHeader>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Setup guide
                </p>
                <h1 className="mt-1 text-2xl font-bold">Prepare this course</h1>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Complete the playing context before the selected-course decision replaces this
                  checklist.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <OperationStepper
                label="Course readiness"
                steps={playReadinessSteps({
                  courseReady: Boolean(selected),
                  teeReady: Boolean(selectedTee),
                  strategyReady,
                  trustedBagReady: trustedBagCount > 0,
                })}
              />
              <div className="grid gap-2">
                <SetupItem icon={MapPinned} label="Course" value={selected?.name ?? "Choose"} />
                <SetupItem label="Tee" value={selectedTee?.name ?? "Choose"} />
                <SetupItem
                  label="Strategy"
                  value={strategyReady ? "Ready" : "Needs mapped holes"}
                />
                <SetupItem
                  icon={ShieldCheck}
                  label="Trusted bag"
                  value={
                    trustedBagCount > 0 ? `${trustedBagCount} measured clubs` : "Build baseline"
                  }
                  href="/quick-bag"
                />
                <SetupItem
                  icon={Cuboid}
                  label="Course Twin availability"
                  value={twin ? `Ready · Grade ${twin.grade}` : "Not available"}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-background/70 p-3">
              <PlaySetupDrawer label="Complete course setup">{selectionControls}</PlaySetupDrawer>
            </CardFooter>
          </Card>
        ) : null}
      </MobileAppShell>
    </PageShell>
  );
}

function SetupItem({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  icon?: typeof MapPinned;
  href?: string;
}) {
  const content = (
    <Item variant="muted" size="sm">
      {Icon ? (
        <ItemMedia>
          <Icon className="size-4 text-primary" aria-hidden />
        </ItemMedia>
      ) : null}
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
        {href ? <ItemDescription>Open setup</ItemDescription> : null}
      </ItemContent>
      <ItemActions>
        <Badge variant="outline">{value}</Badge>
      </ItemActions>
    </Item>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function playReadinessSteps({
  courseReady,
  teeReady,
  strategyReady,
  trustedBagReady,
}: {
  courseReady: boolean;
  teeReady: boolean;
  strategyReady: boolean;
  trustedBagReady: boolean;
}): OperationStep[] {
  const statuses = [courseReady, teeReady, strategyReady, trustedBagReady];
  const firstIncomplete = statuses.findIndex((ready) => !ready);
  return [
    { id: "course", label: "Course", status: courseReady ? "complete" : "current" },
    {
      id: "tee",
      label: "Tee",
      status: teeReady ? "complete" : firstIncomplete === 1 ? "current" : "upcoming",
    },
    {
      id: "strategy",
      label: "Strategy",
      status: strategyReady ? "complete" : firstIncomplete === 2 ? "current" : "upcoming",
    },
    {
      id: "bag",
      label: "Trusted bag",
      status: trustedBagReady ? "complete" : firstIncomplete === 3 ? "current" : "upcoming",
    },
    { id: "twin", label: "Twin checked", status: "complete" },
  ];
}

async function getTrustedBagCount(userId: string) {
  const [row] = await getDb()
    .select({ count: countDistinct(stockYardages.clubId) })
    .from(stockYardages)
    .where(eq(stockYardages.userId, userId));
  return Number(row?.count ?? 0);
}

async function getPlayCourses(userId: string) {
  const rows = await getDb()
    .select({ id: courses.id, name: courses.name, holeCount: countDistinct(holes.id) })
    .from(courses)
    .leftJoin(holes, eq(holes.courseId, courses.id))
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)))
    .groupBy(courses.id, courses.name)
    .orderBy(asc(courses.name));
  return rows.map((row) => ({ ...row, holeCount: Number(row.holeCount ?? 0) }));
}

async function getCourseTees(courseId: string) {
  return getDb()
    .select({ id: teeSets.id, name: teeSets.name, yards: teeSets.yards })
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
