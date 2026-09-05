import { describe, expect, it, vi, beforeEach } from "vitest";
const calls = vi.hoisted(() => ({ where: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...terms: unknown[]) => terms,
  eq: (column: string, value: unknown) => ({ column, equals: value }),
  inArray: (column: string, value: unknown) => ({ column, within: value }),
}));
vi.mock("@/db/schema", () => ({
  sessions: { id: "measured.id", type: "measured.type", userId: "measured.owner" },
  speedTrainingSessions: { id: "speed.id", userId: "speed.owner" },
}));
vi.mock("@/db/client", () => ({ getDb: () => ({ select: calls.select }) }));
import { getMobileTrainingSourceLinks } from "./mobile-training-source-links";
import type { TrainingSessionListItem } from "./trainingData";
beforeEach(() => {
  vi.clearAllMocks();
  calls.select.mockImplementation(() => ({ from: () => ({ where: calls.where }) }));
});
describe("mobile training source navigation", () => {
  it("uses the actual owned source table for rounds, measured practice and speed", async () => {
    calls.where
      .mockResolvedValueOnce([
        { id: "round", type: "real_round" },
        { id: "practice", type: "practice" },
      ])
      .mockResolvedValueOnce([{ id: "speed" }]);
    const training = ["round", "practice", "speed", "unknown", "speed"].map((sourceId) => ({
      sourceId,
    })) as TrainingSessionListItem[];
    expect(await getMobileTrainingSourceLinks("owner", training)).toEqual({
      round: { href: "/rounds/round", label: "View round" },
      practice: { href: "/sessions/practice", label: "View measured session" },
      speed: { href: "/speed/sessions/speed", label: "View speed session" },
    });
    expect(calls.where.mock.calls).toEqual([
      [
        [
          { column: "measured.owner", equals: "owner" },
          { column: "measured.id", within: ["round", "practice", "speed", "unknown"] },
        ],
      ],
      [
        [
          { column: "speed.owner", equals: "owner" },
          { column: "speed.id", within: ["round", "practice", "speed", "unknown"] },
        ],
      ],
    ]);
  });
  it("does not invent a session link for unlinked training", async () => {
    expect(
      await getMobileTrainingSourceLinks("owner", [
        { sourceId: null },
      ] as TrainingSessionListItem[]),
    ).toEqual({});
    expect(calls.select).not.toHaveBeenCalled();
  });
});
