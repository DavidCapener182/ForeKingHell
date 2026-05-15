import Link from "next/link";
import { ArrowLeft, MapPinned, Plus, RefreshCw, Route, Settings, Trophy } from "lucide-react";
import { and, asc, eq, inArray, or } from "drizzle-orm";

import { seedKnownCoursesAction } from "@/app/courses/actions";
import {
  ActiveFilterChips,
  DataPair,
  DataPanel,
  DataTableFrame,
  MetricCard,
  MobileDataCard,
  MobileDataList,
  MobileFilterSheet,
  MobileHorizontalRail,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { courseRecordResults, courseRecords, courses, holes, sessions, teeSets, userProfiles } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 80);
  const data = await getCoursesData();
  const displayedCourses = query
    ? data.courses.filter((course) =>
        [course.name, course.country, course.provider].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : data.courses;
  const mappedCourses = data.courses.filter((course) => course.holeCount > 0);
  const roundLinkedCourses = data.courses.filter((course) => course.roundCount > 0);

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <form action={seedKnownCoursesAction}>
            <Button type="submit" variant="outline">
              <RefreshCw className="size-4" />
              Seed known
            </Button>
          </form>
          <Button asChild>
            <Link href="/courses/new" prefetch={false}>
              <Plus className="size-4" />
              New course
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="green">Course hub</StatusPill>}
        title="Courses"
        description="Open record boards, find live events, and manage the tee-set data behind round reviews and handicap estimates."
        visual={<PageArtwork variant="fairway" alt="" crop="fairway" className="h-full min-h-44" />}
        metrics={[
          {
            label: "Courses",
            value: integerFormatter.format(data.courses.length),
            detail: "Player-facing course hubs",
          },
          {
            label: "Record boards",
            value: integerFormatter.format(data.recordCount),
            detail: "Course champion scopes",
          },
          {
            label: "Tee sets",
            value: integerFormatter.format(data.teeSetCount),
            detail: "Rating, slope, par, and yardage records",
          },
          {
            label: "Linked rounds",
            value: integerFormatter.format(data.roundCount),
            detail: `${integerFormatter.format(roundLinkedCourses.length)} courses used by rounds`,
          },
        ]}
      />

      <MobileMetricStrip
        items={[
          { label: "Courses", value: integerFormatter.format(data.courses.length), detail: "Library", tone: "green" },
          { label: "Mapped", value: integerFormatter.format(mappedCourses.length), detail: "Geometry saved", tone: "sky" },
          { label: "Tee sets", value: integerFormatter.format(data.teeSetCount), detail: "Ratings and yardages", tone: "amber" },
          { label: "Rounds", value: integerFormatter.format(data.roundCount), detail: "Linked", tone: "slate" },
        ]}
      />

      <div className="grid gap-3 sm:hidden">
        <MobileFilterSheet label="Search courses" activeCount={query ? 1 : 0}>
          <form className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Course search
              <input
                name="q"
                defaultValue={query}
                placeholder="Search course, country, or provider"
                className="h-11 rounded-xl border bg-white px-3 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                Search
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/courses" prefetch={false}>Reset</Link>
              </Button>
            </div>
          </form>
        </MobileFilterSheet>
        <ActiveFilterChips items={query ? [{ label: `${query} x`, href: "/courses" }] : []} />
      </div>

      <DataPanel className="hidden sm:block">
        <CardContent className="pt-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-medium">
              Course search
              <input
                name="q"
                defaultValue={query}
                placeholder="Search course, country, or provider"
                className="h-11 rounded-xl border bg-white px-3 text-sm"
              />
            </label>
            <Button type="submit" className="rounded-xl bg-[#111827] text-white">
              Search
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/courses" prefetch={false}>Reset</Link>
            </Button>
          </form>
        </CardContent>
      </DataPanel>

      <section className="hidden gap-4 sm:grid md:grid-cols-3">
        <MetricCard
          label="Course champions"
          value={integerFormatter.format(data.championCount)}
          detail="Verified leaders across all visible course boards."
          icon={MapPinned}
          tone="green"
          href="/course-records"
        />
        <MetricCard
          label="Handicap quality"
          value={integerFormatter.format(data.ratedTeeSetCount)}
          detail="Tee sets with both course rating and slope."
          icon={Trophy}
          tone="amber"
          href="/handicap"
        />
        <MetricCard
          label="Known seeds"
          value="TPC / Bootle / Mountain"
          detail="Use Seed known to restore built-in course geometry."
          icon={Route}
          tone="sky"
        />
      </section>

      <MobileHorizontalRail
        title="Courses"
        description="Open a course to view champion boards first. Management stays behind Manage."
        action={
          <Button asChild variant="outline" size="sm" className="min-h-10 rounded-xl">
            <Link href="/courses/new" prefetch={false}>New</Link>
          </Button>
        }
      >
        {displayedCourses.slice(0, 6).map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}/records`}
            prefetch={false}
            className="apple-panel-strong block p-4"
          >
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={course.id}
              className="mb-3 block h-24 min-h-0 rounded-xl"
              sizes="90vw"
            />
            <p className="truncate font-semibold tracking-normal">{course.name}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{course.country ?? "Country not set"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <span className="rounded-lg bg-slate-50 px-2 py-2">{course.recordCount} records</span>
              <span className="rounded-lg bg-slate-50 px-2 py-2">{course.teeSetCount} tees</span>
              <span className="rounded-lg bg-slate-50 px-2 py-2">{course.roundCount} rounds</span>
            </div>
          </Link>
        ))}
      </MobileHorizontalRail>

      <DataPanel>
        <SectionHeader
          title="Course library"
          description="Open Records for the player hub, or Manage for tee sets and per-hole geometry."
          action={<Badge variant="outline">{integerFormatter.format(displayedCourses.length)} courses</Badge>}
        />
        <CardContent>
          <DataTableFrame
            mobile={
              <MobileDataList>
                {displayedCourses.length > 0 ? (
                  displayedCourses.map((course) => (
                    <MobileDataCard
                      key={course.id}
                      title={course.name}
                      subtitle={course.country ?? "Country not set"}
                      action={
                        <Badge variant={course.provider === "manual" ? "outline" : "secondary"}>
                          {course.provider}
                        </Badge>
                      }
                    >
                      <PageArtwork
                        variant="fairway"
                        alt=""
                        crop="random"
                        cropKey={course.id}
                        className="block h-20 min-h-0 rounded-xl"
                        sizes="100vw"
                      />
                      <DataPair
                        label="Thumbnail"
                        value={course.holeCount > 0 ? "Saved geometry" : "Illustrative layout"}
                      />
                      <DataPair label="Records" value={course.recordCount} />
                      <DataPair label="Champion" value={course.champion?.displayName ?? "--"} />
                      <DataPair label="Tee sets" value={course.teeSetCount} />
                      <DataPair
                        label="Mapped holes"
                        value={
                          <span className={course.holeCount >= 18 ? "text-emerald-700" : "text-amber-700"}>
                            {course.holeCount}
                          </span>
                        }
                      />
                      <DataPair label="Rounds" value={course.roundCount} />
                      <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                        <Link href={`/courses/${course.id}/records`} prefetch={false}>
                          <Trophy className="size-4" />
                          Open records
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="mt-1 w-full">
                        <Link href={`/courses/${course.id}/holes`} prefetch={false}>
                          <Settings className="size-4" />
                          Manage
                        </Link>
                      </Button>
                    </MobileDataCard>
                  ))
                ) : (
                  <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                    No courses yet. Seed known courses or create one manually.
                  </div>
                )}
              </MobileDataList>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Champion</TableHead>
                  <TableHead className="text-right">Tee sets</TableHead>
                  <TableHead className="text-right">Mapped holes</TableHead>
                  <TableHead className="text-right">Rounds</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{course.name}</p>
                        <p className="text-sm text-muted-foreground">{course.country ?? "Country not set"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={course.provider === "manual" ? "outline" : "secondary"}>
                        {course.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{course.recordCount}</TableCell>
                    <TableCell>
                      {course.champion ? (
                        <span className="text-sm font-medium">{course.champion.displayName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Open</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{course.teeSetCount}</TableCell>
                    <TableCell className="text-right">
                      <span className={course.holeCount >= 18 ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                        {course.holeCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{course.roundCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/courses/${course.id}/records`} prefetch={false}>
                            <Trophy className="size-4" />
                            Records
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/courses/${course.id}/holes`} prefetch={false}>
                            <Settings className="size-4" />
                            Manage
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {displayedCourses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No courses yet. Seed known courses or create one manually.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </PageShell>
  );
}

async function getCoursesData() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const courseRows = await db
    .select()
    .from(courses)
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)))
    .orderBy(asc(courses.name));
  const visibleCourseIds = courseRows.map((course) => course.id);
  const [teeSetRows, holeRows, roundRows, recordRows, championRows] = await Promise.all([
    visibleCourseIds.length > 0
      ? db.select().from(teeSets).where(inArray(teeSets.courseId, visibleCourseIds)).orderBy(asc(teeSets.name))
      : [],
    visibleCourseIds.length > 0
      ? db.select({ courseId: holes.courseId }).from(holes).where(inArray(holes.courseId, visibleCourseIds))
      : [],
    db
      .select({
        courseId: sessions.courseId,
        id: sessions.id,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          inArray(sessions.type, ["round", "simulator", "simulated_course", "real_round"]),
        ),
      ),
    visibleCourseIds.length > 0
      ? db.select().from(courseRecords).where(inArray(courseRecords.courseId, visibleCourseIds))
      : [],
    visibleCourseIds.length > 0
      ? db
          .select({
            record: courseRecords,
            result: courseRecordResults,
            profile: userProfiles,
          })
          .from(courseRecordResults)
          .innerJoin(courseRecords, eq(courseRecordResults.recordId, courseRecords.id))
          .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
          .where(and(inArray(courseRecords.courseId, visibleCourseIds), eq(courseRecordResults.rank, 1)))
      : [],
  ]);
  const teeSetsByCourse = countBy(teeSetRows.map((teeSet) => teeSet.courseId));
  const holesByCourse = countBy(holeRows.map((hole) => hole.courseId));
  const roundsByCourse = countBy(roundRows.map((round) => round.courseId).filter((id): id is string => Boolean(id)));
  const recordsByCourse = countBy(recordRows.map((record) => record.courseId));
  const championByCourse = new Map<string, (typeof championRows)[number]>();

  for (const champion of championRows) {
    if (!championByCourse.has(champion.record.courseId)) {
      championByCourse.set(champion.record.courseId, champion);
    }
  }

  return {
    teeSetCount: teeSetRows.length,
    ratedTeeSetCount: teeSetRows.filter((teeSet) => teeSet.courseRating !== null && teeSet.slopeRating !== null).length,
    roundCount: roundRows.length,
    recordCount: recordRows.length,
    championCount: championRows.filter((row) => row.result.verificationStatus === "verified").length,
    courses: courseRows.map((course) => ({
      ...course,
      teeSetCount: teeSetsByCourse.get(course.id) ?? 0,
      holeCount: holesByCourse.get(course.id) ?? 0,
      roundCount: roundsByCourse.get(course.id) ?? 0,
      recordCount: recordsByCourse.get(course.id) ?? 0,
      champion: championByCourse.get(course.id)?.profile ?? null,
    })),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
