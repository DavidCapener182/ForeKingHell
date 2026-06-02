import { describe, expect, it } from "vitest";

import {
  isManageableTopEndGap,
  isMissingYardageWindowGap,
  isScoringEndGap,
  missingYardageWindowPriority,
} from "@/lib/gapping-windows";

describe("gapping window classification", () => {
  it("treats a normal driver-to-fairway gap as playable instead of missing", () => {
    const gap = { longerClubType: "driver", shorterClubType: "5w", gapYd: 30 };

    expect(isManageableTopEndGap(gap)).toBe(true);
    expect(isMissingYardageWindowGap(gap)).toBe(false);
  });

  it("still flags a large top-end gap when the next club is not a bridge club", () => {
    expect(
      isMissingYardageWindowGap({
        longerClubType: "driver",
        shorterClubType: "5i",
        gapYd: 50,
      }),
    ).toBe(true);
  });

  it("keeps scoring-end gaps ahead of long-game gaps", () => {
    const scoringGap = { longerClubType: "pw", shorterClubType: "sw", gapYd: 35 };
    const longGameGap = { longerClubType: "5w", shorterClubType: "5i", gapYd: 24 };

    expect(isScoringEndGap(scoringGap)).toBe(true);
    expect(missingYardageWindowPriority(scoringGap)).toBeGreaterThan(
      missingYardageWindowPriority(longGameGap),
    );
  });
});
