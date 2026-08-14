"use client";

import { AlertCircle, Info, Loader2, MapPin, Search, Star } from "lucide-react";
import { useState } from "react";

import { createGoogleCourseAction } from "@/app/courses/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

export type GoogleCourseSearchResult = {
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

    setSearchState({
      message: "Searching Google Places…",
      results: searchState.results,
      status: "loading",
    });

    try {
      const response = await fetch(
        `/api/courses/google/search?query=${encodeURIComponent(trimmedQuery)}`,
      );
      const payload = (await response.json()) as { results?: GoogleCourseSearchResult[] };
      const results = payload.results ?? [];

      setSearchState({
        message: results.length
          ? `${results.length} Google matches found.`
          : "No Google course matches found.",
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
          className="h-11 bg-background"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-11 rounded-xl"
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

      <Alert
        variant={searchState.status === "error" ? "destructive" : "default"}
        data-google-course-search-feedback
      >
        {searchState.status === "error" ? (
          <AlertCircle className="size-4" />
        ) : (
          <Info className="size-4" />
        )}
        <AlertTitle>
          {searchState.status === "loading"
            ? "Searching Google Places"
            : searchState.status === "error"
              ? "Google Places search failed"
              : "Google Places search"}
        </AlertTitle>
        <AlertDescription>{searchState.message}</AlertDescription>
      </Alert>

      {searchState.results.length > 0 ? (
        <div className="grid gap-2">
          {searchState.results.map((course) => (
            <Item
              key={course.placeId}
              variant={selected?.placeId === course.placeId ? "muted" : "outline"}
              className="items-start"
              data-google-course-result
            >
              <ItemContent>
                <ItemTitle>{course.name}</ItemTitle>
                <ItemDescription className="flex whitespace-normal [overflow-wrap:anywhere]">
                  <MapPin className="mt-0.5 mr-2 size-4 shrink-0" />
                  {course.address ?? course.country ?? "Google Places course"}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="flex-col items-end sm:flex-row sm:items-center">
                {course.rating ? (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="size-3" />
                    {course.rating.toFixed(1)}
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={selected?.placeId === course.placeId ? "secondary" : "outline"}
                  onClick={() => setSelected(course)}
                >
                  {selected?.placeId === course.placeId ? "Selected" : "Select"}
                </Button>
              </ItemActions>
            </Item>
          ))}
        </div>
      ) : null}

      {selected ? <GoogleCourseSelection course={selected} /> : null}
    </div>
  );
}

export function GoogleCourseSelection({ course }: { course: GoogleCourseSearchResult }) {
  return (
    <form action={createGoogleCourseAction} data-google-course-selection>
      <input type="hidden" name="placeId" value={course.placeId} />
      <Item variant="muted" className="items-start">
        <ItemContent>
          <ItemTitle>{course.name}</ItemTitle>
          <ItemDescription className="whitespace-normal">
            {course.address ?? "Google Places match selected"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button type="submit" className="min-h-11">
            Import Google course
          </Button>
        </ItemActions>
      </Item>
    </form>
  );
}
