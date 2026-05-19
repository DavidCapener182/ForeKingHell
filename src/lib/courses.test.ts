import { describe, expect, it } from "vitest";

import { canonicalKnownCourseNameForSession } from "@/lib/courses";

describe("course name canonicalisation", () => {
  it("stores Sawgrass Stadium imports under the canonical course name", () => {
    expect(canonicalKnownCourseNameForSession("TPC Sawgrass (Stadium) - White")).toBe(
      "TPC Sawgrass - THE PLAYERS Stadium Course",
    );
  });

  it("leaves unknown course labels alone", () => {
    expect(canonicalKnownCourseNameForSession("Aintree Golf Centre")).toBeNull();
  });

  it("does not treat every stadium course as Sawgrass", () => {
    expect(canonicalKnownCourseNameForSession("TPC Scottsdale - Stadium")).toBeNull();
  });
});
