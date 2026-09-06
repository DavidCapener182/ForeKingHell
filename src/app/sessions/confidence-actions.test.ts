import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  clauses: [] as unknown[],
  data: {} as Record<string, unknown>,
  auth: vi.fn(),
  stock: vi.fn(),
  practice: vi.fn(),
  invalidate: vi.fn(),
  updates: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: state.auth }));
vi.mock("next/cache", () => ({ revalidatePath: state.invalidate }));
vi.mock("@/lib/stock-yardage-refresh", () => ({ refreshStockYardagesForClubs: state.stock }));
vi.mock("@/lib/practice-planner", () => ({
  refreshPracticeEvidenceForReviewedSessions: state.practice,
}));
vi.mock("@/lib/server-observability", () => ({ reportServerFailure: vi.fn() }));
vi.mock("@/db/client", () => {
  const select = () => ({
    from: () => ({
      where: (condition: unknown) => {
        state.clauses.push(condition);
        return {
          for: async () => state.queue.shift(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(state.queue.shift()).then(resolve),
        };
      },
    }),
  });
  const tx = {
    select,
    selectDistinct: select,
    update: () => ({
      set: (value: { dataConfidenceJson: Record<string, unknown> }) => {
        state.updates(value);
        state.data = value.dataConfidenceJson;
        return {
          where: (condition: unknown) => {
            state.clauses.push(condition);
            return { returning: async () => [{ data: state.data }] };
          },
        };
      },
    }),
  };
  return { getDb: () => ({ transaction: (run: (value: typeof tx) => unknown) => run(tx) }) };
});
import { saveSessionConfidence } from "./confidence-actions";
const owner = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const shotId = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  state.queue = [];
  state.clauses = [];
  state.data = {};
  state.auth.mockResolvedValue(owner);
  state.stock.mockResolvedValue(undefined);
  state.practice.mockResolvedValue(undefined);
});
describe("owner-scoped session confidence saves", () => {
  it("authenticates before any database operation", async () => {
    state.auth.mockRejectedValue(new Error("Unauthenticated"));
    await expect(saveSessionConfidence({ sessionId, alignment: "aligned" })).rejects.toThrow(
      "Unauthenticated",
    );
    expect(state.clauses).toHaveLength(0);
  });
  it("cannot update an unavailable or another owner's session", async () => {
    state.queue = [[]];
    await expect(saveSessionConfidence({ sessionId, alignment: "misaligned" })).rejects.toThrow(
      "unavailable",
    );
    expect(state.updates).not.toHaveBeenCalled();
  });
  it("cannot attach a review for a shot outside the owned session", async () => {
    state.queue = [[{ data: {} }], []];
    await expect(
      saveSessionConfidence({ sessionId, shotId, directionReview: "questionable" }),
    ).rejects.toThrow("shot is unavailable");
    expect(state.updates).not.toHaveBeenCalled();
  });
  it("preserves other review decisions and scopes every read/write to the authenticated owner", async () => {
    state.queue = [
      [
        {
          data: {
            alignment: "aligned",
            directionReviews: { other: { status: "confirmed", updatedAt: "before" } },
          },
        },
      ],
      [{ id: shotId }],
      [],
    ];
    const saved = await saveSessionConfidence({
      sessionId,
      shotId,
      directionReview: "questionable",
    });
    expect(saved.directionReviews?.other.status).toBe("confirmed");
    expect(saved.directionReviews?.[shotId].status).toBe("questionable");
    const dialect = new PgDialect();
    for (const clause of state.clauses) {
      const sql = dialect.sqlToQuery(clause as SQL);
      expect(sql.sql).toContain('"user_id"');
      expect(sql.params).toContain(owner);
    }
    expect(state.stock).toHaveBeenCalledOnce();
    expect(state.practice).toHaveBeenCalledWith(owner, [sessionId]);
    expect(state.invalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("reports a secondary refresh problem accurately after a successful save", async () => {
    state.queue = [[{ data: {} }], []];
    state.practice.mockRejectedValue(new Error("offline"));
    const saved = await saveSessionConfidence({ sessionId, alignment: "unknown" });
    expect(saved).toHaveProperty("refreshWarning");
    expect(saved.alignment).toBe("unknown");
  });
});
