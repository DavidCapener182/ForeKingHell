import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mobileSessionGroups } from "@/lib/mobile-session-review";
import { MobileSessionStory } from "./mobile-session-story";

const state = vi.hoisted(() => ({ query: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.query }));
const iron = {
  clubType: "7i",
  carryYd: 150,
  sideCarryYd: 0,
  ballSpeedMph: null,
  clubSpeedMph: null,
  launchAngleDeg: null,
  smashFactor: null,
};
const groups = mobileSessionGroups([iron, { ...iron, clubType: "driver" }], [iron]);
const draw = () =>
  renderToStaticMarkup(
    <MobileSessionStory groups={groups} preferredClub="7i" sessionId="owned-session" />,
  );

describe("mobile session club selection", () => {
  it("opens the requested club even without trusted readings and scopes the shot explorer", () => {
    state.query = new URLSearchParams("club=driver");
    const html = draw();
    expect(html).toContain("No trusted metric readings for Driver");
    expect(html).toContain('href="/shots?sessionId=owned-session&amp;club=driver"');
    expect(html).toContain("View all 2 shots");
    expect(html).not.toContain("Median of 1 trusted carry readings");
  });
  it("falls back to the measured focus for an absent club without inventing a group", () => {
    state.query = new URLSearchParams("club=5w");
    const html = draw();
    expect(html).toContain("7 Iron · 1 of 1 shots trusted");
    expect(html).toContain('href="/shots?sessionId=owned-session&amp;club=7i"');
    expect(html).not.toContain("5 Wood");
  });
});
