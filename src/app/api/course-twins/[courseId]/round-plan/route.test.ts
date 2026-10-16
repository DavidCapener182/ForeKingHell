import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: vi.fn(),
  plan: vi.fn(),
  manifest: vi.fn(),
  bag: vi.fn(),
  db: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mock.user }));
vi.mock("@/lib/billing", () => ({ getActivePlanKeyForUser: mock.plan, recordUsageEvent: vi.fn() }));
vi.mock("@/lib/course-twin-data", () => ({ getCourseTwinManifest: mock.manifest }));
vi.mock("@/lib/mobile-quick-bag-data", () => ({ getMobileCourseTwinBagProfiles: mock.bag }));
vi.mock("@/db/client", () => ({ getDb: mock.db }));
import { GET, POST } from "./route";
const context = { params: Promise.resolve({ courseId: "course" }) };
const req = (body: unknown = { intent: "normal" }) =>
  new Request("https://example.test/round-plan", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({ id: "owner" });
  mock.plan.mockResolvedValue("pro");
  mock.manifest.mockResolvedValue({ course: { id: "course" } });
  mock.bag.mockResolvedValue([]);
});
it("requires authentication for both reads and writes", async () => {
  mock.user.mockResolvedValue(null);
  expect((await GET(req(), context)).status).toBe(401);
  expect((await POST(req(), context)).status).toBe(401);
  expect(mock.db).not.toHaveBeenCalled();
});
it.each(["free", "plus"])("denies %s accounts direct save and load", async (plan) => {
  mock.plan.mockResolvedValue(plan);
  expect((await GET(req(), context)).status).toBe(403);
  expect((await POST(req(), context)).status).toBe(403);
  expect(mock.db).not.toHaveBeenCalled();
});
it("resolves visibility for the authenticated owner before reading data", async () => {
  mock.manifest.mockResolvedValue(null);
  expect((await GET(req(), context)).status).toBe(404);
  expect(mock.manifest).toHaveBeenCalledWith({ userId: "owner", courseId: "course" });
  expect(mock.db).not.toHaveBeenCalled();
});
it.each([
  {},
  { intent: "bogus" },
  { intent: "normal", userId: "another" },
  { intent: "normal", holesJson: [] },
])("rejects invalid or forged save payloads %j", async (body) => {
  expect((await POST(req(body), context)).status).toBe(400);
  expect(mock.bag).not.toHaveBeenCalled();
  expect(mock.db).not.toHaveBeenCalled();
});
it("reports insufficient evidence without saving fabricated recommendations", async () => {
  expect((await POST(req(), context)).status).toBe(422);
  expect(mock.db).not.toHaveBeenCalled();
});
