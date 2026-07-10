import { describe, expect, it } from "vitest";

import { classifyShotPattern } from "@/lib/shot-pattern-classifier";

describe("classifyShotPattern", () => {
  it("uses measured delivery data when available", () => {
    const patterns = classifyShotPattern(
      Array.from({ length: 8 }, () => ({ launchDirectionDeg: -3, spinAxisDeg: -7, sideYd: -12 })),
      "right",
    );
    expect(patterns[0]).toMatchObject({ label: "pull-draw", source: "measured" });
  });

  it("respects left-handed curve convention", () => {
    expect(classifyShotPattern([{ spinAxisDeg: 15 }], "left")[0]?.label).toBe("hook");
  });

  it("labels a two-way miss without pretending face/path was measured", () => {
    const patterns = classifyShotPattern([-20, -15, 14, 22, -10, 11].map((sideYd) => ({ sideYd })));
    expect(patterns[0]).toMatchObject({ label: "two-way miss", source: "inferred" });
  });
});
