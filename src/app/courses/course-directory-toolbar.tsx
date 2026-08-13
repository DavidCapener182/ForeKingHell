"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Grid2X2, List } from "lucide-react";

import { DataToolbar } from "@/components/app/data-toolbar";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type CourseDirectoryOption = {
  value: string;
  label: string;
  description?: string;
};

export function CourseDirectoryToolbar({
  query: initialQuery,
  activeTab,
  view,
  resultLabel,
  courses,
}: {
  query: string;
  activeTab: string;
  view: "grid" | "table";
  resultLabel: string;
  courses: CourseDirectoryOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [pending, startTransition] = useTransition();
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(() =>
        router.replace(courseDirectoryHref(activeTab, view, query), { scroll: false }),
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [activeTab, query, router, view]);

  return (
    <DataToolbar
      query={query}
      onQueryChange={setQuery}
      searchLabel="Search course, country, or provider"
      resultLabel={pending ? "Updating…" : resultLabel}
      activeFilters={
        query
          ? [
              {
                id: "course-query",
                label: query,
                onRemove: () => setQuery(""),
              },
            ]
          : []
      }
      onClearFilters={query ? () => setQuery("") : undefined}
      filters={
        <EntityCombobox
          value={selectedCourse}
          onValueChange={(courseId) => {
            setSelectedCourse(courseId);
            router.push(`/courses/${courseId}/holes`);
          }}
          options={courses}
          label="Jump to course"
          placeholder="Jump to course"
          searchPlaceholder="Find a course…"
          emptyLabel="No matching course."
          className="w-56"
        />
      }
      actions={
        <ToggleGroup
          type="single"
          value={view}
          variant="outline"
          spacing={0}
          aria-label="Course directory view"
          onValueChange={(nextView) => {
            if (nextView !== "grid" && nextView !== "table") return;
            router.replace(courseDirectoryHref(activeTab, nextView, query), { scroll: false });
          }}
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <Grid2X2 className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      }
    />
  );
}

function courseDirectoryHref(activeTab: string, view: "grid" | "table", query: string) {
  const params = new URLSearchParams();
  if (activeTab !== "records") params.set("tab", activeTab);
  if (view !== "table") params.set("view", view);
  if (query.trim()) params.set("q", query.trim());
  const suffix = params.toString();
  return suffix ? `/courses?${suffix}` : "/courses";
}
