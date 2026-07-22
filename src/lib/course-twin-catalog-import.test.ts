import { describe, expect, it } from "vitest";

import {
  type CourseTwinCatalogCandidate,
  validateCandidate,
} from "@/lib/course-twin-catalog-import";

const candidate: CourseTwinCatalogCandidate = {
  externalId: "osm-way-8036925",
  osmType: "way",
  osmId: "8036925",
  name: "Aldenham Golf Club",
  country: "England",
  latitude: 51.69,
  longitude: -0.36,
  website: "https://example.com/",
  mappedHoles: 18,
  mappedGreens: 18,
  mappedFairways: 18,
  mappedBunkers: 12,
  mappedTees: 18,
  mappedWater: 2,
  readinessScore: 100,
  sourceRegion: "south-east",
};

describe("Course Twin catalogue import validation", () => {
  it("accepts a bounded OSM candidate and normalises the display name", () => {
    expect(validateCandidate({ ...candidate, name: "  Aldenham Golf Club  " }).name).toBe(
      "Aldenham Golf Club",
    );
  });

  it("rejects mismatched identities, weak geometry and non-HTTP websites", () => {
    expect(() => validateCandidate({ ...candidate, osmId: "999" })).toThrow(/invalid/i);
    expect(() => validateCandidate({ ...candidate, mappedHoles: 4 })).toThrow(/invalid/i);
    expect(() => validateCandidate({ ...candidate, website: "file:///tmp/course" })).toThrow(
      /website/i,
    );
  });
});
