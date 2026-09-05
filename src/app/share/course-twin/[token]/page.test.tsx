import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  getDb: () => {
    const query = {
      select: () => query,
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      limit: async () => [
        { userId: "owner", sessionId: "round", courseId: "course", title: "Shared replay" },
      ],
    };
    return query;
  },
}));
vi.mock("@/lib/course-twin-data", () => ({
  getCourseTwinManifest: async () => ({
    course: { name: "Course" },
    holes: [{ holeNumber: 1 }, { holeNumber: 7 }],
  }),
  getCourseTwinReplay: async () => ({ session: { id: "round" }, shots: [] }),
}));
vi.mock("@/app/play/[courseId]/course-twin-runtime", () => ({
  CourseTwinRuntime: ({
    initialMode,
    initialHoleNumber,
    readOnly,
  }: {
    initialMode?: string;
    initialHoleNumber?: number;
    readOnly?: boolean;
  }) => <output>{`${initialMode}:${initialHoleNumber ?? "default"}:${readOnly}`}</output>,
}));
import SharedCourseTwinPage from "./page";

async function renderPage(hole?: string) {
  return renderToStaticMarkup(
    await SharedCourseTwinPage({
      params: Promise.resolve({ token: "test-share-token" }),
      searchParams: Promise.resolve({ hole }),
    }),
  );
}

describe("shared replay display handoff", () => {
  it("forwards a retained non-first hole into the read-only 3D replay", async () => {
    expect(await renderPage("7")).toContain("<output>replay:7:true</output>");
  });
  it("leaves invalid or unmapped holes to the renderer's safe default", async () => {
    for (const hole of [undefined, "bad", "2", "7.5"]) {
      expect(await renderPage(hole)).toContain("<output>replay:default:true</output>");
    }
  });
});
