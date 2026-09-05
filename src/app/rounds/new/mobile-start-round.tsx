"use client";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { RoundCourseOption } from "./new-round-form";
import { MobileLargeTitle, MobileMetric } from "@/components/app/mobile-screen";
import { Button } from "@/components/ui/button";
import styles from "@/components/app/mobile-companion.module.css";
export function MobileStartRound({
  courses,
  courseId,
  teeSetId,
  action,
}: {
  courses: RoundCourseOption[];
  courseId?: string;
  teeSetId?: string;
  action: (data: FormData) => Promise<void>;
}) {
  const [selectedCourse, setCourse] = useState(
    courses.find((course) => course.id === courseId)?.id ?? courses[0]?.id ?? "",
  );
  const course = courses.find((course) => course.id === selectedCourse);
  const [selectedTee, setTee] = useState(teeSetId ?? "");
  const tee = course?.teeSets.find((tee) => tee.id === selectedTee) ?? course?.teeSets[0];
  return (
    <div className="grid gap-6" data-mobile-start-round>
      <MobileLargeTitle title="Start round" detail="Choose your tee. Score as you play." />
      <form action={action} className="grid gap-6">
        <input type="hidden" name="roundStatus" value="in_progress" />
        <input type="hidden" name="teeSetId" value={tee?.id ?? ""} />
        <input type="hidden" name="holeCount" value={tee?.holes.length ?? 0} />
        <div className={styles.setup}>
          <label>
            Course
            <select
              value={selectedCourse}
              onChange={(event) => {
                setCourse(event.target.value);
                setTee("");
              }}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tee
            <select value={tee?.id ?? ""} onChange={(event) => setTee(event.target.value)}>
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
        </div>
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
      </form>
      <Button asChild variant="ghost" className="min-h-12">
        <Link href="/rounds/new?mode=history">Enter a completed round</Link>
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
