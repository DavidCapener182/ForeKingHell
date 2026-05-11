"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RoundCourseOption = {
  id: string;
  name: string;
  country: string | null;
  teeSets: Array<{
    id: string;
    name: string;
    par: number;
    courseRating: number | null;
    slopeRating: number | null;
    yards: number | null;
    holes: Array<{
      holeNumber: number;
      par: number;
      yards: number;
      strokeIndex: number | null;
    }>;
  }>;
};

type NewRoundFormProps = {
  courses: RoundCourseOption[];
  createRoundAction: (formData: FormData) => void | Promise<void>;
};

const todayIso = new Date().toISOString().slice(0, 10);

export function NewRoundForm({ courses, createRoundAction }: NewRoundFormProps) {
  const allTeeSets = useMemo(
    () =>
      courses.flatMap((course) =>
        course.teeSets.map((teeSet) => ({
          ...teeSet,
          courseId: course.id,
          courseName: course.name,
          country: course.country,
        })),
      ),
    [courses],
  );
  const [selectedTeeSetId, setSelectedTeeSetId] = useState(allTeeSets[0]?.id ?? "");
  const selectedTeeSet = allTeeSets.find((teeSet) => teeSet.id === selectedTeeSetId) ?? allTeeSets[0] ?? null;
  const holes = useMemo(() => buildRoundHoles(selectedTeeSet), [selectedTeeSet]);

  if (!selectedTeeSet) {
    return (
      <div className="rounded-2xl border bg-[#f9fafb] p-6 text-center">
        <p className="font-semibold">No courses with tee sets yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create or seed a course first, then come back to add a real round.
        </p>
      </div>
    );
  }

  return (
    <form action={createRoundAction} className="grid gap-5">
      <input type="hidden" name="holeCount" value={holes.length} />

      <div className="grid gap-4 rounded-2xl border bg-[#f9fafb] p-4 lg:grid-cols-[1.2fr_0.8fr]">
        <label className="grid gap-2 text-sm font-medium">
          <span>Course / tee</span>
          <select
            name="teeSetId"
            value={selectedTeeSet.id}
            onChange={(event) => setSelectedTeeSetId(event.target.value)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {courses.map((course) => (
              <optgroup key={course.id} label={course.name}>
                {course.teeSets.map((teeSet) => (
                  <option key={teeSet.id} value={teeSet.id}>
                    {course.name} - {teeSet.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span>Date</span>
          <Input name="date" type="date" defaultValue={todayIso} className="h-11 rounded-xl bg-white" required />
        </label>
        <label className="grid gap-2 text-sm font-medium lg:col-span-2">
          <span>Notes</span>
          <Input name="notes" placeholder="Weather, tees, match notes..." className="h-11 rounded-xl bg-white" />
        </label>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-semibold tracking-normal">{selectedTeeSet.courseName}</p>
            <p className="text-sm text-muted-foreground">
              {selectedTeeSet.name} tees / Par {selectedTeeSet.par}
              {selectedTeeSet.yards ? ` / ${selectedTeeSet.yards.toLocaleString("en-GB")} yd` : ""}
              {selectedTeeSet.courseRating && selectedTeeSet.slopeRating
                ? ` / ${selectedTeeSet.courseRating.toFixed(1)}-${selectedTeeSet.slopeRating}`
                : ""}
            </p>
          </div>
          <CalendarDays className="size-5 text-emerald-600" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {holes.map((hole, index) => (
            <div key={hole.holeNumber} className="rounded-xl border bg-[#f9fafb] p-3">
              <input type="hidden" name={`holeNumber-${index}`} value={hole.holeNumber} />
              <input type="hidden" name={`par-${index}`} value={hole.par} />
              <input type="hidden" name={`yards-${index}`} value={hole.yards} />
              <input type="hidden" name={`strokeIndex-${index}`} value={hole.strokeIndex ?? ""} />

              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Hole {hole.holeNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Par {hole.par} - {hole.yards.toLocaleString("en-GB")} yd
                    {hole.strokeIndex ? ` - SI ${hole.strokeIndex}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <RoundNumberField label="Score" name={`score-${index}`} min={1} />
                <RoundNumberField label="Putts" name={`putts-${index}`} min={0} />
                <RoundNumberField label="Pens" name={`penalties-${index}`} min={0} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <RoundNumberField label="Chips" name={`chipShots-${index}`} min={0} />
                <RoundNumberField label="Sand" name={`greensideSandShots-${index}`} min={0} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <BooleanSelect label="Fairway" name={`fairwayHit-${index}`} disabled={hole.par === 3} />
                <BooleanSelect label="GIR" name={`gir-${index}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full rounded-xl bg-[#111827] text-white sm:w-fit">
        <Save className="size-4" />
        Save real round
      </Button>
    </form>
  );
}

function RoundNumberField({
  label,
  name,
  min,
}: {
  label: string;
  name: string;
  min: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input name={name} type="number" min={min} className="h-9 rounded-lg bg-white text-sm text-foreground" />
    </label>
  );
}

function BooleanSelect({
  label,
  name,
  disabled,
}: {
  label: string;
  name: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={disabled ? "null" : "null"}
        disabled={disabled}
        className="h-9 rounded-lg border border-input bg-white px-2 text-sm text-foreground shadow-xs outline-none disabled:bg-slate-100 disabled:text-muted-foreground"
      >
        <option value="null">-</option>
        <option value="true">Hit</option>
        <option value="false">Miss</option>
      </select>
    </label>
  );
}

function buildRoundHoles(teeSet: (RoundCourseOption["teeSets"][number] & { courseName: string }) | null) {
  if (!teeSet) {
    return [];
  }

  if (teeSet.holes.length > 0) {
    return [...teeSet.holes].sort((left, right) => left.holeNumber - right.holeNumber);
  }

  const holeCount = teeSet.par <= 36 ? 9 : 18;
  const basePar = Math.round(teeSet.par / holeCount);
  const averageYards = Math.round((teeSet.yards ?? holeCount * 360) / holeCount);

  return Array.from({ length: holeCount }, (_, index) => ({
    holeNumber: index + 1,
    par: basePar,
    yards: averageYards,
    strokeIndex: null,
  }));
}
