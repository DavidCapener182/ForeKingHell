"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  previewImageUrl?: string | null;
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

  if (!twins.length)
    return (
      <AppEmptyState
        title="No Course Twin available"
        description="No generated course package is available for this account yet. Your course records and mapped holes remain available."
        primaryAction={
          <Button asChild variant="outline">
            <Link href="/courses">Review mapped courses</Link>
          </Button>
        }
      />
    );

  return (
    <div
      className="grid gap-3 [&_[data-data-toolbar]_button]:min-h-11 [&_[data-data-toolbar]_button]:min-w-11 [&_[data-data-toolbar]_input]:min-h-11"
      data-course-twin-filtered-catalogue
    >
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
              className="flex-wrap"
            >
              <ToggleGroupItem value="all" className="min-h-11">
                All grades
              </ToggleGroupItem>
              {Array.from(new Set(twins.map((twin) => twin.grade)))
                .sort()
                .map((value) => (
                  <ToggleGroupItem key={value} value={value} className="min-h-11">
                    Grade {value}
                  </ToggleGroupItem>
                ))}
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
            <Card
              key={twin.courseId}
              data-course-twin={twin.courseId}
              className="min-w-0 overflow-hidden"
            >
              <TwinPreview key={twin.previewImageUrl} twin={twin} />
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      {twin.country ?? "Mapped course"}
                    </p>
                    <CardTitle className="mt-1 break-words text-xl">{twin.name}</CardTitle>
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
                    <p className="mt-1 font-semibold">{twin.mappedHoles ?? "Not recorded"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mountain className="size-4" aria-hidden /> Terrain
                    </div>
                    <p className="mt-1 font-semibold">
                      {twin.terrainResolutionM === null
                        ? "Not recorded"
                        : `${decimalFormatter.format(twin.terrainResolutionM)} m`}
                    </p>
                  </div>
                </div>
                {twin.warning ? (
                  <p className="break-words text-sm leading-5 text-muted-foreground">
                    {twin.warning}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No additional accuracy warning is attached to this package.
                  </p>
                )}
              </CardContent>
              <CardFooter className="mt-auto flex-wrap gap-2">
                <Button asChild className="min-h-11">
                  <Link href={`/play/${twin.courseId}`} prefetch={false}>
                    <Cuboid className="size-4" aria-hidden /> Open Course Twin
                  </Link>
                </Button>
                <details className="w-full text-sm">
                  <summary className="min-h-11 cursor-pointer content-center font-medium">
                    Course details and 2D fallback
                  </summary>
                  <p className="mb-2 text-muted-foreground">
                    If 3D cannot run on this device, inspect the same course’s mapped holes and
                    coordinates.
                  </p>
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={`/courses/${twin.courseId}/holes`} prefetch={false}>
                      View mapped holes
                    </Link>
                  </Button>
                </details>
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

function TwinPreview({ twin }: { twin: CourseTwinCatalogueItem }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="relative aspect-[16/7] overflow-hidden bg-muted"
      aria-label={`${twin.name} preview`}
    >
      {twin.previewImageUrl && !failed ? (
        <>
          {!loaded && (
            <p
              role="status"
              className="absolute inset-0 grid place-items-center text-sm text-muted-foreground"
            >
              Loading course preview…
            </p>
          )}
          <Image
            src={twin.previewImageUrl}
            alt={`${twin.name} mapped terrain preview`}
            fill
            unoptimized
            sizes="(max-width: 767px) 100vw, 50vw"
            className="object-cover"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        <div className="grid h-full place-content-center gap-1 p-4 text-center text-sm text-muted-foreground">
          <MapPreviewIcon />
          <p>{failed ? "Preview could not load" : "No preview image available"}</p>
          <p>Course facts and mapped holes are available below.</p>
        </div>
      )}
    </div>
  );
}

function MapPreviewIcon() {
  return <Mountain className="mx-auto size-6" aria-hidden />;
}
