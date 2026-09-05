"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { selectCompanionPlayContextAction } from "@/app/play/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlaySelectionItem = { id: string; name: string; detail?: string };

export type PlaySelectionControlsProps = {
  courses: PlaySelectionItem[];
  tees: PlaySelectionItem[];
  selectedCourseId: string | null;
  selectedTeeId: string | null;
  destination?: "/play" | "/courses/strategy";
};

export function PlaySelectionControls({
  courses,
  tees,
  selectedCourseId,
  selectedTeeId,
  destination = "/play",
}: PlaySelectionControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticCourseId, setOptimisticCourseId] = useState(selectedCourseId);
  const [optimisticTeeId, setOptimisticTeeId] = useState(selectedTeeId);
  const [selectionError, setSelectionError] = useState<{
    field: "course" | "tee";
    message: string;
    attempt: number;
  } | null>(null);
  const courseTriggerRef = useRef<HTMLButtonElement>(null);
  const teeTriggerRef = useRef<HTMLButtonElement>(null);
  const failedAttemptRef = useRef(0);

  useEffect(() => {
    if (!selectionError) return;
    return replayErrorShake(
      selectionError.field === "course" ? courseTriggerRef.current : teeTriggerRef.current,
    );
  }, [selectionError]);

  const select = (courseId: string, teeSetId?: string | null) => {
    const previousCourseId = optimisticCourseId;
    const previousTeeId = optimisticTeeId;
    const field = teeSetId ? "tee" : "course";
    setSelectionError(null);
    setOptimisticCourseId(courseId);
    setOptimisticTeeId(teeSetId ?? null);
    startTransition(async () => {
      try {
        const result = await selectCompanionPlayContextAction(courseId, teeSetId);
        const query = new URLSearchParams({ courseId: result.courseId });
        if (result.teeSetId) query.set("teeSetId", result.teeSetId);
        router.replace(`${destination}?${query.toString()}`, { scroll: false });
      } catch {
        setOptimisticCourseId(previousCourseId);
        setOptimisticTeeId(previousTeeId);
        failedAttemptRef.current += 1;
        setSelectionError({
          field,
          message: "That course setup could not be saved. Try again.",
          attempt: failedAttemptRef.current,
        });
      }
    });
  };

  return (
    <div className="grid gap-3" aria-busy={isPending}>
      <SelectionField label="Course" detail="Strategy-ready and saved courses">
        <Select
          value={optimisticCourseId ?? ""}
          disabled={isPending}
          onValueChange={(value) => select(value)}
        >
          <SelectTrigger
            ref={courseTriggerRef}
            aria-label="Course"
            aria-invalid={selectionError?.field === "course"}
            className={`t-input min-h-12 w-full text-[15px] font-semibold ${selectionError?.field === "course" ? "is-error is-shaking" : ""}`}
          >
            <SelectValue placeholder="Choose a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
                {course.detail ? ` · ${course.detail}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectionField>
      {optimisticCourseId === selectedCourseId && tees.length > 0 ? (
        <SelectionField label="Tee" detail="Remembered separately for this course">
          <Select
            value={optimisticTeeId ?? ""}
            disabled={isPending}
            onValueChange={(value) => select(selectedCourseId!, value)}
          >
            <SelectTrigger
              ref={teeTriggerRef}
              aria-label="Tee"
              aria-invalid={selectionError?.field === "tee"}
              className={`t-input min-h-12 w-full text-[15px] font-semibold ${selectionError?.field === "tee" ? "is-error is-shaking" : ""}`}
            >
              <SelectValue placeholder="Choose a tee" />
            </SelectTrigger>
            <SelectContent>
              {tees.map((tee) => (
                <SelectItem key={tee.id} value={tee.id}>
                  {tee.name}
                  {tee.detail ? ` · ${tee.detail}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectionField>
      ) : null}
      {isPending ? (
        <p
          className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          Updating course setup…
        </p>
      ) : null}
      {selectionError ? (
        <Alert variant="destructive">
          <AlertDescription>{selectionError.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function replayErrorShake(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("is-shaking");
  void element.offsetWidth;
  element.classList.add("is-shaking");
  const timer = window.setTimeout(() => element.classList.remove("is-shaking"), 300);
  return () => {
    window.clearTimeout(timer);
    element.classList.remove("is-shaking");
  };
}

function SelectionField({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <Field className="rounded-xl border bg-card p-3">
      <span>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription className="mt-0.5">{detail}</FieldDescription>
      </span>
      {children}
    </Field>
  );
}
