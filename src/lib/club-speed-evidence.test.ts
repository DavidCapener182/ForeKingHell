import { describe, expect, it } from "vitest";
import { clubSpeedMeasurementTrust } from "@/lib/club-speed-evidence";

describe("club speed measurement provenance", () => {
  it.each([null, "", "8", "-1", "unknown", "not estimated", "model experimental"])(
    "keeps undocumented flag %s unknown",
    (flag) => {
      expect(clubSpeedMeasurementTrust(flag)).toBe("unknown");
    },
  );
  it.each(["0", "0.0", "false", "measured", "direct"])(
    "recognizes explicit measured flag %s",
    (flag) => {
      expect(clubSpeedMeasurementTrust(flag)).toBe("measured");
    },
  );
  it.each(["1", "1.0", "true", "estimated", "modelled"])(
    "recognizes explicit estimated flag %s",
    (flag) => {
      expect(clubSpeedMeasurementTrust(flag)).toBe("estimated");
    },
  );
});
