import Link from "next/link";
import { ArrowLeft, Medal, ShieldCheck, Trophy } from "lucide-react";

import { PageShell, StatusPill } from "@/components/premium";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourseRecordsHubData, verificationTierLabel } from "@/lib/course-records";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function CourseRecordsPage() {
  const data = await getCourseRecordsHubData();
  const featured = data.courses.find((course) => course.champion) ?? data.courses[0] ?? null;

  return (
    <PageShell size="7xl">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/courses" prefetch={false}>
            <ArrowLeft className="size-4" />
            Courses
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/tournaments" prefetch={false}>
            <Trophy className="size-4" />
            Tournaments
          </Link>
        </Button>
      </div>

      <header className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <StatusPill tone="amber">Course records</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">Become the Course Champion</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Set the record, defend it, and keep verified boards separate from manual scorecards.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">{integerFormatter.format(data.totalRecords)} boards</Badge>
              <Badge variant="outline">{integerFormatter.format(data.verifiedChampions)} verified champions</Badge>
              <Badge variant="outline">Gold · Silver · Bronze proof</Badge>
            </div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm font-semibold">Today’s board</p>
            {featured ? (
              <Link href={`/courses/${featured.id}/records`} prefetch={false} className="mt-3 block">
                <PageArtwork
                  variant="fairway"
                  alt=""
                  crop="random"
                  cropKey={featured.id}
                  className="mb-3 block h-24 min-h-0 rounded-lg"
                  sizes="(min-width: 1024px) 320px, 100vw"
                />
                <p className="font-semibold tracking-normal">{featured.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {featured.champion
                    ? `${featured.champion.displayName} leads with ${featured.champion.scoreLabel}`
                    : "No champion yet. Set the first verified mark."}
                </p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Add or seed a course to open record boards.</p>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}/records`}
            prefetch={false}
            className="rounded-xl border bg-white p-4 shadow-sm transition hover:border-emerald-300"
          >
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={course.id}
              className="mb-3 block h-24 min-h-0 rounded-lg"
              sizes="(min-width: 1024px) 33vw, 90vw"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold tracking-normal">{course.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{course.country ?? "Course board"}</p>
              </div>
              <Badge variant="outline">{course.recordCount}</Badge>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              {course.champion ? (
                <>
                  <p className="flex items-center gap-2 font-medium">
                    <Medal className="size-4 text-amber-600" />
                    {course.champion.displayName}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {course.champion.scoreLabel} · {verificationTierLabel(course.champion.verificationTier)}
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="size-4" />
                  No verified champion yet
                </p>
              )}
            </div>
          </Link>
        ))}
        {data.courses.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
            No courses are available yet. Seed known courses from the Courses page.
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
