import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MapPinned } from "lucide-react";

import { ShotPatternMap } from "@/components/maps/shot-pattern-map";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { requireCurrentUserId } from "@/lib/current-user";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";
import { getShotPatternOverlayData, getShotPatternSetup } from "@/lib/shot-pattern-overlay-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    courseId: string;
  }>;
};

export default async function CourseShotPatternPage({ params }: PageProps) {
  if (!isShotPatternFeatureEnabled()) {
    notFound();
  }

  const { courseId } = await params;
  return (
    <Suspense fallback={<ShotPatternPageLoading />}>
      <CourseShotPatternContent courseId={courseId} />
    </Suspense>
  );
}

async function CourseShotPatternContent({ courseId }: { courseId: string }) {
  const userId = await requireCurrentUserId();
  const setup = await getShotPatternSetup({ userId, courseId });

  if (!setup) {
    notFound();
  }

  const hasMappedHoles = setup.teeSets.some((teeSet) => teeSet.holeCount > 0);
  const initialPatternData = hasMappedHoles
    ? await getShotPatternOverlayData({
        userId,
        courseId,
        teeSetId: setup.defaultControls.teeSetId,
        holeNumber: setup.defaultControls.holeNumber,
        clubId: setup.defaultControls.clubId,
        clubType: setup.defaultControls.clubType,
        mode: setup.defaultControls.mode,
        outlierMode: setup.defaultControls.outlierMode,
      })
    : null;

  return (
    <PageShell
      size="full"
      className="px-0 py-0 pb-0 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8"
      contentClassName="gap-0 sm:gap-5 lg:gap-6"
    >
      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href={`/courses/${courseId}/holes`} prefetch={false}>
            <ArrowLeft className="size-4" />
            Course
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/courses/${courseId}/holes`} prefetch={false}>
            <MapPinned className="size-4" />
            Edit holes
          </Link>
        </Button>
      </div>

      <div className="hidden sm:block">
        <PageHeader
          eyebrow={
            <StatusPill tone={hasMappedHoles ? "green" : "amber"}>On-course tool</StatusPill>
          }
          title={`${setup.course.name} shot pattern`}
          description="Project your real club dispersion over the selected hole before choosing a line."
          visual={
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={`${courseId}-shot-pattern`}
              className="h-full min-h-44"
              priority
            />
          }
          metrics={[
            {
              label: "Mapped holes",
              value: String(setup.holes.length),
              detail: "Current tee set",
            },
            {
              label: "Club choices",
              value: String(setup.clubOptions.length),
              detail: "Type and club-specific patterns",
            },
            {
              label: "Default",
              value: setup.defaultControls.clubType,
              detail: "Best 90% · total",
            },
            {
              label: "Privacy",
              value: "Private",
              detail: "Uses your own shot history",
            },
          ]}
        />
      </div>

      {hasMappedHoles ? (
        <ShotPatternMap
          courseId={courseId}
          courseName={setup.course.name}
          teeSets={setup.teeSets}
          holes={setup.holes}
          holesByTeeSet={setup.holesByTeeSet}
          clubOptions={setup.clubOptions}
          initialData={initialPatternData}
          defaultControls={setup.defaultControls}
        />
      ) : (
        <div className="apple-panel grid min-h-80 place-items-center p-6 text-center">
          <div>
            <MapPinned className="mx-auto size-10 text-slate-500" />
            <h2 className="mt-3 text-xl font-semibold tracking-normal">Map hole geometry first</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              This course needs tee-to-green hole geometry before club dispersion can be projected
              onto the map.
            </p>
            <Button asChild className="mt-4 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href={`/courses/${courseId}/holes`} prefetch={false}>
                <MapPinned className="size-4" />
                Open hole editor
              </Link>
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function ShotPatternPageLoading() {
  return (
    <PageShell
      size="full"
      className="px-0 py-0 pb-0 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8"
      contentClassName="gap-0 sm:gap-5 lg:gap-6"
    >
      <div className="map-frame relative h-[100svh] min-h-[100svh] overflow-hidden bg-[#101827] sm:h-[72vh] sm:min-h-[420px] lg:min-h-[620px]">
        <div className="absolute left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-20 h-14 animate-pulse rounded-lg bg-white/80 sm:top-3" />
        <div className="absolute inset-x-6 top-1/3 h-48 animate-pulse rounded-lg border border-white/15 bg-white/10" />
        <div className="absolute inset-x-10 bottom-16 h-20 animate-pulse rounded-lg bg-white/15" />
      </div>
    </PageShell>
  );
}
