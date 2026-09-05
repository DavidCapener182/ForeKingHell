import { beforeEach, expect, it, vi } from "vitest";

const manifest = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/course-twin-data", () => ({ getCourseTwinManifest: manifest }));
import { getOptionalMobileCoursePreview } from "./mobile-course-preview";

beforeEach(() => manifest.mockReset());

it("retains owner checks and returns only the available preview imagery", async () => {
  const imagery = { url: "/course-aerial", attribution: "Course source" };
  manifest.mockResolvedValue({ terrain: { imagery }, holes: [{ holeNumber: 1 }] });
  expect(await getOptionalMobileCoursePreview("owner", "course")).toEqual(imagery);
  expect(manifest).toHaveBeenCalledWith({ userId: "owner", courseId: "course" });
});

it("omits optional imagery when the manifest or signed-asset lookup fails", async () => {
  manifest.mockRejectedValue(new Error("Published asset could not be signed"));
  await expect(getOptionalMobileCoursePreview("owner", "course")).resolves.toBeNull();
  manifest.mockResolvedValue(null);
  await expect(getOptionalMobileCoursePreview("owner", "course")).resolves.toBeNull();
  manifest.mockResolvedValue({ terrain: {} });
  await expect(getOptionalMobileCoursePreview("owner", "course")).resolves.toBeNull();
});
