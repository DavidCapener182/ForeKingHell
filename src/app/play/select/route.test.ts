import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { SELECTED_COURSE_COOKIE, SELECTED_TEE_COOKIE } from "@/lib/selected-course";

const query = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner" }));
vi.mock("@/db/client", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => query }) }) }),
}));
beforeEach(() => query.limit.mockReset());

it.each(["", "&teeSetId=unavailable"])(
  "clears an old tee when selecting a course without a valid tee (%s)",
  async (suffix) => {
    query.limit.mockResolvedValueOnce([{ id: "course" }]).mockResolvedValueOnce([]);
    const response = await GET(
      new NextRequest(`http://localhost/play/select?courseId=course${suffix}`, {
        headers: { cookie: `${SELECTED_TEE_COOKIE}=old-tee` },
      }),
    );
    expect(response.cookies.get(SELECTED_COURSE_COOKIE)?.value).toBe("course");
    expect(response.cookies.get(SELECTED_TEE_COOKIE)?.value).toBe("");
    expect(response.cookies.get(SELECTED_TEE_COOKIE)?.expires).toEqual(new Date(0));
    expect(response.headers.get("location")).toBe("http://localhost/play?courseId=course");
  },
);

it("preserves an available tee and the strategy destination", async () => {
  query.limit.mockResolvedValueOnce([{ id: "course" }]).mockResolvedValueOnce([{ id: "tee" }]);
  const response = await GET(
    new NextRequest(
      "http://localhost/play/select?courseId=course&teeSetId=tee&destination=strategy",
    ),
  );
  expect(response.cookies.get(SELECTED_TEE_COOKIE)?.value).toBe("tee");
  expect(response.headers.get("location")).toBe(
    "http://localhost/courses/strategy?courseId=course&teeSetId=tee",
  );
});

it("does not overwrite remembered context for an unavailable course", async () => {
  query.limit.mockResolvedValueOnce([]);
  const response = await GET(new NextRequest("http://localhost/play/select?courseId=unavailable"));
  expect(response.cookies.getAll()).toHaveLength(0);
  expect(response.headers.get("location")).toBe("http://localhost/play");
});
