import Link from "next/link";
import { cookies } from "next/headers";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Cuboid, Flag, Search, ShieldCheck } from "lucide-react";

import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { CompanionImageHero } from "@/components/app/companion-image-hero";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { sessions, teeSets } from "@/db/schema";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";
import { SELECTED_COURSE_COOKIE } from "@/lib/selected-course";

export const dynamic = "force-dynamic";

export default async function PlayCompanionPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const twins = await listAvailableCourseTwins(userId);
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const requestedCourseId = params.courseId ?? cookieStore.get(SELECTED_COURSE_COOKIE)?.value;
  const selected =
    twins.find((course) => course.courseId === requestedCourseId) ?? twins[0] ?? null;
  const [teeSet, latestRound] = await Promise.all([
    selected ? getSelectedTeeSet(selected.courseId) : null,
    getLatestRound(userId),
  ]);

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-play-companion-hub>
        <MobileTopBar title="Play" />
        <CompanionImageHero
          variant="play"
          label={selected?.name ?? "Course strategy"}
          alt="An illustrated aerial golf-hole strategy showing the target, hazards and route to the green"
        />

        <section className="grid gap-3">
          <div className="ios-grouped-list grid gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Selected course
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {selected?.name ?? "Choose a mapped course"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {teeSet?.name ?? "Tee not selected"}
                  {teeSet?.yards ? ` · ${teeSet.yards.toLocaleString("en-GB")} yd` : ""}
                </p>
              </div>
              <IOSInlineStatus
                label={selected ? `Grade ${selected.grade}` : "Not selected"}
                tone={selected ? "positive" : "attention"}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="min-h-12 rounded-xl">
                <Link
                  href={
                    selected ? `/courses/strategy?courseId=${selected.courseId}` : "/course-twins"
                  }
                >
                  Course Strategy
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 rounded-xl">
                <Link
                  href={selected ? `/play/${selected.courseId}?mode=strategy` : "/course-twins"}
                >
                  Course Twin
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 rounded-xl">
                <Link href="/rounds/new">Start round</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 rounded-xl">
                <Link href="/course-twins">Change course</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader
            title="Round readiness"
            description="The decisions worth checking before the first tee."
          />
          <IOSGroupedList label="Round readiness">
            <IOSMetricRow label="Strategy" value={selected ? "Ready to review" : "Choose course"} />
            <IOSMetricRow label="Course Twin" value={selected ? "Strategy ready" : "Unavailable"} />
            <IOSMetricRow label="Conditions" value="Not added" />
            <IOSMetricRow
              label="Round status"
              value={
                latestRound?.roundStatus === "active" ? "Round in progress" : "No active round"
              }
            />
          </IOSGroupedList>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Before you play" />
          <IOSGroupedList label="Before you play actions">
            <IOSListRow icon={ShieldCheck} label="Review clubs to trust" href="/quick-bag" />
            <IOSListRow
              icon={Flag}
              label="Open one-hole strategy"
              href={selected ? `/courses/strategy?courseId=${selected.courseId}` : "/course-twins"}
            />
            <IOSListRow
              icon={Cuboid}
              label="Open Course Twin Strategy"
              href={selected ? `/play/${selected.courseId}?mode=strategy` : "/course-twins"}
            />
            <IOSListRow icon={Search} label="Import a recent round" href="/import" />
          </IOSGroupedList>
        </section>
      </MobileAppShell>
    </PageShell>
  );
}

async function getSelectedTeeSet(courseId: string) {
  return (
    (
      await getDb()
        .select({ name: teeSets.name, yards: teeSets.yards })
        .from(teeSets)
        .where(eq(teeSets.courseId, courseId))
        .orderBy(asc(teeSets.yards))
        .limit(1)
    )[0] ?? null
  );
}

async function getLatestRound(userId: string) {
  return (
    (
      await getDb()
        .select({ roundStatus: sessions.roundStatus })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), inArray(sessions.type, ["round", "real_round"])))
        .orderBy(desc(sessions.date))
        .limit(1)
    )[0] ?? null
  );
}
