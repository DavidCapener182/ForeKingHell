"use client";

import { useState } from "react";
import { AlertCircle, Info, Loader2, MapPinned, Search, TriangleAlert } from "lucide-react";

import { createOsmCourseAction } from "@/app/courses/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { OsmCourseResult, OsmHoleGeometry } from "@/lib/osm-course-search";

type SearchState =
  | { status: "idle"; message?: string }
  | { status: "loading"; message?: string }
  | { status: "success"; results: OsmCourseResult[] }
  | { status: "error"; message: string };

type HoleState =
  | { status: "idle"; holes: OsmHoleGeometry[] }
  | { status: "loading"; holes: OsmHoleGeometry[] }
  | { status: "success"; holes: OsmHoleGeometry[] }
  | { status: "error"; holes: OsmHoleGeometry[]; message: string };

export function OsmCourseImporter() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OsmCourseResult | null>(null);
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [holeState, setHoleState] = useState<HoleState>({ status: "idle", holes: [] });

  async function searchCourses() {
    if (!query.trim()) {
      setSearchState({ status: "idle", message: "Enter a course name or area." });
      return;
    }

    setSearchState({ status: "loading" });
    setSelected(null);
    setHoleState({ status: "idle", holes: [] });

    try {
      const response = await fetch(
        `/api/courses/osm/search?query=${encodeURIComponent(query.trim())}`,
      );
      const payload = (await response.json()) as { results?: OsmCourseResult[]; message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "OpenStreetMap search failed.");
      }

      setSearchState({ status: "success", results: payload.results ?? [] });
    } catch (error) {
      setSearchState({
        status: "error",
        message: error instanceof Error ? error.message : "OpenStreetMap search failed.",
      });
    }
  }

  async function selectCourse(course: OsmCourseResult) {
    setSelected(course);
    setHoleState({ status: "loading", holes: [] });

    try {
      const params = new URLSearchParams({
        lat: String(course.lat),
        lon: String(course.lon),
      });
      const response = await fetch(`/api/courses/osm/holes?${params.toString()}`);
      const payload = (await response.json()) as { holes?: OsmHoleGeometry[]; message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "OpenStreetMap hole lookup failed.");
      }

      setHoleState({ status: "success", holes: payload.holes ?? [] });
    } catch (error) {
      setHoleState({
        status: "error",
        holes: [],
        message: error instanceof Error ? error.message : "OpenStreetMap hole lookup failed.",
      });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm font-medium">
          <span>Search OpenStreetMap</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchCourses();
              }
            }}
            placeholder="Bootle Golf Course"
            className="h-11 bg-background"
          />
        </label>
        <Button
          type="button"
          className="h-11 self-end"
          disabled={searchState.status === "loading"}
          onClick={() => void searchCourses()}
        >
          {searchState.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </div>

      {searchState.status === "error" ? (
        <Alert variant="destructive" data-osm-search-feedback>
          <AlertCircle className="size-4" />
          <AlertTitle>OpenStreetMap search failed</AlertTitle>
          <AlertDescription>{searchState.message}</AlertDescription>
        </Alert>
      ) : null}
      {searchState.status === "idle" && searchState.message ? (
        <Alert data-osm-search-feedback>
          <Info className="size-4" />
          <AlertTitle>Search needed</AlertTitle>
          <AlertDescription>{searchState.message}</AlertDescription>
        </Alert>
      ) : null}

      {searchState.status === "success" ? (
        <div className="grid gap-2">
          {searchState.results.length > 0 ? (
            searchState.results.map((course) => (
              <Item
                key={`${course.osmType}-${course.osmId}`}
                variant={selected?.osmId === course.osmId ? "muted" : "outline"}
                className="items-start"
                data-osm-course-result
              >
                <ItemContent>
                  <ItemTitle>{course.name}</ItemTitle>
                  <ItemDescription className="whitespace-normal [overflow-wrap:anywhere]">
                    {course.displayName}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="flex-col items-end sm:flex-row sm:items-center">
                  <Badge variant={selected?.osmId === course.osmId ? "default" : "outline"}>
                    {course.osmType}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected?.osmId === course.osmId ? "secondary" : "outline"}
                    onClick={() => void selectCourse(course)}
                  >
                    {selected?.osmId === course.osmId ? "Selected" : "Review"}
                  </Button>
                </ItemActions>
              </Item>
            ))
          ) : (
            <Alert data-osm-search-feedback>
              <Info className="size-4" />
              <AlertTitle>No courses found</AlertTitle>
              <AlertDescription>No OpenStreetMap courses matched that search.</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      {selected ? <OsmCourseSelection course={selected} holeState={holeState} /> : null}
    </div>
  );
}

export function OsmCourseSelection({
  course,
  holeState,
}: {
  course: OsmCourseResult;
  holeState: HoleState;
}) {
  const holes = holeState.holes;
  const totalYards = holes.reduce((total, hole) => total + hole.yards, 0);

  return (
    <section className="grid gap-4 border-t border-border pt-4" data-osm-course-selection>
      <Item variant="muted" className="items-start">
        <ItemContent>
          <ItemTitle>{course.name}</ItemTitle>
          <ItemDescription className="whitespace-normal leading-6">
            {course.displayName}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <MapPinned className="size-5 text-primary" aria-hidden />
        </ItemActions>
      </Item>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <SmallMetric
          label="Holes found"
          value={holeState.status === "loading" ? "Loading" : String(holes.length)}
        />
        <SmallMetric
          label="Yardage"
          value={totalYards > 0 ? `${totalYards.toLocaleString("en-GB")} yd` : "--"}
        />
        <SmallMetric label="Source" value="OSM + Overpass" />
      </div>
      {holeState.status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Hole lookup failed</AlertTitle>
          <AlertDescription>{holeState.message}</AlertDescription>
        </Alert>
      ) : null}
      {holeState.status === "success" && holes.length === 0 ? (
        <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]">
          <TriangleAlert className="size-4" />
          <AlertTitle>No tagged holes found</AlertTitle>
          <AlertDescription className="text-current/80">
            No tagged golf holes were found nearby. You can still import the course shell and add
            holes manually.
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        action={createOsmCourseAction}
        className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <input type="hidden" name="name" value={course.name} />
        <input type="hidden" name="country" value={course.country ?? ""} />
        <input type="hidden" name="osmType" value={course.osmType} />
        <input type="hidden" name="osmId" value={course.osmId} />
        <input type="hidden" name="lat" value={course.lat} />
        <input type="hidden" name="lon" value={course.lon} />
        <input type="hidden" name="holesJson" value={JSON.stringify(holes)} />
        <label className="grid gap-2 text-sm font-medium">
          <span>Tee set name</span>
          <Input name="teeName" defaultValue="OpenStreetMap" className="min-h-11 bg-background" />
        </label>
        <Button type="submit" disabled={holeState.status === "loading"} className="min-h-11">
          <MapPinned className="size-4" />
          Import course
        </Button>
      </form>
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <Item variant="muted" size="sm" className="items-start">
      <ItemContent>
        <ItemDescription>{label}</ItemDescription>
        <ItemTitle>{value}</ItemTitle>
      </ItemContent>
    </Item>
  );
}
