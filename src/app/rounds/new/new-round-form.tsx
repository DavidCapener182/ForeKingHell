"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Save } from "lucide-react";

import { StickyMobileAction } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackPlausibleEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

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

type MobileRoundStep = "setup" | "score" | "stats" | "review";

const mobileRoundSteps: Array<{ id: MobileRoundStep; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "score", label: "Score" },
  { id: "stats", label: "Stats" },
  { id: "review", label: "Review" },
];

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
  const [mobileStep, setMobileStep] = useState<MobileRoundStep>("setup");
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);
  const selectedTeeSet =
    allTeeSets.find((teeSet) => teeSet.id === selectedTeeSetId) ?? allTeeSets[0] ?? null;
  const holes = useMemo(() => buildRoundHoles(selectedTeeSet), [selectedTeeSet]);
  const activeStepIndex = mobileRoundSteps.findIndex((step) => step.id === mobileStep);
  const activeHole = holes[activeHoleIndex] ?? holes[0] ?? null;

  if (!selectedTeeSet) {
    return (
      <div className="apple-panel p-6 text-center">
        <p className="font-semibold">No courses with tee sets yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create or seed a course first, then come back to add a real round.
        </p>
      </div>
    );
  }

  return (
    <form
      action={createRoundAction}
      className="grid gap-5"
      onSubmit={() => trackPlausibleEvent("Round Created")}
    >
      <input type="hidden" name="holeCount" value={holes.length} />

      <MobileRoundStepper step={mobileStep} onStepChange={setMobileStep} />

      <div
        className={cn(
          "apple-panel gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]",
          mobileStep === "setup" || mobileStep === "stats" ? "grid" : "hidden sm:grid",
        )}
      >
        <label
          className={cn(
            "grid gap-2 text-sm font-medium",
            mobileStep === "stats" ? "hidden sm:grid" : "",
          )}
        >
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
        <label
          className={cn(
            "grid gap-2 text-sm font-medium",
            mobileStep === "stats" ? "hidden sm:grid" : "",
          )}
        >
          <span>Date</span>
          <Input
            name="date"
            type="date"
            defaultValue={todayIso}
            className="h-11 rounded-xl bg-white"
            required
          />
        </label>
        <label
          className={cn(
            "grid gap-2 text-sm font-medium",
            mobileStep === "stats" ? "hidden sm:grid" : "",
          )}
        >
          <span>Status</span>
          <select
            name="roundStatus"
            defaultValue="complete"
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="complete">Complete</option>
            <option value="in_progress">In progress</option>
          </select>
        </label>
        <label
          className={cn(
            "grid gap-2 text-sm font-medium lg:col-span-2",
            mobileStep === "stats" ? "hidden sm:grid" : "",
          )}
        >
          <span>Notes</span>
          <Input
            name="notes"
            placeholder="Weather, tees, match notes..."
            className="h-11 rounded-xl bg-white"
          />
        </label>
        <div
          className={cn(
            "grid gap-3 lg:col-span-2 sm:grid-cols-3",
            mobileStep === "setup" ? "hidden sm:grid" : "",
          )}
        >
          <label className="grid gap-2 text-sm font-medium">
            <span>Conditions</span>
            <Input
              name="weatherConditions"
              placeholder="Dry, soft, rain..."
              className="h-11 rounded-xl bg-white"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>Wind</span>
            <Input
              name="wind"
              placeholder="10 mph into / cross"
              className="h-11 rounded-xl bg-white"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>Temperature</span>
            <Input name="temperature" placeholder="14C" className="h-11 rounded-xl bg-white" />
          </label>
        </div>
        <label
          className={cn(
            "grid gap-2 text-sm font-medium lg:col-span-2",
            mobileStep === "setup" ? "hidden sm:grid" : "",
          )}
        >
          <span>Equipment notes</span>
          <Input
            name="equipmentNotes"
            placeholder="Ball, shaft setting, new club, grip changes..."
            className="h-11 rounded-xl bg-white"
          />
        </label>
      </div>

      <div
        className={cn(
          "rounded-2xl border bg-white p-4",
          mobileStep === "score" ? "block" : "hidden sm:block",
        )}
      >
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

        <div className="sticky top-[7.75rem] z-30 -mx-1 mt-4 flex gap-1 overflow-x-auto px-1 py-1 sm:hidden">
          {holes.map((hole, index) => (
            <button
              key={hole.holeNumber}
              type="button"
              onClick={() => setActiveHoleIndex(index)}
              className={cn(
                "grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border text-sm font-semibold shadow-sm",
                index === activeHoleIndex
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {hole.holeNumber}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {holes.map((hole, index) => (
            <div
              key={hole.holeNumber}
              className={cn(
                "apple-panel-strong p-3",
                index === activeHoleIndex ? "block" : "hidden sm:block",
              )}
            >
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
                <BooleanSelect
                  label="Fairway"
                  name={`fairwayHit-${index}`}
                  disabled={hole.par === 3}
                />
                <BooleanSelect label="GIR" name={`gir-${index}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "premium-card grid gap-3 p-4 sm:hidden",
          mobileStep === "review" ? "grid" : "hidden",
        )}
      >
        <div>
          <p className="text-lg font-semibold tracking-normal">Ready to save</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {selectedTeeSet.courseName} / {selectedTeeSet.name} tees, {holes.length} holes.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ReviewMetric label="Par" value={selectedTeeSet.par.toString()} />
          <ReviewMetric
            label="Yards"
            value={selectedTeeSet.yards ? selectedTeeSet.yards.toLocaleString("en-GB") : "--"}
          />
          <ReviewMetric label="Hole" value={activeHole ? activeHole.holeNumber.toString() : "--"} />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="hidden w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:flex sm:w-fit"
      >
        <Save className="size-4" />
        Save real round
      </Button>

      <StickyMobileAction>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={activeStepIndex <= 0}
            onClick={() => setMobileStep(mobileRoundSteps[Math.max(0, activeStepIndex - 1)].id)}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {mobileStep === "review" ? (
            <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Save className="size-4" />
              Save round
            </Button>
          ) : (
            <Button
              type="button"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              onClick={() =>
                setMobileStep(
                  mobileRoundSteps[Math.min(mobileRoundSteps.length - 1, activeStepIndex + 1)].id,
                )
              }
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </StickyMobileAction>
    </form>
  );
}

function MobileRoundStepper({
  step,
  onStepChange,
}: {
  step: MobileRoundStep;
  onStepChange: (step: MobileRoundStep) => void;
}) {
  return (
    <nav
      className="sticky top-[4.75rem] z-30 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 sm:hidden"
      aria-label="Round steps"
    >
      {mobileRoundSteps.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onStepChange(item.id)}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-3 py-2 text-sm font-medium shadow-sm",
            item.id === step
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white/90 text-slate-700",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/85 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function RoundNumberField({ label, name, min }: { label: string; name: string; min: number }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input
        name={name}
        type="number"
        min={min}
        className="h-9 rounded-lg bg-white text-sm text-foreground"
      />
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

function buildRoundHoles(
  teeSet: (RoundCourseOption["teeSets"][number] & { courseName: string }) | null,
) {
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
