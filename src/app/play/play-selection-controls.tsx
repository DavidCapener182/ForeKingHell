"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { selectCompanionPlayContextAction } from "@/app/play/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <Select
          value={optimisticCourseId ?? ""}
          disabled={isPending}
          onValueChange={(value) => select(value)}
        >
          <SelectTrigger className="min-h-12 w-full text-[15px] font-semibold">
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
            <SelectTrigger className="min-h-12 w-full text-[15px] font-semibold">
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
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
    <div className="grid gap-2 rounded-xl border bg-card p-3">
      <span>
        <Label className="block text-sm font-semibold">{label}</Label>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
      {children}
    </div>
  );
}
