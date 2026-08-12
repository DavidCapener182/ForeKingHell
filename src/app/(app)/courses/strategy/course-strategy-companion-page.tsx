import Link from "next/link";
import { Flag, MapPinned, ShieldCheck } from "lucide-react";

import { MobileHoleStrategy } from "@/app/courses/strategy/mobile-hole-strategy";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { getCourseStrategyData } from "@/lib/course-strategy-data";
import { requireCurrentUserId } from "@/lib/current-user";

export default async function CourseStrategyCompanionPage({
  searchParams,
}: {
  searchParams?: Promise<{ courseId?: string; teeSetId?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const [data, availableTwins] = await Promise.all([
    getCourseStrategyData(params?.courseId, params?.teeSetId),
    listAvailableCourseTwins(userId),
  ]);
  const courseTwinAvailable = availableTwins.some(
    (twin) => twin.courseId === data.selectedCourse?.id,
  );
  const usedClubs = new Set(data.strategies.map((strategy) => strategy.recommendedClub));
  const pressureClub =
    data.trustedBag
      .filter(
        (club) => usedClubs.has(club.label) && club.sampleSize >= 8 && club.confidence >= 0.55,
      )
      .sort(
        (left, right) => right.confidence - left.confidence || right.sampleSize - left.sampleSize,
      )[0] ?? null;
  const warningClub =
    data.trustedBag
      .filter((club) => usedClubs.has(club.label) && club.sampleSize > 0 && club.confidence < 0.55)
      .sort((left, right) => left.confidence - right.confidence)[0] ?? null;
  const firstHole = data.strategies[0] ?? null;

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-course-strategy-companion>
        <MobileTopBar title="Course Strategy" />

        <section className="ios-grouped-list grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Overall game plan
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {data.selectedCourse?.name ?? "Choose a mapped course"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.selectedTee?.name ?? "Tee not selected"}
                {data.selectedTee?.yards
                  ? ` · ${data.selectedTee.yards.toLocaleString("en-GB")} yd`
                  : ""}
              </p>
            </div>
            <IOSInlineStatus
              label={data.strategies.length > 0 ? "Plan ready" : "Setup needed"}
              tone={data.strategies.length > 0 ? "positive" : "attention"}
            />
          </div>
          <IOSGroupedList label="Round strategy summary" className="bg-card">
            <IOSListRow
              icon={ShieldCheck}
              label="Club to trust"
              value={pressureClub?.label ?? "Building"}
              detail={
                pressureClub
                  ? `${Math.round(pressureClub.minCarryYd)}–${Math.round(pressureClub.maxCarryYd)} yd measured range`
                  : "Build a measured bag baseline."
              }
            />
            <IOSListRow
              label="Low-confidence warning"
              value={warningClub?.label ?? "No clear warning"}
              detail={
                warningClub
                  ? `${Math.round(warningClub.confidence * 100)}% confidence from ${warningClub.sampleSize} shots · choose a conservative alternative when this club is required`
                  : "No low-confidence club is separated."
              }
            />
            <IOSListRow
              label="First-hole plan"
              value={firstHole?.recommendedClub ?? "Not ready"}
              detail={
                firstHole
                  ? `${firstHole.safeTarget} · ${firstHole.expectedCarryRange}`
                  : "Map a tee set and trusted bag values."
              }
            />
          </IOSGroupedList>
          <Button asChild className="min-h-12 rounded-xl">
            <Link href="/rounds/new">
              <Flag className="size-4" />
              Start round
            </Link>
          </Button>
        </section>

        <IOSDisclosureGroup
          label="Course selection"
          items={[
            {
              value: "course",
              title: "Change course",
              summary: data.selectedCourse?.name ?? "Choose",
              content: (
                <form action="/play/select" className="grid gap-3">
                  <input type="hidden" name="destination" value="strategy" />
                  <select
                    name="courseId"
                    defaultValue={data.selectedCourse?.id ?? ""}
                    className="min-h-11 w-full rounded-xl border bg-background px-3"
                    aria-label="Course"
                  >
                    {data.courseOptions.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                  {data.teeOptions.length > 0 ? (
                    <select
                      name="teeSetId"
                      defaultValue={data.selectedTee?.id ?? ""}
                      className="min-h-11 w-full rounded-xl border bg-background px-3"
                      aria-label="Tee"
                    >
                      {data.teeOptions.map((tee) => (
                        <option key={tee.id} value={tee.id}>
                          {tee.name}
                          {tee.yards ? ` · ${tee.yards.toLocaleString("en-GB")} yd` : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Button type="submit" variant="outline" className="min-h-11">
                    Load strategy
                  </Button>
                </form>
              ),
            },
          ]}
        />

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Hole plan" description="One decision at a time." />
          {data.selectedCourse && data.strategies.length > 0 ? (
            <MobileHoleStrategy
              strategies={data.strategies}
              course={data.selectedCourse}
              accountId={userId}
              trustedBag={data.trustedBag}
              tee={data.selectedTee}
              courseTwinAvailable={courseTwinAvailable}
            />
          ) : (
            <IOSGroupedList label="Hole strategy unavailable">
              <IOSListRow
                icon={MapPinned}
                label="Strategy not ready"
                detail="A mapped tee set and trusted measured bag values are required."
                href="/play"
              />
            </IOSGroupedList>
          )}
        </section>
      </MobileAppShell>
    </PageShell>
  );
}
