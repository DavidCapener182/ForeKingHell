import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
vi.mock("@/db/client", () => ({ getDb: vi.fn() }));
import { getDb } from "@/db/client";
import { getSessionReviewMetadata } from "@/lib/session-review-metadata";
const id = "00000000-0000-4000-8000-000000008888";
const owner = "00000000-0000-4000-8000-000000009999";
const where = vi.fn();
const leftJoin = vi.fn();
const select = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
});
function database(rows: unknown[]) {
  const q = {
    from: vi.fn(() => q),
    leftJoin: leftJoin.mockImplementation(() => q),
    where: where.mockImplementation(() => q),
    groupBy: vi.fn(() => q),
    limit: vi.fn(async () => rows),
  };
  select.mockReturnValue(q);
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>);
}
describe("owned session metadata", () => {
  it("returns a saved activity with zero shots and scopes both tables to its owner", async () => {
    database([{ id, shotCount: 0, notes: "Recorded practice" }]);
    expect(await getSessionReviewMetadata(owner, id)).toMatchObject({ id, shotCount: 0 });
    const dialect = new PgDialect();
    const predicate = dialect.sqlToQuery(where.mock.calls[0][0]);
    expect(predicate.params).toEqual([owner, id]);
    const join = dialect.sqlToQuery(leftJoin.mock.calls[0][1]);
    expect(join.params).toContain(owner);
  });
  it("does not expose missing or unowned records", async () => {
    database([]);
    expect(await getSessionReviewMetadata(owner, id)).toBeNull();
  });
  it("rejects malformed deep links before querying a UUID column", async () => {
    expect(await getSessionReviewMetadata(owner, "not-a-session")).toBeNull();
    expect(getDb).not.toHaveBeenCalled();
  });
});
