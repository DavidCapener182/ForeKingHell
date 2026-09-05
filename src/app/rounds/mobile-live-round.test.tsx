import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { MobileLiveRound, type MobileRoundHole } from "@/app/rounds/mobile-live-round";

const holes: MobileRoundHole[] = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: 4,
  yards: 360,
  score: 4,
  putts: 2,
  penalties: 0,
  fairwayHit: null,
  gir: null,
}));
const props = {
  accountId: "test",
  sessionId: "round",
  course: "Course",
  tee: "White",
  courseId: "course",
  recordVersion: "2026-09-05T00:00:00Z",
  holes,
};

describe("mobile round completion entry", () => {
  it("offers completion on hole 18 when the scorecard is already full", () => {
    const html = renderToStaticMarkup(<MobileLiveRound {...props} teeSetId="white-tee" />);
    expect(html).toContain("Hole 18");
    expect(html).toContain("Finish round");
    expect(html).toContain("courseId=course&amp;teeSetId=white-tee&amp;hole=18");
  });
  it("does not invent a tee for an older offline snapshot", () => {
    const html = renderToStaticMarkup(<MobileLiveRound {...props} />);
    expect(html).toContain("courseId=course&amp;hole=18");
    expect(html).not.toContain("teeSetId=");
  });
  it("shows current strategy and only linked actual clubs", () => {
    const html = renderToStaticMarkup(
      <MobileLiveRound
        {...props}
        clubEvidence={{
          18: { plan: ["5W", "7i"], actual: ["Driver", "PW"], actualOrderKnown: true },
        }}
      />,
    );
    expect(html).toContain("5W → 7i");
    expect(html).toContain("Driver → PW");
    expect(html).toContain("Current trusted-bag strategy");
    const missing = renderToStaticMarkup(
      <MobileLiveRound {...props} clubEvidence={{ 18: { plan: ["7i"], actual: [] } }} />,
    );
    expect(missing).toContain("No linked shots yet");
  });
  it("does not imply a shot sequence when ordering evidence is unavailable", () => {
    const html = renderToStaticMarkup(
      <MobileLiveRound
        {...props}
        clubEvidence={{ 18: { plan: ["5W"], actual: ["Driver", "PW"], actualOrderKnown: false } }}
      />,
    );
    expect(html).toContain("Driver · PW");
    expect(html).toContain("shot order unavailable");
  });
  it("keeps active complete scorecards in scoring until the completion action succeeds", () => {
    const source = readFileSync("src/app/(app)/rounds/[sessionId]/page.tsx", "utf8");
    expect(source).toMatch(
      /\["active", "in_progress"\]\.includes\(round.session.roundStatus\)\s*&&\s*round.holes.length > 0\s*\?\s*\(\s*<MobileLiveRound/,
    );
  });
});
