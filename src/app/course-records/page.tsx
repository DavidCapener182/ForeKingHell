import Link from "next/link";
import { ArrowLeft, Medal, Search, ShieldCheck, Trophy } from "lucide-react";

import {
  CourseRecordCard,
  EventHeroCard,
  MobileAppShell,
  MobileIconButton,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { CourseRecordFeaturePanel } from "@/components/features/feature-panels";
import { PageShell, StatusPill } from "@/components/premium";
import { CourseLogoArtwork } from "@/components/visuals/course-logo-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourseRecordsHubData, verificationTierLabel } from "@/lib/course-records";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { isGoogleImageSearchConfigured } from "@/lib/google-image-search";
import { isGooglePlacesConfigured } from "@/lib/google-places";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function CourseRecordsPage() {
  const [data, featureData] = await Promise.all([getCourseRecordsHubData(), getFeatureIdeasData()]);
  const logoLookupEnabled = isGoogleImageSearchConfigured() || isGooglePlacesConfigured();
  const featured = data.courses.find((course) => course.champion) ?? data.courses[0] ?? null;

  return (
    <PageShell size="7xl">
      <MobileAppShell>
        <MobileTopBar
          title="Course Records"
          leading={<MobileIconButton href="/courses" label="Courses" icon={ArrowLeft} />}
          actions={<MobileIconButton href="/courses" label="Search records" icon={Search} />}
        />
        <MobileRouteTabs group="play" activeKey="records" />
        <MobileTabBar
          activeKey="all"
          className="-mt-4"
          tabs={[
            { key: "all", label: "All", href: "/course-records" },
            { key: "friends", label: "Friends", href: "/leaderboard?tab=courses" },
            { key: "monthly", label: "Monthly", href: "/leaderboard?tab=monthly" },
            { key: "mine", label: "Mine", href: "/profile?tab=records" },
          ]}
        />
        <MobileStatusAction
          label="Verified course champions"
          value={integerFormatter.format(data.verifiedChampions)}
          detail={`${integerFormatter.format(data.totalRecords)} record boards across visible courses`}
          action={
            featured ? (
              <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                <Link href={`/courses/${featured.id}/records`} prefetch={false}>Open</Link>
              </Button>
            ) : null
          }
        />
        {featured ? (
          <EventHeroCard
            eyebrow="Featured champion"
            title={featured.name}
            description={
              featured.champion
                ? `${featured.champion.displayName} leads with ${featured.champion.scoreLabel}`
                : "No champion yet. Set the first verified mark."
            }
            href={`/courses/${featured.id}/records`}
            actionLabel="Challenge"
            meta={<span>{featured.recordCount} boards · {featured.liveAttemptCount} live attempts</span>}
            media={
              <CourseLogoArtwork
                courseName={featured.name}
                country={featured.country}
                alt=""
                logoLookupEnabled={logoLookupEnabled}
                className="block h-full min-h-0 rounded-none"
                sizes="100vw"
                priority
              />
            }
          />
        ) : null}
        <NativeListSection title="Honours boards">
          {data.courses.map((course) => (
            <CourseRecordCard
              key={course.id}
              href={`/courses/${course.id}/records`}
              title={course.name}
              champion={course.champion?.displayName}
              score={course.champion?.scoreLabel}
              proof={course.champion?.verificationTier}
              cta="Open"
            />
          ))}
          {data.courses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
              No courses are available yet. Seed known courses from Courses.
            </p>
          ) : null}
        </NativeListSection>
        <CourseRecordFeaturePanel data={featureData} />
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
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

      <div className="hidden sm:contents">
      <header className="premium-hero overflow-hidden">
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
          <div className="rounded-lg border bg-[#F5F6F4] p-3">
            <p className="text-sm font-semibold">Today’s board</p>
            {featured ? (
              <Link href={`/courses/${featured.id}/records`} prefetch={false} className="mt-3 block">
                <CourseLogoArtwork
                  courseName={featured.name}
                  country={featured.country}
                  alt=""
                  logoLookupEnabled={logoLookupEnabled}
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

      <CourseRecordFeaturePanel data={featureData} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}/records`}
            prefetch={false}
            className="premium-card p-4 transition hover:border-emerald-300"
          >
            <CourseLogoArtwork
              courseName={course.name}
              country={course.country}
              alt=""
              logoLookupEnabled={logoLookupEnabled}
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
            <div className="mt-3 rounded-lg bg-[#F5F6F4] p-3 text-sm">
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
      </div>
    </PageShell>
  );
}
