"use client";

import { useState } from "react";
import { Loader2, MapPinned, Search } from "lucide-react";

import { createOsmCourseAction } from "@/app/courses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      const response = await fetch(`/api/courses/osm/search?query=${encodeURIComponent(query.trim())}`);
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

  const holes = holeState.holes;
  const totalYards = holes.reduce((total, hole) => total + hole.yards, 0);

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
            className="h-11 rounded-xl bg-white"
          />
        </label>
        <Button
          type="button"
          className="h-11 self-end rounded-xl bg-[#111827] text-white"
          disabled={searchState.status === "loading"}
          onClick={() => void searchCourses()}
        >
          {searchState.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Search
        </Button>
      </div>

      {searchState.status === "error" ? <p className="text-sm text-destructive">{searchState.message}</p> : null}
      {searchState.status === "idle" && searchState.message ? <p className="text-sm text-muted-foreground">{searchState.message}</p> : null}

      {searchState.status === "success" ? (
        <div className="grid gap-2">
          {searchState.results.length > 0 ? (
            searchState.results.map((course) => (
              <button
                key={`${course.osmType}-${course.osmId}`}
                type="button"
                onClick={() => void selectCourse(course)}
                className="rounded-xl border bg-white px-3 py-2 text-left text-sm transition hover:bg-muted"
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-medium">{course.name}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{course.displayName}</span>
                  </span>
                  <Badge variant={selected?.osmId === course.osmId ? "default" : "outline"}>
                    {course.osmType}
                  </Badge>
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No OpenStreetMap courses matched that search.
            </div>
          )}
        </div>
      ) : null}

      {selected ? (
        <div className="rounded-2xl border bg-white/90 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{selected.displayName}</p>
            </div>
            <MapPinned className="size-5 text-emerald-600" />
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <SmallMetric label="Holes found" value={holeState.status === "loading" ? "Loading" : String(holes.length)} />
            <SmallMetric label="Yardage" value={totalYards > 0 ? `${totalYards.toLocaleString("en-GB")} yd` : "--"} />
            <SmallMetric label="Source" value="OSM + Overpass" />
          </div>
          {holeState.status === "error" ? (
            <p className="mt-3 text-sm text-destructive">{holeState.message}</p>
          ) : null}
          {holeState.status === "success" && holes.length === 0 ? (
            <p className="mt-3 text-sm text-amber-700">
              No tagged golf holes were found nearby. You can still import the course shell and add holes manually.
            </p>
          ) : null}
          <form action={createOsmCourseAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="name" value={selected.name} />
            <input type="hidden" name="country" value={selected.country ?? ""} />
            <input type="hidden" name="osmType" value={selected.osmType} />
            <input type="hidden" name="osmId" value={selected.osmId} />
            <input type="hidden" name="holesJson" value={JSON.stringify(holes)} />
            <label className="grid gap-2 text-sm font-medium">
              <span>Tee set name</span>
              <Input name="teeName" defaultValue="OpenStreetMap" className="h-10 rounded-xl bg-white" />
            </label>
            <Button type="submit" disabled={holeState.status === "loading"} className="rounded-xl bg-[#111827] text-white">
              <MapPinned className="size-4" />
              Import course
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
