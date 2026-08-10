"use client";

import { useState, type ComponentProps } from "react";
import { Globe2, MapPinned, PencilLine, Save } from "lucide-react";

import { createCourseAction } from "@/app/courses/actions";
import { GoogleCourseImporter } from "@/app/courses/google-course-importer";
import { OsmCourseImporter } from "@/app/courses/osm-course-importer";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { SegmentedControl } from "@/components/app/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CourseSource = "google" | "osm" | "manual";

const sourceOptions = [
  { label: "Google", value: "google" },
  { label: "OSM", value: "osm" },
  { label: "Manual", value: "manual" },
];

export function MobileCourseSourceChooser() {
  const [source, setSource] = useState<CourseSource>("google");

  return (
    <section className="grid gap-4 lg:hidden" data-mobile-course-source={source}>
      <IOSSectionHeader
        title="Choose a source"
        description="Use one setup path. You can switch without creating a duplicate course."
      />
      <SegmentedControl
        label="Course source"
        value={source}
        options={sourceOptions}
        onChange={(value) => setSource(value as CourseSource)}
      />

      <section className="grid gap-2.5" aria-live="polite" aria-label={workflowTitle(source)}>
        <IOSGroupedList label="Selected course source">
          <IOSListRow
            icon={workflowIcon(source)}
            label={workflowTitle(source)}
            detail={workflowDescription(source)}
            status={<IOSInlineStatus label="Selected workflow" tone="info" />}
          />
        </IOSGroupedList>
        <div className="ios-grouped-list p-4" data-course-source-workflow={source}>
          {source === "google" ? <GoogleCourseImporter /> : null}
          {source === "osm" ? <OsmCourseImporter /> : null}
          {source === "manual" ? <ManualCourseWorkflow /> : null}
        </div>
      </section>

      <IOSDisclosureGroup
        label="Course setup guidance"
        items={[
          {
            value: "map-guidance",
            title: "How course maps work",
            summary: "Tee + green",
            description: "What you need after creating the course",
            content: (
              <div className="grid gap-2 text-[13px] leading-5 text-muted-foreground">
                <p>
                  Saved tee and green coordinates power round overlays and the hole editor. They are
                  enough for a useful first map.
                </p>
                <p>
                  Google is strongest for official identity. OpenStreetMap may also provide tagged
                  hole geometry. Manual entry always remains available.
                </p>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

function ManualCourseWorkflow() {
  return (
    <form action={createCourseAction} className="grid gap-4">
      <div>
        <h2 className="text-[17px] font-semibold text-foreground">Enter course details</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Create the course and the tee set you normally play. Map individual holes next.
        </p>
      </div>
      <MobileFormField label="Course name" name="name" placeholder="Bootle Golf Course" required />
      <MobileFormField label="Country" name="country" placeholder="England" />
      <MobileFormField label="Tee set" name="teeName" placeholder="Yellow" required />
      <MobileFormField label="Par" name="par" type="number" min={1} defaultValue={72} required />
      <MobileFormField
        label="Course rating"
        name="courseRating"
        type="number"
        step="0.1"
        placeholder="71.5"
      />
      <MobileFormField
        label="Slope rating"
        name="slopeRating"
        type="number"
        min={55}
        max={155}
        placeholder="123"
      />
      <MobileFormField label="Yards" name="yards" type="number" min={1} placeholder="5839" />
      <Button type="submit" className="min-h-11 w-full rounded-lg">
        <Save className="size-4" aria-hidden />
        Create course
      </Button>
    </form>
  );
}

function MobileFormField({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & ComponentProps<typeof Input>) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      <span>{label}</span>
      <Input name={name} className="min-h-11 rounded-lg bg-background" {...props} />
    </label>
  );
}

function workflowTitle(source: CourseSource) {
  if (source === "google") return "Google Places";
  if (source === "osm") return "OpenStreetMap";
  return "Manual setup";
}

function workflowDescription(source: CourseSource) {
  if (source === "google") return "Find the official place and create its canonical course shell.";
  if (source === "osm") return "Search mapped courses and import tagged hole geometry when found.";
  return "Create a course and first tee set without an external source.";
}

function workflowIcon(source: CourseSource) {
  if (source === "google") return Globe2;
  if (source === "osm") return MapPinned;
  return PencilLine;
}
