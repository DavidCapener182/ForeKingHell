import Link from "next/link";
import { ArrowLeft, MapPinned, Plus, RefreshCw, Route, Settings, Trophy } from "lucide-react";
import { asc, inArray } from "drizzle-orm";

import { seedKnownCoursesAction } from "@/app/courses/actions";
import {
  DataPair,
  DataPanel,
  DataTableFrame,
  MetricCard,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
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
import { courses, holes, sessions, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function CoursesPage() {
  const data = await getCoursesData();
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
        eyebrow={<StatusPill tone="green">Course overlays</StatusPill>}
        title="Courses"
        description="Manage the course and tee-set data that powers round reviews, satellite overlays, and handicap estimates."
        metrics={[
          {
            label: "Courses",
            value: integerFormatter.format(data.courses.length),
            detail: "Seeded and manually created courses",
          },
          {
            label: "Mapped courses",
            value: integerFormatter.format(mappedCourses.length),
            detail: "Have at least one saved hole geometry",
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

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Map readiness"
          value={`${mappedCourses.length}/${data.courses.length || 0}`}
          detail="Course overlays need hole geometry with tee and green points."
          icon={MapPinned}
          tone="green"
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

      <DataPanel>
        <SectionHeader
          title="Course library"
          description="Open a course to edit tee sets and per-hole geometry."
          action={<Badge variant="outline">{integerFormatter.format(data.courses.length)} courses</Badge>}
        />
        <CardContent>
          <DataTableFrame
            mobile={
              <MobileDataList>
                {data.courses.length > 0 ? (
                  data.courses.map((course) => (
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
                        <Link href={`/courses/${course.id}/holes`} prefetch={false}>
                          <Settings className="size-4" />
                          Edit course
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
                  <TableHead className="text-right">Tee sets</TableHead>
                  <TableHead className="text-right">Mapped holes</TableHead>
                  <TableHead className="text-right">Rounds</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.courses.map((course) => (
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
                    <TableCell className="text-right">{course.teeSetCount}</TableCell>
                    <TableCell className="text-right">
                      <span className={course.holeCount >= 18 ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                        {course.holeCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{course.roundCount}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/courses/${course.id}/holes`} prefetch={false}>
                          <Settings className="size-4" />
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.courses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
  const [courseRows, teeSetRows, holeRows, roundRows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.name)),
    db.select().from(teeSets).orderBy(asc(teeSets.name)),
    db.select({ courseId: holes.courseId }).from(holes),
    db
      .select({
        courseId: sessions.courseId,
        id: sessions.id,
      })
      .from(sessions)
      .where(inArray(sessions.type, ["round", "simulator", "simulated_course", "real_round"])),
  ]);
  const teeSetsByCourse = countBy(teeSetRows.map((teeSet) => teeSet.courseId));
  const holesByCourse = countBy(holeRows.map((hole) => hole.courseId));
  const roundsByCourse = countBy(roundRows.map((round) => round.courseId).filter((id): id is string => Boolean(id)));

  return {
    teeSetCount: teeSetRows.length,
    ratedTeeSetCount: teeSetRows.filter((teeSet) => teeSet.courseRating !== null && teeSet.slopeRating !== null).length,
    roundCount: roundRows.length,
    courses: courseRows.map((course) => ({
      ...course,
      teeSetCount: teeSetsByCourse.get(course.id) ?? 0,
      holeCount: holesByCourse.get(course.id) ?? 0,
      roundCount: roundsByCourse.get(course.id) ?? 0,
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
