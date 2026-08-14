import Link from "next/link";
import { Suspense } from "react";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { MapPinned, Plus } from "lucide-react";

import { CourseLibrary, type CourseLibraryEntry } from "@/app/courses/course-library";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  courseProviderAliases,
  courseRecordResults,
  courseRecords,
  courses,
  holes,
  sessions,
  teeSets,
  userProfiles,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { dedupeCoursesByName } from "@/lib/course-dedupe";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type CourseSearchParams = Promise<{
  q?: string | string[];
  tab?: string | string[];
  view?: string | string[];
}>;

export default async function CoursesPage({ searchParams }: { searchParams: CourseSearchParams }) {
  const params = await searchParams;

  return (
    <Suspense fallback={<CoursesLoading />}>
      <CoursesPageContent
        initialQuery={first(params.q).slice(0, 80)}
        initialFilter={first(params.tab)}
        initialView={first(params.view) === "table" ? "table" : "grid"}
      />
    </Suspense>
  );
}

async function CoursesPageContent({
  initialFilter,
  initialQuery,
  initialView,
}: {
  initialFilter: string;
  initialQuery: string;
  initialView: "grid" | "table";
}) {
  const library = await getCourseLibraryData();

  return (
    <PageShell contentClassName="gap-5 lg:gap-6">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Course library
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Find your next course
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Browse the courses you play, prepare strategy, open a Course Twin, or review the
            record—without turning the catalogue into a management screen.
          </p>
        </div>
        <Button asChild className="min-h-10 w-full sm:w-auto">
          <Link href="/courses/new">
            <Plus className="size-4" aria-hidden />
            Add course
          </Link>
        </Button>
      </header>

      {library.length > 0 ? (
        <CourseLibrary
          courses={library}
          initialQuery={initialQuery}
          initialView={initialView}
          initialFilter={initialFilter}
        />
      ) : (
        <AppEmptyState
          icon={<MapPinned className="size-5" aria-hidden />}
          title="Your course library is empty"
          description="Add a course to build a catalogue of places you play, prepare and revisit."
          primaryAction={
            <Button asChild>
              <Link href="/courses/new">Add your first course</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/rounds/new">Log a round</Link>
            </Button>
          }
          className="min-h-[420px]"
        />
      )}
    </PageShell>
  );
}

async function getCourseLibraryData(): Promise<CourseLibraryEntry[]> {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const mapPreviewsEnabled = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
  const courseRows = await db
    .select()
    .from(courses)
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)))
    .orderBy(asc(courses.name));
  const visibleCourseIds = courseRows.map((course) => course.id);

  if (visibleCourseIds.length === 0) return [];

  const [teeRows, holeRows, roundRows, recordRows, aliasRows, availableTwins] = await Promise.all([
    db
      .select({ courseId: teeSets.courseId })
      .from(teeSets)
      .where(inArray(teeSets.courseId, visibleCourseIds)),
    db
      .select({ courseId: holes.courseId, holeNumber: holes.holeNumber })
      .from(holes)
      .where(inArray(holes.courseId, visibleCourseIds)),
    db
      .select({ courseId: sessions.courseId, date: sessions.date })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          inArray(sessions.type, ["round", "simulator", "simulated_course", "real_round"]),
        ),
      ),
    db
      .select({
        courseId: courseRecords.courseId,
        championVerificationStatus: courseRecordResults.verificationStatus,
        championProfileUserId: userProfiles.userId,
      })
      .from(courseRecords)
      .leftJoin(courseRecordResults, eq(courseRecords.bestResultId, courseRecordResults.id))
      .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
      .where(
        and(
          inArray(courseRecords.courseId, visibleCourseIds),
          eq(courseRecords.scope, "public"),
          eq(courseRecords.status, "active"),
        ),
      ),
    db
      .select({ courseId: courseProviderAliases.courseId })
      .from(courseProviderAliases)
      .where(inArray(courseProviderAliases.courseId, visibleCourseIds)),
    listAvailableCourseTwins(userId),
  ]);

  const teeCounts = countBy(teeRows.map((row) => row.courseId));
  const holeNumbers = new Map<string, Set<number>>();
  const roundsByCourse = new Map<string, { count: number; lastPlayedAt: Date | null }>();
  const recordsByCourse = countBy(recordRows.map((row) => row.courseId));
  const aliasesByCourse = countBy(aliasRows.map((row) => row.courseId));
  const twinByCourse = new Map(availableTwins.map((twin) => [twin.courseId, twin]));

  for (const row of holeRows) {
    const numbers = holeNumbers.get(row.courseId) ?? new Set<number>();
    numbers.add(row.holeNumber);
    holeNumbers.set(row.courseId, numbers);
  }

  for (const round of roundRows) {
    if (!round.courseId) continue;
    const current = roundsByCourse.get(round.courseId) ?? { count: 0, lastPlayedAt: null };
    current.count += 1;
    if (!current.lastPlayedAt || round.date > current.lastPlayedAt)
      current.lastPlayedAt = round.date;
    roundsByCourse.set(round.courseId, current);
  }

  const enriched = courseRows.map((course) => {
    const holeCount = holeNumbers.get(course.id)?.size ?? 0;
    const teeSetCount = teeCounts.get(course.id) ?? 0;
    const rounds = roundsByCourse.get(course.id) ?? { count: 0, lastPlayedAt: null };
    const twin = twinByCourse.get(course.id);

    return {
      ...course,
      holeCount,
      teeSetCount,
      roundCount: rounds.count,
      lastPlayedAt: rounds.lastPlayedAt,
      recordCount: recordsByCourse.get(course.id) ?? 0,
      providerAliasCount: aliasesByCourse.get(course.id) ?? 0,
      strategyReady: holeCount >= 9 && teeSetCount > 0,
      courseTwinReady: Boolean(twin),
      courseTwinGrade: twin?.grade ?? null,
    };
  });

  return dedupeCoursesByName(enriched, courseLibraryPreference).map((course) => ({
    id: course.id,
    name: course.name,
    country: course.country,
    location: courseLocationLabel(course.address, course.country),
    latitude: course.latitude,
    longitude: course.longitude,
    mapPreviewAvailable: mapPreviewsEnabled,
    holeCount: course.holeCount,
    roundCount: course.roundCount,
    lastPlayedAt: course.lastPlayedAt?.toISOString() ?? null,
    recordCount: course.recordCount,
    strategyReady: course.strategyReady,
    courseTwinReady: course.courseTwinReady,
    courseTwinGrade: course.courseTwinGrade,
  }));
}

function courseLibraryPreference(course: {
  roundCount: number;
  holeCount: number;
  teeSetCount: number;
  recordCount: number;
  courseTwinReady: boolean;
  providerAliasCount: number;
  createdByUserId: string | null;
}) {
  return (
    course.roundCount * 1000 +
    course.holeCount * 100 +
    (course.courseTwinReady ? 75 : 0) +
    course.teeSetCount * 5 +
    course.recordCount +
    course.providerAliasCount +
    (course.createdByUserId ? 1 : 0)
  );
}

function courseLocationLabel(address: string | null, country: string | null) {
  if (!address?.trim()) return country?.trim() || "Location not set";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(", ") || country?.trim() || "Location not set";
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function CoursesLoading() {
  return (
    <PageShell>
      <div className="space-y-3 border-b border-border/70 pb-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-[560px] max-w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[360px] w-full rounded-xl" />
        ))}
      </div>
    </PageShell>
  );
}
