import { describe, expect, it } from "vitest";

import {
  currentBagClubs,
  formatClubIdentityLabel,
  formatCompanionClubType,
} from "@/lib/club-format";

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

it("keeps current equipment and standalone generic clubs but hides retired and duplicate entries", () => {
  const clubs = [
    { type: "7i", active: false, brand: "Old" },
    { type: "7i", active: true, brand: "TaylorMade", model: "Qi" },
    { type: "7i", active: true, brand: " " },
    { type: "sw", active: true },
  ];
  expect(currentBagClubs(clubs)).toEqual([clubs[1], clubs[3]]);
});
it("distinguishes clubs sharing the same model", () => {
  expect(formatClubIdentityLabel({ type: "5w", brand: "TaylorMade", model: "Qi4D Max" })).toBe(
    "5W · TaylorMade Qi4D Max",
  );
  expect(formatClubIdentityLabel({ type: "driver", brand: "TaylorMade", model: "Qi4D Max" })).toBe(
    "Driver · TaylorMade Qi4D Max",
  );
});
