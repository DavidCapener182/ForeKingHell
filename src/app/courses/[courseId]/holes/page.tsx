import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { ArrowLeft, Flag, MapPinned, Save, Trophy } from "lucide-react";
import { and, asc, eq, or } from "drizzle-orm";

import { updateTeeSetAction, upsertHoleAction } from "@/app/courses/actions";
import {
  DataTableFrame,
  DataPanel,
  MetricCard,
  MobileAccordionSection,
  MobileCurrentItemCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { ensureCourseAutoImport, type CourseAutoImportResult } from "@/lib/course-auto-enrichment";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";
import { CourseHoleMapEditor } from "./course-hole-map-editor";
import { GoogleCourseContextPanel } from "./google-course-context-panel";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    courseId: string;
  }>;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const coordinateFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 6,
});
const AUTOMATIC_COURSE_PROVIDERS = new Set([
  "espn-pga",
  "google-places",
  "osm",
  "schedule",
  "seed",
  "tour-seed",
]);
const holeGeometryColumns: DesktopWorkbenchColumn[] = [
  { id: "hole", label: "Hole", locked: true },
  { id: "par", label: "Par" },
  { id: "yards", label: "Yards" },
  { id: "stroke-index", label: "Stroke index" },
  { id: "tee", label: "Tee" },
  { id: "green", label: "Green" },
  { id: "status", label: "Status" },
  { id: "action", label: "Action", locked: true },
];
const holeGeometrySuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Missing coordinates",
    href: "#hole-geometry-table",
    detail: "Find holes that still need tee and green points.",
  },
  {
    title: "Tee-set metadata",
    href: "#tee-set",
    detail: "Check rating, slope, par and yardage before mapping holes.",
  },
  {
    title: "Geometry preview",
    href: "#geometry-preview",
    detail: "Review the saved tee-to-green lines before editing.",
  },
];

export default async function CourseHoleEditorPage({ params }: PageProps) {
  const { courseId } = await params;
  const data = await getCourseEditorData(courseId);

  if (!data) {
    notFound();
  }

  const primaryTeeSet = data.teeSets[0] ?? null;
  const mappedHoleCount = data.holes.length;
  const holesForPrimaryTeeSet = primaryTeeSet
    ? data.holes.filter((hole) => hole.teeSetId === primaryTeeSet.id)
    : [];
  const hasMappedGeometry = holesForPrimaryTeeSet.length > 0;
  const usesAutomaticCourseData = usesAutomaticImportData(data.course);
  const allowManualHoleEditing = data.isEditable && (hasMappedGeometry || !usesAutomaticCourseData);
  const showTeeSetTools = Boolean(primaryTeeSet && (hasMappedGeometry || !usesAutomaticCourseData));
  const shotPatternEnabled = isShotPatternFeatureEnabled();
  const holeSlots = createHoleSlots(primaryTeeSet?.par ?? 72, holesForPrimaryTeeSet.length);
  const holeByNumber = new Map(holesForPrimaryTeeSet.map((hole) => [hole.holeNumber, hole]));
  const mapStatus =
    mappedHoleCount === 0
      ? "Import checked"
      : mappedHoleCount >= 18 || (primaryTeeSet?.par ?? 72) <= 36
        ? "Ready"
        : "Partial";

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="course-holes">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/courses" prefetch={false}>
              <ArrowLeft className="size-4" />
              Courses
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/rounds" prefetch={false}>
              <Flag className="size-4" />
              Rounds
            </Link>
          </Button>
          {shotPatternEnabled ? (
            <Button asChild>
              <Link href={`/courses/${courseId}/shot-pattern`} prefetch={false}>
                <MapPinned className="size-4" />
                Shot pattern
              </Link>
            </Button>
          ) : null}
        </div>

        <PageHeader
          eyebrow={
            <StatusPill tone={data.isEditable ? "green" : "sky"}>
              {data.isEditable ? "Course editor" : "Course reference"}
            </StatusPill>
          }
          title={data.course.name}
          description={
            data.isEditable
              ? "Edit the tee-set metadata and saved hole geometry used by real-course overlays and handicap estimates."
              : "Use this course for scoring and overlays. Editing is limited to courses you imported or created."
          }
          visual={
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={courseId}
              className="h-full min-h-44"
              priority
            />
          }
          metrics={[
            {
              label: "Provider",
              value: data.course.provider,
              detail: data.course.country ?? "Country not set",
            },
            {
              label: "Tee sets",
              value: integerFormatter.format(data.teeSets.length),
              detail: "Current editor uses the first tee set.",
            },
            {
              label: "Mapped holes",
              value: integerFormatter.format(mappedHoleCount),
              detail: "Saved tee and green points.",
            },
            {
              label: "Map status",
              value: mapStatus,
              detail: "Round overlays use these coordinates.",
            },
          ]}
        />

        <MobileMetricStrip
          items={[
            {
              label: "Provider",
              value: data.course.provider,
              detail: data.course.country ?? "Country not set",
              tone: "green",
            },
            {
              label: "Tee sets",
              value: integerFormatter.format(data.teeSets.length),
              detail: "Available",
              tone: "sky",
            },
            {
              label: "Mapped",
              value: integerFormatter.format(mappedHoleCount),
              detail: "Saved holes",
              tone: "amber",
            },
            {
              label: "Status",
              value: mapStatus,
              detail: "Overlay geometry",
              tone: mappedHoleCount >= 18 ? "green" : "slate",
            },
          ]}
        />

        {data.course.latitude !== null && data.course.longitude !== null ? (
          <GoogleCourseContextPanel
            address={data.course.address}
            googleRating={data.course.googleRating}
            latitude={data.course.latitude}
            longitude={data.course.longitude}
            name={data.course.name}
            reviewCount={data.course.googleUserRatingsTotal}
            websiteUrl={data.course.websiteUrl}
          />
        ) : null}

        {!primaryTeeSet ? (
          <DataPanel>
            <SectionHeader
              title="No tee set"
              description="This course needs a tee set before holes can be mapped."
            />
            <CardContent>
              {usesAutomaticCourseData ? (
                <AutoImportStatusContent autoImport={data.autoImport} />
              ) : (
                <Button asChild>
                  <Link href="/courses/new" prefetch={false}>
                    Create a new course instead
                  </Link>
                </Button>
              )}
            </CardContent>
          </DataPanel>
        ) : allowManualHoleEditing ? (
          <DataPanel>
            <SectionHeader
              title="Visual hole editor"
              description="Use the satellite map to place tee and green points. This saves the same geometry used by round overlays."
              action={<MapPinned className="size-5 text-sky-600" />}
            />
            <CardContent>
              <CourseHoleMapEditor
                courseId={data.course.id}
                teeSetId={primaryTeeSet.id}
                teeSetName={primaryTeeSet.name}
                holes={holesForPrimaryTeeSet.map((hole) => ({
                  id: hole.id,
                  holeNumber: hole.holeNumber,
                  par: hole.par,
                  strokeIndex: hole.strokeIndex,
                  yards: hole.yards,
                  teeLat: hole.teeLat,
                  teeLng: hole.teeLng,
                  greenLat: hole.greenLat,
                  greenLng: hole.greenLng,
                }))}
                holeCount={holeSlots.length}
                saveHoleAction={upsertHoleAction}
              />
            </CardContent>
          </DataPanel>
        ) : usesAutomaticCourseData && !hasMappedGeometry ? (
          <DataPanel>
            <SectionHeader
              title="Automatic course import"
              description="Course details are pulled from Google Places and mapped hole data is pulled from available course geometry sources."
              action={<MapPinned className="size-5 text-sky-600" />}
            />
            <CardContent>
              <AutoImportStatusContent autoImport={data.autoImport} />
            </CardContent>
          </DataPanel>
        ) : (
          <DataPanel>
            <SectionHeader
              title="Read-only course geometry"
              description="This map is read-only for your account. Import or create a course if you need custom tee or green points."
              action={<MapPinned className="size-5 text-sky-600" />}
            />
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Reference courses can be selected for rounds and used in overlays. Editing stays
                limited to courses you own.
              </p>
            </CardContent>
          </DataPanel>
        )}

        {primaryTeeSet && showTeeSetTools ? (
          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-4">
              <DataPanel>
                <SectionHeader
                  title="Tee set"
                  description="Rating and slope improve handicap calculations. Yardage and par drive the round context."
                  action={<Trophy className="size-5 text-amber-500" />}
                />
                <CardContent>
                  {data.isEditable ? (
                    <form action={updateTeeSetAction} className="grid gap-4">
                      <input type="hidden" name="courseId" value={data.course.id} />
                      <input type="hidden" name="teeSetId" value={primaryTeeSet.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          label="Tee set"
                          name="name"
                          defaultValue={primaryTeeSet.name}
                          required
                        />
                        <FormField
                          label="Par"
                          name="par"
                          type="number"
                          defaultValue={primaryTeeSet.par}
                          required
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <FormField
                          label="Course rating"
                          name="courseRating"
                          type="number"
                          step="0.1"
                          defaultValue={primaryTeeSet.courseRating ?? undefined}
                        />
                        <FormField
                          label="Slope"
                          name="slopeRating"
                          type="number"
                          defaultValue={primaryTeeSet.slopeRating ?? undefined}
                        />
                        <FormField
                          label="Yards"
                          name="yards"
                          type="number"
                          defaultValue={primaryTeeSet.yards ?? undefined}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:w-fit"
                      >
                        <Save className="size-4" />
                        Save tee set
                      </Button>
                    </form>
                  ) : (
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <ReadonlyValue label="Tee set" value={primaryTeeSet.name} />
                      <ReadonlyValue label="Par" value={String(primaryTeeSet.par)} />
                      <ReadonlyValue
                        label="Course rating"
                        value={formatOptionalNumber(primaryTeeSet.courseRating)}
                      />
                      <ReadonlyValue
                        label="Slope"
                        value={primaryTeeSet.slopeRating?.toString() ?? "--"}
                      />
                      <ReadonlyValue
                        label="Yards"
                        value={primaryTeeSet.yards?.toString() ?? "--"}
                      />
                    </dl>
                  )}
                </CardContent>
              </DataPanel>

              <section className="hidden gap-3 sm:grid sm:grid-cols-2">
                <MetricCard
                  label="Course rating"
                  value={formatOptionalNumber(primaryTeeSet.courseRating)}
                  detail="Used directly by the WHS-style differential."
                  icon={Trophy}
                  tone="amber"
                />
                <MetricCard
                  label="Overlay geometry"
                  value={`${holesForPrimaryTeeSet.length}/${holeSlots.length}`}
                  detail="Saved holes for this tee set."
                  icon={MapPinned}
                  tone="green"
                />
              </section>
            </div>

            <DataPanel id="geometry-preview">
              <SectionHeader
                title="Geometry preview"
                description="A lightweight check that the course lines point in the right direction."
                action={<Badge variant="outline">{primaryTeeSet.name}</Badge>}
              />
              <CardContent>
                <CourseGeometryPreview holes={holesForPrimaryTeeSet} />
              </CardContent>
            </DataPanel>
          </section>
        ) : null}

        {primaryTeeSet ? (
          <HoleGeometryTable
            courseId={data.course.id}
            teeSetName={primaryTeeSet.name}
            holes={holeSlots.map((holeNumber) => ({
              holeNumber,
              hole: holeByNumber.get(holeNumber) ?? null,
            }))}
            editable={allowManualHoleEditing}
          />
        ) : null}

        {primaryTeeSet && allowManualHoleEditing ? (
          <>
            <MobileCurrentItemCard
              title="Hole editor"
              subtitle="Edit one hole at a time on mobile."
              selector={
                <div className="flex gap-2">
                  {holeSlots.map((holeNumber) => (
                    <a
                      key={holeNumber}
                      href={`#mobile-hole-${holeNumber}`}
                      className="grid min-h-10 min-w-10 place-items-center rounded-full border border-slate-200 bg-white text-sm font-semibold"
                    >
                      {holeNumber}
                    </a>
                  ))}
                </div>
              }
              action={
                <Badge variant="outline">
                  {holesForPrimaryTeeSet.length}/{holeSlots.length}
                </Badge>
              }
            >
              <div id="mobile-hole-1">
                <HoleForm
                  courseId={data.course.id}
                  teeSetId={primaryTeeSet.id}
                  holeNumber={holeSlots[0] ?? 1}
                  hole={holeByNumber.get(holeSlots[0] ?? 1) ?? null}
                  formId={`mobile-current-hole-form-${holeSlots[0] ?? 1}`}
                />
              </div>
            </MobileCurrentItemCard>

            <MobileAccordionSection
              title="All hole forms"
              count={holeSlots.length}
              description="Open only when you need batch edits."
              contentClassName="grid gap-3"
            >
              {holeSlots.map((holeNumber) => (
                <HoleForm
                  key={holeNumber}
                  courseId={data.course.id}
                  teeSetId={primaryTeeSet.id}
                  holeNumber={holeNumber}
                  hole={holeByNumber.get(holeNumber) ?? null}
                  formId={`mobile-hole-form-${holeNumber}`}
                />
              ))}
            </MobileAccordionSection>

            <DataPanel className="hidden sm:block">
              <SectionHeader
                title="Hole geometry"
                description="Save tee and green coordinates for each hole. Seeded courses already include this data; manual courses can be built up one hole at a time."
                action={<Badge variant="outline">{holeSlots.length} holes</Badge>}
              />
              <CardContent className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {holeSlots.map((holeNumber) => (
                  <HoleForm
                    key={holeNumber}
                    courseId={data.course.id}
                    teeSetId={primaryTeeSet.id}
                    holeNumber={holeNumber}
                    hole={holeByNumber.get(holeNumber) ?? null}
                    formId={`desktop-hole-form-${holeNumber}`}
                  />
                ))}
              </CardContent>
            </DataPanel>
          </>
        ) : null}
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

async function getCourseEditorData(courseId: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  let {
    course,
    teeSets: teeSetRows,
    holes: holeRows,
  } = await loadCourseEditorRows(db, courseId, userId);
  let autoImport: CourseAutoImportResult = {
    changed: false,
    status: holeRows.length > 0 ? "ready" : "no_geometry_found",
  };

  if (!course) {
    return null;
  }

  if (holeRows.length === 0) {
    autoImport = await ensureCourseAutoImport(course, holeRows.length);

    if (autoImport.changed) {
      ({
        course,
        teeSets: teeSetRows,
        holes: holeRows,
      } = await loadCourseEditorRows(db, courseId, userId));
    }
  }

  if (!course) {
    return null;
  }

  return {
    course,
    teeSets: teeSetRows,
    holes: holeRows,
    isEditable: course.createdByUserId === userId,
    autoImport,
  };
}

async function loadCourseEditorRows(
  db: ReturnType<typeof getDb>,
  courseId: string,
  userId: string,
) {
  const [courseRows, teeSetRows, holeRows] = await Promise.all([
    db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
        ),
      )
      .limit(1),
    db.select().from(teeSets).where(eq(teeSets.courseId, courseId)).orderBy(asc(teeSets.name)),
    db.select().from(holes).where(eq(holes.courseId, courseId)).orderBy(asc(holes.holeNumber)),
  ]);

  return {
    course: courseRows[0] ?? null,
    teeSets: teeSetRows,
    holes: holeRows,
  };
}

function AutoImportStatusContent({ autoImport }: { autoImport: CourseAutoImportResult }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
      {autoImport.status === "imported"
        ? "Hole geometry was imported automatically. Refresh if the updated map is not visible yet."
        : autoImport.status === "no_coordinates"
          ? "Google Places has not returned usable course coordinates yet."
          : autoImport.status === "recently_attempted"
            ? "Automatic import has already checked this course recently. No mapped hole data is available yet."
            : "Automatic import checked Google Places and available map geometry, but no tagged holes were found yet."}
    </div>
  );
}

function usesAutomaticImportData(course: typeof courses.$inferSelect) {
  return Boolean(course.googlePlaceId) || AUTOMATIC_COURSE_PROVIDERS.has(course.provider);
}

function HoleForm({
  courseId,
  teeSetId,
  holeNumber,
  hole,
  formId,
}: {
  courseId: string;
  teeSetId: string;
  holeNumber: number;
  hole: typeof holes.$inferSelect | null;
  formId?: string;
}) {
  return (
    <form id={formId} action={upsertHoleAction} className="apple-panel-strong p-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="teeSetId" value={teeSetId} />
      <input type="hidden" name="holeNumber" value={holeNumber} />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Hole {holeNumber}</p>
          <p className="text-sm text-muted-foreground">
            {hole ? `${hole.yards} yd - SI ${hole.strokeIndex ?? "--"}` : "Not mapped yet"}
          </p>
        </div>
        <StatusPill tone={hole ? "green" : "amber"}>{hole ? "Mapped" : "Missing"}</StatusPill>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          label="Par"
          name="par"
          type="number"
          min={1}
          defaultValue={hole?.par ?? undefined}
          required
        />
        <FormField
          label="Yards"
          name="yards"
          type="number"
          min={1}
          defaultValue={hole?.yards ?? undefined}
          required
        />
        <FormField
          label="SI"
          name="strokeIndex"
          type="number"
          min={1}
          max={18}
          defaultValue={hole?.strokeIndex ?? undefined}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FormField
          label="Tee lat"
          name="teeLat"
          type="number"
          step="0.000001"
          defaultValue={hole?.teeLat ?? undefined}
          required
        />
        <FormField
          label="Tee lng"
          name="teeLng"
          type="number"
          step="0.000001"
          defaultValue={hole?.teeLng ?? undefined}
          required
        />
        <FormField
          label="Green lat"
          name="greenLat"
          type="number"
          step="0.000001"
          defaultValue={hole?.greenLat ?? undefined}
          required
        />
        <FormField
          label="Green lng"
          name="greenLng"
          type="number"
          step="0.000001"
          defaultValue={hole?.greenLng ?? undefined}
          required
        />
      </div>

      {hole ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Tee {coordinateFormatter.format(hole.teeLat)}, {coordinateFormatter.format(hole.teeLng)} /
          Green {coordinateFormatter.format(hole.greenLat)},{" "}
          {coordinateFormatter.format(hole.greenLng)}
        </p>
      ) : null}

      <Button type="submit" variant="outline" className="mt-4 w-full">
        <Save className="size-4" />
        Save hole
      </Button>
    </form>
  );
}

function HoleGeometryTable({
  courseId,
  editable,
  holes: holeRows,
  teeSetName,
}: {
  courseId: string;
  editable: boolean;
  holes: Array<{ holeNumber: number; hole: typeof holes.$inferSelect | null }>;
  teeSetName: string;
}) {
  const mappedCount = holeRows.filter((row) => row.hole).length;

  return (
    <section id="hole-geometry-table" className="hidden sm:block" data-workbench-scope="courses">
      <DataPanel>
        <SectionHeader
          title="Hole geometry table"
          description="Desktop reference for tee, green, par, yardage and missing geometry before editing individual holes."
          action={
            <StatusPill tone={mappedCount === holeRows.length ? "green" : "amber"}>
              {mappedCount}/{holeRows.length} mapped
            </StatusPill>
          }
        />
        <CardContent className="grid gap-3">
          <DesktopTableWorkbenchControls
            viewKey={`course-holes-${courseId}`}
            scope="courses"
            currentViewLabel={`${teeSetName} hole geometry`}
            resultLabel={`${integerFormatter.format(holeRows.length)} holes`}
            columns={holeGeometryColumns}
            suggestedViews={holeGeometrySuggestedViews}
            exportTableId="course-hole-geometry"
            exportFileName="forekinghell-course-hole-geometry.csv"
          />
          <DataTableFrame mainTable mainTableLabel="Course hole geometry table">
            <Table
              data-workbench-export-table="course-hole-geometry"
              aria-describedby="course-hole-geometry-summary"
            >
              <TableCaption id="course-hole-geometry-summary" className="sr-only">
                Course hole geometry table showing hole number, par, yardage, stroke index, tee
                coordinates, green coordinates, mapping status and edit action.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <TableHead
                    data-column="hole"
                    className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    Hole
                  </TableHead>
                  <TableHead data-column="par" className="text-right">
                    Par
                  </TableHead>
                  <TableHead data-column="yards" className="text-right">
                    Yards
                  </TableHead>
                  <TableHead data-column="stroke-index" className="text-right">
                    SI
                  </TableHead>
                  <TableHead data-column="tee">Tee</TableHead>
                  <TableHead data-column="green">Green</TableHead>
                  <TableHead data-column="status">Status</TableHead>
                  <TableHead data-column="action" className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holeRows.map(({ holeNumber, hole }) => (
                  <TableRow key={holeNumber}>
                    <TableCell
                      data-column="hole"
                      className="sticky left-0 z-10 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      Hole {holeNumber}
                    </TableCell>
                    <TableCell data-column="par" className="text-right tabular-nums">
                      {hole?.par ?? "--"}
                    </TableCell>
                    <TableCell data-column="yards" className="text-right tabular-nums">
                      {hole?.yards ? integerFormatter.format(hole.yards) : "--"}
                    </TableCell>
                    <TableCell data-column="stroke-index" className="text-right tabular-nums">
                      {hole?.strokeIndex ?? "--"}
                    </TableCell>
                    <TableCell data-column="tee" className="min-w-48">
                      {hole
                        ? `${coordinateFormatter.format(hole.teeLat)}, ${coordinateFormatter.format(hole.teeLng)}`
                        : "Not mapped"}
                    </TableCell>
                    <TableCell data-column="green" className="min-w-48">
                      {hole
                        ? `${coordinateFormatter.format(hole.greenLat)}, ${coordinateFormatter.format(hole.greenLng)}`
                        : "Not mapped"}
                    </TableCell>
                    <TableCell data-column="status">
                      <StatusPill tone={hole ? "green" : "amber"}>
                        {hole ? "Mapped" : "Missing"}
                      </StatusPill>
                    </TableCell>
                    <TableCell data-column="action" className="text-right">
                      {editable ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={`#desktop-hole-form-${holeNumber}`}>Edit</a>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Read-only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </section>
  );
}

function FormField({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & ComponentProps<typeof Input>) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input name={name} className="h-10 rounded-xl bg-white" {...props} />
    </label>
  );
}

function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2">
      <dt className="text-xs uppercase tracking-normal text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function CourseGeometryPreview({
  holes: mappedHoles,
}: {
  holes: Array<typeof holes.$inferSelect>;
}) {
  if (mappedHoles.length === 0) {
    return (
      <div className="grid h-80 place-items-center rounded-2xl border bg-[#0f172a] text-sm text-slate-300">
        No hole geometry saved yet.
      </div>
    );
  }

  const coordinates = mappedHoles.flatMap((hole) => [
    [hole.teeLat, hole.teeLng] as [number, number],
    [hole.greenLat, hole.greenLng] as [number, number],
  ]);
  const lats = coordinates.map(([lat]) => lat);
  const lngs = coordinates.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const width = 900;
  const height = 420;
  const pad = 44;
  const xFor = (lng: number) =>
    pad + ((lng - minLng) / Math.max(0.000001, maxLng - minLng)) * (width - pad * 2);
  const yFor = (lat: number) =>
    height - pad - ((lat - minLat) / Math.max(0.000001, maxLat - minLat)) * (height - pad * 2);

  return (
    <div className="grid gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Course geometry preview map"
        className="h-80 w-full rounded-2xl border bg-[#0f172a]"
      >
        <defs>
          <linearGradient id="course-line" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="#0f172a" />
        {mappedHoles.map((hole) => {
          const teeX = xFor(hole.teeLng);
          const teeY = yFor(hole.teeLat);
          const greenX = xFor(hole.greenLng);
          const greenY = yFor(hole.greenLat);

          return (
            <g key={hole.id}>
              <line
                x1={teeX}
                y1={teeY}
                x2={greenX}
                y2={greenY}
                stroke="#ffffff"
                strokeOpacity="0.28"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <line
                x1={teeX}
                y1={teeY}
                x2={greenX}
                y2={greenY}
                stroke="url(#course-line)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={teeX} cy={teeY} r="5" fill="#ffffff" stroke="#111827" strokeWidth="2" />
              <circle
                cx={greenX}
                cy={greenY}
                r="7"
                fill="#dcfce7"
                stroke="#22c55e"
                strokeWidth="3"
              />
              <text
                x={(teeX + greenX) / 2}
                y={(teeY + greenY) / 2 - 8}
                fill="#e5e7eb"
                fontSize="12"
                textAnchor="middle"
              >
                {hole.holeNumber}
              </text>
            </g>
          );
        })}
        <text x="28" y="32" fill="#e5e7eb" fontSize="13">
          Saved tee-to-green geometry
        </text>
      </svg>
      <ChartAccessibleFallback
        title="Course geometry preview"
        summary={courseGeometrySummary(mappedHoles)}
        columns={[
          { key: "hole", label: "Hole" },
          { key: "par", label: "Par" },
          { key: "yards", label: "Yards" },
          { key: "tee", label: "Tee" },
          { key: "green", label: "Green" },
        ]}
        rows={courseGeometryRows(mappedHoles)}
        className="bg-white/80"
      />
    </div>
  );
}

function courseGeometrySummary(mappedHoles: Array<typeof holes.$inferSelect>) {
  const pars = mappedHoles.reduce((total, hole) => total + (hole.par ?? 0), 0);
  const yards = mappedHoles.reduce((total, hole) => total + (hole.yards ?? 0), 0);
  const firstHole = mappedHoles[0] ?? null;
  const lastHole = mappedHoles[mappedHoles.length - 1] ?? null;
  const range =
    firstHole && lastHole
      ? ` Hole ${firstHole.holeNumber} through ${lastHole.holeNumber} are represented.`
      : "";

  return `${integerFormatter.format(mappedHoles.length)} mapped holes are shown with saved tee and green coordinates. Total par is ${integerFormatter.format(
    pars,
  )}; mapped yardage is ${integerFormatter.format(yards)} yd.${range}`;
}

function courseGeometryRows(mappedHoles: Array<typeof holes.$inferSelect>) {
  return mappedHoles.map((hole) => ({
    _key: hole.id,
    hole: String(hole.holeNumber),
    par: String(hole.par),
    yards: hole.yards ? integerFormatter.format(hole.yards) : "--",
    tee: `${coordinateFormatter.format(hole.teeLat)}, ${coordinateFormatter.format(hole.teeLng)}`,
    green: `${coordinateFormatter.format(hole.greenLat)}, ${coordinateFormatter.format(hole.greenLng)}`,
  }));
}

function createHoleSlots(par: number, mappedCount: number) {
  const count = par <= 36 && mappedCount <= 9 ? 9 : 18;
  return Array.from({ length: count }, (_, index) => index + 1);
}

function formatOptionalNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}
