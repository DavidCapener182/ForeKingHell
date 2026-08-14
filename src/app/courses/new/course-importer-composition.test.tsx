import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GoogleCourseSelection,
  type GoogleCourseSearchResult,
} from "@/app/courses/google-course-importer";
import { OsmCourseSelection } from "@/app/courses/osm-course-importer";
import { Card, CardContent } from "@/components/ui/card";
import type { OsmCourseResult } from "@/lib/osm-course-search";

describe("course importer Card composition", () => {
  it("renders a Google selection without another Card inside the route panel", () => {
    const course: GoogleCourseSearchResult = {
      placeId: "google-course",
      name: "Royal Test Golf Club",
      address: "1 Fairway Road",
      country: "United Kingdom",
      latitude: 53.1,
      longitude: -3.1,
      rating: 4.8,
      userRatingsTotal: 80,
      types: ["golf_course"],
    };
    const markup = renderToStaticMarkup(
      <Card>
        <CardContent>
          <GoogleCourseSelection course={course} />
        </CardContent>
      </Card>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain("data-google-course-selection");
    expect(markup).toContain('name="placeId"');
  });

  it("renders an OSM selection without another Card inside the route panel", () => {
    const course = {
      osmType: "way",
      osmId: 123,
      name: "Mapped Golf Club",
      displayName: "Mapped Golf Club, Testshire",
      country: "United Kingdom",
      lat: 53.2,
      lon: -3.2,
    } as OsmCourseResult;
    const markup = renderToStaticMarkup(
      <Card>
        <CardContent>
          <OsmCourseSelection course={course} holeState={{ status: "success", holes: [] }} />
        </CardContent>
      </Card>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain("data-osm-course-selection");
    expect(markup).toContain('name="osmId"');
  });
});
