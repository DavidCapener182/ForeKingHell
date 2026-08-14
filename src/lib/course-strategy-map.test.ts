import { describe, expect, it } from "vitest";

import aintreeManifest from "@/generated/course-twins/aintree-v1.json";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import { courseStrategyMapFromManifest } from "@/lib/course-strategy-map";

describe("course strategy map", () => {
  it("preserves Aintree's distinct mapped holes and aerial reference", () => {
    const map = courseStrategyMapFromManifest(aintreeManifest as unknown as CourseTwinManifest);

    expect(map?.imageUrl).toBe("/course-twins/aintree-v1/imagery.jpg");
    expect(map?.holes).toHaveLength(9);
    expect(new Set(map?.holes.map((hole) => JSON.stringify(hole.centerline))).size).toBe(9);
    expect(map?.features.some((feature) => feature.type === "fairway")).toBe(true);
    expect(map?.features.some((feature) => feature.type === "bunker")).toBe(true);
  });

  it("returns no map when a Course Twin manifest is unavailable", () => {
    expect(courseStrategyMapFromManifest(null)).toBeNull();
  });
});
