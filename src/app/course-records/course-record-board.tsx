"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { updateRecordViewQuery } from "./record-view-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { useClientReady } from "@/hooks/use-client-ready";
import styles from "./course-record-board.module.css";

export type CourseRecordBoardRow = {
  id: string;
  name: string;
  country: string | null;
  recordCount: number;
  teeSetCount: number;
  attemptCount: number;
  champion: null | {
    displayName: string;
    scoreLabel: string;
    verificationLabel: string;
    recordId: string;
    recordType: string;
    period: string;
    periodLabel?: string;
    verificationStatus: string;
    proofStatus: string | null;
    categoryName?: string;
  };
};
const boardColumns = [
  { id: "course", label: "Course", locked: true },
  { id: "leader", label: "Verified leader" },
  { id: "category", label: "Category and period", locked: true },
  { id: "result", label: "Result and proof", locked: true },
  { id: "boards", label: "Boards" },
  { id: "tees", label: "Tees" },
  { id: "submissions", label: "Submissions" },
  { id: "actions", label: "Actions", locked: true },
];
const human = (value: string) => value.replaceAll("_", " ");
export function CourseRecordBoard({ courses }: { courses: CourseRecordBoardRow[] }) {
  const ready = useClientReady();
  const params = useSearchParams();
  const query = params.get("recordQuery") ?? "";
  const proof = params.get("recordLeader") ?? "all";
  const sort = params.get("recordSort") ?? "course";
  const setQuery = (value: string) => updateRecordViewQuery({ recordQuery: value });
  const setProof = (value: string) => updateRecordViewQuery({ recordLeader: value });
  const setSort = (value: string) => updateRecordViewQuery({ recordSort: value });
  const visible = useMemo(
    () =>
      courses
        .filter(
          (course) =>
            (!query.trim() ||
              `${course.name} ${course.country ?? ""} ${course.champion?.displayName ?? ""} ${course.champion?.recordType ?? ""}`
                .toLowerCase()
                .includes(query.trim().toLowerCase())) &&
            (proof === "all" || (proof === "verified" ? !!course.champion : !course.champion)),
        )
        .sort((a, b) =>
          sort === "boards"
            ? b.recordCount - a.recordCount || a.name.localeCompare(b.name)
            : sort === "submissions"
              ? b.attemptCount - a.attemptCount || a.name.localeCompare(b.name)
              : a.name.localeCompare(b.name),
        ),
    [courses, proof, query, sort],
  );
  const reset = () => {
    updateRecordViewQuery({ recordQuery: "", recordLeader: "", recordSort: "" });
  };
  if (!courses.length)
    return (
      <AppEmptyState
        title="No course boards available"
        description="Add or select an accessible course to review its record categories and evidence requirements."
        primaryAction={
          <Button asChild>
            <Link href="/courses">Open courses</Link>
          </Button>
        }
      />
    );
  return (
    <section
      className="grid gap-4"
      aria-label="Course record browser"
      data-workbench-scope="course-records"
    >
      <DesktopWorkbenchControls
        viewKey="course-records"
        scope="course-records"
        currentViewLabel="Course record boards"
        resultLabel={`${visible.length} filtered courses`}
        columns={boardColumns}
        exportFileName="course-records-filtered.csv"
      />
      <fieldset
        disabled={!ready}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3"
      >
        <legend className="sr-only">Filter course record boards</legend>
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">
          Search course, golfer or category
          <Input
            type="search"
            aria-label="Search course, golfer or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Leader
          <select
            aria-label="Leader"
            className="min-h-11 rounded-md border bg-background px-2"
            value={proof}
            onChange={(event) => setProof(event.target.value)}
          >
            <option value="all">All courses</option>
            <option value="verified">Verified leader</option>
            <option value="open">No verified leader</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Sort by
          <select
            aria-label="Sort by"
            className="min-h-11 rounded-md border bg-background px-2"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="course">Course name</option>
            <option value="boards">Most boards</option>
            <option value="submissions">Most submissions</option>
          </select>
        </label>
        <Button variant="outline" className="min-h-11" onClick={reset}>
          Reset filters
        </Button>
      </fieldset>
      <p role="status" className="text-sm text-muted-foreground">
        {visible.length} of {courses.length} loaded courses · public active boards · scores retain
        their own category and period.
      </p>
      {!visible.length ? (
        <AppEmptyState
          title="No boards match these filters"
          description="Clear your search or leader filter to show the loaded course boards."
          primaryAction={<Button onClick={reset}>Clear filters</Button>}
        />
      ) : (
        <>
          <div
            className={styles.desktop}
            role="region"
            aria-label="Course records table"
            tabIndex={0}
          >
            <table
              data-workbench-export-table="course-records"
              className="w-full text-left text-sm"
            >
              <caption className="sr-only">
                Courses, selected verified board leader, exact score and proof, board and tee
                counts, submissions. Different categories are not ranked together.
              </caption>
              <thead>
                <tr>
                  <th
                    data-column="course"
                    scope="col"
                    aria-sort={sort === "course" ? "ascending" : "none"}
                  >
                    Course
                  </th>
                  <th data-column="leader" scope="col">
                    Verified board leader
                  </th>
                  <th data-column="category" scope="col">
                    Category and period
                  </th>
                  <th data-column="result" scope="col">
                    Result and proof
                  </th>
                  <th
                    data-column="boards"
                    scope="col"
                    aria-sort={sort === "boards" ? "descending" : "none"}
                  >
                    Boards
                  </th>
                  <th data-column="tees" scope="col">
                    Tees
                  </th>
                  <th
                    data-column="submissions"
                    scope="col"
                    aria-sort={sort === "submissions" ? "descending" : "none"}
                  >
                    Submissions
                  </th>
                  <th data-column="actions" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((course) => (
                  <tr key={course.id}>
                    <th data-column="course" scope="row">
                      <Link
                        href={`/courses/${course.id}/records`}
                        className="font-semibold text-primary"
                      >
                        {course.name}
                      </Link>
                      <p className="font-normal text-muted-foreground">
                        {course.country ?? "Country not recorded"}
                      </p>
                    </th>
                    <td data-column="leader">
                      {course.champion?.displayName ?? "No verified leader"}
                    </td>
                    <td>
                      {course.champion ? (
                        <>
                          <p>{course.champion.categoryName ?? human(course.champion.recordType)}</p>
                          <p>{course.champion.periodLabel ?? human(course.champion.period)}</p>
                        </>
                      ) : (
                        "Open a course to inspect its categories"
                      )}
                    </td>
                    <td>
                      {course.champion ? (
                        <>
                          <p className="font-semibold">{course.champion.scoreLabel}</p>
                          <p>{course.champion.verificationLabel}</p>
                          <p>
                            Proof:{" "}
                            {course.champion.proofStatus
                              ? human(course.champion.proofStatus)
                              : "Not recorded"}
                          </p>
                        </>
                      ) : (
                        "No verified result"
                      )}
                    </td>
                    <td data-column="boards" className="tabular-nums">
                      {course.recordCount}
                    </td>
                    <td data-column="tees" className="tabular-nums">
                      {course.teeSetCount}
                    </td>
                    <td data-column="submissions" className="tabular-nums">
                      {course.attemptCount}
                    </td>
                    <td>
                      <BoardActions course={course} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobile}>
            {visible.map((course) => (
              <article key={course.id} className="rounded-xl border bg-card p-4">
                <h2 className="break-words text-lg font-semibold">{course.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {course.country ?? "Country not recorded"}{" "}
                  <span data-column="boards">· {course.recordCount} boards</span>
                </p>
                <p className="mt-3 text-sm">
                  {course.champion ? (
                    <>
                      <span data-column="leader">{course.champion.displayName} · </span>
                      {course.champion.scoreLabel}
                    </>
                  ) : (
                    "No verified board leader yet"
                  )}
                </p>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer content-center font-semibold">
                    Record details and proof
                  </summary>
                  <dl className="grid gap-2 py-2 text-sm">
                    <Fact
                      label="Category"
                      value={
                        course.champion?.categoryName ??
                        (course.champion
                          ? human(course.champion.recordType)
                          : "Open a course to inspect its categories")
                      }
                    />
                    <Fact
                      label="Period"
                      value={
                        course.champion
                          ? (course.champion.periodLabel ?? human(course.champion.period))
                          : "No selected record"
                      }
                    />
                    <Fact
                      label="Verification"
                      value={course.champion?.verificationLabel ?? "No verified result"}
                    />
                    <Fact
                      label="Proof status"
                      value={
                        course.champion
                          ? course.champion.proofStatus
                            ? human(course.champion.proofStatus)
                            : "Not recorded"
                          : "No verified proof"
                      }
                    />
                    <Fact column="boards" label="Boards" value={course.recordCount} />
                    <Fact column="tees" label="Tee sets" value={course.teeSetCount} />
                    <Fact column="submissions" label="Submissions" value={course.attemptCount} />
                  </dl>
                  <BoardActions course={course} />
                </details>
                <Button asChild className="mt-3 min-h-11 w-full">
                  <Link href={`/courses/${course.id}/records`}>Open course boards</Link>
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function Fact({
  label,
  value,
  column,
}: {
  label: string;
  value: string | number;
  column?: string;
}) {
  return (
    <div data-column={column}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}
function BoardActions({ course }: { course: CourseRecordBoardRow }) {
  return (
    <div className="grid gap-2">
      {course.champion ? (
        <Link
          className="min-h-11 content-center font-semibold text-primary"
          href={`/course-records/${course.champion.recordId}`}
        >
          Inspect this record
        </Link>
      ) : null}
      <Link
        className="min-h-11 content-center font-medium text-primary"
        href={`/courses/${course.id}/records`}
      >
        All course boards
      </Link>
    </div>
  );
}
