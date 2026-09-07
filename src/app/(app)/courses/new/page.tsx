import Link from "next/link";
import { UrlTabs } from "@/components/untitled-ui/url-tabs";
import type { ComponentProps } from "react";
import { ArrowLeft, Flag, MapPinned, Save, Search } from "lucide-react";

import { CourseCreationForm } from "@/app/courses/course-creation-form";
import { createCourseAction } from "@/app/courses/actions";
import { GoogleCourseImporter } from "@/app/courses/google-course-importer";
import { OsmCourseImporter } from "@/app/courses/osm-course-importer";
import { DesktopWorkflowLayout } from "@/components/app/desktop-workbench";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
        eyebrow={<StatusPill tone="green">Add a course</StatusPill>}
        title="Add a course"
        description="Choose a source or enter the course and first tee. Then review its hole map."
      />

      <DesktopWorkflowLayout
        steps={courseWorkflowSteps}
        helpTitle="Course setup help"
        helpDescription="Build trustworthy course data"
        helpItems={courseWorkflowHelpItems}
      >
        <UrlTabs
          label="Course setup source"
          queryKey="source"
          defaultTabKey="google"
          tabs={[
            {
              id: "google",
              label: "Google",
              content: (
                <DataPanel>
                  <SectionHeader
                    title="Google import"
                    description="Search by name and location, then confirm the exact course before importing."
                    action={<Search className="size-5 text-primary" />}
                  />
                  <CardContent>
                    <GoogleCourseImporter />
                  </CardContent>
                </DataPanel>
              ),
            },
            {
              id: "manual",
              label: "Manual entry",
              content: (
                <DataPanel>
                  <SectionHeader
                    title="Course details"
                    description="Start with the tee set you normally play. Extra tee sets can be added later."
                    action={<Flag className="size-5 text-primary" />}
                  />
                  <CardContent>
                    <CourseCreationForm action={createCourseAction} className="grid gap-4">
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
                        <FormField
                          label="Total yardage (yd)"
                          name="yards"
                          type="number"
                          min={1}
                          placeholder="5839"
                        />
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Course and tee names are required. Leave unknown rating, slope and yardage
                        blank.
                      </p>
                      <Button type="submit" size="lg" className="w-full rounded-lg sm:w-fit">
                        <Save className="size-4" />
                        Create course
                      </Button>
                    </CourseCreationForm>
                  </CardContent>
                </DataPanel>
              ),
            },
            {
              id: "osm",
              label: "OpenStreetMap",
              content: (
                <DataPanel>
                  <SectionHeader
                    title="OpenStreetMap import"
                    description="Find a course in OpenStreetMap and review available hole locations before importing."
                    action={<MapPinned className="size-5 text-primary" />}
                  />
                  <CardContent>
                    <OsmCourseImporter />
                  </CardContent>
                </DataPanel>
              ),
            },
          ]}
        />

        <DataPanel>
          <SectionHeader
            title="Overlay notes"
            description="How this connects to the course maps."
            action={<MapPinned className="size-5 text-primary" />}
          />
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <Alert className="border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]">
              <MapPinned className="size-4" />
              <AlertTitle>Hole geometry drives the map</AlertTitle>
              <AlertDescription>
                The round page projects each launch-monitor shot from the saved tee point toward the
                green point using total distance and side carry.
              </AlertDescription>
            </Alert>
            <div className="apple-panel-strong p-4">
              <p className="font-semibold">Review the hole map</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You only need tee and green coordinates to get useful overlays. Check imported
                points against the course before using them for shot overlays.
              </p>
            </div>
          </CardContent>
        </DataPanel>
      </DesktopWorkflowLayout>
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
      <Input
        inputMode={props.type === "number" ? "decimal" : undefined}
        name={name}
        className="h-11 rounded-xl bg-background"
        {...props}
      />
    </label>
  );
}
