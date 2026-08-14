"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Grid2X2, List, Search } from "lucide-react";

import { DataToolbar } from "@/components/app/data-toolbar";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { ResponsiveFilterPanel } from "@/components/app/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type CourseDirectoryOption = {
  value: string;
  label: string;
  description?: string;
};

export function CourseDirectoryControls({
  surface,
  query: initialQuery,
  activeTab,
  view = "table",
  resultLabel,
  courses = [],
}: {
  surface: "companion" | "workbench";
  query: string;
  activeTab: string;
  view?: "grid" | "table";
  resultLabel: string;
  courses?: CourseDirectoryOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const initialRender = useRef(true);
  const activeCount = query.trim() ? 1 : 0;

  useEffect(() => {
    if (surface !== "workbench") return;

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
  }, [activeTab, query, router, surface, view]);

  function navigate(nextQuery: string, nextView: "grid" | "table" = view) {
    startTransition(() => {
      router.replace(courseDirectoryHref(activeTab, nextView, nextQuery), { scroll: false });
    });
  }

  if (surface === "companion") {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3" data-course-companion-filter>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {pending ? "Updating…" : resultLabel}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {initialQuery ? `Filtered by “${initialQuery}”` : "Search the current course view"}
          </p>
        </div>
        <ResponsiveFilterPanel
          open={open}
          onOpenChange={setOpen}
          activeCount={activeCount}
          onClear={() => {
            setQuery("");
            navigate("");
          }}
          title="Course filters"
          description="Find a course by name, country or provider."
          applyAction={
            <Button
              type="button"
              onClick={() => {
                navigate(query);
                setOpen(false);
              }}
              disabled={pending}
            >
              Apply filter
            </Button>
          }
        >
          <Field>
            <FieldLabel htmlFor="companion-course-search">Course search</FieldLabel>
            <InputGroup className="h-11 bg-background">
              <InputGroupAddon>
                <Search className="size-4" aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="companion-course-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    navigate(query);
                    setOpen(false);
                  }
                }}
                placeholder="Course, country or provider"
                aria-label="Search course, country, or provider"
              />
            </InputGroup>
          </Field>
        </ResponsiveFilterPanel>
      </div>
    );
  }

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
            navigate(query, nextView);
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
