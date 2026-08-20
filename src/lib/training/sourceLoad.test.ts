import { describe, expect, it } from "vitest";

import { buildImportedTrainingSessionRow } from "@/lib/training/sourceLoad";

describe("imported source training load", () => {
  it("counts committed physical swings independently of later analytical review", () => {
    const row = buildImportedTrainingSessionRow({
      userId: "user-1",
      sourceId: "session-1",
      source: "rapsodo",
      sessionType: "range",
      sessionDate: new Date("2026-07-01T12:54:14.708Z"),
      fileName: "rapsodo-cloud-range-session-2026-07-01.csv",
      shotCount: 82,
    });

    expect(row).toMatchObject({
      userId: "user-1",
      sourceType: "launch_monitor",
      sourceId: "session-1",
      title: "Rapsodo practice",
      sessionDate: "2026-07-01",
      totalSwings: 82,
      holesPlayed: null,
      rpe: 5,
      sessionLoad: 410,
    });
  });

  it("keeps simulated-course imports as round workload", () => {
    const row = buildImportedTrainingSessionRow({
      userId: "user-1",
      sourceId: "session-2",
      source: "rapsodo",
      sessionType: "simulated_course",
      sessionDate: new Date("2026-07-01T17:30:00.000Z"),
      fileName: "rapsodo-cloud-aintree-2026-07-01.csv",
      courseName: "Aintree Golf Centre",
      shotCount: 25,
      scorecardHoleCount: 9,
    });

    expect(row).toMatchObject({
      sourceType: "round",
      title: "Aintree Golf Centre",
      sessionDate: "2026-07-01",
      holesPlayed: 9,
      totalSwings: null,
      walked: false,
      usedCart: true,
      rpe: 5,
      sessionLoad: 300,
    });
  });
});
