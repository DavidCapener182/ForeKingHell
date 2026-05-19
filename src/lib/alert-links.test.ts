import { describe, expect, it } from "vitest";

import { achievementDomId, achievementUnlockHref, clubHref, shotRowsHref } from "./alert-links";

describe("alert link helpers", () => {
  it("builds direct club and filtered shot row links for longest-shot alerts", () => {
    const notification = {
      clubId: "club-123",
      clubType: "driver",
      sessionId: "session-456",
      fileName: "range.csv",
    };

    expect(clubHref(notification)).toBe("/bag/club-123");
    expect(shotRowsHref(notification)).toBe("/shots?club=driver&sessionId=session-456");
  });

  it("falls back to file search when a session id is unavailable", () => {
    expect(
      shotRowsHref({
        clubId: "club-123",
        clubType: "7i",
        fileName: "May range.csv",
      }),
    ).toBe("/shots?club=7i&q=May+range.csv");
  });

  it("builds focused achievement links and stable DOM ids", () => {
    expect(achievementDomId("driver_total_200")).toBe("achievement-driver_total_200");
    expect(achievementUnlockHref("driver_total_200")).toBe(
      "/achievements?achievement=driver_total_200#achievement-driver_total_200",
    );
  });
});
