import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MapPinned } from "lucide-react";

import { ShotPatternMap } from "@/components/maps/shot-pattern-map";
import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { requireCurrentUserId } from "@/lib/current-user";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";
import {
  getShotPatternOverlayData,
  getShotPatternSetup,
  type ShotPatternSetup,
} from "@/lib/shot-pattern-overlay-data";
import type { ShotPatternClubOption } from "@/lib/shot-patterns";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    courseId: string;
  }>;
};

type ShotPatternHoleRow = {
  teeSetId: string;
  teeSetName: string;
  holeNumber: number;
  par: number;
  yards: number;
};

const shotPatternHoleColumns: DesktopWorkbenchColumn[] = [
  { id: "hole", label: "Hole", locked: true },
  { id: "teeSet", label: "Tee set" },
  { id: "par", label: "Par" },
  { id: "yards", label: "Yards" },
  { id: "status", label: "Status" },
  { id: "action", label: "Action", locked: true },
];

const shotPatternClubColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "type", label: "Type" },
  { id: "sample", label: "Sample" },
  { id: "playNumber", label: "Play number" },
  { id: "default", label: "Default" },
  { id: "action", label: "Action", locked: true },
];

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
      className="px-0 py-0 pb-0 lg:px-8 lg:pb-8 lg:pt-6"
      contentClassName="gap-0 lg:gap-6"
    >
      <DesktopWorkbenchLayout scope="course-shot-pattern">
        <div className="hidden items-center justify-between gap-4 lg:flex">
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

        <div className="hidden lg:block">
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
          <>
            <ShotPatternSetupBoard courseId={courseId} setup={setup} />
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
          </>
        ) : (
          <div className="apple-panel grid min-h-80 place-items-center p-6 text-center">
            <div>
              <MapPinned className="mx-auto size-10 text-slate-500" />
              <h2 className="mt-3 text-xl font-semibold tracking-normal">
                Map hole geometry first
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                This course needs tee-to-green hole geometry before club dispersion can be projected
                onto the map.
              </p>
              <Button
                asChild
                className="mt-4 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                <Link href={`/courses/${courseId}/holes`} prefetch={false}>
                  <MapPinned className="size-4" />
                  Open hole editor
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function ShotPatternSetupBoard({ courseId, setup }: { courseId: string; setup: ShotPatternSetup }) {
  const holeRows = shotPatternHoleRows(setup);

  return (
    <section
      id="shot-pattern-setup"
      className="hidden scroll-mt-28 gap-4 lg:grid"
      data-workbench-scope="shot-pattern-setup"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Shot-pattern setup board</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Desktop review of mapped holes, tee sets and club-pattern samples before using the
            interactive course overlay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={holeRows.length > 0 ? "green" : "amber"}>
            {holeRows.length} mapped holes
          </StatusPill>
          <StatusPill tone={setup.clubOptions.length > 0 ? "green" : "slate"}>
            {setup.clubOptions.length} club patterns
          </StatusPill>
        </div>
      </div>

      <ShotPatternHoleTable courseId={courseId} setup={setup} holeRows={holeRows} />
      <ShotPatternClubTable courseId={courseId} setup={setup} clubOptions={setup.clubOptions} />
    </section>
  );
}

function ShotPatternHoleTable({
  courseId,
  setup,
  holeRows,
}: {
  courseId: string;
  setup: ShotPatternSetup;
  holeRows: ShotPatternHoleRow[];
}) {
  const suggestedViews = shotPatternSuggestedViews(courseId);

  return (
    <section className="grid gap-3" data-workbench-scope="shot-pattern-holes">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Mapped hole geometry</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Holes available to project dispersion onto, grouped by tee set.
          </p>
        </div>
        <StatusPill tone={setup.defaultControls.teeSetId ? "green" : "amber"}>
          {setup.teeSets.length} tee sets
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`shot-pattern-holes-${courseId}`}
        scope="shot-pattern-holes"
        currentViewLabel={`${setup.course.name} mapped holes`}
        resultLabel={`${holeRows.length} holes`}
        columns={shotPatternHoleColumns}
        suggestedViews={suggestedViews}
        exportTableId="shot-pattern-holes"
        exportFileName={`forekinghell-shot-pattern-${courseId}-holes.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Shot pattern mapped holes table" stickyFirstColumn>
        <Table
          data-workbench-export-table="shot-pattern-holes"
          aria-describedby="shot-pattern-holes-summary"
        >
          <TableCaption id="shot-pattern-holes-summary" className="sr-only">
            Shot pattern mapped holes table showing hole, tee set, par, yards, mapping status and
            action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="hole"
                className="sticky left-0 z-20 min-w-28 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Hole
              </TableHead>
              <TableHead data-column="teeSet">Tee set</TableHead>
              <TableHead data-column="par">Par</TableHead>
              <TableHead data-column="yards">Yards</TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holeRows.length > 0 ? (
              holeRows.map((hole) => (
                <TableRow
                  key={`${hole.teeSetId}:${hole.holeNumber}`}
                  tabIndex={0}
                  className="focus-aaa outline-none"
                >
                  <TableCell
                    data-column="hole"
                    className="sticky left-0 z-10 min-w-28 bg-white font-semibold shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    {hole.holeNumber}
                  </TableCell>
                  <TableCell data-column="teeSet">{hole.teeSetName}</TableCell>
                  <TableCell data-column="par">Par {hole.par}</TableCell>
                  <TableCell data-column="yards">
                    {integerFormatter.format(hole.yards)} yd
                  </TableCell>
                  <TableCell data-column="status">Mapped</TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${courseId}/holes`} prefetch={false}>
                        Edit geometry
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No mapped hole geometry is available for this course yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function ShotPatternClubTable({
  courseId,
  setup,
  clubOptions,
}: {
  courseId: string;
  setup: ShotPatternSetup;
  clubOptions: ShotPatternClubOption[];
}) {
  const suggestedViews = shotPatternSuggestedViews(courseId);

  return (
    <section className="grid gap-3" data-workbench-scope="shot-pattern-clubs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Club pattern evidence</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Club choices with enough shot history to project onto mapped holes.
          </p>
        </div>
        <StatusPill tone={clubOptions.length > 0 ? "green" : "amber"}>
          {clubOptions.length} available
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`shot-pattern-clubs-${courseId}`}
        scope="shot-pattern-clubs"
        currentViewLabel={`${setup.course.name} club patterns`}
        resultLabel={`${clubOptions.length} club patterns`}
        columns={shotPatternClubColumns}
        suggestedViews={suggestedViews}
        exportTableId="shot-pattern-clubs"
        exportFileName={`forekinghell-shot-pattern-${courseId}-clubs.csv`}
      />

      <DataTableFrame label="Shot pattern club evidence table" stickyFirstColumn>
        <Table
          data-workbench-export-table="shot-pattern-clubs"
          aria-describedby="shot-pattern-clubs-summary"
        >
          <TableCaption id="shot-pattern-clubs-summary" className="sr-only">
            Shot pattern club evidence table showing club, club type, sample size, play number,
            default state and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="club"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Club
              </TableHead>
              <TableHead data-column="type">Type</TableHead>
              <TableHead data-column="sample">Sample</TableHead>
              <TableHead data-column="playNumber">Play number</TableHead>
              <TableHead data-column="default">Default</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clubOptions.length > 0 ? (
              clubOptions.map((club) => {
                const isDefault = defaultClubSelectionMatches(setup, club);

                return (
                  <TableRow
                    key={`${club.clubId ?? "type"}:${club.clubType}`}
                    tabIndex={0}
                    className="focus-aaa outline-none"
                  >
                    <TableCell
                      data-column="club"
                      className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      <p className="font-semibold">{club.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {club.clubId ? "Specific club" : "Club type pattern"}
                      </p>
                    </TableCell>
                    <TableCell data-column="type">{club.clubType}</TableCell>
                    <TableCell data-column="sample">
                      {integerFormatter.format(club.sampleSize)} shots
                    </TableCell>
                    <TableCell data-column="playNumber">
                      {formatPlayNumber(club.playNumberYd)}
                    </TableCell>
                    <TableCell data-column="default">{isDefault ? "Default" : "--"}</TableCell>
                    <TableCell data-column="action" className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={club.clubId ? `/bag/${club.clubId}/analytics` : "/bag"}
                          prefetch={false}
                        >
                          Open club
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Import stock or full-shot data to build club patterns for this course.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function ShotPatternPageLoading() {
  return (
    <PageShell
      size="full"
      className="px-0 py-0 pb-0 lg:px-8 lg:pb-8 lg:pt-6"
      contentClassName="gap-0 lg:gap-6"
    >
      <div className="map-frame relative h-[100svh] min-h-[100svh] overflow-hidden bg-[#101827] lg:h-[72vh] lg:min-h-[620px]">
        <div className="absolute left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-20 h-14 animate-pulse rounded-lg bg-white/80 motion-reduce:animate-none lg:top-3" />
        <div className="absolute inset-x-6 top-1/3 h-48 animate-pulse rounded-lg border border-white/15 bg-white/10 motion-reduce:animate-none" />
        <div className="absolute inset-x-10 bottom-16 h-20 animate-pulse rounded-lg bg-white/15 motion-reduce:animate-none" />
      </div>
    </PageShell>
  );
}

const integerFormatter = new Intl.NumberFormat("en-GB");

function shotPatternHoleRows(setup: ShotPatternSetup): ShotPatternHoleRow[] {
  return setup.teeSets.flatMap((teeSet) =>
    (setup.holesByTeeSet[teeSet.id] ?? []).map((hole) => ({
      teeSetId: teeSet.id,
      teeSetName: teeSet.name,
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
    })),
  );
}

function defaultClubSelectionMatches(setup: ShotPatternSetup, club: ShotPatternClubOption) {
  if (setup.defaultControls.clubId) {
    return club.clubId === setup.defaultControls.clubId;
  }

  return !club.clubId && club.clubType === setup.defaultControls.clubType;
}

function formatPlayNumber(value: number | null | undefined) {
  return typeof value === "number" ? `${integerFormatter.format(value)} yd` : "--";
}

function shotPatternSuggestedViews(courseId: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Shot pattern",
      href: `/courses/${courseId}/shot-pattern`,
      detail: "Mapped holes, club samples and current overlay setup.",
    },
    {
      title: "Hole editor",
      href: `/courses/${courseId}/holes`,
      detail: "Review tee, green and centreline geometry.",
    },
    {
      title: "Course records",
      href: `/courses/${courseId}/records`,
      detail: "Open proof-backed records for this course.",
    },
  ];
}
