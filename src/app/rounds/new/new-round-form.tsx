"use client";

import { useActionState, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RoundCreationState } from "@/app/rounds/actions";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Save,
  TriangleAlert,
} from "lucide-react";

import styles from "./new-round-form.module.css";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { StickyMobileAction } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  compact?: boolean;
  courses: RoundCourseOption[];
  courseId?: string;
  teeSetId?: string;
  creationId: string;
  createRoundAction: (state: RoundCreationState, formData: FormData) => Promise<RoundCreationState>;
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
  compact = false,
  courses,
  courseId,
  teeSetId,
  creationId,
  createRoundAction,
}: NewRoundFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [pendingTee, setPendingTee] = useState<string | null>(null);
  const [requestId] = useState(creationId);
  const [result, formAction, pending] = useActionState(createRoundAction, { error: null });
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
  const [selectedTeeSetId, setSelectedTeeSetId] = useState(
    allTeeSets.find((tee) => tee.id === teeSetId && (!courseId || tee.courseId === courseId))?.id ??
      allTeeSets.find((tee) => tee.courseId === courseId)?.id ??
      allTeeSets[0]?.id ??
      "",
  );
  const [mobileStep, setMobileStep] = useState<MobileRoundStep>("setup");
  const [mobileStepDirection, setMobileStepDirection] = useState<"forward" | "back" | null>(null);
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);
  const [roundStatus, setRoundStatus] = useState("complete");
  const [scoreValues, setScoreValues] = useState<Record<number, string>>({});
  const mobileStepHeadingRef = useRef<HTMLHeadingElement>(null);
  const mobileStepPanelRefs = useRef<Record<MobileRoundStep, HTMLDivElement | null>>({
    setup: null,
    score: null,
    stats: null,
    review: null,
  });
  const selectTee = (id: string) => {
    setSelectedTeeSetId(id);
    setActiveHoleIndex(0);
    setScoreValues({});
    setPendingTee(null);
  };
  const requestTee = (id: string) => {
    const entries = formRef.current ? new FormData(formRef.current) : null;
    const hasHoleEntries =
      entries &&
      [...entries].some(
        ([name, value]) =>
          /^(score|putts|penalties|chipShots|greensideSandShots|fairwayHit|gir)-/.test(name) &&
          value !== "" &&
          value !== "null",
      );
    if (hasHoleEntries && id !== selectedTeeSetId) setPendingTee(id);
    else selectTee(id);
  };
  const selectedTeeSet =
    allTeeSets.find((teeSet) => teeSet.id === selectedTeeSetId) ?? allTeeSets[0] ?? null;
  const holes = useMemo(() => buildRoundHoles(selectedTeeSet), [selectedTeeSet]);
  const activeStepIndex = mobileRoundSteps.findIndex((step) => step.id === mobileStep);
  const validScore = (index: number) => {
    const value = Number(scoreValues[index]);
    return Number.isInteger(value) && value >= 1;
  };
  const completedScoreCount = holes.filter((_, index) => validScore(index)).length;
  const enteredScoreTotal = holes.reduce(
    (total, _, index) => total + (validScore(index) ? Number(scoreValues[index]) : 0),
    0,
  );
  const missingScoreCount = Math.max(0, holes.length - completedScoreCount);
  const completeRoundNeedsScores =
    holes.length === 0 || (roundStatus === "complete" && missingScoreCount > 0);
  const scorecardGridId = `${instanceId}-scorecard-entry-grid`;
  const reviewCompletenessId = `${instanceId}-review-completeness`;

  const changeMobileStep = (nextStep: MobileRoundStep) => {
    const nextStepIndex = mobileRoundSteps.findIndex((step) => step.id === nextStep);
    if (nextStepIndex === activeStepIndex) return;
    setMobileStepDirection(nextStepIndex > activeStepIndex ? "forward" : "back");
    setMobileStep(nextStep);
  };

  useLayoutEffect(() => {
    if (!mobileStepDirection) return;
    const panel = mobileStepPanelRefs.current[mobileStep];
    const shouldAnimate =
      compact ||
      (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches);

    if (panel) {
      panel.dataset.direction = mobileStepDirection;
    }
    if (panel && shouldAnimate) {
      panel.classList.remove("t-route-step");
      void panel.offsetWidth;
      panel.classList.add("t-route-step");
    }

    const frame = window.requestAnimationFrame(() =>
      mobileStepHeadingRef.current?.focus({ preventScroll: true }),
    );
    const removeMotionClass = () => panel?.classList.remove("t-route-step");
    panel?.addEventListener("animationend", removeMotionClass, { once: true });

    return () => {
      window.cancelAnimationFrame(frame);
      panel?.removeEventListener("animationend", removeMotionClass);
      removeMotionClass();
    };
  }, [mobileStep, mobileStepDirection, compact]);

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
      action={formAction}
      ref={formRef}
      noValidate
      data-round-entry-layout={compact ? "companion" : "workbench"}
      data-round-entry-step={mobileStep}
      className={cn("grid min-w-0 gap-5", styles.form)}
      // A returned save error must retain uncontrolled notes and scorecard fields.
      // Successful creation navigates to the saved round instead of clearing this form.
      onReset={(event) => event.preventDefault()}
      onSubmit={(event) => {
        const invalid = [...event.currentTarget.elements].find(
          (element) => element instanceof HTMLInputElement && !element.validity.valid,
        ) as HTMLInputElement | undefined;
        if (invalid) {
          event.preventDefault();
          const hole = invalid.name.match(/-(\d+)$/);
          if (hole) {
            setActiveHoleIndex(Number(hole[1]));
            changeMobileStep("score");
          } else changeMobileStep("setup");
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => {
              invalid.focus();
              invalid.reportValidity();
            }),
          );
        } else trackPlausibleEvent("Round Created");
      }}
    >
      <AlertDialog
        open={Boolean(pendingTee)}
        onOpenChange={(open) => {
          if (!open) setPendingTee(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change course or tee?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the hole scores and stats you have entered. Your date and round notes stay
              here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Keep this scorecard</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                if (pendingTee) selectTee(pendingTee);
              }}
            >
              Change and clear holes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <input type="hidden" name="creationId" value={requestId} />
      {result.error ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : null}
      <input type="hidden" name="holeCount" value={holes.length} />

      <MobileRoundStepper step={mobileStep} onStepChange={changeMobileStep} />
      <h2 ref={mobileStepHeadingRef} tabIndex={-1} className="sr-only">
        Round step: {mobileRoundSteps[activeStepIndex]?.label ?? "Setup"}
      </h2>

      <div
        data-round-setup
        className={cn(
          "apple-panel min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]",
          mobileStep === "setup" || mobileStep === "stats" ? "grid" : "hidden sm:grid",
        )}
      >
        <div
          data-entry-section="setup"
          ref={(node) => {
            mobileStepPanelRefs.current.setup = node;
          }}
          className={cn(
            "grid gap-4 sm:contents",
            mobileStep === "setup" ? "" : "hidden sm:contents",
          )}
        >
          <label className="grid gap-2 text-sm font-medium">
            Search courses and tees
            <input
              type="search"
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              className="min-h-11 rounded-lg border bg-background px-3"
              placeholder="Course or tee name"
            />
          </label>
          <label
            className={cn(
              "grid gap-2 text-sm font-medium",
              mobileStep === "stats" ? "hidden sm:grid" : "",
            )}
          >
            <span id={`${instanceId}-course-label`}>Course / tee</span>
            <select
              name="teeSetId"
              aria-labelledby={`${instanceId}-course-label`}
              aria-describedby={`${instanceId}-tee-description`}
              value={selectedTeeSet.id}
              onChange={(event) => requestTee(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base"
            >
              {courses
                .filter((course) =>
                  course.teeSets.some(
                    (tee) =>
                      tee.id === selectedTeeSetId ||
                      `${course.name} ${tee.name}`
                        .toLowerCase()
                        .includes(courseSearch.toLowerCase()),
                  ),
                )
                .map((course) => (
                  <optgroup key={course.id} label={course.name}>
                    {course.teeSets.map((tee) => (
                      <option key={tee.id} value={tee.id}>
                        {course.name} - {tee.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <span id={`${instanceId}-tee-description`} className="text-xs text-muted-foreground">
              {selectedTeeSet.name} tees · {holes.length} saved holes · Par {selectedTeeSet.par}
            </span>
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
            <Select name="roundStatus" value={roundStatus} onValueChange={setRoundStatus}>
              <SelectTrigger className="h-11 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
              </SelectContent>
            </Select>
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
        </div>
        <div
          data-entry-section="stats"
          ref={(node) => {
            mobileStepPanelRefs.current.stats = node;
          }}
          className={cn(
            "grid gap-4 sm:contents",
            mobileStep === "stats" ? "" : "hidden sm:contents",
          )}
        >
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
      </div>

      <div
        data-entry-section="score"
        ref={(node) => {
          mobileStepPanelRefs.current.score = node;
        }}
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
          <CalendarDays className="size-5 text-primary" />
        </div>

        {!holes.length ? (
          <Alert className="mt-4">
            <AlertTitle>Hole details needed</AlertTitle>
            <AlertDescription>
              This tee does not have a saved hole-by-hole scorecard. Choose another tee or add its
              hole details in Courses.
            </AlertDescription>
          </Alert>
        ) : null}
        <ToggleGroup
          type="single"
          value={String(activeHoleIndex)}
          onValueChange={(value) => {
            if (value) {
              setActiveHoleIndex(Number(value));
            }
          }}
          variant="outline"
          aria-label="Scorecard hole"
          className="sticky top-[7.75rem] z-30 -mx-1 mt-4 w-full justify-start overflow-x-auto px-1 py-1 sm:hidden"
          data-round-hole-tabs
        >
          {holes.map((hole, index) => (
            <ToggleGroupItem
              key={hole.holeNumber}
              value={String(index)}
              aria-label={`Go to hole ${hole.holeNumber}`}
              className="min-h-11 min-w-11 rounded-xl p-0 text-sm font-semibold shadow-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {hole.holeNumber}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div data-hole-controls className="mt-3 flex items-center justify-between gap-2 sm:hidden">
          <Button
            type="button"
            variant="outline"
            disabled={activeHoleIndex === 0}
            onClick={() => setActiveHoleIndex((index) => index - 1)}
          >
            Previous hole
          </Button>
          <span className="text-xs text-muted-foreground">
            {completedScoreCount}/{holes.length} scored
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={activeHoleIndex >= holes.length - 1}
            onClick={() => setActiveHoleIndex((index) => index + 1)}
          >
            Next hole
          </Button>
        </div>
        <div
          className={styles.scoreScroll}
          tabIndex={0}
          role="region"
          aria-label="Scorecard columns"
        >
          <div
            data-round-grid-header
            className="mt-4 hidden rounded-lg border border-border bg-muted/55 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid sm:grid-cols-[minmax(9rem,1.4fr)_repeat(5,minmax(4.25rem,0.7fr))_repeat(2,minmax(5rem,0.75fr))] sm:items-center sm:gap-2"
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
            key={selectedTeeSet.id}
            id={scorecardGridId}
            data-scorecard-entry-grid
            role="group"
            aria-label="Keyboard-friendly scorecard hole entry grid"
            className="mt-3 grid gap-3 sm:gap-2"
          >
            {holes.map((hole, index) => (
              <fieldset
                key={hole.holeNumber}
                data-entry-hole
                data-active={index === activeHoleIndex}
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
      </div>

      <Card
        data-entry-section="review"
        ref={(node) => {
          mobileStepPanelRefs.current.review = node;
        }}
        hidden={mobileStep !== "review"}
        className="gap-0 py-0 sm:hidden"
      >
        <CardContent className="grid gap-3 p-4">
          <div>
            <p className="text-lg font-semibold tracking-normal">
              {completeRoundNeedsScores ? "Finish the scorecard" : "Ready to save"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {selectedTeeSet.courseName} / {selectedTeeSet.name} tees, {holes.length} holes.
            </p>
          </div>
          <Alert
            id={reviewCompletenessId}
            role={completeRoundNeedsScores ? "alert" : "status"}
            className={cn(
              completeRoundNeedsScores
                ? "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)] [&_[data-slot=alert-description]]:text-[var(--status-warning-foreground)]"
                : "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] [&_[data-slot=alert-description]]:text-[var(--status-success-foreground)]",
            )}
            data-round-completeness
          >
            {completeRoundNeedsScores ? (
              <TriangleAlert className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <AlertTitle>
              {completeRoundNeedsScores ? "Scores required" : "Scorecard status"}
            </AlertTitle>
            <AlertDescription>
              {!holes.length
                ? "This tee has no saved holes. Choose another tee or add its scorecard in Courses."
                : completeRoundNeedsScores
                  ? `${missingScoreCount} hole${missingScoreCount === 1 ? " is" : "s are"} missing a score. Enter every score or change the round status to In progress.`
                  : roundStatus === "in_progress"
                    ? `${completedScoreCount} of ${holes.length} hole scores entered. The round will remain in progress.`
                    : `All ${holes.length} hole scores are entered.`}
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-3 gap-2">
            <ReviewMetric label="Par" value={selectedTeeSet.par.toString()} />
            <ReviewMetric
              label="Score"
              value={completedScoreCount ? String(enteredScoreTotal) : "—"}
            />
            <ReviewMetric label="Scores" value={`${completedScoreCount}/${holes.length}`} />
          </div>
          {missingScoreCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActiveHoleIndex(holes.findIndex((_, index) => !validScore(index)));
                changeMobileStep("score");
              }}
            >
              Fix first missing or invalid score
            </Button>
          ) : null}
          <details className="rounded-xl border p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-semibold">
              Review all {holes.length} scores
            </summary>
            <ol className="divide-y">
              {holes.map((hole, index) => (
                <li key={hole.holeNumber}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full justify-between"
                    onClick={() => {
                      setActiveHoleIndex(index);
                      changeMobileStep("score");
                    }}
                  >
                    <span>
                      Hole {hole.holeNumber} · Par {hole.par}
                    </span>
                    <span>{validScore(index) ? scoreValues[index] : "Needs score"}</span>
                  </Button>
                </li>
              ))}
            </ol>
          </details>
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        data-desktop-save
        className="hidden w-full rounded-lg sm:flex sm:w-fit"
        disabled={completeRoundNeedsScores || pending}
      >
        <Save className="size-4" />
        {pending ? "Saving…" : "Save real round"}
      </Button>

      <StickyMobileAction className={styles.actions}>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={activeStepIndex <= 0}
            onClick={() => changeMobileStep(mobileRoundSteps[Math.max(0, activeStepIndex - 1)].id)}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {mobileStep === "review" ? (
            <Button
              type="submit"
              className="min-h-11 rounded-xl"
              disabled={completeRoundNeedsScores || pending}
              aria-describedby={completeRoundNeedsScores ? reviewCompletenessId : undefined}
            >
              <Save className="size-4" />
              {pending ? "Saving…" : "Save round"}
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-11 rounded-xl"
              onClick={() =>
                changeMobileStep(
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
      className="sticky top-[4.75rem] z-30 -mx-1 overflow-x-auto px-1 py-1 sm:hidden"
      data-round-step-navigation
      aria-label="Round steps"
    >
      <ToggleGroup
        type="single"
        value={step}
        onValueChange={(value) => {
          if (value) {
            onStepChange(value as MobileRoundStep);
          }
        }}
        variant="outline"
        aria-label="Round step"
        className="w-max min-w-full justify-start bg-background/90 p-1 backdrop-blur"
        data-round-stepper
      >
        {mobileRoundSteps.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.id}
            aria-current={item.id === step ? "step" : undefined}
            className="min-h-11 rounded-full px-3 text-sm font-medium shadow-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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
      <Select name={name} defaultValue="null" disabled={disabled}>
        <SelectTrigger className="h-11 min-w-0 sm:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="null">-</SelectItem>
          <SelectItem value="true">Hit</SelectItem>
          <SelectItem value="false">Miss</SelectItem>
        </SelectContent>
      </Select>
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

  return [];
}
