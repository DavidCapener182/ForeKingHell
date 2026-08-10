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
  instanceId?: string;
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

export function NewRoundForm({
  instanceId = "round",
  courses,
  createRoundAction,
}: NewRoundFormProps) {
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
  const [roundStatus, setRoundStatus] = useState("complete");
  const [scoreValues, setScoreValues] = useState<Record<number, string>>({});
  const selectedTeeSet =
    allTeeSets.find((teeSet) => teeSet.id === selectedTeeSetId) ?? allTeeSets[0] ?? null;
  const holes = useMemo(() => buildRoundHoles(selectedTeeSet), [selectedTeeSet]);
  const activeStepIndex = mobileRoundSteps.findIndex((step) => step.id === mobileStep);
  const completedScoreCount = holes.filter((_, index) => scoreValues[index]?.trim()).length;
  const missingScoreCount = Math.max(0, holes.length - completedScoreCount);
  const completeRoundNeedsScores = roundStatus === "complete" && missingScoreCount > 0;
  const scorecardGridId = `${instanceId}-scorecard-entry-grid`;
  const reviewCompletenessId = `${instanceId}-review-completeness`;

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
            onChange={(event) => {
              setSelectedTeeSetId(event.target.value);
              setActiveHoleIndex(0);
              setScoreValues({});
            }}
            className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            className="h-11 min-w-0 rounded-xl bg-background"
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
            value={roundStatus}
            onChange={(event) => setRoundStatus(event.target.value)}
            className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            placeholder="Weather, tees, match notes…"
            className="h-11 min-w-0 rounded-xl bg-background"
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
              placeholder="Dry, soft, rain…"
              className="h-11 min-w-0 rounded-xl bg-background"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>Wind</span>
            <Input
              name="wind"
              placeholder="10 mph into / cross"
              className="h-11 min-w-0 rounded-xl bg-background"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>Temperature</span>
            <Input
              name="temperature"
              placeholder="14C"
              className="h-11 min-w-0 rounded-xl bg-background"
            />
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
            placeholder="Ball, shaft setting, new club, grip changes…"
            className="h-11 min-w-0 rounded-xl bg-background"
          />
        </label>
      </div>

      <div
        className={cn(
          "rounded-2xl border bg-card p-4",
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
              aria-label={`Go to hole ${hole.holeNumber}`}
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

        <div
          className="mt-4 hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid sm:grid-cols-[minmax(9rem,1.4fr)_repeat(5,minmax(4.25rem,0.7fr))_repeat(2,minmax(5rem,0.75fr))] sm:items-center sm:gap-2"
          aria-hidden
        >
          <span>Hole</span>
          <span>Score</span>
          <span>Putts</span>
          <span>Pens</span>
          <span>Chips</span>
          <span>Sand</span>
          <span>Fairway</span>
          <span>GIR</span>
        </div>

        <div
          id={scorecardGridId}
          data-scorecard-entry-grid
          role="group"
          aria-label="Keyboard-friendly scorecard hole entry grid"
          className="mt-3 grid gap-3 sm:gap-2"
        >
          {holes.map((hole, index) => (
            <fieldset
              key={hole.holeNumber}
              className={cn(
                "apple-panel-strong grid grid-cols-2 gap-2 p-3 sm:grid-cols-[minmax(9rem,1.4fr)_repeat(5,minmax(4.25rem,0.7fr))_repeat(2,minmax(5rem,0.75fr))] sm:items-end sm:p-2",
                index === activeHoleIndex ? "grid" : "hidden sm:grid",
              )}
            >
              <input type="hidden" name={`holeNumber-${index}`} value={hole.holeNumber} />
              <input type="hidden" name={`par-${index}`} value={hole.par} />
              <input type="hidden" name={`yards-${index}`} value={hole.yards} />
              <input type="hidden" name={`strokeIndex-${index}`} value={hole.strokeIndex ?? ""} />

              <legend className="sr-only">Hole {hole.holeNumber} scorecard entry</legend>

              <div className="col-span-2 flex items-start justify-between gap-3 sm:col-span-1 sm:block">
                <div>
                  <p className="font-semibold">Hole {hole.holeNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Par {hole.par} - {hole.yards.toLocaleString("en-GB")} yd
                    {hole.strokeIndex ? ` - SI ${hole.strokeIndex}` : ""}
                  </p>
                </div>
              </div>

              <RoundNumberField
                label="Score"
                name={`score-${index}`}
                min={1}
                required={roundStatus === "complete"}
                onValueChange={(value) =>
                  setScoreValues((current) => ({ ...current, [index]: value }))
                }
              />
              <RoundNumberField label="Putts" name={`putts-${index}`} min={0} />
              <RoundNumberField label="Pens" name={`penalties-${index}`} min={0} />
              <RoundNumberField label="Chips" name={`chipShots-${index}`} min={0} />
              <RoundNumberField label="Sand" name={`greensideSandShots-${index}`} min={0} />
              <BooleanSelect
                label="Fairway"
                name={`fairwayHit-${index}`}
                disabled={hole.par === 3}
              />
              <BooleanSelect label="GIR" name={`gir-${index}`} />
            </fieldset>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "premium-card gap-3 p-4 sm:hidden",
          mobileStep === "review" ? "grid" : "hidden",
        )}
      >
        <div>
          <p className="text-lg font-semibold tracking-normal">
            {completeRoundNeedsScores ? "Finish the scorecard" : "Ready to save"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {selectedTeeSet.courseName} / {selectedTeeSet.name} tees, {holes.length} holes.
          </p>
        </div>
        <div
          id={reviewCompletenessId}
          role={completeRoundNeedsScores ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm leading-5",
            completeRoundNeedsScores
              ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/45 dark:bg-amber-500/10 dark:text-amber-100"
              : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/45 dark:bg-emerald-500/10 dark:text-emerald-100",
          )}
        >
          {completeRoundNeedsScores
            ? `${missingScoreCount} hole${missingScoreCount === 1 ? " is" : "s are"} missing a score. Enter every score or change the round status to In progress.`
            : roundStatus === "in_progress"
              ? `${completedScoreCount} of ${holes.length} hole scores entered. The round will remain in progress.`
              : `All ${holes.length} hole scores are entered.`}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ReviewMetric label="Par" value={selectedTeeSet.par.toString()} />
          <ReviewMetric
            label="Yards"
            value={selectedTeeSet.yards ? selectedTeeSet.yards.toLocaleString("en-GB") : "--"}
          />
          <ReviewMetric label="Scores" value={`${completedScoreCount}/${holes.length}`} />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="hidden w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:flex sm:w-fit"
        disabled={completeRoundNeedsScores}
      >
        <Save className="size-4" />
        Save real round
      </Button>

      <StickyMobileAction>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={activeStepIndex <= 0}
            onClick={() => setMobileStep(mobileRoundSteps[Math.max(0, activeStepIndex - 1)].id)}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {mobileStep === "review" ? (
            <Button
              type="submit"
              className="min-h-11 rounded-xl bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              disabled={completeRoundNeedsScores}
              aria-describedby={completeRoundNeedsScores ? reviewCompletenessId : undefined}
            >
              <Save className="size-4" />
              Save round
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-11 rounded-xl bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
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
          aria-current={item.id === step ? "step" : undefined}
          onClick={() => onStepChange(item.id)}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-3 py-2 text-sm font-medium shadow-sm",
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
    <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function RoundNumberField({
  label,
  name,
  min,
  required,
  onValueChange,
}: {
  label: string;
  name: string;
  min: number;
  required?: boolean;
  onValueChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:min-w-0">
      <span>{label}</span>
      <Input
        name={name}
        type="number"
        min={min}
        required={required}
        inputMode="numeric"
        autoComplete="off"
        className="h-11 min-w-0 rounded-xl bg-background text-base text-foreground sm:h-9 sm:rounded-lg sm:text-sm"
        onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
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
        className="h-11 min-w-0 rounded-xl border border-input bg-background px-2 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground sm:h-9 sm:rounded-lg sm:text-sm"
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
