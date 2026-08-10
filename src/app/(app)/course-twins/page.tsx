import Link from "next/link";
import { Cuboid, Flag, MapPinned, Mountain } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileIconButton, MobileTopBar } from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const decimalFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function CourseTwinCataloguePage() {
  const userId = await requireCurrentUserId();
  const twins = await listAvailableCourseTwins(userId);
  const warningCount = twins.filter((twin) => Boolean(twin.warning)).length;

  return (
    <PageShell>
      <MobileAppShell className="gap-5">
        <div data-course-twin-mobile-catalogue className="grid gap-5">
          <MobileTopBar
            title="Course Twin"
            actions={<MobileIconButton href="/courses" label="View all courses" icon={MapPinned} />}
          />

          <p className="px-1 text-[15px] leading-6 text-muted-foreground">
            Replay measured shots, test your real dispersion or play a persistent virtual round.
          </p>

          <section className="grid gap-2.5" aria-label="Playable courses">
            <IOSSectionHeader
              title="Playable courses"
              description={`${twins.length} generated ${twins.length === 1 ? "course is" : "courses are"} ready now.`}
            />

            {twins.length > 0 ? (
              <IOSGroupedList label="Playable Course Twin catalogue">
                {twins.map((twin) => (
                  <IOSListRow
                    key={twin.courseId}
                    icon={Cuboid}
                    label={twin.name}
                    detail={
                      <>
                        {twin.country ?? "Mapped course"} ·{" "}
                        {typeof twin.mappedHoles === "number"
                          ? `${twin.mappedHoles} holes`
                          : "Mapped holes"}
                      </>
                    }
                    value={
                      <IOSInlineStatus
                        label={`Grade ${twin.grade}`}
                        tone={twin.grade === "A" ? "positive" : "info"}
                      />
                    }
                    href={`/play/${twin.courseId}`}
                    ariaLabel={`Open ${twin.name} Course Twin`}
                  />
                ))}
              </IOSGroupedList>
            ) : (
              <IOSGroupedList label="Course Twin availability">
                <IOSListRow
                  icon={Cuboid}
                  label="No Course Twin available"
                  detail="No generated course package is available for this account yet."
                  status={<IOSInlineStatus label="Check your courses" tone="attention" />}
                />
              </IOSGroupedList>
            )}
          </section>

          {twins.length > 0 ? (
            <section className="grid gap-2.5" aria-label="Course package details">
              <IOSSectionHeader
                title="Course package details"
                description="Terrain quality and accuracy notes stay out of the way until you need them."
              />
              <IOSDisclosureGroup
                label="Course Twin package details"
                items={[
                  {
                    value: "package-details",
                    title: "Terrain and accuracy",
                    summary:
                      warningCount > 0
                        ? `${warningCount} ${warningCount === 1 ? "note" : "notes"}`
                        : "All ready",
                    description: "Mapping grade, terrain resolution and known limitations",
                    content: (
                      <div className="grid gap-4">
                        {twins.map((twin) => (
                          <section
                            key={twin.courseId}
                            className="grid gap-2.5 border-b border-border/70 pb-4 last:border-0 last:pb-0"
                            aria-label={`${twin.name} package details`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold leading-5 text-foreground">
                                  {twin.name}
                                </h3>
                                <p className="mt-0.5 text-[13px] leading-[1.15rem] text-muted-foreground">
                                  {typeof twin.mappedHoles === "number"
                                    ? `${twin.mappedHoles} mapped holes`
                                    : "Mapped course"}
                                </p>
                              </div>
                              <span className="shrink-0 text-[13px] font-medium text-foreground">
                                Grade {twin.grade}
                              </span>
                            </div>

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] leading-5">
                              <div>
                                <dt className="text-muted-foreground">Terrain</dt>
                                <dd className="font-medium text-foreground">
                                  {twin.terrainResolutionM === null
                                    ? "Generated"
                                    : `${decimalFormatter.format(twin.terrainResolutionM)} m`}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Package</dt>
                                <dd className="font-medium text-foreground">Ready to open</dd>
                              </div>
                            </dl>

                            {twin.warning ? (
                              <p className="text-[13px] leading-5 text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                  Accuracy note.{" "}
                                </span>
                                {twin.warning}
                              </p>
                            ) : (
                              <p className="text-[13px] leading-5 text-muted-foreground">
                                No additional accuracy warning is attached to this package.
                              </p>
                            )}

                            <Link
                              href={`/courses/${twin.courseId}/holes`}
                              prefetch={false}
                              className="focus-aaa inline-flex min-h-11 w-fit touch-manipulation items-center text-[15px] font-semibold text-primary outline-none"
                            >
                              View mapped holes
                            </Link>
                          </section>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </section>
          ) : null}
        </div>
      </MobileAppShell>

      <div className="hidden lg:contents" data-course-twin-desktop-catalogue>
        <PageHeader
          eyebrow={<StatusPill tone="sky">Real-course 3D</StatusPill>}
          title="Course Twin"
          description="Open a generated 3D course, replay measured shots, test your real dispersion or play a persistent virtual round. Grade B courses use real terrain with approximate putting contours."
          actions={
            <Button asChild variant="outline">
              <Link href="/courses">
                <MapPinned className="size-4" />
                All courses
              </Link>
            </Button>
          }
          metrics={[
            {
              label: "Available now",
              value: twins.length,
              detail: "Generated course packages",
            },
            {
              label: "Ways to use it",
              value: "Replay · Strategy · Play",
              detail: "Plus flyover, Live and walk/cart",
            },
          ]}
        />

        <section className="grid gap-4" aria-labelledby="course-twin-catalogue-title">
          <div>
            <p className="text-sm font-semibold text-primary">Playable catalogue</p>
            <h2
              id="course-twin-catalogue-title"
              className="mt-1 font-display text-2xl font-semibold text-foreground"
            >
              Choose a course
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Aintree, Bootle and every checked package are opened from here—no hidden URL required.
            </p>
          </div>

          {twins.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {twins.map((twin) => (
                <article
                  key={twin.courseId}
                  className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                  data-course-twin={twin.courseId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        {twin.country ?? "Mapped course"}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-foreground">{twin.name}</h3>
                    </div>
                    <StatusPill tone={twin.grade === "A" ? "green" : "sky"}>
                      Grade {twin.grade}
                    </StatusPill>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-muted/60 p-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Flag className="size-4" />
                        Holes
                      </div>
                      <p className="mt-1 font-semibold text-foreground">
                        {twin.mappedHoles ?? "Mapped"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mountain className="size-4" />
                        Terrain
                      </div>
                      <p className="mt-1 font-semibold text-foreground">
                        {twin.terrainResolutionM === null
                          ? "Generated"
                          : `${decimalFormatter.format(twin.terrainResolutionM)} m`}
                      </p>
                    </div>
                  </div>

                  {twin.warning ? (
                    <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {twin.warning}
                    </p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={`/play/${twin.courseId}`} prefetch={false}>
                        <Cuboid className="size-4" />
                        Open Course Twin
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/courses/${twin.courseId}/holes`} prefetch={false}>
                        Course details
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No Course Twin package is available for this account yet.
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
