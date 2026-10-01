import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  tx: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  stock: vi.fn(),
  practice: vi.fn(),
  commit: vi.fn(),
}));
vi.mock("@/db/client", () => ({
  getDb: () => ({ transaction: (fn: (tx: unknown) => unknown) => fn(state.tx) }),
}));
vi.mock("@/lib/stock-yardage-refresh", () => ({ refreshStockYardagesForClubs: state.stock }));
vi.mock("@/lib/practice-planner", () => ({
  refreshPracticeEvidenceForReviewedSessions: state.practice,
}));
vi.mock("@/lib/offline-operation-ledger", () => ({ recordOfflineRoundCommit: state.commit }));
vi.mock("@/lib/round-assignments", () => ({
  recalculateRoundAssignments: vi.fn(),
  rebuildRoundStrokesGainedEvents: vi.fn(),
}));
vi.mock("@/lib/offline-round-precondition", () => ({
  assertOfflineRoundPrecondition: vi.fn(),
  nextRoundVersionTime: () => new Date(),
}));
import { correctShotsClub } from "./shot-club-correction";
const ids = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const clubId = "00000000-0000-0000-0000-000000000003";
function chain(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    for: () => Promise.resolve(rows),
    limit: () => Promise.resolve(rows),
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(rows).then(fn),
  };
  return builder;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [
    [{ id: "user" }],
    ids.map(() => ({ sessionId: "session" })),
    [{ id: "session", updatedAt: new Date(), scorecardJson: null }],
    ids.map((id) => ({
      id,
      sessionId: "session",
      clubId: "old",
      clubType: "7i",
      playContext: "practice",
      reviewStatus: "included",
      qualityTag: null,
    })),
    [{ id: clubId, type: "6i" }],
  ];
  state.tx.select.mockImplementation(() => chain(state.rows.shift()!));
  state.tx.update.mockImplementation(() => ({
    set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
  }));
  state.tx.insert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
});
it("updates a selection with one stock refresh and one session commit", async () => {
  expect(await correctShotsClub({ userId: "user", shotIds: ids, clubId })).toMatchObject({
    count: 2,
    sessionIds: ["session"],
  });
  expect(state.stock).toHaveBeenCalledTimes(1);
  expect(state.practice).toHaveBeenCalledTimes(1);
  expect(state.commit).toHaveBeenCalledTimes(1);
  expect(state.tx.insert).toHaveBeenCalledTimes(1);
});
it("rejects a missing or unowned shot before any mutation", async () => {
  state.rows[1] = [{ sessionId: "session" }];
  await expect(correctShotsClub({ userId: "user", shotIds: ids, clubId })).rejects.toThrow(
    "unavailable",
  );
  expect(state.tx.update).not.toHaveBeenCalled();
  expect(state.tx.insert).not.toHaveBeenCalled();
});
it("rejects an inactive or unowned destination before any mutation", async () => {
  state.rows[4] = [];
  await expect(correctShotsClub({ userId: "user", shotIds: ids, clubId })).rejects.toThrow(
    "active club",
  );
  expect(state.tx.update).not.toHaveBeenCalled();
});
