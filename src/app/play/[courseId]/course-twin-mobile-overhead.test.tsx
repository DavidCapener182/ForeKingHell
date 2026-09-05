import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CourseTwinManifest, CourseTwinReplayDocument } from "@/lib/course-twin-contract";
import { CourseTwinMobileOverhead } from "./course-twin-mobile-overhead";

const state = vi.hoisted(() => ({ query: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.query }));
const manifest = {
  course: { id: "course", name: "Evidence course" },
  holes: [
    {
      holeNumber: 1,
      par: 4,
      yards: 350,
      tee: [0, 0, 0],
      green: [300, 0, 0],
      centerline: [
        [0, 0, 0],
        [300, 0, 0],
      ],
    },
    {
      holeNumber: 2,
      par: 3,
      yards: 150,
      tee: [0, 0, 20],
      green: [120, 0, 20],
      centerline: [
        [0, 0, 20],
        [120, 0, 20],
      ],
    },
  ],
  features: [],
  quality: { warnings: [] },
  attribution: [],
} as unknown as CourseTwinManifest;
const missing = { value: null, provenance: "unavailable" };
const replay = {
  session: { id: "session", title: "Measured round", date: "2026-05-07", source: "CSV" },
  disclosure: "Placement is derived; flight is reconstructed.",
  shots: [
    {
      id: "second-shot",
      holeNumber: 2,
      holeShotNumber: 1,
      clubType: "7i",
      start: [0, 0, 20],
      carryEnd: [100, 0, 20],
      totalEnd: [100, 0, 20],
      trajectory: [],
      rollProvenance: "unavailable",
      metrics: { carryYd: missing, totalYd: missing, sideCarryYd: missing },
    },
  ],
} as unknown as CourseTwinReplayDocument;
function draw(readOnly = false, initialMode: "replay" | "strategy" | null = "replay") {
  return renderToStaticMarkup(
    <CourseTwinMobileOverhead
      manifest={manifest}
      replay={replay}
      initialMode={initialMode ?? undefined}
      readOnly={readOnly}
      onEnable3d={() => {}}
    />,
  );
}
describe("phone low-power evidence", () => {
  it("opens a shared replay without a mode hint and still allows explicit Plan", () => {
    state.query = new URLSearchParams("hole=2");
    expect(draw(true, null)).toContain("Show result");
    expect(draw(false, null)).not.toContain("Show result");
    state.query = new URLSearchParams("hole=2&mode=strategy");
    expect(draw(true, null)).not.toContain("Show result");
  });
  it("honours the requested hole and shot without manufacturing missing metrics", () => {
    state.query = new URLSearchParams("hole=2&mode=replay&shot=second-shot");
    const html = draw();
    expect(html).toContain("Hole 2");
    expect(html).toContain("7i");
    expect(html).toContain("Carry not recorded");
    expect(html).toContain("Total not recorded");
    expect(html).not.toContain("yd carry · measured");
    expect(html).toContain("Placement is derived; flight is reconstructed.");
  });
  it("does not substitute another hole's measured shots for an empty hole", () => {
    state.query = new URLSearchParams("hole=1&mode=replay");
    const html = draw();
    expect(html).toContain("No measured shots on this hole");
    expect(html).not.toContain("data-replay-ball");
  });
  it("keeps shared views read-only with no personal scoring or bag actions", () => {
    state.query = new URLSearchParams("hole=2&mode=replay");
    const html = draw(true);
    expect(html).not.toContain('href="/play?');
    expect(html).not.toContain('href="/quick-bag"');
    expect(html).toContain("Show result");
  });
});
