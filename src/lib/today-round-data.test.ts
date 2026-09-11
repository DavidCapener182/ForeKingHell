import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ result: [] as unknown[], where: vi.fn(), getDb: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
import { getTodayRound } from "./today-round-data";
beforeEach(() => {
  mocks.result = [];
  mocks.where.mockReset();
  mocks.getDb.mockReset();
  mocks.getDb.mockImplementation(() => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: (clause: unknown) => {
            mocks.where(clause);
            return { orderBy: () => ({ limit: async () => mocks.result }) };
          },
        }),
      }),
    }),
  }));
});
describe("Today activity selection", () => {
  it("accepts a latest scorecard round with no launch-monitor shots", async () => {
    mocks.result = [{ session: { type: "real_round" }, tee: null }];
    expect(await getTodayRound("owner")).toEqual(mocks.result[0]);
    const q = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(q.params).toContain("owner");
    expect(q.sql).toContain('"fkh_sessions"."user_id" =');
    expect(q.sql).toContain('"fkh_shots"."user_id" =');
    expect(q.sql).toContain("Europe/London");
    expect(q.sql).toContain("jsonb_array_elements");
    expect(q.sql).toContain("'complete'");
    expect(q.sql).toContain("max(");
  });
  it("returns to practice when the newest eligible activity is practice", async () => {
    mocks.result = [{ session: { type: "range" }, tee: null }];
    expect(await getTodayRound("owner")).toBeNull();
  });
  it("preserves explicit practice and club scopes", async () => {
    expect(await getTodayRound("owner", { view: "practice" })).toBeNull();
    expect(await getTodayRound("owner", { club: "7i" })).toBeNull();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("applies selected dates and session ownership without falling back to another round", async () => {
    expect(await getTodayRound("owner", { date: "2026-09-08", session: "selected" })).toBeNull();
    const q = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(q.params).toContain("2026-09-08");
    expect(q.params).toContain("selected");
    expect(q.params).toContain("owner");
  });
});
