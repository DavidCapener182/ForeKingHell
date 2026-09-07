"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StrategyContextFields({
  courseId,
  teeSetId,
}: {
  courseId?: string;
  teeSetId?: string;
}) {
  const search = useSearchParams();
  return (
    <>
      <input type="hidden" name="courseId" value={courseId ?? ""} />
      <input type="hidden" name="teeSetId" value={teeSetId ?? ""} />
      {["hole", "option"].map((name) =>
        search.get(name) ? (
          <input key={name} type="hidden" name={name} value={search.get(name)!} />
        ) : null,
      )}
    </>
  );
}

export function StrategyModeNavigation({
  mode,
  courseId,
  teeSetId,
}: {
  mode: "pre" | "post";
  courseId?: string;
  teeSetId?: string;
}) {
  const search = useSearchParams();
  return (
    <nav aria-label="Round strategy" className="flex rounded-xl border border-border bg-card p-1">
      {(["pre", "post"] as const).map((value) => {
        const query = new URLSearchParams(search.toString());
        query.set("mode", value);
        query.delete("saved");
        if (courseId) query.set("courseId", courseId);
        if (teeSetId) query.set("teeSetId", teeSetId);
        return (
          <Link
            key={value}
            data-tone-role={mode === value ? undefined : "surface"}
            href={`/courses/strategy?${query}`}
            aria-current={mode === value ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            {value === "pre" ? "Pre-round" : "Post-round"}
          </Link>
        );
      })}
    </nav>
  );
}

export function StrategyCourseSelection({
  courses,
  tees,
  courseId,
  teeSetId,
}: {
  courses: { id: string; name: string }[];
  tees: { id: string; name: string }[];
  courseId?: string;
  teeSetId?: string;
}) {
  const search = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedCourse, setCourse] = useState(courseId ?? "");
  const [selectedTee, setTee] = useState(teeSetId ?? "");
  const sameCourse = selectedCourse === courseId;
  const control =
    "min-h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <form
      action="/courses/strategy"
      className="grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.4fr)_auto]"
      aria-label="Choose course and tee"
    >
      <label className="grid gap-2 text-sm font-semibold sm:col-span-3">
        Search courses
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={control}
        />
      </label>
      <input type="hidden" name="mode" value="pre" />
      {sameCourse
        ? ["hole", "option", "roundId"].map((name) =>
            search.get(name) ? (
              <input key={name} type="hidden" name={name} value={search.get(name)!} />
            ) : null,
          )
        : null}
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
        Course
        <select
          className={control}
          name="courseId"
          value={selectedCourse}
          onChange={(event) => setCourse(event.target.value)}
          required
        >
          {!courseId ? <option value="">Choose a course</option> : null}
          {courses
            .filter(
              (course) =>
                course.id === selectedCourse ||
                course.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
        Tee
        <select
          className={control}
          name="teeSetId"
          value={sameCourse ? selectedTee : ""}
          onChange={(event) => setTee(event.target.value)}
          disabled={!sameCourse || tees.length === 0}
        >
          {!sameCourse ? <option value="">Load course first</option> : null}
          {sameCourse && !selectedTee ? <option value="">Choose a tee</option> : null}
          {sameCourse
            ? tees.map((tee) => (
                <option key={tee.id} value={tee.id}>
                  {tee.name}
                </option>
              ))
            : null}
        </select>
      </label>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        onClick={() => {
          setQuery("");
          setCourse(courseId ?? "");
          setTee(teeSetId ?? "");
        }}
      >
        Reset setup
      </Button>
      <Button type="submit" variant="outline" className="min-h-11" disabled={!selectedCourse}>
        Load caddie book
      </Button>
    </form>
  );
}
