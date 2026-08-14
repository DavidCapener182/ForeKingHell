import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  MapPinned,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings,
  Trophy,
  MoreHorizontal,
} from "lucide-react";
import { and, asc, eq, inArray, or } from "drizzle-orm";

import { seedKnownCoursesAction } from "@/app/courses/actions";
import { CourseFollowFeaturePanel } from "@/components/features/feature-panels";
import {
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import {
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
} from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Table,
  TableBody,
  TableCaption,
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
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { CourseDirectoryControls } from "@/app/courses/course-directory-toolbar";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

type CourseDirectoryCourse = Awaited<ReturnType<typeof getCoursesData>>["courses"][number];
type CourseSortMetric =
  | "course"
  | "provider"
  | "quality"
  | "records"
  | "champion"
  | "tees"
  | "holes"
  | "rounds";
type CourseSortDirection = "asc" | "desc";
type CourseSortState = {
  metric: CourseSortMetric;
  dir: CourseSortDirection;
};

const courseWorkbenchColumns: DesktopWorkbenchColumn[] = [
  { id: "course", label: "Course", locked: true },
  { id: "provider", label: "Provider" },
  { id: "quality", label: "Data quality" },
  { id: "records", label: "Records" },
  { id: "champion", label: "Champion" },
  { id: "tees", label: "Tee sets" },
  { id: "holes", label: "Mapped holes" },
  { id: "rounds", label: "Rounds" },
  { id: "actions", label: "Actions", locked: true },
];

const courseSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Mapped courses",
    href: "/courses?tab=patterns",
    detail: "Courses with saved hole geometry for pattern and shot-map work.",
  },
  {
    title: "Played courses",
    href: "/courses?tab=played",
    detail: "Courses with saved rounds linked to the record and handicap loop.",
  },
  {
    title: "Course data cleanup",
    href: "/courses?tab=manage",
    detail: "Find missing tees, hole geometry and rating/slope gaps.",
  },
];

const coursesWorkbenchPrompts = [
  {
    label: "Explain this page",
    prompt:
      "Explain my ForeKingHell Courses page using only visible course, record, tee-set, mapped-hole, linked-round and data-quality evidence. Do not invent missing numbers.",
    icon: Search,
  },
  {
    label: "What changed?",
    prompt:
      "Compare the current course directory with the previous useful course period. Cite visible course, record, mapping, tee-set and round-link changes.",
    icon: RefreshCw,
  },
  {
    label: "Find records to chase",
    prompt:
      "Use visible course records, champions, linked rounds and mapped-hole evidence to suggest which course records are worth chasing next.",
    icon: Trophy,
  },
  {
    label: "Build course data plan",
    prompt:
      "Build a course data cleanup plan from visible missing holes, tee sets, ratings, provider aliases and round links. Flag low-confidence gaps.",
    icon: Route,
  },
  {
    label: "Generate course report",
    prompt:
      "Generate a course directory report with mapped coverage, record boards, linked rounds, weak data-quality areas and next management actions.",
    icon: MapPinned,
  },
];

const courseSortLabels: Record<CourseSortMetric, string> = {
  course: "Course",
  provider: "Provider",
  quality: "Data quality",
  records: "Records",
  champion: "Champion",
  tees: "Tee sets",
  holes: "Mapped holes",
  rounds: "Rounds",
};

const courseSortDefaultDirections: Record<CourseSortMetric, CourseSortDirection> = {
  course: "asc",
  provider: "asc",
  quality: "desc",
  records: "desc",
  champion: "asc",
  tees: "desc",
  holes: "desc",
  rounds: "desc",
};

type CourseSearchParams = { [key: string]: string | string[] | undefined };
type SearchParams = Promise<CourseSearchParams>;

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, surface] = await Promise.all([searchParams, getRequestAppSurface()]);
  return (
    <Suspense fallback={<CoursesPageLoading surface={surface} />}>
      <CoursesPageContent params={params} surface={surface} />
    </Suspense>
  );
}

async function CoursesPageContent({
  params,
  surface,
}: {
  params: CourseSearchParams;
  surface: "companion" | "workbench";
}) {
  const query = first(params.q).trim().slice(0, 80);
  const activeTab = parseCourseTab(first(params.tab));
  const directoryView = parseCourseDirectoryView(first(params.view));
  const courseSort: CourseSortState = {
    metric: parseCourseSortMetric(first(params.sort)),
    dir: parseCourseSortDirection(first(params.dir)),
  };
  const [data, featureData] = await Promise.all([getCoursesData(), getCourseFollowFeatureData()]);
  const searchedCourses = query
    ? data.courses.filter((course) =>
        [course.name, course.country, course.provider].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : data.courses;
  const shotPatternEnabled = isShotPatternFeatureEnabled();
  const mappedCourses = data.courses.filter((course) => course.holeCount > 0);
  const patternCourses = shotPatternEnabled
    ? searchedCourses.filter((course) => course.holeCount > 0)
    : [];
  const roundLinkedCourses = data.courses.filter((course) => course.roundCount > 0);
  const playedCourses = searchedCourses.filter((course) => course.roundCount > 0);
  const displayedCourses =
    activeTab === "played"
      ? playedCourses
      : activeTab === "patterns"
        ? patternCourses
        : searchedCourses;
  const sortedDisplayedCourses = sortCourses(displayedCourses, courseSort);
  const heroArtworkVariant = mappedCourses.length > 0 ? "fairway" : "courseMap";
  const displayedMappedCourses = sortedDisplayedCourses.filter((course) => course.holeCount > 0);
  const displayedRatedCourses = sortedDisplayedCourses.filter(
    (course) => course.ratedTeeSetCount > 0,
  );
  const focusCourse = sortedDisplayedCourses[0] ?? null;
  const courseCurrentViewLabel = [
    activeTab === "played"
      ? "Played courses"
      : activeTab === "patterns"
        ? "Mapped course patterns"
        : activeTab === "manage"
          ? "Course data cleanup"
          : "All courses",
    query ? `search: ${query}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const mobileCourses = sortedDisplayedCourses;

  if (surface === "companion") {
    return (
      <PageShell>
        <MobileAppShell>
          <MobileTopBar title="Courses" />
          <MobileRouteTabs group="play" activeKey="courses" />
          <MobileTabBar
            activeKey={activeTab}
            className="-mt-4"
            tabs={[
              { key: "records", label: "Records", href: "/courses" },
              { key: "patterns", label: "Patterns", href: "/courses?tab=patterns" },
              { key: "played", label: "Played", href: "/courses?tab=played" },
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
              <Button asChild className="min-h-11">
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

          <CourseDirectoryControls
            key={`${activeTab}:${query}`}
            surface="companion"
            query={query}
            activeTab={activeTab}
            resultLabel={`${integerFormatter.format(mobileCourses.length)} courses`}
          />

          {activeTab === "manage" ? (
            <Card data-course-companion-management>
              <CardHeader>
                <CardTitle>Course management</CardTitle>
                <CardDescription>Seed the known catalogue or create a new course.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <form action={seedKnownCoursesAction}>
                  <Button type="submit" variant="outline" className="min-h-11 w-full">
                    <RefreshCw className="size-4" />
                    Seed known
                  </Button>
                </form>
                <Button asChild className="min-h-11 w-full">
                  <Link href="/courses/new" prefetch={false}>
                    <Plus className="size-4" />
                    New
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card data-course-companion-directory>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle>{mobileCourseDirectoryTitle(activeTab)}</CardTitle>
                <CardDescription>{mobileCourseDirectoryDescription(activeTab)}</CardDescription>
              </div>
              <Badge variant="secondary">{mobileCourses.length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2">
              {mobileCourses.length > 0 ? (
                mobileCourses.map((course) => (
                  <Item key={course.id} variant="outline" className="items-start">
                    <ItemMedia className="rounded-lg bg-primary/10 p-2 text-primary">
                      {activeTab === "patterns" ? (
                        <MapPinned className="size-4" aria-hidden />
                      ) : activeTab === "manage" ? (
                        <Settings className="size-4" aria-hidden />
                      ) : (
                        <Trophy className="size-4" aria-hidden />
                      )}
                    </ItemMedia>
                    <ItemContent className="space-y-1">
                      <ItemTitle>{course.name}</ItemTitle>
                      <ItemDescription className="whitespace-normal">
                        {mobileCourseDetail(course, activeTab)}
                      </ItemDescription>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-medium text-foreground">
                          {mobileCourseValue(course, activeTab)}
                        </span>
                        <Badge variant={mobileCourseStatusVariant(course, activeTab)}>
                          {mobileCourseStatus(course, activeTab)}
                        </Badge>
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link
                          href={mobileCourseHref(course, activeTab)}
                          prefetch={false}
                          aria-label={`Open ${course.name}`}
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </Button>
                    </ItemActions>
                  </Item>
                ))
              ) : (
                <AppEmptyState
                  icon={<MapPinned className="size-5" />}
                  title={
                    activeTab === "patterns" ? "No mapped course patterns" : "No courses found"
                  }
                  description={
                    activeTab === "patterns"
                      ? "Open Manage to map course holes first."
                      : "Clear the course filter or choose another view."
                  }
                  primaryAction={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/courses" prefetch={false}>
                        Clear filter
                      </Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card data-course-companion-readiness>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>Course data readiness</CardTitle>
                <CardDescription>Mapping, ratings, rounds and record coverage.</CardDescription>
              </div>
              <Badge variant="outline">
                {mappedCourses.length}/{data.courses.length} mapped
              </Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <CourseReadinessItem label="Mapped courses" value={mappedCourses.length} />
              <CourseReadinessItem label="Rated tee sets" value={data.ratedTeeSetCount} />
              <CourseReadinessItem label="Linked rounds" value={data.roundCount} />
              <CourseReadinessItem label="Record boards" value={data.recordCount} />
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full">
                <Link href="/courses?tab=manage" prefetch={false}>
                  <Settings className="size-4" />
                  Manage course data
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {activeTab === "manage" ? (
            <CourseFollowFeaturePanel data={featureData} courseId={focusCourse?.id ?? null} />
          ) : null}
        </MobileAppShell>
      </PageShell>
    );
  }

  const { DesktopInsightRail, DesktopTableWorkbenchControls, DesktopWorkbenchLayout } =
    await import("@/components/app/desktop-workbench");

  return (
    <PageShell>
      <DesktopWorkbenchLayout
        scope="courses"
        rail={
          <DesktopInsightRail
            title="AI course rail"
            description="Course library, mapping coverage and record context stay visible while reviewing where to play or clean data next."
            metrics={[
              {
                label: "Visible courses",
                value: integerFormatter.format(displayedCourses.length),
                detail: query ? `Filtered by "${query}".` : "All deduped player-facing courses.",
                tone: displayedCourses.length > 0 ? "green" : "amber",
              },
              {
                label: "Mapped courses",
                value: integerFormatter.format(displayedMappedCourses.length),
                detail: `${integerFormatter.format(mappedCourses.length)} total courses have saved hole geometry.`,
                tone: displayedMappedCourses.length > 0 ? "sky" : "amber",
              },
              {
                label: "Rated tee coverage",
                value: integerFormatter.format(displayedRatedCourses.length),
                detail: `${integerFormatter.format(data.ratedTeeSetCount)} tee sets include rating and slope data.`,
                tone: displayedRatedCourses.length > 0 ? "green" : "amber",
              },
              {
                label: "Linked rounds",
                value: integerFormatter.format(data.roundCount),
                detail: `${integerFormatter.format(roundLinkedCourses.length)} courses are connected to saved rounds.`,
                tone: data.roundCount > 0 ? "green" : "slate",
              },
            ]}
            evidence={[
              `${integerFormatter.format(displayedCourses.length)} courses are visible in the current directory view.`,
              `${integerFormatter.format(data.recordCount)} record boards and ${integerFormatter.format(data.championCount)} verified champions are available.`,
              `${integerFormatter.format(data.teeSetCount)} tee sets and ${integerFormatter.format(data.ratedTeeSetCount)} rated tee sets are stored.`,
              focusCourse
                ? `${focusCourse.name} is the current first course with ${focusCourse.holeCount} mapped holes and ${focusCourse.roundCount} linked rounds.`
                : "No course row is visible, so AI should not infer course-specific readiness.",
            ]}
            prompts={coursesWorkbenchPrompts}
            actions={[
              {
                label: "Course records",
                href: "/course-records",
                detail: "Open cross-course record boards.",
                icon: Trophy,
              },
              {
                label: "New course",
                href: "/courses/new",
                detail: "Create or import a course setup.",
                icon: Plus,
              },
              {
                label: "Manage first course",
                href: focusCourse ? `/courses/${focusCourse.id}/holes` : "#course-library",
                detail: focusCourse
                  ? "Open tee sets, hole data and map management."
                  : "Seed or create a course before managing holes.",
                icon: Settings,
              },
            ]}
          />
        }
      >
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

        <div className="contents">
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

          <CourseFollowFeaturePanel data={featureData} courseId={focusCourse?.id ?? null} />

          <CourseDirectoryControls
            surface="workbench"
            query={query}
            activeTab={activeTab}
            view={directoryView}
            resultLabel={`${integerFormatter.format(sortedDisplayedCourses.length)} courses`}
            courses={data.courses.map((course) => ({
              value: course.id,
              label: course.name,
              description: course.country ?? course.sourceLabel,
            }))}
          />

          <ConnectedMetricBar
            label="Course directory metrics"
            metrics={[
              {
                label: "Course champions",
                value: integerFormatter.format(data.championCount),
                detail: "Verified leaders across visible course boards.",
              },
              {
                label: "Handicap quality",
                value: integerFormatter.format(data.ratedTeeSetCount),
                detail: "Tee sets with rating and slope.",
              },
              {
                label: "Mapped courses",
                value: integerFormatter.format(mappedCourses.length),
                detail: "Courses with saved hole geometry.",
              },
              {
                label: "Linked rounds",
                value: integerFormatter.format(data.roundCount),
                detail: `${integerFormatter.format(roundLinkedCourses.length)} courses used by rounds.`,
              },
            ]}
          />

          <CourseDataQualityPanel courses={displayedCourses} />

          {directoryView === "grid" ? (
            <CourseDirectoryGrid
              courses={sortedDisplayedCourses}
              shotPatternEnabled={shotPatternEnabled}
            />
          ) : null}

          {directoryView === "table" ? (
            <DataPanel id="course-library">
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
                <DesktopTableWorkbenchControls
                  viewKey="courses"
                  scope="courses"
                  currentViewLabel={courseCurrentViewLabel}
                  resultLabel={`${integerFormatter.format(displayedCourses.length)} courses`}
                  columns={courseWorkbenchColumns}
                  suggestedViews={courseSuggestedViews}
                  exportTableId="courses"
                  exportFileName="forekinghell-courses-view.csv"
                  className="mb-3"
                />
                <DataTableFrame mainTable mainTableLabel="Course library table" stickyFirstColumn>
                  <Table
                    className="min-w-[980px]"
                    data-workbench-scope="courses"
                    data-workbench-export-table="courses"
                    aria-describedby="courses-table-summary"
                  >
                    <TableCaption id="courses-table-summary" className="sr-only">
                      Course library with provider source, data quality, record boards, champions,
                      tee sets, mapped holes, linked rounds and management actions.
                    </TableCaption>
                    <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                      <TableRow>
                        <TableHead
                          data-column="course"
                          className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_70%,transparent)]"
                          aria-sort={
                            courseSort.metric === "course" ? sortAriaValue(courseSort.dir) : "none"
                          }
                        >
                          <SortableCourseHeadLink
                            activeTab={activeTab}
                            metric="course"
                            query={query}
                            sortState={courseSort}
                          />
                        </TableHead>
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="provider"
                          metric="provider"
                          query={query}
                          sortState={courseSort}
                        />
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="quality"
                          metric="quality"
                          query={query}
                          sortState={courseSort}
                        />
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="records"
                          metric="records"
                          query={query}
                          sortState={courseSort}
                          align="right"
                        />
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="champion"
                          metric="champion"
                          query={query}
                          sortState={courseSort}
                        />
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="tees"
                          metric="tees"
                          query={query}
                          sortState={courseSort}
                          align="right"
                        />
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="holes"
                          metric="holes"
                          query={query}
                          sortState={courseSort}
                          align="right"
                        />
                        <SortableCourseHead
                          activeTab={activeTab}
                          columnId="rounds"
                          metric="rounds"
                          query={query}
                          sortState={courseSort}
                          align="right"
                        />
                        <TableHead data-column="actions" className="text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDisplayedCourses.map((course) => (
                        <TableRow key={course.id} tabIndex={0} className="focus-aaa outline-none">
                          <TableCell
                            data-column="course"
                            className="sticky left-0 z-10 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_70%,transparent)]"
                          >
                            <div>
                              <Link
                                href={`/courses/${course.id}/holes`}
                                prefetch={false}
                                className="font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {course.name}
                              </Link>
                              <p className="text-sm text-muted-foreground">
                                {course.country ?? "Country not set"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell data-column="provider">
                            <Badge variant={course.provider === "manual" ? "outline" : "secondary"}>
                              {course.sourceLabel}
                            </Badge>
                          </TableCell>
                          <TableCell data-column="quality">
                            <span className="text-sm text-muted-foreground">
                              {courseQualitySummary(course)}
                            </span>
                          </TableCell>
                          <TableCell data-column="records" className="text-right">
                            {course.recordCount}
                          </TableCell>
                          <TableCell data-column="champion">
                            {course.champion ? (
                              <span className="text-sm font-medium">
                                {course.champion.displayName}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Open</span>
                            )}
                          </TableCell>
                          <TableCell data-column="tees" className="text-right">
                            {course.teeSetCount}
                          </TableCell>
                          <TableCell data-column="holes" className="text-right">
                            <span
                              className={
                                course.holeCount >= 18
                                  ? "font-semibold text-[var(--status-success-foreground)]"
                                  : "font-semibold text-[var(--status-warning-foreground)]"
                              }
                            >
                              {course.holeCount}
                            </span>
                          </TableCell>
                          <TableCell data-column="rounds" className="text-right">
                            {course.roundCount}
                          </TableCell>
                          <TableCell data-column="actions" className="text-right">
                            <CourseActionsMenu
                              course={course}
                              shotPatternEnabled={shotPatternEnabled}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {sortedDisplayedCourses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="p-4">
                            <AppEmptyState
                              icon={<MapPinned className="size-5" />}
                              title="No courses"
                              description="Seed the known course library or create a course manually."
                              primaryAction={
                                <Button asChild size="sm">
                                  <Link href="/courses/new">Create course</Link>
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </DataTableFrame>
              </CardContent>
            </DataPanel>
          ) : null}
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function CourseDirectoryGrid({
  courses,
  shotPatternEnabled,
}: {
  courses: CourseDirectoryCourse[];
  shotPatternEnabled: boolean;
}) {
  if (courses.length === 0) {
    return (
      <AppEmptyState
        icon={<MapPinned className="size-5" />}
        title="No courses"
        description="Seed the known course library or create a course manually."
        primaryAction={
          <Button asChild>
            <Link href="/courses/new">Create course</Link>
          </Button>
        }
      />
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-course-directory-grid>
      {courses.map((course, index) => (
        <Card key={course.id} className="overflow-hidden">
          <PageArtwork
            variant={courseArtworkVariant(course)}
            alt=""
            crop={courseArtworkCrop(course)}
            cropKey={course.id}
            className="block h-32 min-h-0 rounded-none border-0"
            sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
            priority={index === 0}
          />
          <CardHeader className="gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge variant={course.holeCount > 0 ? "secondary" : "outline"}>
                  {course.holeCount > 0 ? `${course.holeCount} holes mapped` : "Mapping needed"}
                </Badge>
                <CardTitle className="mt-2 truncate text-lg">{course.name}</CardTitle>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {course.country ?? "Country not set"} · {course.sourceLabel}
                </p>
              </div>
              <CourseActionsMenu course={course} shotPatternEnabled={shotPatternEnabled} />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 divide-x rounded-lg border bg-muted/25 text-center">
              <CourseGridMetric label="Records" value={course.recordCount} />
              <CourseGridMetric label="Tee sets" value={course.teeSetCount} />
              <CourseGridMetric label="Rounds" value={course.roundCount} />
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">{courseQualitySummary(course)}</p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href={`/courses/${course.id}/holes`} prefetch={false}>
                <Settings className="size-4" />
                Open course
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </section>
  );
}

function CourseGridMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 p-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CourseActionsMenu({
  course,
  shotPatternEnabled,
}: {
  course: CourseDirectoryCourse;
  shotPatternEnabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "outline", size: "icon-sm" })}
        aria-label={`Actions for ${course.name}`}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Course actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/courses/${course.id}/records`} prefetch={false}>
            <Trophy className="size-4" />
            Records
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/courses/${course.id}/holes`} prefetch={false}>
            <Settings className="size-4" />
            Manage course
          </Link>
        </DropdownMenuItem>
        {shotPatternEnabled && course.holeCount > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/courses/${course.id}/shot-pattern`} prefetch={false}>
                <MapPinned className="size-4" />
                Shot pattern
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function mobileCourseHref(
  course: CourseDirectoryCourse,
  activeTab: ReturnType<typeof parseCourseTab>,
) {
  if (activeTab === "patterns") {
    return `/courses/${course.id}/shot-pattern`;
  }

  if (activeTab === "manage") {
    return `/courses/${course.id}/holes`;
  }

  return `/courses/${course.id}/records`;
}

function mobileCourseValue(
  course: CourseDirectoryCourse,
  activeTab: ReturnType<typeof parseCourseTab>,
) {
  if (activeTab === "patterns") return `${course.holeCount} holes`;
  if (activeTab === "played") return `${course.roundCount} rounds`;
  if (activeTab === "manage") return `${course.holeCount} mapped holes`;
  return `${course.recordCount} boards`;
}

function mobileCourseDetail(
  course: CourseDirectoryCourse,
  activeTab: ReturnType<typeof parseCourseTab>,
) {
  const location = course.country ?? "Course";

  if (activeTab === "patterns") {
    return `${location} · ${course.teeSetCount} tee sets · ${course.sourceLabel}`;
  }

  if (activeTab === "played") {
    return `${location} · ${course.recordCount} record boards`;
  }

  if (activeTab === "manage") {
    return `${location} · ${course.teeSetCount} tee sets · ${course.sourceLabel}`;
  }

  return course.champion
    ? `${location} · champion ${course.champion.displayName}`
    : `${location} · no verified champion yet`;
}

function mobileCourseStatus(
  course: CourseDirectoryCourse,
  activeTab: ReturnType<typeof parseCourseTab>,
) {
  if (activeTab === "patterns") return "Overlay ready";
  if (activeTab === "played") return "Played course";
  if (activeTab === "manage") return courseQualitySummary(course);
  if (course.championVerificationStatus === "verified") return "Verified champion";
  return "Open board";
}

function mobileCourseStatusVariant(
  course: CourseDirectoryCourse,
  activeTab: ReturnType<typeof parseCourseTab>,
): "default" | "secondary" | "outline" {
  if (activeTab === "manage") {
    return courseQualityTone(course) === "green" ? "default" : "secondary";
  }
  if (activeTab === "patterns" || activeTab === "played") return "secondary";
  return course.championVerificationStatus === "verified" ? "default" : "outline";
}

function mobileCourseDirectoryTitle(activeTab: ReturnType<typeof parseCourseTab>) {
  if (activeTab === "played") return "Played courses";
  if (activeTab === "patterns") return "Course patterns";
  if (activeTab === "manage") return "Courses to manage";
  return "Record boards";
}

function mobileCourseDirectoryDescription(activeTab: ReturnType<typeof parseCourseTab>) {
  if (activeTab === "patterns") {
    return "Mapped courses ready for dispersion overlays.";
  }
  if (activeTab === "played") {
    return "Courses connected to your saved rounds.";
  }
  if (activeTab === "manage") {
    return "Open tee sets, hole mapping and provider data.";
  }
  return "Champions and live record boards first.";
}

function CourseReadinessItem({ label, value }: { label: string; value: number }) {
  return (
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemDescription>{label}</ItemDescription>
        <ItemTitle className="text-base tabular-nums">{integerFormatter.format(value)}</ItemTitle>
      </ItemContent>
    </Item>
  );
}

function CoursesPageLoading({ surface }: { surface: "companion" | "workbench" }) {
  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar title="Courses" />
          <MobileRouteTabs group="play" activeKey="courses" />
          <div className="grid gap-3 p-4">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </MobileAppShell>
      ) : (
        <div className="grid gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      )}
    </PageShell>
  );
}

function SortableCourseHead({
  activeTab,
  align = "left",
  columnId,
  metric,
  query,
  sortState,
}: {
  activeTab: string;
  align?: "left" | "right";
  columnId: string;
  metric: CourseSortMetric;
  query: string;
  sortState: CourseSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <TableHead
      data-column={columnId}
      className={align === "right" ? "text-right" : undefined}
      aria-sort={active ? sortAriaValue(sortState.dir) : "none"}
    >
      <SortableCourseHeadLink
        activeTab={activeTab}
        align={align}
        metric={metric}
        query={query}
        sortState={sortState}
      />
    </TableHead>
  );
}

function SortableCourseHeadLink({
  activeTab,
  align = "left",
  metric,
  query,
  sortState,
}: {
  activeTab: string;
  align?: "left" | "right";
  metric: CourseSortMetric;
  query: string;
  sortState: CourseSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: CourseSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : courseSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = courseSortLabels[metric];

  return (
    <Link
      href={courseSortHref({ activeTab, dir: nextDir, metric, query })}
      prefetch={false}
      className={`focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
      aria-label={`Sort courses by ${label}, ${sortDirectionCopy(nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-primary" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function courseSortHref({
  activeTab,
  dir,
  metric,
  query,
}: {
  activeTab: string;
  dir: CourseSortDirection;
  metric: CourseSortMetric;
  query: string;
}) {
  const params = new URLSearchParams();

  if (activeTab !== "records") {
    params.set("tab", activeTab);
  }

  if (query) {
    params.set("q", query);
  }

  params.set("sort", metric);
  params.set("dir", dir);

  const search = params.toString();
  return search ? `/courses?${search}` : "/courses";
}

function sortCourses(courses: CourseDirectoryCourse[], sortState: CourseSortState) {
  return [...courses].sort((left, right) => {
    const result = compareCourseValues(left, right, sortState.metric, sortState.dir);

    if (result !== 0) {
      return result;
    }

    return compareCourseValues(left, right, "course", "asc");
  });
}

function compareCourseValues(
  left: CourseDirectoryCourse,
  right: CourseDirectoryCourse,
  metric: CourseSortMetric,
  dir: CourseSortDirection,
) {
  const direction = dir === "asc" ? 1 : -1;

  switch (metric) {
    case "course":
      return left.name.localeCompare(right.name) * direction;
    case "provider":
      return left.sourceLabel.localeCompare(right.sourceLabel) * direction;
    case "quality":
      return compareNumbers(courseQualityScore(left), courseQualityScore(right), dir);
    case "records":
      return compareNumbers(left.recordCount, right.recordCount, dir);
    case "champion":
      return compareStrings(
        left.champion?.displayName ?? null,
        right.champion?.displayName ?? null,
        dir,
      );
    case "tees":
      return compareNumbers(left.teeSetCount, right.teeSetCount, dir);
    case "holes":
      return compareNumbers(left.holeCount, right.holeCount, dir);
    case "rounds":
      return compareNumbers(left.roundCount, right.roundCount, dir);
  }
}

function compareNumbers(left: number, right: number, dir: CourseSortDirection) {
  return dir === "asc" ? left - right : right - left;
}

function compareStrings(left: string | null, right: string | null, dir: CourseSortDirection) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const result = left.localeCompare(right);
  return dir === "asc" ? result : -result;
}

function courseQualityScore(course: CourseDirectoryCourse) {
  return courseQualityChecks(course).filter((check) => check.ready).length;
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
    <Card data-course-data-quality>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Course data quality</CardTitle>
            <CardDescription className="mt-1 max-w-4xl leading-6">
              Source labels and health checks make Google, OSM, Rapsodo aliases and manual setup
              visible before users trust a board.
            </CardDescription>
          </div>
          <Badge variant={courseQualityScore(focusCourse) >= 3 ? "secondary" : "outline"}>
            {courseQualitySummary(focusCourse)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ConnectedMetricBar
          embedded
          label="Course directory data quality"
          metrics={[
            {
              label: "Google-enriched",
              value: `${integerFormatter.format(googleEnriched)} courses`,
            },
            {
              label: "18 holes mapped",
              value: `${integerFormatter.format(mappedCourses)} courses`,
            },
            { label: "Rating / slope", value: `${integerFormatter.format(ratedCourses)} courses` },
            {
              label: "Provider aliases",
              value: `${integerFormatter.format(aliasMatched)} courses`,
            },
          ]}
        />
        <Alert>
          <MapPinned className="size-4" aria-hidden="true" />
          <AlertTitle>{focusCourse.name}</AlertTitle>
          <AlertDescription>
            {focusCourse.sourceLabel} · {courseQualitySummary(focusCourse)}. Missing evidence stays
            visible below before this course is used for records or mapping.
          </AlertDescription>
        </Alert>
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{focusCourse.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{focusCourse.sourceLabel}</p>
            </div>
            <Badge variant="outline">{courseQualitySummary(focusCourse)}</Badge>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {courseQualityChecks(focusCourse).map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between gap-3 rounded-md bg-card px-2 py-1.5 ring-1 ring-border"
              >
                <span className="text-muted-foreground">{check.label}</span>
                <span
                  className={
                    check.ready ? "font-medium text-primary" : "font-medium text-accent-foreground"
                  }
                >
                  {check.ready ? "Found" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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
          .where(
            and(
              inArray(courseRecords.courseId, visibleCourseIds),
              eq(courseRecords.scope, "public"),
              eq(courseRecords.status, "active"),
            ),
          )
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

function parseCourseSortMetric(value: string): CourseSortMetric {
  if (
    value === "course" ||
    value === "provider" ||
    value === "quality" ||
    value === "records" ||
    value === "champion" ||
    value === "tees" ||
    value === "holes" ||
    value === "rounds"
  ) {
    return value;
  }

  return "course";
}

function parseCourseSortDirection(value: string): CourseSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function sortAriaValue(dir: CourseSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function sortDirectionCopy(dir: CourseSortDirection) {
  return dir === "desc" ? "high to low" : "low to high";
}

function parseCourseTab(value: string) {
  if (value === "played" || value === "patterns" || value === "favourites" || value === "manage") {
    return value;
  }

  return "records";
}

function parseCourseDirectoryView(value: string): "grid" | "table" {
  return value === "grid" ? "grid" : "table";
}
