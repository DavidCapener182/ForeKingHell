import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  counts: [] as number[],
  insert: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getDb: () => ({ transaction: state.transaction }) }));
import { reserveAiCredits } from "@/lib/ai/usage";

beforeEach(() => {
  vi.clearAllMocks();
  state.counts = [0, 0];
  state.insert.mockReturnValue({
    values: () => ({ returning: async () => [{ id: "reservation" }] }),
  });
  state.transaction.mockImplementation(async (callback) =>
    callback({
      execute: state.execute,
      update: () => ({ set: () => ({ where: async () => undefined }) }),
      select: () => ({
        from: () => ({ where: async () => [{ value: state.counts.shift() ?? 0 }] }),
      }),
      insert: state.insert,
    }),
  );
});

const request = {
  userId: "account",
  featureKey: "scorecard_extract" as const,
  planKeySnapshot: "plus" as const,
  model: "test",
  creditCost: 4,
  monthlyLimit: 10,
};
describe("AI quota reservations", () => {
  it("rejects a third Plus extract even when monthly credits remain", async () => {
    state.counts = [0, 2];
    await expect(reserveAiCredits(request)).rejects.toMatchObject({
      status: 429,
      code: "ai_quota_exhausted",
    });
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.execute).toHaveBeenCalledOnce();
  });
  it("admits the last available extract and reserves its credits", async () => {
    state.counts = [4, 1];
    await expect(reserveAiCredits(request)).resolves.toEqual({
      eventId: "reservation",
      creditsRemaining: 2,
    });
    expect(state.insert).toHaveBeenCalledOnce();
  });
  it("enforces the combined chat cap before contacting the provider", async () => {
    state.counts = [30, 30];
    await expect(
      reserveAiCredits({
        ...request,
        featureKey: "data_chat",
        planKeySnapshot: "pro",
        creditCost: 1,
        monthlyLimit: 100,
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("also enforces monthly credits when the feature count is below its limit", async () => {
    state.counts = [8, 0];
    await expect(reserveAiCredits(request)).rejects.toMatchObject({ status: 429 });
    expect(state.insert).not.toHaveBeenCalled();
  });
});
