import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { and, asc, countDistinct, desc, eq, inArray, or } from "drizzle-orm";
import { Cuboid, Flag, MapPinned, ShieldCheck } from "lucide-react";

import { PlaySelectionControls } from "@/app/play/play-selection-controls";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { courses, holes, sessions, teeSets } from "@/db/schema";
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
  const [params, cookieStore, twins, availableCourses, activeRound] = await Promise.all([
    searchParams,
    cookies(),
    listAvailableCourseTwins(userId),
    getPlayCourses(userId),
    getInProgressRound(userId),
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

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-play-companion-hub>
        <MobileTopBar title="Play" />

        {activeRound ? (
          <section
            className="ios-grouped-list grid gap-3 border-primary/30 bg-primary/5 p-5"
            data-active-round
          >
            <div className="flex items-start justify-between gap-3">
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
              <IOSInlineStatus label="In progress" tone="positive" />
            </div>
            <Button asChild className="min-h-12 rounded-xl text-base">
              <Link href={`/rounds/${activeRound.id}`}>Continue Round</Link>
            </Button>
          </section>
        ) : null}

        <section className="ios-grouped-list overflow-hidden" data-selected-course>
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
          <div className="grid gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
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
              <IOSInlineStatus
                label={strategyReady ? "Strategy ready" : "Setup needed"}
                tone={strategyReady ? "positive" : "attention"}
              />
            </div>
            <IOSGroupedList label="Course readiness" className="bg-card">
              <IOSMetricRow
                label="Course Strategy"
                value={strategyReady ? "Ready" : "Needs scorecard"}
              />
              <IOSMetricRow
                label="Course Twin"
                value={twin ? `Ready · Grade ${twin.grade}` : "Not built"}
              />
              <IOSMetricRow label="Selected tee" value={selectedTee?.name ?? "Not selected"} />
            </IOSGroupedList>
          </div>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Play this course" />
          <IOSGroupedList label="Play actions">
            <IOSListRow
              icon={MapPinned}
              label="Course Strategy"
              detail="One hole at a time"
              href={
                selected && strategyReady
                  ? `/courses/strategy?courseId=${selected.id}${selectedTee ? `&teeSetId=${selectedTee.id}` : ""}`
                  : "/courses"
              }
              status={
                <IOSInlineStatus
                  label={strategyReady ? "Ready" : "Setup needed"}
                  tone={strategyReady ? "positive" : "attention"}
                />
              }
            />
            <IOSListRow
              icon={Cuboid}
              label="Course Twin"
              detail={twin ? "Immersive strategy and replay" : "No 3D twin is available yet"}
              href={twin ? `/play/${twin.courseId}?mode=strategy` : "/course-twins"}
              status={
                <IOSInlineStatus
                  label={twin ? "Ready" : "Unavailable"}
                  tone={twin ? "positive" : "neutral"}
                />
              }
            />
            <IOSListRow
              icon={ShieldCheck}
              label="Quick Bag"
              detail="Check trusted carries and target matches"
              href="/quick-bag"
            />
            <IOSListRow
              icon={Flag}
              label="Start round"
              detail={selectedTee ? `Using ${selectedTee.name}` : "Choose course and tee first"}
              href={
                selected
                  ? `/rounds/new?courseId=${selected.id}${selectedTee ? `&teeSetId=${selectedTee.id}` : ""}`
                  : "/rounds/new"
              }
            />
          </IOSGroupedList>
        </section>

        <IOSDisclosureGroup
          label="Change course or tee"
          items={[
            {
              value: "course",
              title: "Change course or tee",
              summary: `${availableCourses.length} courses`,
              description: "Course and tee choices are stored independently",
              content: (
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
              ),
            },
          ]}
        />
      </MobileAppShell>
    </PageShell>
  );
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
