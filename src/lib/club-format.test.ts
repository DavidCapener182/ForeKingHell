import { describe, expect, it } from "vitest";

import { formatCompanionClubType } from "@/lib/club-format";

describe("companion club labels", () => {
  it.each([
    ["driver", "Driver"],
    ["7i", "7 Iron"],
    ["3w", "3 Wood"],
    ["4h", "4 Hybrid"],
    ["pw", "Pitching Wedge"],
    ["sw", "Sand Wedge"],
  ])("formats %s as %s", (club, label) => {
    expect(formatCompanionClubType(club)).toBe(label);
  });
});
