import { describe, expect, it } from "vitest";

import { groupRecentTrainingSessions } from "@/lib/training/recentSessions";
import type { TrainingSessionListItem } from "@/lib/training/trainingData";

describe("groupRecentTrainingSessions", () => {
  it("groups same-day launch monitor range splits into one displayed range block", () => {
    const sessions = [
      launchMonitorSession({ id: "range-26", totalSwings: 26, sessionLoad: 104 }),
      launchMonitorSession({ id: "range-6", totalSwings: 6, sessionLoad: 24 }),
      roundSession(),
      launchMonitorSession({ id: "range-9", totalSwings: 9, sessionLoad: 36 }),
    ];

    const grouped = groupRecentTrainingSessions(sessions);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      title: "Rapsodo practice",
      sessionDate: "2026-06-22",
      totalSwings: 41,
      rpe: 4,
      sessionLoad: 164,
      entryCount: 3,
    });
    expect(grouped[1]).toMatchObject({
      title: "Aintree Golf Centre",
      holesPlayed: 9,
      sessionLoad: 300,
      entryCount: 1,
    });
  });

  it("keeps different dates as separate displayed sessions", () => {
    const grouped = groupRecentTrainingSessions([
      launchMonitorSession({
        id: "today",
        sessionDate: "2026-07-01",
        totalSwings: 82,
        sessionLoad: 410,
      }),
      launchMonitorSession({
        id: "previous",
        sessionDate: "2026-06-22",
        totalSwings: 26,
        sessionLoad: 104,
      }),
    ]);

    expect(grouped.map((session) => session.totalSwings)).toEqual([82, 26]);
    expect(grouped.map((session) => session.entryCount)).toEqual([1, 1]);
  });
});

function launchMonitorSession(
  overrides: Partial<TrainingSessionListItem> = {},
): TrainingSessionListItem {
  return {
    id: "range",
    sourceType: "launch_monitor",
    sourceId: "source-range",
    title: "Rapsodo practice",
    sessionDate: "2026-06-22",
    durationMinutes: null,
    holesPlayed: null,
    totalSwings: 26,
    fullSwings: null,
    shortGameSwings: null,
    puttingSwings: null,
    walked: null,
    usedCart: null,
    competition: false,
    rpe: 4,
    mentalPressure: null,
    physicalDemand: null,
    sessionLoad: 104,
    notes: null,
    ...overrides,
  };
}

function roundSession(): TrainingSessionListItem {
  return {
    ...launchMonitorSession(),
    id: "round",
    sourceType: "round",
    sourceId: "source-round",
    title: "Aintree Golf Centre",
    holesPlayed: 9,
    totalSwings: null,
    rpe: 5,
    sessionLoad: 300,
  };
}
