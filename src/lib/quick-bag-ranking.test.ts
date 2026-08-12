import { describe, expect, it } from "vitest";

import { rankQuickBagForTarget } from "@/lib/quick-bag-ranking";

const club = (
  id: string,
  values: Partial<Parameters<typeof rankQuickBagForTarget>[0][number]> = {},
) => ({
  id,
  trustedCarryYd: 160,
  playNumberYd: 164,
  lowYd: 158,
  highYd: 169,
  confidence: 80,
  sampleSize: 18,
  ...values,
});

describe("Quick Bag target ranking", () => {
  it("ranks a measured-range match before a median-only match", () => {
    const result = rankQuickBagForTarget(
      [
        club("range"),
        club("median", { trustedCarryYd: 165, playNumberYd: 165, lowYd: 150, highYd: 160 }),
      ],
      165,
      "finish",
    );
    expect(result[0]?.id).toBe("range");
  });

  it("uses confidence and then sample size to break equal matches", () => {
    const result = rankQuickBagForTarget(
      [
        club("low", { confidence: 50, sampleSize: 30 }),
        club("high", { confidence: 85, sampleSize: 12 }),
      ],
      165,
      "finish",
    );
    expect(result[0]?.id).toBe("high");
  });
});
