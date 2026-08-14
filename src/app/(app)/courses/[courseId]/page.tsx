import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Cuboid,
  Flag,
  MapPin,
  MapPinned,
  Target,
} from "lucide-react";

import { CourseFavouriteButton } from "@/app/courses/course-favourite-button";
import { CoursePreview } from "@/app/courses/course-library";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { courses, courseRecords, holes, sessions, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CourseDetailTab = "overview" | "course-twin" | "rounds";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const activeTab = parseDetailTab(first(query.tab));
  const data = await getCourseDetailData(courseId);

  if (!data) notFound();

  const primaryAction = data.courseTwin
    ? { href: `/play/${courseId}`, label: "Open Course Twin", icon: Cuboid }
    : data.strategyReady
      ? { href: `/courses/strategy?courseId=${courseId}`, label: "Open strategy", icon: Target }
      : { href: `/rounds/new?courseId=${courseId}`, label: "Plan a round", icon: Flag };
  const PrimaryIcon = primaryAction.icon;

  return (
    <PageShell contentClassName="gap-5 lg:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/courses">
            <ArrowLeft className="size-4" aria-hidden />
            Course library
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <CourseFavouriteButton courseId={courseId} courseName={data.course.name} />
          <Button asChild className="min-h-10">
            <Link href={primaryAction.href}>
              <PrimaryIcon className="size-4" aria-hidden />
              {primaryAction.label}
            </Link>
          </Button>
        </div>
      </div>

      <header className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,42%)]">
          <div className="flex min-h-64 flex-col justify-end p-5 sm:p-7 lg:min-h-72">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Course profile
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              {data.course.name}
            </h1>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground sm:text-base">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {data.location}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/70 pt-5 sm:grid-cols-4">
              <HeroMetric label="Holes" value={data.holeCount || "—"} />
              <HeroMetric label="Last played" value={formatShortDate(data.lastPlayedAt)} />
              <HeroMetric label="Rounds" value={data.rounds.length} />
              <HeroMetric label="Records" value={data.recordCount} />
            </dl>
          </div>
          <CoursePreview
            course={{
              id: data.course.id,
              name: data.course.name,
              latitude: data.course.latitude,
              longitude: data.course.longitude,
              mapPreviewAvailable: data.mapPreviewAvailable,
            }}
            priority
            className="min-h-60 lg:min-h-full"
          />
        </div>
      </header>

      <CourseDetailNavigation
        courseId={courseId}
        activeTab={activeTab}
        courseTwinReady={Boolean(data.courseTwin)}
      />

      {activeTab === "rounds" ? (
        <CourseRoundsTab rounds={data.rounds} courseId={courseId} />
      ) : activeTab === "course-twin" ? (
        <CourseTwinTab courseId={courseId} courseTwin={data.courseTwin} />
      ) : (
        <CourseOverview data={data} />
      )}
    </PageShell>
  );
}

function CourseDetailNavigation({
  courseId,
  activeTab,
  courseTwinReady,
}: {
  courseId: string;
  activeTab: CourseDetailTab;
  courseTwinReady: boolean;
}) {
  const tabs = [
    { label: "Overview", href: `/courses/${courseId}`, active: activeTab === "overview" },
    { label: "Holes", href: `/courses/${courseId}/holes?tab=holes`, active: false },
    { label: "Strategy", href: `/courses/strategy?courseId=${courseId}`, active: false },
    {
      label: "Course Twin",
      href: `/courses/${courseId}?tab=course-twin`,
      active: activeTab === "course-twin",
      ready: courseTwinReady,
    },
    { label: "Records", href: `/courses/${courseId}/records`, active: false },
    {
      label: "Rounds",
      href: `/courses/${courseId}?tab=rounds`,
      active: activeTab === "rounds",
    },
  ];

  return (
    <nav className="overflow-x-auto border-b" aria-label="Course detail">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "focus-aaa relative flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              tab.active &&
                "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
            )}
            aria-current={tab.active ? "page" : undefined}
          >
            {tab.label}
            {tab.label === "Course Twin" && tab.ready ? (
              <span className="size-1.5 rounded-full bg-primary" aria-label="ready" />
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function CourseOverview({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getCourseDetailData>>>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Course readiness
            </p>
            <CardTitle className="font-display text-2xl">Ready for your next round?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <ReadinessCard
              icon={MapPinned}
              label="Holes"
              ready={data.holeCount >= 9}
              detail={data.holeCount > 0 ? `${data.holeCount} mapped holes` : "Mapping needed"}
              href={`/courses/${data.course.id}/holes?tab=holes`}
            />
            <ReadinessCard
              icon={Target}
              label="Strategy"
              ready={data.strategyReady}
              detail={
                data.strategyReady ? "Course strategy can be built" : "Needs tees and mapped holes"
              }
              href={`/courses/strategy?courseId=${data.course.id}`}
            />
            <ReadinessCard
              icon={Cuboid}
              label="Course Twin"
              ready={Boolean(data.courseTwin)}
              detail={
                data.courseTwin
                  ? `Grade ${data.courseTwin.grade} package ready`
                  : "No playable package yet"
              }
              href={`/courses/${data.course.id}?tab=course-twin`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-end justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Round history
              </p>
              <CardTitle className="mt-2 font-display text-2xl">Recent rounds</CardTitle>
            </div>
            {data.rounds.length > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/courses/${data.course.id}?tab=rounds`}>View all</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {data.rounds.length > 0 ? (
              <div className="divide-y">
                {data.rounds.slice(0, 4).map((round) => (
                  <Link
                    key={round.id}
                    href={`/rounds/${round.id}`}
                    className="focus-aaa flex min-h-14 items-center justify-between gap-4 py-3 hover:text-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {round.courseName || data.course.name}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatLongDate(round.date)} · {formatRoundType(round.type)}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                ))}
              </div>
            ) : (
              <AppEmptyState
                icon={<Flag className="size-5" aria-hidden />}
                title="No rounds here yet"
                description="Log your first round at this course to start its playing history."
                primaryAction={
                  <Button asChild size="sm">
                    <Link href={`/rounds/new?courseId=${data.course.id}`}>Log a round</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Course facts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <FactRow label="Location" value={data.location} />
              <FactRow
                label="Holes"
                value={data.holeCount > 0 ? String(data.holeCount) : "Not mapped"}
              />
              <FactRow label="Tee sets" value={String(data.teeSetCount)} />
              <FactRow label="Last played" value={formatLongDate(data.lastPlayedAt)} />
              <FactRow label="Record boards" value={String(data.recordCount)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Next action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              {data.strategyReady
                ? "The mapped course and tee data are ready. Open Strategy to prepare decisions before you play."
                : "Complete the mapped holes and tee setup before relying on course strategy."}
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full justify-between">
              <Link
                href={
                  data.strategyReady
                    ? `/courses/strategy?courseId=${data.course.id}`
                    : `/courses/${data.course.id}/holes`
                }
              >
                {data.strategyReady ? "Prepare strategy" : "Complete course setup"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function CourseRoundsTab({
  rounds,
  courseId,
}: {
  rounds: NonNullable<Awaited<ReturnType<typeof getCourseDetailData>>>["rounds"];
  courseId: string;
}) {
  if (rounds.length === 0) {
    return (
      <AppEmptyState
        icon={<CalendarDays className="size-5" aria-hidden />}
        title="No rounds saved for this course"
        description="Once you log or import a round, it will appear here as part of this course profile."
        primaryAction={
          <Button asChild>
            <Link href={`/rounds/new?courseId=${courseId}`}>Log a round</Link>
          </Button>
        }
        className="min-h-[380px]"
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-end justify-between gap-4 space-y-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Playing history
          </p>
          <CardTitle className="mt-2 font-display text-2xl">Rounds at this course</CardTitle>
        </div>
        <Button asChild>
          <Link href={`/rounds/new?courseId=${courseId}`}>Add round</Link>
        </Button>
      </CardHeader>
      <CardContent className="divide-y">
        {rounds.map((round) => (
          <Link
            key={round.id}
            href={`/rounds/${round.id}`}
            className="focus-aaa flex min-h-16 items-center justify-between gap-4 py-3 hover:text-primary"
          >
            <div>
              <p className="font-medium text-foreground">{round.courseName || "Saved round"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatLongDate(round.date)} · {formatRoundType(round.type)}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function CourseTwinTab({
  courseId,
  courseTwin,
}: {
  courseId: string;
  courseTwin: NonNullable<Awaited<ReturnType<typeof getCourseDetailData>>>["courseTwin"];
}) {
  if (!courseTwin) {
    return (
      <AppEmptyState
        icon={<Cuboid className="size-5" aria-hidden />}
        title="Course Twin is not ready yet"
        description="This course remains usable for rounds and strategy. A playable 3D package has not been published for it."
        primaryAction={
          <Button asChild>
            <Link href={`/courses/${courseId}/holes`}>Review mapped holes</Link>
          </Button>
        }
        secondaryAction={
          <Button asChild variant="outline">
            <Link href="/course-twins">Browse ready Course Twins</Link>
          </Button>
        }
        className="min-h-[380px]"
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <div className="p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Playable 3D course
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold">Course Twin is ready</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Open the generated course to explore the terrain, replay measured shots or test your
            real dispersion against the hole.
          </p>
          <dl className="mt-6 grid max-w-lg grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/25 p-4">
              <dt className="text-xs text-muted-foreground">Quality grade</dt>
              <dd className="mt-1 text-2xl font-semibold">{courseTwin.grade}</dd>
            </div>
            <div className="rounded-lg border bg-muted/25 p-4">
              <dt className="text-xs text-muted-foreground">Mapped holes</dt>
              <dd className="mt-1 text-2xl font-semibold">{courseTwin.mappedHoles ?? "—"}</dd>
            </div>
          </dl>
          <Button asChild size="lg" className="mt-6">
            <Link href={`/play/${courseId}`}>
              <Cuboid className="size-4" aria-hidden />
              Open Course Twin
            </Link>
          </Button>
        </div>
        <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent_62%),linear-gradient(145deg,var(--muted),var(--background))]">
          <Cuboid className="size-24 text-primary/70" strokeWidth={1.25} aria-hidden />
        </div>
      </div>
    </Card>
  );
}

function ReadinessCard({
  icon: Icon,
  label,
  ready,
  detail,
  href,
}: {
  icon: typeof Target;
  label: string;
  ready: boolean;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="focus-aaa group rounded-xl border bg-muted/20 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-background text-primary shadow-sm">
          <Icon className="size-4" aria-hidden />
        </span>
        {ready ? (
          <CheckCircle2 className="size-4 text-primary" aria-label="Ready" />
        ) : (
          <Circle className="size-4 text-muted-foreground/50" aria-label="Not ready" />
        )}
      </div>
      <p className="mt-4 font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </Link>
  );
}

function HeroMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

async function getCourseDetailData(courseId: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
      ),
    )
    .limit(1);

  if (!course) return null;

  const [teeRows, holeRows, roundRows, recordRows, twins] = await Promise.all([
    db.select({ id: teeSets.id }).from(teeSets).where(eq(teeSets.courseId, courseId)),
    db.select({ holeNumber: holes.holeNumber }).from(holes).where(eq(holes.courseId, courseId)),
    db
      .select({
        id: sessions.id,
        courseName: sessions.courseName,
        date: sessions.date,
        type: sessions.type,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.courseId, courseId),
          inArray(sessions.type, ["round", "simulator", "simulated_course", "real_round"]),
        ),
      )
      .orderBy(desc(sessions.date)),
    db
      .select({ id: courseRecords.id })
      .from(courseRecords)
      .where(
        and(
          eq(courseRecords.courseId, courseId),
          eq(courseRecords.scope, "public"),
          eq(courseRecords.status, "active"),
        ),
      )
      .orderBy(asc(courseRecords.createdAt)),
    listAvailableCourseTwins(userId),
  ]);
  const holeCount = new Set(holeRows.map((row) => row.holeNumber)).size;
  const courseTwin = twins.find((twin) => twin.courseId === courseId) ?? null;

  return {
    course,
    mapPreviewAvailable: Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim()),
    location: courseLocationLabel(course.address, course.country),
    teeSetCount: teeRows.length,
    holeCount,
    strategyReady: holeCount >= 9 && teeRows.length > 0,
    courseTwin,
    recordCount: recordRows.length,
    lastPlayedAt: roundRows[0]?.date ?? null,
    rounds: roundRows,
  };
}

function parseDetailTab(value: string): CourseDetailTab {
  if (value === "rounds" || value === "course-twin") return value;
  return "overview";
}

function courseLocationLabel(address: string | null, country: string | null) {
  if (!address?.trim()) return country?.trim() || "Location not set";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(", ") || country?.trim() || "Location not set";
}

function formatShortDate(value: Date | null) {
  if (!value) return "Not played";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(value);
}

function formatLongDate(value: Date | null) {
  if (!value) return "Not played yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatRoundType(value: string) {
  if (value === "real_round" || value === "round") return "On-course round";
  if (value === "simulated_course" || value === "simulator") return "Simulator round";
  return "Round";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
