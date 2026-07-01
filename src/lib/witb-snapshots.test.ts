import { describe, expect, it } from "vitest";

import {
  buildEquipmentSnapshotPayload,
  defaultBagSection,
  normalizeBagOrder,
} from "@/lib/witb-snapshots";

describe("WITB snapshots", () => {
  it("defaults club slots from golf bag order", () => {
    expect(defaultBagSection("driver")).toBe("driver");
    expect(defaultBagSection("5w")).toBe("woods");
    expect(defaultBagSection("7i")).toBe("irons");
    expect(defaultBagSection("sw")).toBe("wedges");
    expect(defaultBagSection("putter")).toBe("putter");
  });

  it("normalizes saved bag sections and positions", () => {
    const ordered = normalizeBagOrder([
      { id: "sw", type: "sw", bagSection: "wedges", bagPosition: 20 },
      { id: "driver", type: "driver", bagSection: null, bagPosition: null },
      { id: "7i", type: "7i", bagSection: "IRONS", bagPosition: 10.4 },
    ]);

    expect(ordered.map((club) => club.id)).toEqual(["driver", "7i", "sw"]);
    expect(ordered.find((club) => club.id === "7i")?.bagSection).toBe("irons");
    expect(ordered.find((club) => club.id === "7i")?.bagPosition).toBe(10);
  });

  it("captures compact equipment snapshot payloads", () => {
    expect(
      buildEquipmentSnapshotPayload([
        {
          id: "club-1",
          type: "driver",
          brand: "Ping",
          model: "G430",
          confidence: 82,
          carryYd: 256,
        },
      ]),
    ).toEqual([
      {
        clubId: "club-1",
        label: "Driver",
        section: "driver",
        position: 100,
        brandModel: "Ping G430",
        confidence: 82,
        carryYd: 256,
      },
    ]);
  });
});
