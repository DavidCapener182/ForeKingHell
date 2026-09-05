import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getReplay } = vi.hoisted(() => ({ getReplay: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner" }));
vi.mock("@/lib/course-twin-data", () => ({
  getCourseTwinManifest: async () => ({ courseId: "course" }),
  getCourseTwinReplay: getReplay,
}));
vi.mock("@/app/play/[courseId]/course-twin-runtime", () => ({
  CourseTwinRuntime: ({ initialMode }: { initialMode?: string }) => (
    <output>{initialMode ?? "automatic"}</output>
  ),
}));

import CourseTwinPage from "@/app/(app)/play/[courseId]/page";

async function renderPage(query: { sessionId?: string; mode?: string }) {
  return renderToStaticMarkup(
    await CourseTwinPage({
      params: Promise.resolve({ courseId: "course" }),
      searchParams: Promise.resolve(query),
    }),
  );
}

describe("Course Twin entry mode", () => {
  beforeEach(() => getReplay.mockResolvedValue(null));

  it("opens a usable strategy for scorecard-only round replay links", async () => {
    expect(await renderPage({ sessionId: "scorecard-only" })).toContain(
      "<output>strategy</output>",
    );
    expect(await renderPage({ mode: "replay" })).toContain("<output>strategy</output>");
  });

  it("opens measured replay while preserving an explicit strategy choice", async () => {
    getReplay.mockResolvedValue({ sessionId: "measured-round" });
    expect(await renderPage({ sessionId: "measured-round" })).toContain("<output>replay</output>");
    expect(await renderPage({ sessionId: "measured-round", mode: "strategy" })).toContain(
      "<output>strategy</output>",
    );
  });

  it("preserves automatic entry for an ordinary course link", async () => {
    expect(await renderPage({})).toContain("<output>automatic</output>");
  });
});
