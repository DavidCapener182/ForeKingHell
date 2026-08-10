import { describe, expect, it } from "vitest";

import {
  initializeBagOrder,
  moveBagClub,
  moveBagClubWithinSection,
  type BagOrderClubItem,
} from "@/app/equipment/bag-order-state";

const clubs: BagOrderClubItem[] = [
  club("iron-7", "7 Iron", "irons", 20),
  club("driver", "Driver", "driver", 10),
  club("wedge", "Sand Wedge", "wedges", 10),
  club("iron-5", "5 Iron", "irons", 10),
  club("wood", "5 Wood", "woods", 10),
];

describe("equipment bag order state", () => {
  it("initializes from saved section and position order", () => {
    const ordered = initializeBagOrder(clubs);

    expect(ordered.map((item) => item.id)).toEqual(["driver", "wood", "iron-5", "iron-7", "wedge"]);
    expect(ordered.filter((item) => item.bagSection === "irons").map(position)).toEqual([10, 20]);
  });

  it("moves a club within its section without the saved order restoring it", () => {
    const ordered = initializeBagOrder(clubs);
    const moved = moveBagClubWithinSection(ordered, "iron-5", 1);
    const irons = moved.filter((item) => item.bagSection === "irons");

    expect(irons.map((item) => item.id)).toEqual(["iron-7", "iron-5"]);
    expect(irons.map(position)).toEqual([10, 20]);
  });

  it("moves a club between sections through the non-drag picker", () => {
    const ordered = initializeBagOrder(clubs);
    const moved = moveBagClub(ordered, "iron-5", "woods");
    const woods = moved.filter((item) => item.bagSection === "woods");

    expect(woods.map((item) => item.id)).toEqual(["wood", "iron-5"]);
    expect(woods.map(position)).toEqual([10, 20]);
  });

  it("keeps drag insertion before the selected target", () => {
    const ordered = initializeBagOrder(clubs);
    const moved = moveBagClub(ordered, "iron-7", "irons", "iron-5");

    expect(moved.filter((item) => item.bagSection === "irons").map((item) => item.id)).toEqual([
      "iron-7",
      "iron-5",
    ]);
  });

  it("does not move a club when it is dropped onto itself", () => {
    const ordered = initializeBagOrder(clubs);

    expect(moveBagClub(ordered, "iron-5", "irons", "iron-5")).toBe(ordered);
  });
});

function club(id: string, label: string, bagSection: string, bagPosition: number) {
  return {
    id,
    type: id,
    label,
    brandModel: `${label} model`,
    bagSection,
    bagPosition,
    confidence: 80,
    carryLabel: "150 yd",
  } satisfies BagOrderClubItem;
}

function position(item: BagOrderClubItem) {
  return item.bagPosition;
}
