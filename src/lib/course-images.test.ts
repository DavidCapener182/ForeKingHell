import { describe, expect, it } from "vitest";

import {
  buildCourseLogoSearchQueries,
  courseLogoRoutePath,
  rankCourseLogoSearchCandidates,
  scoreCourseLogoSearchCandidate,
} from "@/lib/course-images";

describe("course image helpers", () => {
  it("routes named courses through the course logo resolver", () => {
    expect(courseLogoRoutePath({ name: "Aintree Golf Centre", country: "England" })).toBe(
      "/api/course-logos?name=Aintree+Golf+Centre&country=England&v=3",
    );
  });

  it("builds exact Google image queries for course logos", () => {
    expect(
      buildCourseLogoSearchQueries({ name: "Aintree Golf Centre", country: "England" }),
    ).toEqual([
      '"Aintree Golf Centre" England golf course logo',
      '"Aintree Golf Centre" England logo',
      '"Aintree Golf Centre" golf club crest',
    ]);
  });

  it("prefers official logo-like results over generic course imagery", () => {
    const ranked = rankCourseLogoSearchCandidates(
      [
        {
          url: "https://example.com/images/aintree-scorecard.jpg",
          title: "Aintree Golf Centre scorecard",
          displayLink: "example.com",
          contextLink: "https://example.com/scorecards/aintree",
          mime: "image/jpeg",
          source: "image",
        },
        {
          url: "https://aintreegolfcentre.co.uk/assets/logo.png",
          title: "Aintree Golf Centre logo",
          displayLink: "aintreegolfcentre.co.uk",
          contextLink: "https://aintreegolfcentre.co.uk/",
          mime: "image/png",
          source: "image",
        },
      ],
      { name: "Aintree Golf Centre", country: "England" },
    );

    expect(ranked[0]?.url).toBe("https://aintreegolfcentre.co.uk/assets/logo.png");
  });

  it("rejects unrelated image candidates", () => {
    expect(
      scoreCourseLogoSearchCandidate(
        {
          url: "https://example.com/photo.jpg",
          title: "Best golf holidays",
          displayLink: "example.com",
          contextLink: "https://example.com/",
          mime: "image/jpeg",
          source: "image",
        },
        { name: "Aintree Golf Centre", country: "England" },
      ),
    ).toBeLessThan(6);
  });
});
