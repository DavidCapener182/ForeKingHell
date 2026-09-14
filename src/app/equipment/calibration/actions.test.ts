import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  redirect: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: mocks.user }));
vi.mock("@/db/client", () => ({ getDb: () => ({ update: mocks.update }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveMonitorConditions } from "./actions";
const source = "11111111-1111-4111-8111-111111111111";
const reference = "22222222-2222-4222-8222-222222222222";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    sessionId: source,
    sourceId: source,
    referenceId: reference,
    recording: "partial",
    club: "driver",
  }))
    data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue("owner");
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ id: source }]);
});
describe("save monitor conditions", () => {
  it("scopes updates to the signed-in owner and merges only the conditions key", async () => {
    await saveMonitorConditions(form());
    const dialect = new PgDialect();
    const condition = dialect.sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(condition.params).toEqual([source, "owner"]);
    const update = mocks.set.mock.calls[0][0];
    expect(Object.keys(update).sort()).toEqual(["dataConfidenceJson", "updatedAt"]);
    const expression = dialect.sqlToQuery(update.dataConfidenceJson);
    expect(expression.sql).toContain("jsonb_set");
    expect(expression.sql).toContain("{launchMonitor}");
    expect(typeof expression.params[0]).toBe("string");
    expect(JSON.parse(String(expression.params[0])).recording).toBe("partial");
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("saved=1"));
  });
  it("does not report success for a session the owner cannot update", async () => {
    mocks.returning.mockResolvedValue([]);
    await expect(saveMonitorConditions(form())).rejects.toThrow("Session not found");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("rejects invalid identities before touching the database", async () => {
    const data = form();
    data.set("sessionId", "invalid");
    await expect(saveMonitorConditions(data)).rejects.toThrow("valid sessions");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
