import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowLeft, Flag, MapPinned, Save, Search } from "lucide-react";

import { createCourseAction } from "@/app/courses/actions";
import { GoogleCourseImporter } from "@/app/courses/google-course-importer";
import { OsmCourseImporter } from "@/app/courses/osm-course-importer";
import { DesktopWorkflowLayout } from "@/components/app/desktop-workbench";
import {
  DataPanel,
  MobileAccordionSection,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageArtwork } from "@/components/visuals/page-artwork";

export const dynamic = "force-dynamic";

const courseWorkflowSteps = [
  {
    title: "Choose source",
    value: "Current",
    detail: "Start from Google, OpenStreetMap or manual entry depending on what exists.",
    status: "current" as const,
  },
  {
    title: "Confirm tee set",
    detail: "Par, rating, slope and yardage drive round scoring and handicap context.",
  },
  {
    title: "Check duplicates",
    detail: "Prefer the canonical course record before creating another local copy.",
  },
  {
    title: "Map holes",
    detail: "After creation, add tee and green points so round overlays have real geometry.",
  },
];

const courseWorkflowHelpItems = [
  {
    title: "Best source",
    detail: "Google gives identity and media; OSM can add tagged hole geometry when available.",
  },
  {
    title: "Trust rules",
    detail:
      "Imported coordinates still need review. Keep low-confidence geometry visible until checked.",
  },
  {
    title: "Next action",
    detail:
      "Created courses should go straight to the hole-management workspace for tee and green data.",
  },
];

export default function NewCoursePage() {
  return (
    <PageShell>
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/courses" prefetch={false}>
            <ArrowLeft className="size-4" />
            Courses
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="green">Manual course setup</StatusPill>}
        title="New Course"
        description="Create the course and first tee set now. The next screen lets you enter tee and green coordinates for each hole so round overlays can use the real course."
        visual={
          <PageArtwork
            variant="fairway"
            alt=""
            crop="fairway"
            className="h-full min-h-44"
            priority
          />
        }
        metrics={[
          {
            label: "Required",
            value: "Course + tee",
            detail: "Name, par, yardage, rating and slope where known.",
          },
          {
            label: "Next step",
            value: "Hole map",
            detail: "Add tee and green points for the overlay engine.",
          },
          {
            label: "Display unit",
            value: "Yards",
            detail: "All course yardages are shown in yards.",
          },
          {
            label: "Storage",
            value: "LMWT tables",
            detail: "Stores course and tee data in the LM World Tour tables.",
          },
        ]}
      />

      <MobileMetricStrip
        items={[
          { label: "Step", value: "Course", detail: "Name and tee", tone: "green" },
          { label: "Next", value: "Hole map", detail: "Tee and green points", tone: "sky" },
          { label: "Unit", value: "Yards", detail: "Course yardage", tone: "slate" },
        ]}
      />

      <DesktopWorkflowLayout
        steps={courseWorkflowSteps}
        helpTitle="Course setup help"
        helpDescription="Build trustworthy course data"
        helpItems={courseWorkflowHelpItems}
      >
        <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          <DataPanel>
            <SectionHeader
              title="Google import"
              description="Find the real Google Place, store its canonical ID, address, coordinates, website and media signals."
              action={<Search className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <GoogleCourseImporter />
            </CardContent>
          </DataPanel>

          <DataPanel className="hidden sm:block">
            <SectionHeader
              title="Course details"
              description="Start with the tee set you normally play. Extra tee sets can be added later."
              action={<Flag className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <form action={createCourseAction} className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Course name"
                    name="name"
                    placeholder="Bootle Golf Course"
                    required
                  />
                  <FormField label="Country" name="country" placeholder="England" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Tee set" name="teeName" placeholder="Yellow" required />
                  <FormField
                    label="Par"
                    name="par"
                    type="number"
                    min={1}
                    defaultValue={72}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    label="Course rating"
                    name="courseRating"
                    type="number"
                    step="0.1"
                    placeholder="71.5"
                  />
                  <FormField
                    label="Slope rating"
                    name="slopeRating"
                    type="number"
                    min={55}
                    max={155}
                    placeholder="123"
                  />
                  <FormField label="Yards" name="yards" type="number" min={1} placeholder="5839" />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:w-fit"
                >
                  <Save className="size-4" />
                  Create course
                </Button>
              </form>
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="OpenStreetMap import"
              description="Search OSM/Nominatim, pull tagged golf-hole geometry from Overpass, then manually correct anything that needs work."
              action={<MapPinned className="size-5 text-sky-600" />}
            />
            <CardContent>
              <OsmCourseImporter />
            </CardContent>
          </DataPanel>
        </section>

        <DataPanel className="hidden sm:block">
          <SectionHeader
            title="Overlay notes"
            description="How this connects to the course maps."
            action={<MapPinned className="size-5 text-sky-600" />}
          />
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <Alert className="border-emerald-200 bg-emerald-50/70">
              <MapPinned className="size-4" />
              <AlertTitle>Hole geometry drives the map</AlertTitle>
              <AlertDescription>
                The round page projects each launch-monitor shot from the saved tee point toward the
                green point using total distance and side carry.
              </AlertDescription>
            </Alert>
            <div className="apple-panel-strong p-4">
              <p className="font-semibold">Good enough for MVP</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You only need tee and green coordinates to get useful overlays. The centreline can
                be refined later when we build the full course editor.
              </p>
            </div>
          </CardContent>
        </DataPanel>
      </DesktopWorkflowLayout>

      <MobileAccordionSection
        title="OpenStreetMap import"
        description="Search and pull tagged golf-hole geometry."
      >
        <OsmCourseImporter />
      </MobileAccordionSection>

      <MobileAccordionSection
        title="Google import"
        description="Search Google Places and create a canonical course shell."
      >
        <GoogleCourseImporter />
      </MobileAccordionSection>

      <MobileAccordionSection
        title="Overlay notes"
        description="How course maps power round overlays."
      >
        <div className="grid gap-3">
          <Alert className="border-emerald-200 bg-emerald-50/70">
            <MapPinned className="size-4" />
            <AlertTitle>Hole geometry drives the map</AlertTitle>
            <AlertDescription>
              Round pages project launch-monitor shots from saved tee points toward saved green
              points.
            </AlertDescription>
          </Alert>
          <p className="rounded-xl border bg-white/80 p-3 text-sm leading-6 text-muted-foreground">
            Tee and green coordinates are enough for useful overlays. Centreline refinement can
            happen later.
          </p>
        </div>
      </MobileAccordionSection>
    </PageShell>
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
      <Input name={name} className="h-11 rounded-xl bg-white" {...props} />
    </label>
  );
}
