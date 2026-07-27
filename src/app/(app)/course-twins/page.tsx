import Link from "next/link";
import { Cuboid, Flag, MapPinned, Mountain } from "lucide-react";

import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const decimalFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function CourseTwinCataloguePage() {
  const userId = await requireCurrentUserId();
  const twins = await listAvailableCourseTwins(userId);

  return (
    <PageShell>
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
    </PageShell>
  );
}
