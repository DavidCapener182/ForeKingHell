"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { selectCompanionPlayContextAction } from "@/app/play/actions";

type SelectionItem = { id: string; name: string; detail?: string };

export function PlaySelectionControls({
  courses,
  tees,
  selectedCourseId,
  selectedTeeId,
}: {
  courses: SelectionItem[];
  tees: SelectionItem[];
  selectedCourseId: string | null;
  selectedTeeId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticCourseId, setOptimisticCourseId] = useState(selectedCourseId);
  const [optimisticTeeId, setOptimisticTeeId] = useState(selectedTeeId);
  const [error, setError] = useState<string | null>(null);

  const select = (courseId: string, teeSetId?: string | null) => {
    const previousCourseId = optimisticCourseId;
    const previousTeeId = optimisticTeeId;
    setError(null);
    setOptimisticCourseId(courseId);
    setOptimisticTeeId(teeSetId ?? null);
    startTransition(async () => {
      try {
        const result = await selectCompanionPlayContextAction(courseId, teeSetId);
        const query = new URLSearchParams({ courseId: result.courseId });
        if (result.teeSetId) query.set("teeSetId", result.teeSetId);
        router.replace(`/play?${query.toString()}`, { scroll: false });
      } catch {
        setOptimisticCourseId(previousCourseId);
        setOptimisticTeeId(previousTeeId);
        setError("That course setup could not be saved. Try again.");
      }
    });
  };

  return (
    <div className="grid gap-3" aria-busy={isPending}>
      <SelectionField label="Course" detail="Strategy-ready and saved courses">
        <select
          value={optimisticCourseId ?? ""}
          disabled={isPending}
          onChange={(event) => select(event.target.value)}
          className="focus-aaa min-h-12 w-full rounded-xl border bg-card px-3 text-[15px] font-semibold outline-none disabled:opacity-65"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
              {course.detail ? ` · ${course.detail}` : ""}
            </option>
          ))}
        </select>
      </SelectionField>
      {optimisticCourseId === selectedCourseId && tees.length > 0 ? (
        <SelectionField label="Tee" detail="Remembered separately for this course">
          <select
            value={optimisticTeeId ?? ""}
            disabled={isPending}
            onChange={(event) => select(selectedCourseId!, event.target.value)}
            className="focus-aaa min-h-12 w-full rounded-xl border bg-card px-3 text-[15px] font-semibold outline-none disabled:opacity-65"
          >
            {tees.map((tee) => (
              <option key={tee.id} value={tee.id}>
                {tee.name}
                {tee.detail ? ` · ${tee.detail}` : ""}
              </option>
            ))}
          </select>
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
      {error ? (
        <p className="px-1 text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
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
    <label className="ios-grouped-list grid gap-2 bg-card p-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
      {children}
    </label>
  );
}
