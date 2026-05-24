import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowLeft,
  Filter,
  MapPinned,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings,
  Trophy,
} from "lucide-react";
import { and, asc, eq, inArray, or } from "drizzle-orm";

import { seedKnownCoursesAction } from "@/app/courses/actions";
import { CourseFollowFeaturePanel } from "@/components/features/feature-panels";
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
import {
  BottomSheet,
  CourseCard,
  MobileAppShell,
  MobileIconButton,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
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
import { requireCurrentUserId } from "@/lib/current-user";
import { getCourseFollowFeatureData } from "@/lib/feature-ideas";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

type CourseSearchParams = { [key: string]: string | string[] | undefined };
type SearchParams = Promise<CourseSearchParams>;

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <Suspense fallback={<CoursesPageLoading />}>
      <CoursesPageContent params={params} />
    </Suspense>
  );
}

async function CoursesPageContent({ params }: { params: CourseSearchParams }) {
  const query = first(params.q).trim().slice(0, 80);
  const activeTab = parseCourseTab(first(params.tab));
  const [data, featureData] = await Promise.all([getCoursesData(), getCourseFollowFeatureData()]);
  const displayedCourses = query
    ? data.courses.filter((course) =>
        [course.name, course.country, course.provider].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : data.courses;
  const shotPatternEnabled = isShotPatternFeatureEnabled();
  const mappedCourses = data.courses.filter((course) => course.holeCount > 0);
  const patternCourses = shotPatternEnabled
    ? displayedCourses.filter((course) => course.holeCount > 0)
    : [];
  const roundLinkedCourses = data.courses.filter((course) => course.roundCount > 0);
  const heroArtworkVariant = mappedCourses.length > 0 ? "fairway" : "courseMap";
  const mobileCourses =
    activeTab === "played"
      ? displayedCourses.filter((course) => course.roundCount > 0)
      : activeTab === "patterns"
        ? patternCourses
        : displayedCourses;
  const mobileCourseLimit =
    activeTab === "patterns" ? patternCourses.length : activeTab === "records" ? 12 : 8;

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar
          title="Courses"
          leading={<MobileIconButton href="/courses" label="Search courses" icon={Search} />}
          actions={
            <BottomSheet
              label={
                <>
                  <Filter className="size-4" /> Filter
                </>
              }
              title="Course filters"
              triggerClassName="bg-white text-[#050505] ring-1 ring-[#E5E7EB]"
            >
              <form className="grid gap-3">
                <input type="hidden" name="tab" value={activeTab} />
                <label className="grid gap-1 text-sm font-medium">
                  Course search
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Search course, country, or provider"
                    className="h-11 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="submit" className="rounded-full bg-[#0B7A3B] text-white">
                    Search
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/courses" prefetch={false}>
                      Reset
                    </Link>
                  </Button>
                </div>
              </form>
            </BottomSheet>
          }
        />
        <MobileRouteTabs group="play" activeKey="courses" />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "records", label: "Records", href: "/courses" },
            { key: "patterns", label: "Patterns", href: "/courses?tab=patterns" },
            { key: "played", label: "Played", href: "/courses?tab=played" },
            { key: "favourites", label: "Favourites", href: "/courses?tab=favourites" },
            { key: "manage", label: "Manage", href: "/courses?tab=manage" },
          ]}
        />
        <MobileStatusAction
          label={activeTab === "patterns" ? "Course patterns" : "Course records"}
          value={
            activeTab === "patterns"
              ? `${integerFormatter.format(patternCourses.length)} ready`
              : `${integerFormatter.format(data.recordCount)} boards`
          }
          detail={
            activeTab === "patterns"
              ? "Mapped courses with shot-pattern overlays ready to open."
              : `${integerFormatter.format(data.championCount)} verified champions · ${integerFormatter.format(roundLinkedCourses.length)} played courses`
          }
          action={
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link
                href={
                  activeTab === "patterns" && patternCourses[0]
                    ? `/courses/${patternCourses[0].id}/shot-pattern`
                    : "/course-records"
                }
                prefetch={false}
              >
                {activeTab === "patterns" ? "Open" : "Records"}
              </Link>
            </Button>
          }
        />
        {activeTab === "manage" ? (
          <NativeListSection
            title="Course management"
            description="Search, seed, create and edit course data from here."
            action={
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/courses/new" prefetch={false}>
                  New
                </Link>
              </Button>
            }
          >
            <div className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-white p-3">
              <form action={seedKnownCoursesAction}>
                <Button type="submit" variant="outline" className="w-full rounded-full">
                  <RefreshCw className="size-4" />
                  Seed known courses
                </Button>
              </form>
              {displayedCourses.slice(0, 8).map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}/holes`}
                  prefetch={false}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#E5E7EB] py-3 text-sm first:border-t-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{course.name}</span>
                    <span className="block truncate text-[#6B7280]">
                      {course.teeSetCount} tee sets · {course.holeCount} mapped holes
                    </span>
                  </span>
                  <Settings className="size-4 text-[#6B7280]" />
                </Link>
              ))}
            </div>
          </NativeListSection>
        ) : (
          <NativeListSection
            title={
              activeTab === "played"
                ? "Played courses"
                : activeTab === "patterns"
                  ? "Course patterns"
                : activeTab === "favourites"
                  ? "Favourite courses"
                  : "Record boards"
            }
            description={
              activeTab === "patterns"
                ? "Mapped courses with enough saved hole geometry for dispersion overlays."
                : activeTab === "records"
                  ? "Champions and live record boards first."
                  : undefined
            }
          >
            {mobileCourses
              .slice(0, mobileCourseLimit)
              .map((course, index) => (
                <CourseCard
                  key={course.id}
                  href={
                    activeTab === "patterns"
                      ? `/courses/${course.id}/shot-pattern`
                      : `/courses/${course.id}/records`
                  }
                  title={course.name}
                  subtitle={course.country ?? "Course board"}
                  media={
                    <PageArtwork
                      variant={courseArtworkVariant(course)}
                      alt=""
                      crop={courseArtworkCrop(course)}
                      cropKey={course.id}
                      className="block h-36 min-h-0 rounded-lg"
                      sizes="calc(100vw - 2rem)"
                      priority={index === 0}
                    />
                  }
                  champion={
                    course.champion ? (
                      <span>
                        Champion:{" "}
                        <span className="font-semibold">{course.champion.displayName}</span>
                      </span>
                    ) : (
                      <span>No verified champion yet</span>
                    )
                  }
                  stats={
                    <>
                      <span>{course.sourceLabel}</span>
                      <span>{course.recordCount} record boards</span>
                      <span>{course.roundCount} played rounds</span>
                      <span>{course.teeSetCount} tee sets</span>
                      <span>{course.holeCount} mapped holes</span>
                    </>
                  }
                  actions={
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-10 rounded-full border-[#D7DEE2] bg-white px-3 text-[#050505]"
                      >
                        <Link href={`/courses/${course.id}/records`} prefetch={false}>
                          <Trophy className="size-4" />
                          Records
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-10 rounded-full border-[#D7DEE2] bg-white px-3 text-[#050505]"
                      >
                        <Link href={`/courses/${course.id}/holes`} prefetch={false}>
                          <Settings className="size-4" />
                          Map
                        </Link>
                      </Button>
                      {shotPatternEnabled && course.holeCount > 0 ? (
                        <Button
                          asChild
                          size="sm"
                          className="col-span-2 min-h-10 rounded-full bg-[#0B7A3B] px-3 text-white hover:bg-[#064E3B]"
                        >
                          <Link href={`/courses/${course.id}/shot-pattern`} prefetch={false}>
                            <MapPinned className="size-4" />
                            Shot pattern
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  }
                />
              ))}
            {mobileCourses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#D7DEE2] bg-white p-4 text-sm leading-5 text-[#6B7280]">
                {activeTab === "patterns"
                  ? "No mapped course patterns yet. Open Manage to map course holes first."
                  : "No courses match this view yet."}
              </div>
            ) : null}
          </NativeListSection>
        )}
        <CourseDataQualityPanel courses={displayedCourses} />
        <CourseFollowFeaturePanel data={featureData} courseId={displayedCourses[0]?.id ?? null} />
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-4 sm:flex">
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

      <div className="hidden sm:contents">
        <PageHeader
          eyebrow={<StatusPill tone="green">Course hub</StatusPill>}
          title="Courses"
          description="Open record boards, find live events, and manage the tee-set data behind round reviews and handicap estimates."
          visual={
            <PageArtwork
              variant={heroArtworkVariant}
              alt=""
              crop={heroArtworkVariant === "courseMap" ? undefined : "fairway"}
              className="h-full min-h-44"
              priority
            />
          }
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
            {
              label: "Courses",
              value: integerFormatter.format(data.courses.length),
              detail: "Library",
              tone: "green",
            },
            {
              label: "Mapped",
              value: integerFormatter.format(mappedCourses.length),
              detail: "Geometry saved",
              tone: "sky",
            },
            {
              label: "Tee sets",
              value: integerFormatter.format(data.teeSetCount),
              detail: "Ratings and yardages",
              tone: "amber",
            },
            {
              label: "Rounds",
              value: integerFormatter.format(data.roundCount),
              detail: "Linked",
              tone: "slate",
            },
          ]}
        />

        <CourseFollowFeaturePanel data={featureData} courseId={displayedCourses[0]?.id ?? null} />

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
                <Button
                  type="submit"
                  className="rounded-xl bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
                >
                  Search
                </Button>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/courses" prefetch={false}>
                    Reset
                  </Link>
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
              <Button
                type="submit"
                className="rounded-xl bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                Search
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/courses" prefetch={false}>
                  Reset
                </Link>
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

        <CourseDataQualityPanel courses={displayedCourses} />

        <MobileHorizontalRail
          title="Courses"
          description="Open a course to view tee sets and saved hole geometry."
          action={
            <Button asChild variant="outline" size="sm" className="min-h-10 rounded-xl">
              <Link href="/courses/new" prefetch={false}>
                New
              </Link>
            </Button>
          }
        >
          {displayedCourses.slice(0, 6).map((course, index) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}/holes`}
              prefetch={false}
              className="apple-panel-strong block p-4"
            >
              <PageArtwork
                variant={courseArtworkVariant(course)}
                alt=""
                crop={courseArtworkCrop(course)}
                cropKey={course.id}
                className="mb-3 block h-24 min-h-0 rounded-xl"
                sizes="90vw"
                priority={index === 0}
              />
              <p className="truncate font-semibold tracking-normal">{course.name}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {course.country ?? "Country not set"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded-lg bg-[#F5F6F4] px-2 py-2">
                  {course.recordCount} records
                </span>
                <span className="rounded-lg bg-[#F5F6F4] px-2 py-2">{course.teeSetCount} tees</span>
                <span className="rounded-lg bg-[#F5F6F4] px-2 py-2">
                  {course.roundCount} rounds
                </span>
              </div>
            </Link>
          ))}
        </MobileHorizontalRail>

        <DataPanel>
          <SectionHeader
            title="Course library"
            description="Click a course name to view its tee sets and saved holes. Records opens the player hub."
            action={
              <Badge variant="outline">
                {integerFormatter.format(displayedCourses.length)} courses
              </Badge>
            }
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
                            {course.sourceLabel}
                          </Badge>
                        }
                      >
                        <PageArtwork
                          variant={courseArtworkVariant(course)}
                          alt=""
                          crop={courseArtworkCrop(course)}
                          cropKey={course.id}
                          className="block h-20 min-h-0 rounded-xl"
                          sizes="calc(100vw - 2rem)"
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
                            <span
                              className={
                                course.holeCount >= 18 ? "text-emerald-700" : "text-amber-700"
                              }
                            >
                              {course.holeCount}
                            </span>
                          }
                        />
                        <DataPair label="Data quality" value={courseQualitySummary(course)} />
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
                        {shotPatternEnabled && course.holeCount > 0 ? (
                          <Button asChild size="sm" className="mt-1 w-full">
                            <Link href={`/courses/${course.id}/shot-pattern`} prefetch={false}>
                              <MapPinned className="size-4" />
                              Pattern
                            </Link>
                          </Button>
                        ) : null}
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
                    <TableHead>Data quality</TableHead>
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
                          <Link
                            href={`/courses/${course.id}/holes`}
                            prefetch={false}
                            className="font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          >
                            {course.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {course.country ?? "Country not set"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={course.provider === "manual" ? "outline" : "secondary"}>
                          {course.sourceLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {courseQualitySummary(course)}
                        </span>
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
                        <span
                          className={
                            course.holeCount >= 18
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-amber-700"
                          }
                        >
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
                          {shotPatternEnabled && course.holeCount > 0 ? (
                            <Button asChild size="sm">
                              <Link href={`/courses/${course.id}/shot-pattern`} prefetch={false}>
                                <MapPinned className="size-4" />
                                Pattern
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayedCourses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        No courses yet. Seed known courses or create one manually.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </DataTableFrame>
          </CardContent>
        </DataPanel>
      </div>
    </PageShell>
  );
}

function CoursesPageLoading() {
  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Courses" />
        <MobileRouteTabs group="play" activeKey="courses" />
        <div className="grid gap-3 p-4">
          <div className="h-24 animate-pulse rounded-lg bg-[#E5E7EB]" />
          <div className="h-48 animate-pulse rounded-lg bg-[#E5E7EB]" />
          <div className="h-48 animate-pulse rounded-lg bg-[#E5E7EB]" />
        </div>
      </MobileAppShell>
      <div className="hidden gap-4 sm:grid">
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </PageShell>
  );
}

function CourseDataQualityPanel({
  courses,
}: {
  courses: Awaited<ReturnType<typeof getCoursesData>>["courses"];
}) {
  if (courses.length === 0) {
    return null;
  }

  const focusCourse = courses[0];
  const googleEnriched = courses.filter((course) => Boolean(course.googlePlaceId)).length;
  const mappedCourses = courses.filter((course) => course.holeCount >= 18).length;
  const ratedCourses = courses.filter((course) => course.ratedTeeSetCount > 0).length;
  const aliasMatched = courses.filter((course) => course.providerAliasCount > 0).length;

  return (
    <DataPanel>
      <SectionHeader
        title="Course data quality"
        description="Source labels and health checks make Google, OSM, Rapsodo aliases and manual setup visible before users trust a board."
        action={
          <StatusPill tone={courseQualityTone(focusCourse)}>
            {courseQualitySummary(focusCourse)}
          </StatusPill>
        }
      />
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <DataPair
            label="Google-enriched"
            value={`${integerFormatter.format(googleEnriched)} courses`}
          />
          <DataPair
            label="18 holes mapped"
            value={`${integerFormatter.format(mappedCourses)} courses`}
          />
          <DataPair
            label="Rating/slope"
            value={`${integerFormatter.format(ratedCourses)} courses`}
          />
          <DataPair
            label="Provider aliases"
            value={`${integerFormatter.format(aliasMatched)} courses`}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{focusCourse.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{focusCourse.sourceLabel}</p>
            </div>
            <StatusPill tone={courseQualityTone(focusCourse)}>
              {courseQualitySummary(focusCourse)}
            </StatusPill>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {courseQualityChecks(focusCourse).map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between gap-3 rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200"
              >
                <span className="text-muted-foreground">{check.label}</span>
                <span
                  className={
                    check.ready ? "font-medium text-emerald-700" : "font-medium text-amber-700"
                  }
                >
                  {check.ready ? "Found" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </DataPanel>
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
  const [teeSetRows, holeRows, roundRows, recordRows, aliasRows] = await Promise.all([
    visibleCourseIds.length > 0
      ? db
          .select()
          .from(teeSets)
          .where(inArray(teeSets.courseId, visibleCourseIds))
          .orderBy(asc(teeSets.name))
      : [],
    visibleCourseIds.length > 0
      ? db
          .select({ courseId: holes.courseId })
          .from(holes)
          .where(inArray(holes.courseId, visibleCourseIds))
      : [],
    db
      .select({
        courseId: sessions.courseId,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          inArray(sessions.type, ["round", "simulator", "simulated_course", "real_round"]),
        ),
      ),
    visibleCourseIds.length > 0
      ? db
        .select({
          id: courseRecords.id,
          courseId: courseRecords.courseId,
          bestResultId: courseRecords.bestResultId,
          championVerificationStatus: courseRecordResults.verificationStatus,
          championProfileUserId: userProfiles.userId,
          championProfileDisplayName: userProfiles.displayName,
          championProfileUsername: userProfiles.username,
          championProfileAvatarUrl: userProfiles.avatarUrl,
        })
        .from(courseRecords)
        .leftJoin(courseRecordResults, eq(courseRecords.bestResultId, courseRecordResults.id))
        .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
        .where(inArray(courseRecords.courseId, visibleCourseIds))
      : [],
    visibleCourseIds.length > 0
      ? db
          .select({ courseId: courseProviderAliases.courseId })
          .from(courseProviderAliases)
          .where(inArray(courseProviderAliases.courseId, visibleCourseIds))
      : [],
  ]);
  const teeSetsByCourse = countBy(teeSetRows.map((teeSet) => teeSet.courseId));
  const ratedTeeSetsByCourse = countBy(
    teeSetRows
      .filter((teeSet) => teeSet.courseRating !== null && teeSet.slopeRating !== null)
      .map((teeSet) => teeSet.courseId),
  );
  const holesByCourse = countBy(holeRows.map((hole) => hole.courseId));
  const roundsByCourse = countBy(
    roundRows.map((round) => round.courseId).filter((id): id is string => Boolean(id)),
  );
  const recordsByCourse = countBy(recordRows.map((record) => record.courseId));
  const aliasesByCourse = countBy(aliasRows.map((alias) => alias.courseId));
  const championByCourse = new Map<string, (typeof recordRows)[number]>();

  for (const record of recordRows) {
    if (record.championProfileUserId && !championByCourse.has(record.courseId)) {
      championByCourse.set(record.courseId, record);
    }
  }

  const allCourses = courseRows.map((course) => {
    const championRow = championByCourse.get(course.id);

    return {
      ...course,
      teeSetCount: teeSetsByCourse.get(course.id) ?? 0,
      holeCount: holesByCourse.get(course.id) ?? 0,
      roundCount: roundsByCourse.get(course.id) ?? 0,
      recordCount: recordsByCourse.get(course.id) ?? 0,
      ratedTeeSetCount: ratedTeeSetsByCourse.get(course.id) ?? 0,
      providerAliasCount: aliasesByCourse.get(course.id) ?? 0,
      sourceLabel: courseSourceLabel(
        course.provider,
        course.googlePlaceId,
        aliasesByCourse.get(course.id) ?? 0,
      ),
      champion: championRow?.championProfileUserId
        ? {
            userId: championRow.championProfileUserId,
            displayName:
              championRow.championProfileDisplayName ?? championRow.championProfileUsername,
            username: championRow.championProfileUsername,
            avatarUrl: championRow.championProfileAvatarUrl,
          }
        : null,
      championVerificationStatus: championRow?.championVerificationStatus ?? null,
    };
  });
  const dedupedCourses = dedupeCoursesByName(allCourses, courseLibraryPreference);
  const dedupedCourseIds = new Set(dedupedCourses.map((course) => course.id));

  return {
    teeSetCount: sum(dedupedCourses.map((course) => course.teeSetCount)),
    ratedTeeSetCount: teeSetRows.filter(
      (teeSet) =>
        dedupedCourseIds.has(teeSet.courseId) &&
        teeSet.courseRating !== null &&
        teeSet.slopeRating !== null,
    ).length,
    roundCount: sum(dedupedCourses.map((course) => course.roundCount)),
    recordCount: sum(dedupedCourses.map((course) => course.recordCount)),
    championCount: dedupedCourses.filter(
      (course) => course.championVerificationStatus === "verified",
    ).length,
    courses: dedupedCourses,
  };
}

function courseLibraryPreference(course: {
  roundCount: number;
  holeCount: number;
  champion: unknown;
  teeSetCount: number;
  recordCount: number;
  createdByUserId: string | null;
}) {
  return (
    course.roundCount * 1000 +
    course.holeCount * 100 +
    (course.champion ? 50 : 0) +
    course.teeSetCount * 5 +
    course.recordCount +
    (course.createdByUserId ? 1 : 0)
  );
}

function courseArtworkVariant(
  course: Awaited<ReturnType<typeof getCoursesData>>["courses"][number],
) {
  return course.holeCount > 0 ? ("fairway" as const) : ("courseMap" as const);
}

function courseArtworkCrop(course: Awaited<ReturnType<typeof getCoursesData>>["courses"][number]) {
  return course.holeCount > 0 ? ("random" as const) : undefined;
}

function courseSourceLabel(
  provider: string,
  googlePlaceId: string | null,
  providerAliasCount: number,
) {
  if (googlePlaceId || provider === "google-places") {
    return "Google-enriched";
  }

  if (provider === "osm") {
    return "OSM geometry";
  }

  if (providerAliasCount > 0 || provider.toLowerCase().includes("rapsodo")) {
    return "Rapsodo alias";
  }

  if (provider === "manual") {
    return "Manual course";
  }

  return `${provider.replace(/[-_]/g, " ")} source`;
}

function courseQualitySummary(
  course: Awaited<ReturnType<typeof getCoursesData>>["courses"][number],
) {
  const checks = courseQualityChecks(course);
  const ready = checks.filter((check) => check.ready).length;

  return `${ready}/${checks.length} ready`;
}

function courseQualityTone(course: Awaited<ReturnType<typeof getCoursesData>>["courses"][number]) {
  const checks = courseQualityChecks(course);
  const ready = checks.filter((check) => check.ready).length;

  if (ready >= 5) {
    return "green";
  }

  if (ready >= 3) {
    return "amber";
  }

  return "slate";
}

function courseQualityChecks(
  course: Awaited<ReturnType<typeof getCoursesData>>["courses"][number],
) {
  return [
    {
      label: "Address",
      ready: Boolean(course.address || course.country),
    },
    {
      label: "Location",
      ready: course.latitude !== null && course.longitude !== null,
    },
    {
      label: "Google/website link",
      ready: Boolean(course.googleMapsUrl || course.websiteUrl || course.googlePlaceId),
    },
    {
      label: "18 holes",
      ready: course.holeCount >= 18,
    },
    {
      label: "Tee rating/slope",
      ready: course.ratedTeeSetCount > 0,
    },
    {
      label: "Provider alias",
      ready: course.providerAliasCount > 0 || course.provider !== "manual",
    },
  ];
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseCourseTab(value: string) {
  if (
    value === "played" ||
    value === "patterns" ||
    value === "favourites" ||
    value === "manage"
  ) {
    return value;
  }

  return "records";
}
