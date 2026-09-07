"use client";

import { useState } from "react";
import { CourseCreationForm } from "@/app/courses/course-creation-form";
import { Save, Settings2 } from "lucide-react";

import { updateTeeSetAction } from "@/app/courses/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function CourseTeeEditorSheet({
  courseId,
  teeSet,
}: {
  courseId: string;
  teeSet: {
    id: string;
    name: string;
    par: number;
    courseRating: number | null;
    slopeRating: number | null;
    yards: number | null;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <Settings2 className="size-4" />
          Edit tee set
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit {teeSet.name}</SheetTitle>
          <SheetDescription>
            Rating and slope feed the handicap estimate. Par and yardage provide the round context.
          </SheetDescription>
        </SheetHeader>
        <CourseCreationForm
          noun="tee set"
          action={updateTeeSetAction}
          className="grid gap-5 px-4 pb-4"
        >
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="teeSetId" value={teeSet.id} />
          <FieldGroup>
            <TeeField label="Tee set" name="name" defaultValue={teeSet.name} required />
            <TeeField
              label="Par"
              name="par"
              type="number"
              min={1}
              defaultValue={teeSet.par}
              required
            />
            <TeeField
              label="Course rating"
              name="courseRating"
              type="number"
              step="0.1"
              defaultValue={teeSet.courseRating ?? undefined}
            />
            <TeeField
              label="Slope"
              name="slopeRating"
              min={55}
              max={155}
              type="number"
              defaultValue={teeSet.slopeRating ?? undefined}
            />
            <TeeField
              label="Yards"
              name="yards"
              min={1}
              type="number"
              defaultValue={teeSet.yards ?? undefined}
            />
          </FieldGroup>
          <SheetFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11">
              <Save className="size-4" />
              Save tee set
            </Button>
          </SheetFooter>
        </CourseCreationForm>
      </SheetContent>
    </Sheet>
  );
}

function TeeField({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <Field>
      <FieldLabel htmlFor={`tee-${props.name}`}>{label}</FieldLabel>
      <Input
        inputMode={props.type === "number" ? "decimal" : undefined}
        className="min-h-11"
        id={`tee-${props.name}`}
        {...props}
      />
    </Field>
  );
}
