import { describe, expect, it } from "vitest";

import {
  getMobileTabContentBounds,
  getMobileTabScrollLeft,
  shouldUseCompactMobileTabs,
} from "@/components/mobile-tab-bar";

const tabs = [
  { left: 728, width: 83 },
  { left: 814, width: 63 },
  { left: 880, width: 104 },
  { left: 987, width: 90 },
  { left: 1080, width: 78 },
];

describe("getMobileTabScrollLeft", () => {
  it("anchors a narrow route rail on a complete preceding tab", () => {
    expect(
      getMobileTabScrollLeft({
        tabs,
        activeIndex: 2,
        viewportWidth: 288,
        maxScrollLeft: 870,
      }),
    ).toBe(814);
  });

  it("reveals another complete preceding tab when the viewport has room", () => {
    expect(
      getMobileTabScrollLeft({
        tabs,
        activeIndex: 2,
        viewportWidth: 358,
        maxScrollLeft: 800,
      }),
    ).toBe(728);
  });

  it("clamps the chosen tab boundary to the available scroll range", () => {
    expect(
      getMobileTabScrollLeft({
        tabs,
        activeIndex: 4,
        viewportWidth: 288,
        maxScrollLeft: 870,
      }),
    ).toBe(870);
  });

  it("normalizes viewport-inset tab bounds before aligning the active route", () => {
    const achievementBounds = getMobileTabContentBounds({
      tabLeft: -1,
      tabWidth: 111,
      viewportLeft: 16,
      scrollLeft: 483,
    });

    expect(achievementBounds).toEqual({ left: 466, width: 111 });
    expect(
      getMobileTabScrollLeft({
        tabs: [
          { left: 0, width: 93 },
          { left: 96, width: 105 },
          { left: 204, width: 109 },
          { left: 316, width: 75 },
          { left: 394, width: 69 },
          achievementBounds,
          { left: 580, width: 70 },
          { left: 653, width: 55 },
          { left: 711, width: 64 },
          { left: 777, width: 64 },
        ],
        activeIndex: 7,
        viewportWidth: 358,
        maxScrollLeft: 483,
      }),
    ).toBe(466);
  });
});

describe("shouldUseCompactMobileTabs", () => {
  it("keeps four genuinely short labels in an equal-width segmented rail", () => {
    expect(
      shouldUseCompactMobileTabs([
        { key: "all", label: "All", href: "/all" },
        { key: "friends", label: "Friends", href: "/friends" },
        { key: "monthly", label: "Monthly", href: "/monthly" },
        { key: "mine", label: "Mine", href: "/mine" },
      ]),
    ).toBe(true);
  });

  it("uses the scroll rail when a four-item route has an important long label", () => {
    expect(
      shouldUseCompactMobileTabs([
        { key: "today", label: "Today", href: "/today" },
        { key: "dashboard", label: "Dashboard", href: "/dashboard" },
        { key: "progress", label: "Progress", href: "/progress" },
        { key: "strokes", label: "Strokes gained", href: "/strokes-gained" },
      ]),
    ).toBe(false);
  });
});
