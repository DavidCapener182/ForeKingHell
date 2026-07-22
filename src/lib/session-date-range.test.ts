import { describe, expect, it } from "vitest";

import { formatSessionDateRange, validSessionDate } from "@/lib/session-date-range";

describe("session date range", () => {
  it("formats database aggregate strings and Date instances together", () => {
    expect(
      formatSessionDateRange("2026-07-01T12:00:00.000Z", new Date("2026-07-21T12:00:00Z")),
    ).toBe("1 Jul 2026 – 21 Jul 2026");
  });

  it("returns an honest empty state for invalid stored or aggregate dates", () => {
    expect(formatSessionDateRange("not-a-date", new Date("2026-07-21T12:00:00Z"))).toBe(
      "No measured date range yet",
    );
    expect(validSessionDate(new Date(Number.NaN))).toBeNull();
  });
});
