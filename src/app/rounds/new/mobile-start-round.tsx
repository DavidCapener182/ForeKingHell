"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { RoundCreationState } from "@/app/rounds/actions";
import { useFormStatus } from "react-dom";
import type { RoundCourseOption } from "./new-round-form";
import { MobileLargeTitle, MobileMetric } from "@/components/app/mobile-screen";
import { Button } from "@/components/ui/button";
import styles from "@/components/app/mobile-companion.module.css";
export function MobileStartRound({
  courses,
  courseId,
  teeSetId,
  creationId,
  action,
}: {
  courses: RoundCourseOption[];
  courseId?: string;
  teeSetId?: string;
  creationId: string;
  action: (state: RoundCreationState, data: FormData) => Promise<RoundCreationState>;
}) {
  const [requestId] = useState(creationId);
  const [result, formAction, pending] = useActionState(action, { error: null });
  const [selectedCourse, setCourse] = useState(
    courses.find((course) => course.id === courseId)?.id ?? courses[0]?.id ?? "",
  );
  const course = courses.find((course) => course.id === selectedCourse);
  const [search, setSearch] = useState("");
  const [teeChanged, setTeeChanged] = useState(false);
  const [selectedTee, setTee] = useState(
    course?.teeSets.find((tee) => tee.id === teeSetId)?.id ?? course?.teeSets[0]?.id ?? "",
  );
  const tee = course?.teeSets.find((tee) => tee.id === selectedTee);
  return (
    <div className="grid min-w-0 gap-6" data-mobile-start-round>
      <MobileLargeTitle title="Start round" detail="Choose your tee. Score as you play." />
      <form
        action={formAction}
        className="grid min-w-0 gap-6"
        onReset={(event) => event.preventDefault()}
      >
        <input type="hidden" name="creationId" value={requestId} />
        <input type="hidden" name="roundStatus" value="in_progress" />
        <input type="hidden" name="teeSetId" value={tee?.id ?? ""} />
        <input type="hidden" name="holeCount" value={tee?.holes.length ?? 0} />
        <fieldset disabled={pending} className={`${styles.setup} ${styles.roundSetup}`}>
          <label>
            Search courses
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Course name"
            />
          </label>
          <label>
            Course
            <select
              value={selectedCourse}
              onChange={(event) => {
                setCourse(event.target.value);
                setTee("");
                setTeeChanged(true);
              }}
            >
              {courses
                .filter(
                  (item) =>
                    item.id === selectedCourse ||
                    item.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tee
            <select
              required
              value={tee?.id ?? ""}
              onChange={(event) => {
                setTee(event.target.value);
                setTeeChanged(false);
              }}
            >
              <option value="">Choose a tee</option>
              {course?.teeSets.map((tee) => (
                <option key={tee.id} value={tee.id}>
                  {tee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toLocaleDateString("en-CA")}
            />
          </label>
        </fieldset>
        <p className="break-words text-sm text-muted-foreground">
          {course?.name ?? "No course selected"} · {tee?.name ?? "Choose a tee"}
        </p>
        {teeChanged && (
          <p role="status" className="text-sm text-muted-foreground">
            Course changed. Choose a tee for this course before starting.
          </p>
        )}
        {tee?.holes.length ? (
          <div className="mobile-metric-strip">
            <MobileMetric value={tee.holes.length} label="holes" />
            <MobileMetric value={tee.par} label="par" />
            <MobileMetric value={tee.yards ?? "—"} unit="yd" label="course" />
          </div>
        ) : (
          <p className="text-muted-foreground">
            Choose a course with mapped hole pars and yardages before starting.
          </p>
        )}
        <div hidden>
          {tee?.holes.map((hole, index) => (
            <span key={hole.holeNumber}>
              {Object.entries({
                holeNumber: hole.holeNumber,
                par: hole.par,
                yards: hole.yards,
                strokeIndex: hole.strokeIndex,
              }).map(([key, value]) => (
                <input key={key} type="hidden" name={`${key}-${index}`} value={value ?? ""} />
              ))}
            </span>
          ))}
        </div>
        <StartButton disabled={!tee?.holes.length} />
        {result.error ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        ) : null}
      </form>
      <Button asChild variant="ghost" className="min-h-12">
        <Link
          href={`/rounds/new?${new URLSearchParams({ mode: "history", ...(course ? { courseId: course.id } : {}), ...(tee ? { teeSetId: tee.id } : {}) })}`}
        >
          Enter a completed round
        </Link>
      </Button>
    </div>
  );
}
function StartButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-14 rounded-2xl text-base" disabled={disabled || pending}>
      {pending ? "Starting…" : "Start round"}
    </Button>
  );
}
