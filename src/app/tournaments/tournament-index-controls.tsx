"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
export function TournamentIndexControls({
  active,
  courseId,
  q,
  sort,
  courses,
  counts,
  children,
}: {
  active: string;
  courseId: string;
  q: string;
  sort: string;
  courses: Array<{ courseId: string; courseName: string }>;
  counts: Record<"upcoming" | "active" | "completed", number>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const ready = useClientReady();
  return (
    <section className="grid min-w-0 gap-4" data-tournament-directory>
      <form
        className="min-w-0"
        key={`${courseId}:${q}:${sort}`}
        onSubmit={(event) => {
          event.preventDefault();
          const params = new URLSearchParams();
          new FormData(event.currentTarget).forEach((v, k) => {
            if (typeof v === "string" && v) params.set(k, v);
          });
          start(() => router.push("/tournaments?" + params, { scroll: false }));
        }}
      >
        <fieldset disabled={!ready || pending} className="flex min-w-0 flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value={active} />
          <label className="grid w-full min-w-0 gap-1 text-sm font-medium sm:w-auto sm:max-w-full">
            Course
            <select
              aria-label="Course filter"
              name="courseId"
              defaultValue={courseId}
              className="min-h-11 w-full min-w-0 max-w-full rounded-md border bg-background px-2"
            >
              <option value="">All available courses</option>
              {courseId && !courses.some((c) => c.courseId === courseId) ? (
                <option value={courseId}>Selected course unavailable</option>
              ) : null}
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Search events
            <Input type="search" name="q" defaultValue={q} className="min-h-11" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Order
            <select
              aria-label="Event order"
              name="sort"
              defaultValue={sort}
              className="min-h-11 rounded-md border bg-background px-2"
            >
              <option value="date">Start date</option>
              <option value="name">Event name</option>
            </select>
          </label>
          <Button className="min-h-11">Apply filters</Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() =>
              start(() => router.push(`/tournaments?tab=${active}`, { scroll: false }))
            }
          >
            Clear filters
          </Button>
        </fieldset>
      </form>
      <p className="text-sm text-muted-foreground">
        Current course:{" "}
        {courseId
          ? (courses.find((c) => c.courseId === courseId)?.courseName ??
            "Selected course unavailable")
          : "All available courses"}
        . Swipe the status strip for all event views.
      </p>
      <UntitledTabs
        label="Tournament status"
        selectedKey={active}
        disabled={!ready || pending}
        onSelectionChange={(key) =>
          start(() => {
            const url = new URL(window.location.href);
            url.searchParams.set("tab", key);
            router.push(url.pathname + url.search, { scroll: false });
          })
        }
        items={Object.entries(counts).map(([key, count]) => ({
          id: key,
          label: `${key[0].toUpperCase() + key.slice(1)} (${count})`,
          content: key === active ? children : null,
        }))}
      />
      {pending ? <p role="status">Loading event view…</p> : null}
    </section>
  );
}
