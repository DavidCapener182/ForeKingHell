import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  manifest: vi.fn(),
  mobile: vi.fn(),
  stock: vi.fn(),
  build: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/course-twin-data", () => ({
  getCourseTwinManifest: mocks.manifest,
  getCourseTwinBagProfiles: mocks.stock,
}));
vi.mock("@/lib/mobile-quick-bag-data", () => ({ getMobileCourseTwinBagProfiles: mocks.mobile }));
vi.mock("@/lib/course-twin-strategy", () => ({ buildCourseTwinStrategy: mocks.build }));
import { GET } from "./route";
const request = (query = "") =>
  GET(new Request(`https://example.test/api/course-twins/course/strategy?${query}`), {
    params: Promise.resolve({ courseId: "course" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.manifest.mockResolvedValue({ holes: [{ holeNumber: 1 }] });
  mocks.mobile.mockResolvedValue([{ clubId: "mobile" }]);
  mocks.stock.mockResolvedValue([{ clubId: "stock" }]);
  mocks.build.mockImplementation(({ bag }) => ({ clubs: bag }));
});
describe("Course Twin strategy evidence routing", () => {
  it("keeps the default desktop bag and explicitly chooses the mobile projection", async () => {
    expect(await (await request()).json()).toEqual({ clubs: [{ clubId: "stock" }] });
    expect(mocks.stock).toHaveBeenCalledWith("owner");
    expect(mocks.mobile).not.toHaveBeenCalled();
    expect(await (await request("evidenceBasis=latest-reliable")).json()).toEqual({
      clubs: [{ clubId: "mobile" }],
    });
    expect(mocks.mobile).toHaveBeenCalledOnce();
    expect(mocks.stock).toHaveBeenCalledOnce();
  });
  it("rejects unauthenticated, invalid basis and unmapped hole requests before loading bag evidence", async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(401);
    expect((await request("evidenceBasis=unknown")).status).toBe(400);
    expect((await request("holeNumber=2")).status).toBe(404);
    expect(mocks.mobile).not.toHaveBeenCalled();
    expect(mocks.stock).not.toHaveBeenCalled();
  });
  it("does not silently substitute stock evidence when mobile dispersion is insufficient", async () => {
    mocks.mobile.mockResolvedValue([]);
    const response = await request("evidenceBasis=latest-reliable");
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("side readings"),
    });
    expect(mocks.stock).not.toHaveBeenCalled();
    expect(mocks.build).not.toHaveBeenCalled();
  });
});
