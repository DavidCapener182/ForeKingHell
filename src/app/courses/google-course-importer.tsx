"use client";

import { Loader2, MapPin, Search, Star } from "lucide-react";
import { useState } from "react";

import { createGoogleCourseAction } from "@/app/courses/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type GoogleCourseSearchResult = {
  placeId: string;
  name: string;
  address: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingsTotal: number | null;
  types: string[];
};

type SearchState =
  | { status: "idle"; message: string; results: GoogleCourseSearchResult[] }
  | { status: "loading"; message: string; results: GoogleCourseSearchResult[] }
  | { status: "success"; message: string; results: GoogleCourseSearchResult[] }
  | { status: "error"; message: string; results: GoogleCourseSearchResult[] };

export function GoogleCourseImporter() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GoogleCourseSearchResult | null>(null);
  const [searchState, setSearchState] = useState<SearchState>({
    message: "Search Google Places for the official course.",
    results: [],
    status: "idle",
  });

  async function searchCourses() {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setSearchState({ message: "Enter at least two characters.", results: [], status: "idle" });
      return;
    }

    setSearchState({ message: "Searching Google Places...", results: searchState.results, status: "loading" });

    try {
      const response = await fetch(`/api/courses/google/search?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json()) as { results?: GoogleCourseSearchResult[] };
      const results = payload.results ?? [];

      setSearchState({
        message: results.length ? `${results.length} Google matches found.` : "No Google course matches found.",
        results,
        status: "success",
      });
    } catch {
      setSearchState({
        message: "Google course search failed.",
        results: [],
        status: "error",
      });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchCourses();
            }
          }}
          placeholder="Quail Hollow Club"
          className="h-11 rounded-xl bg-white"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-11 rounded-xl"
          disabled={searchState.status === "loading"}
          onClick={() => void searchCourses()}
        >
          {searchState.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Search
        </Button>
      </div>

      <p className={cn("text-sm", searchState.status === "error" ? "text-destructive" : "text-muted-foreground")}>
        {searchState.message}
      </p>

      {searchState.results.length > 0 ? (
        <div className="grid gap-2">
          {searchState.results.map((course) => (
            <button
              key={course.placeId}
              type="button"
              onClick={() => setSelected(course)}
              className={cn(
                "grid gap-2 rounded-xl border bg-white p-3 text-left transition hover:border-emerald-400",
                selected?.placeId === course.placeId && "border-emerald-500 bg-emerald-50/60",
              )}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{course.name}</span>
                {course.rating ? (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="size-3" />
                    {course.rating.toFixed(1)}
                  </Badge>
                ) : null}
              </span>
              <span className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {course.address ?? course.country ?? "Google Places course"}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <form action={createGoogleCourseAction} className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <input type="hidden" name="placeId" value={selected.placeId} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selected.address ?? "Google Places match selected"}</p>
            </div>
            <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              Import Google course
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
