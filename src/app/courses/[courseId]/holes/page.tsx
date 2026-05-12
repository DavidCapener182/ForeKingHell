import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { ArrowLeft, Flag, MapPinned, Save, Trophy } from "lucide-react";
import { asc, eq } from "drizzle-orm";

import { updateTeeSetAction, upsertHoleAction } from "@/app/courses/actions";
import {
  DataPanel,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { CourseHoleMapEditor } from "./course-hole-map-editor";

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
  const holeSlots = createHoleSlots(primaryTeeSet?.par ?? 72, holesForPrimaryTeeSet.length);
  const holeByNumber = new Map(holesForPrimaryTeeSet.map((hole) => [hole.holeNumber, hole]));

  return (
    <PageShell size="full">
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
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="green">Course editor</StatusPill>}
        title={data.course.name}
        description="Edit the tee-set metadata and saved hole geometry used by real-course overlays and handicap estimates."
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
            value: mappedHoleCount >= 18 || (primaryTeeSet?.par ?? 72) <= 36 ? "Ready" : "Partial",
            detail: "Round overlays use these coordinates.",
          },
        ]}
      />

      {!primaryTeeSet ? (
        <DataPanel>
          <SectionHeader title="No tee set" description="This course needs a tee set before holes can be mapped." />
          <CardContent>
            <Button asChild>
              <Link href="/courses/new" prefetch={false}>Create a new course instead</Link>
            </Button>
          </CardContent>
        </DataPanel>
      ) : (
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
      )}

      {primaryTeeSet ? (
        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            <DataPanel>
              <SectionHeader
                title="Tee set"
                description="Rating and slope improve handicap calculations. Yardage and par drive the round context."
                action={<Trophy className="size-5 text-amber-500" />}
              />
              <CardContent>
                <form action={updateTeeSetAction} className="grid gap-4">
                  <input type="hidden" name="courseId" value={data.course.id} />
                  <input type="hidden" name="teeSetId" value={primaryTeeSet.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Tee set" name="name" defaultValue={primaryTeeSet.name} required />
                    <FormField label="Par" name="par" type="number" defaultValue={primaryTeeSet.par} required />
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
                    <FormField label="Yards" name="yards" type="number" defaultValue={primaryTeeSet.yards ?? undefined} />
                  </div>
                  <Button type="submit" className="w-full rounded-xl bg-[#111827] text-white sm:w-fit">
                    <Save className="size-4" />
                    Save tee set
                  </Button>
                </form>
              </CardContent>
            </DataPanel>

            <section className="grid gap-3 sm:grid-cols-2">
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

          <DataPanel>
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
        <DataPanel>
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
              />
            ))}
          </CardContent>
        </DataPanel>
      ) : null}
    </PageShell>
  );
}

async function getCourseEditorData(courseId: string) {
  const db = getDb();
  const [courseRows, teeSetRows, holeRows] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, courseId)).limit(1),
    db.select().from(teeSets).where(eq(teeSets.courseId, courseId)).orderBy(asc(teeSets.name)),
    db
      .select()
      .from(holes)
      .where(eq(holes.courseId, courseId))
      .orderBy(asc(holes.holeNumber)),
  ]);
  const course = courseRows[0];

  if (!course) {
    return null;
  }

  return {
    course,
    teeSets: teeSetRows,
    holes: holeRows,
  };
}

function HoleForm({
  courseId,
  teeSetId,
  holeNumber,
  hole,
}: {
  courseId: string;
  teeSetId: string;
  holeNumber: number;
  hole: (typeof holes.$inferSelect) | null;
}) {
  return (
    <form action={upsertHoleAction} className="apple-panel-strong p-4">
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
        <FormField label="Par" name="par" type="number" min={1} defaultValue={hole?.par ?? undefined} required />
        <FormField label="Yards" name="yards" type="number" min={1} defaultValue={hole?.yards ?? undefined} required />
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
          Tee {coordinateFormatter.format(hole.teeLat)}, {coordinateFormatter.format(hole.teeLng)} / Green{" "}
          {coordinateFormatter.format(hole.greenLat)}, {coordinateFormatter.format(hole.greenLng)}
        </p>
      ) : null}

      <Button type="submit" variant="outline" className="mt-4 w-full">
        <Save className="size-4" />
        Save hole
      </Button>
    </form>
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

function CourseGeometryPreview({ holes: mappedHoles }: { holes: Array<typeof holes.$inferSelect> }) {
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
  const xFor = (lng: number) => pad + ((lng - minLng) / Math.max(0.000001, maxLng - minLng)) * (width - pad * 2);
  const yFor = (lat: number) => height - pad - ((lat - minLat) / Math.max(0.000001, maxLat - minLat)) * (height - pad * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-80 w-full rounded-2xl border bg-[#0f172a]">
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
            <line x1={teeX} y1={teeY} x2={greenX} y2={greenY} stroke="#ffffff" strokeOpacity="0.28" strokeWidth="10" strokeLinecap="round" />
            <line x1={teeX} y1={teeY} x2={greenX} y2={greenY} stroke="url(#course-line)" strokeWidth="4" strokeLinecap="round" />
            <circle cx={teeX} cy={teeY} r="5" fill="#ffffff" stroke="#111827" strokeWidth="2" />
            <circle cx={greenX} cy={greenY} r="7" fill="#dcfce7" stroke="#22c55e" strokeWidth="3" />
            <text x={(teeX + greenX) / 2} y={(teeY + greenY) / 2 - 8} fill="#e5e7eb" fontSize="12" textAnchor="middle">
              {hole.holeNumber}
            </text>
          </g>
        );
      })}
      <text x="28" y="32" fill="#e5e7eb" fontSize="13">
        Saved tee-to-green geometry
      </text>
    </svg>
  );
}

function createHoleSlots(par: number, mappedCount: number) {
  const count = par <= 36 && mappedCount <= 9 ? 9 : 18;
  return Array.from({ length: count }, (_, index) => index + 1);
}

function formatOptionalNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}
