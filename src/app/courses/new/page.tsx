import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowLeft, Flag, MapPinned, Save } from "lucide-react";

import { createCourseAction } from "@/app/courses/actions";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

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
            value: "FKH tables",
            detail: "Uses the existing shared Supabase database prefix.",
          },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <DataPanel>
          <SectionHeader
            title="Course details"
            description="Start with the tee set you normally play. Extra tee sets can be added later."
            action={<Flag className="size-5 text-emerald-600" />}
          />
          <CardContent>
            <form action={createCourseAction} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Course name" name="name" placeholder="Bootle Golf Course" required />
                <FormField label="Country" name="country" placeholder="England" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Tee set" name="teeName" placeholder="Yellow" required />
                <FormField label="Par" name="par" type="number" min={1} defaultValue={72} required />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  label="Course rating"
                  name="courseRating"
                  type="number"
                  step="0.1"
                  placeholder="71.5"
                />
                <FormField label="Slope rating" name="slopeRating" type="number" min={55} max={155} placeholder="123" />
                <FormField label="Yards" name="yards" type="number" min={1} placeholder="5839" />
              </div>

              <Button type="submit" size="lg" className="w-full rounded-xl bg-[#111827] text-white sm:w-fit">
                <Save className="size-4" />
                Create course
              </Button>
            </form>
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Overlay notes"
            description="How this connects to the course maps."
            action={<MapPinned className="size-5 text-sky-600" />}
          />
          <CardContent className="space-y-3">
            <Alert className="border-emerald-200 bg-emerald-50/70">
              <MapPinned className="size-4" />
              <AlertTitle>Hole geometry drives the map</AlertTitle>
              <AlertDescription>
                The round page projects each launch-monitor shot from the saved tee point toward
                the green point using total distance and side carry.
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
      </section>
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
