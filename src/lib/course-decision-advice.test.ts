import { describe, expect, it } from "vitest";

import { buildCourseDecisionAdvice, getClubDecisionLabel } from "@/lib/course-decision-advice";
import type { StockYardage } from "@/lib/stock-yardage";

describe("getClubDecisionLabel", () => {
  it("maps stock labels into visible decision labels", () => {
    expect(getClubDecisionLabel({ stockLabel: "Reliable" })).toBe("Trust");
    expect(getClubDecisionLabel({ stockLabel: "Developing" })).toBe("Developing");
    expect(getClubDecisionLabel({ stockLabel: "Unstable" })).toBe("Needs calibration");
    expect(getClubDecisionLabel({ stockLabel: "Do not trust yet" })).toBe("Do not trust yet");
    expect(getClubDecisionLabel({ isShortGameTouch: true, stockLabel: "Reliable" })).toBe("Touch shots only");
  });
});

describe("buildCourseDecisionAdvice", () => {
  it("prefers a trusted non-driver over soft-driver logic around 200 yd", () => {
    const advice = buildCourseDecisionAdvice([
      club("driver", 205, "Reliable"),
      club("5w", 180, "Developing"),
      club("6i", 160, "Reliable"),
    ]);

    const twoHundredOut = advice.find((item) => item.key === "200-out");

    expect(twoHundredOut?.value).toContain("5W");
    expect(twoHundredOut?.value).not.toContain("Driver");
  });

  it("excludes untrusted clubs from confident course decisions", () => {
    const advice = buildCourseDecisionAdvice([
      club("5w", 180, "Do not trust yet"),
      club("6i", 160, "Reliable"),
    ]);

    const teeAdvice = advice.find((item) => item.key === "180-tee");

    expect(teeAdvice?.value).toContain("6i");
    expect(teeAdvice?.value).not.toContain("5W");
  });

  it("uses touch-shot wedge guidance inside 100 yd when no full wedge stock exists", () => {
    const advice = buildCourseDecisionAdvice([
      {
        ...club("sw", null, "Do not trust yet"),
        isShortGameTouch: true,
        touch: {
          sampleSize: 18,
          carryMedianYd: 42,
          carryP25Yd: 30,
          carryP75Yd: 58,
        },
      },
    ]);

    const insideHundred = advice.find((item) => item.key === "inside-100");

    expect(insideHundred?.value).toBe("SW touch only");
    expect(insideHundred?.detail).toContain("touch windows");
  });
});

function club(type: string, playNumberYd: number | null, label: StockYardage["label"]) {
  return {
    id: type,
    type,
    stock: {
      carryMedianYd: playNumberYd,
      recommendedPlayNumberYd: playNumberYd,
      confidenceScore: label === "Reliable" ? 82 : label === "Developing" ? 58 : 20,
      label,
    },
  };
}
