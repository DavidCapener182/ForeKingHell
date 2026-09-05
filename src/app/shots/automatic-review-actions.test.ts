import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  owned: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  inserted: [] as Array<Record<string, unknown>>,
  refresh: vi.fn(),
  practice: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/product-events", () => ({ recordProductWorkflowEvent: vi.fn() }));
vi.mock("@/lib/server-observability", () => ({ reportServerFailure: vi.fn() }));
vi.mock("@/lib/practice-planner", () => ({
  refreshPracticeEvidenceForReviewedSessions: state.practice,
}));
vi.mock("@/lib/stock-yardage-refresh", () => ({ refreshStockYardagesForClubs: state.refresh }));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({
        select: () => ({
          from: () => ({
            where: () => ({
              for: async () => state.owned,
              orderBy: () => ({ limit: async () => state.events }),
            }),
          }),
        }),
        update: () => ({
          set: (value: Record<string, unknown>) => ({
            where: async () => {
              state.updates.push(value);
            },
          }),
        }),
        insert: () => ({
          values: async (value: Record<string, unknown>) => {
            state.inserted.push(value);
          },
        }),
      }),
  }),
}));
import { keepAutomaticShotReviewAction } from "@/app/(app)/shots/actions";
const id = "11111111-1111-4111-8111-111111111111";
const base = {
  id,
  userId: "owner",
  sessionId: "session",
  clubId: "club",
  playContext: "range",
  reviewStatus: "included",
  qualityTag: null,
  reviewPreviousQualityTag: null,
  reviewSource: null,
  reviewReason: null,
};
beforeEach(() => {
  state.owned = [{ ...base }];
  state.events = [];
  state.updates = [];
  state.inserted = [];
  state.refresh.mockReset();
  state.practice.mockReset();
});
describe("automatic review Keep and Undo", () => {
  it("records Keep without changing the raw shot or excluding it", async () => {
    await keepAutomaticShotReviewAction([id]);
    expect(state.updates[0]).toMatchObject({
      reviewStatus: "included",
      qualityTag: null,
      reviewSource: "user",
    });
    expect(state.updates[0]).not.toHaveProperty("carryYd");
    expect(state.updates[0]).not.toHaveProperty("sourceRawJson");
    expect(state.inserted[0]).toMatchObject({
      userId: "owner",
      shotId: id,
      previousStatus: "included",
      status: "included",
    });
    expect(state.refresh).toHaveBeenCalledOnce();
  });
  it("restores a kept imported suggestion and retains its previous quality flag", async () => {
    state.owned = [
      {
        ...base,
        reviewStatus: "suggested_exclusion",
        qualityTag: "needs-review",
        reviewPreviousQualityTag: null,
      },
    ];
    await keepAutomaticShotReviewAction([id]);
    expect(state.updates[0]).toMatchObject({ reviewStatus: "restored", qualityTag: null });
    expect(state.inserted[0]).toMatchObject({
      previousQualityTag: "needs-review",
      resultingQualityTag: null,
    });
  });
  it("undoes only a current Keep using the owned audit event", async () => {
    const reason = "Automatic review: golfer kept this shot.";
    state.owned = [
      { ...base, reviewStatus: "restored", reviewReason: reason, reviewSource: "user" },
    ];
    state.events = [
      { reason, previousStatus: "suggested_exclusion", previousQualityTag: "needs-review" },
    ];
    await keepAutomaticShotReviewAction([id], true);
    expect(state.updates[0]).toMatchObject({
      reviewStatus: "suggested_exclusion",
      qualityTag: "needs-review",
      reviewSource: "system",
      reviewedAt: null,
    });
  });
  it("refuses Undo after another review or club correction", async () => {
    state.owned = [
      { ...base, reviewReason: "Automatic review: golfer kept this shot.", reviewSource: "user" },
    ];
    state.events = [{ reason: "Club corrected" }];
    await expect(keepAutomaticShotReviewAction([id], true)).rejects.toThrow("changed");
    expect(state.updates).toHaveLength(0);
  });
  it("rejects an unavailable owned row before any write", async () => {
    state.owned = [];
    await expect(keepAutomaticShotReviewAction([id])).rejects.toThrow("unavailable");
    expect(state.updates).toHaveLength(0);
  });
  it("does not overwrite an exclusion decision", async () => {
    state.owned = [{ ...base, reviewStatus: "user_excluded", reviewSource: "user" }];
    await expect(keepAutomaticShotReviewAction([id])).rejects.toThrow("already has");
    expect(state.updates).toHaveLength(0);
  });
  it("does not duplicate a Keep event on retry", async () => {
    state.owned = [
      { ...base, reviewSource: "user", reviewReason: "Automatic review: golfer kept this shot." },
    ];
    await keepAutomaticShotReviewAction([id]);
    expect(state.inserted).toHaveLength(0);
  });
  it("keeps a successful review successful when downstream practice refresh fails", async () => {
    state.practice.mockRejectedValueOnce(new Error("refresh failed"));
    await expect(keepAutomaticShotReviewAction([id])).resolves.toBeUndefined();
    expect(state.updates).toHaveLength(1);
  });
});
