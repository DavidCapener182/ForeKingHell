import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/driver-development-data", () => ({ getDriverDevelopmentSnapshot: vi.fn() }));
vi.mock("@/components/analysis/session-confidence-controls", () => ({
  SessionConfidenceControls: () => null,
}));
import { DriverDevelopmentCard } from "./driver-development-panel";
import {
  buildDriverDevelopmentSnapshot,
  type DevelopmentShot,
} from "@/lib/driver-development-snapshot";
describe("Driver development presentation", () => {
  it("shows session evidence and the exact repeatability denominator without inventing a PB", () => {
    const rows = Array.from(
      { length: 10 },
      (_, i) =>
        ({
          id: String(i),
          sessionId: "session",
          clubId: "driver",
          clubType: "driver",
          shotAt: new Date("2026-09-06T12:00:00Z"),
          sessionSource: "rapsodo",
          sessionType: "range",
          playContext: "range",
          fileName: "export.csv",
          carryYd: i < 7 ? 205 : 195,
          totalYd: 220,
          ballSpeedMph: 130,
          clubSpeedMph: 88,
          smashFactor: 1.47,
          launchAngleDeg: 13,
          attackAngleDeg: 4,
          apexFt: 80,
          sideCarryYd: 5,
          clubDataEstType: "0",
          reviewStatus: "included",
          qualityTag: null,
          shotCategory: "full",
        }) satisfies DevelopmentShot,
    );
    const snapshot = buildDriverDevelopmentSnapshot(rows)!;
    const html = renderToStaticMarkup(<DriverDevelopmentCard snapshot={snapshot} compact />);
    expect(html).toContain('data-driver-development-snapshot="2026-09-06"');
    expect(html).toContain("7 / 10");
    expect(html).toContain("70%");
    expect(html).toContain("Capability");
    expect(html).toContain("Course recommendation");
    expect(html).toContain("not personal-best claims");
    expect(html).not.toContain("new PB");
  });
});
