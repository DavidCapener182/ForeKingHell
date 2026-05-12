import { describe, expect, it } from "vitest";

import {
  buildNominatimCourseSearchUrl,
  parseNominatimCourseResults,
  parseOverpassGolfHoles,
} from "@/lib/osm-course-search";

describe("OSM course search helpers", () => {
  it("builds course-biased Nominatim search URLs", () => {
    const url = buildNominatimCourseSearchUrl("Bootle");

    expect(url.hostname).toBe("nominatim.openstreetmap.org");
    expect(url.searchParams.get("q")).toBe("Bootle golf course");
    expect(url.searchParams.get("addressdetails")).toBe("1");
  });

  it("normalizes Nominatim golf course results", () => {
    const results = parseNominatimCourseResults([
      {
        osm_type: "way",
        osm_id: 123,
        name: "Bootle Golf Course",
        display_name: "Bootle Golf Course, Merseyside, England",
        lat: "53.485",
        lon: "-2.992",
        address: { country: "United Kingdom" },
      },
    ]);

    expect(results).toEqual([
      {
        osmType: "way",
        osmId: 123,
        name: "Bootle Golf Course",
        displayName: "Bootle Golf Course, Merseyside, England",
        country: "United Kingdom",
        lat: 53.485,
        lon: -2.992,
      },
    ]);
  });

  it("extracts hole geometry from Overpass golf hole ways", () => {
    const holes = parseOverpassGolfHoles({
      elements: [
        {
          type: "way",
          id: 1,
          tags: { golf: "hole", ref: "1", par: "4", length: "360 yd" },
          geometry: [
            { lat: 53.1, lon: -2.1 },
            { lat: 53.101, lon: -2.102 },
          ],
        },
      ],
    });

    expect(holes[0]).toMatchObject({
      holeNumber: 1,
      par: 4,
      yards: 360,
      teeLat: 53.1,
      greenLng: -2.102,
    });
  });
});
