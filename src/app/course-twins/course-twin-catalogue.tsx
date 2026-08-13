"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cuboid, Flag, Mountain } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { DataToolbar } from "@/components/app/data-toolbar";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type CourseTwinCatalogueItem = {
  courseId: string;
  name: string;
  country: string | null;
  grade: string;
  mappedHoles: number | null;
  terrainResolutionM: number | null;
  warning: string | null;
};

const decimalFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function CourseTwinCatalogue({ twins }: { twins: CourseTwinCatalogueItem[] }) {
  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState("all");
  const [grade, setGrade] = useState("all");
  const visibleTwins = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return twins.filter((twin) => {
      const matchesQuery =
        !cleanQuery ||
        `${twin.name} ${twin.country ?? ""} ${twin.grade}`.toLowerCase().includes(cleanQuery);
      const matchesCourse = courseId === "all" || twin.courseId === courseId;
      const matchesGrade = grade === "all" || twin.grade === grade;
      return matchesQuery && matchesCourse && matchesGrade;
    });
  }, [courseId, grade, query, twins]);

  return (
    <div className="grid gap-3" data-course-twin-filtered-catalogue>
      <DataToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Search Course Twins"
        resultLabel={`${visibleTwins.length} of ${twins.length} courses`}
        filters={
          <>
            <EntityCombobox
              value={courseId}
              onValueChange={setCourseId}
              label="Course"
              placeholder="All courses"
              searchPlaceholder="Find a course…"
              className="min-w-44"
              options={[
                { value: "all", label: "All courses" },
                ...twins.map((twin) => ({
                  value: twin.courseId,
                  label: twin.name,
                  description: twin.country ?? `Grade ${twin.grade}`,
                })),
              ]}
            />
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={grade}
              onValueChange={(value) => value && setGrade(value)}
              aria-label="Course Twin grade"
            >
              <ToggleGroupItem value="all">All grades</ToggleGroupItem>
              <ToggleGroupItem value="A">Grade A</ToggleGroupItem>
              <ToggleGroupItem value="B">Grade B</ToggleGroupItem>
            </ToggleGroup>
          </>
        }
        activeFilters={[
          ...(courseId !== "all"
            ? [
                {
                  id: "course",
                  label: twins.find((twin) => twin.courseId === courseId)?.name ?? "Course",
                  onRemove: () => setCourseId("all"),
                },
              ]
            : []),
          ...(grade !== "all"
            ? [{ id: "grade", label: `Grade ${grade}`, onRemove: () => setGrade("all") }]
            : []),
        ]}
        onClearFilters={() => {
          setQuery("");
          setCourseId("all");
          setGrade("all");
        }}
      />

      {visibleTwins.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleTwins.map((twin) => (
            <Card key={twin.courseId} data-course-twin={twin.courseId}>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      {twin.country ?? "Mapped course"}
                    </p>
                    <CardTitle className="mt-1 text-xl">{twin.name}</CardTitle>
                  </div>
                  <Badge variant={twin.grade === "A" ? "default" : "secondary"}>
                    Grade {twin.grade}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Flag className="size-4" aria-hidden /> Holes
                    </div>
                    <p className="mt-1 font-semibold">{twin.mappedHoles ?? "Mapped"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mountain className="size-4" aria-hidden /> Terrain
                    </div>
                    <p className="mt-1 font-semibold">
                      {twin.terrainResolutionM === null
                        ? "Generated"
                        : `${decimalFormatter.format(twin.terrainResolutionM)} m`}
                    </p>
                  </div>
                </div>
                {twin.warning ? (
                  <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {twin.warning}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Package ready with no accuracy note.
                  </p>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                <Button asChild>
                  <Link href={`/play/${twin.courseId}`} prefetch={false}>
                    <Cuboid className="size-4" aria-hidden /> Open Course Twin
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/courses/${twin.courseId}/holes`} prefetch={false}>
                    Course details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <AppEmptyState
          title="No Course Twins match"
          description="Clear the filters to return to every available generated course package."
          primaryAction={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setCourseId("all");
                setGrade("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  );
}
