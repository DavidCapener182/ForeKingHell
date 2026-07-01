import { describe, expect, it } from "vitest";

import {
  buildFeedItemContentExportSnapshot,
  readContentExportSnapshot,
} from "@/lib/content-exports";

describe("content export snapshots", () => {
  it("builds a stable feed item snapshot with sensible fallbacks", () => {
    const snapshot = buildFeedItemContentExportSnapshot(
      {
        headline: "  New driver PB from the latest Rapsodo import  ",
        metricLabel: null,
        metricValue: "286 yd",
        context: null,
        verificationLabel: "Verified import",
        profileUsername: "@Fore King Hell!",
      },
      new Date("2026-06-30T09:00:00Z"),
    );

    expect(snapshot).toEqual({
      title: "New driver PB from the latest Rapsodo import",
      metricLabel: "ForeKingHell",
      metricValue: "286 yd",
      context: "Verified import",
      footer: "Verified import / @ForeKingHell",
      username: "ForeKingHell",
      generatedAt: "2026-06-30T09:00:00.000Z",
    });
  });

  it("normalizes unknown snapshot payloads for image rendering", () => {
    const snapshot = readContentExportSnapshot({
      title: "A".repeat(220),
      metricLabel: "Carry",
      metricValue: null,
      username: "",
      generatedAt: "not-a-date",
    });

    expect(snapshot.title).toHaveLength(150);
    expect(snapshot.title.endsWith("...")).toBe(true);
    expect(snapshot.metricValue).toBe("Verified");
    expect(snapshot.username).toBe("player");
    expect(new Date(snapshot.generatedAt).toString()).not.toBe("Invalid Date");
  });
});
