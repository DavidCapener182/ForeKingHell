import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  MobileCarouselPagination,
  MobileFilterChipGroup,
  MobileSegmentedControl,
  MobilePageTabs,
  resolveMobilePageTabValue,
} from "@/components/app/mobile-controls";

const source = readFileSync(join(process.cwd(), "src/components/app/mobile-controls.tsx"), "utf8");

describe("mobile companion controls", () => {
  it("provides one enabled tab stop without inventing a selected value", () => {
    for (const Control of [MobileSegmentedControl, MobileFilterChipGroup]) {
      const markup = renderToStaticMarkup(
        <Control
          value="missing"
          ariaLabel="Options"
          onValueChange={() => undefined}
          options={[
            { value: "disabled", label: "Unavailable", disabled: true },
            { value: "first", label: "First" },
            { value: "last", label: "Last" },
          ]}
        />,
      );
      expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
      expect(markup).not.toContain('aria-checked="true"');
      expect(markup).not.toContain("t-tabs-pill");
    }
  });

  it("wraps radio keyboard focus, skips disabled choices and respects text direction", () => {
    const buttons = [false, true, false, false].map((disabled) => ({
      disabled,
      focus: vi.fn(),
      scrollIntoView: vi.fn(),
      click: vi.fn(),
      getAttribute: () => "false",
    }));
    const group = { querySelectorAll: () => buttons };
    const control = MobileSegmentedControl({
      value: "a",
      ariaLabel: "Options",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B", disabled: true },
        { value: "c", label: "C" },
        { value: "d", label: "D" },
      ],
      onValueChange: () => undefined,
    });
    vi.stubGlobal("getComputedStyle", () => ({ direction: "ltr" }));
    try {
      const move = (key: string, index: number) => {
        const event = {
          key,
          target: buttons[index],
          currentTarget: group,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        };
        control.props.onKeyDown(event);
        return event;
      };
      expect(move("ArrowRight", 0).preventDefault).toHaveBeenCalledOnce();
      expect(buttons[2].focus).toHaveBeenCalledOnce();
      expect(buttons[2].click).toHaveBeenCalledOnce();
      move("ArrowDown", 3);
      expect(buttons[0].focus).toHaveBeenCalledOnce();
      expect(buttons[1].focus).not.toHaveBeenCalled();
      move("End", 0);
      move("Home", 2);
      expect(buttons[3].focus).toHaveBeenCalledOnce();
      expect(buttons[0].focus).toHaveBeenCalledTimes(2);
      expect(move("Tab", 0).preventDefault).not.toHaveBeenCalled();
      vi.stubGlobal("getComputedStyle", () => ({ direction: "rtl" }));
      move("ArrowLeft", 0);
      expect(buttons[2].focus).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("labels tab panels while keeping inactive content unmounted", () => {
    const DeferredContent = () => {
      throw new Error("Inactive content must stay deferred");
    };
    const markup = renderToStaticMarkup(
      <MobilePageTabs
        mode="local"
        initialValue="a"
        ariaLabel="Views"
        tabs={[
          { value: "a", label: "Current", content: <p>Current panel</p> },
          { value: "b", label: "Deferred", content: <DeferredContent /> },
        ]}
      />,
    );
    expect(markup.match(/role="tabpanel"/g)).toHaveLength(2);
    for (const match of markup.matchAll(/aria-controls="([^"]+)"/g)) {
      expect(markup).toContain(`id="${match[1]}"`);
    }
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain('hidden=""');
  });
  it("renders segmented choices as one labelled local radio group", () => {
    const markup = renderToStaticMarkup(
      <MobileSegmentedControl
        value="dispersion"
        ariaLabel="Shot pattern view"
        onValueChange={() => undefined}
        options={[
          { value: "dispersion", label: "Dispersion" },
          { value: "flight", label: "Flight" },
        ]}
      />,
    );

    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-label="Shot pattern view"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('data-mobile-control="segmented"');
    expect(markup).not.toContain("href=");
  });

  it("keeps every filter choice an independent full pill", () => {
    const markup = renderToStaticMarkup(
      <MobileFilterChipGroup
        value="driver"
        ariaLabel="Chart club"
        onValueChange={() => undefined}
        options={[
          { value: "driver", label: "Driver" },
          { value: "gw", label: "GW" },
        ]}
      />,
    );

    expect(markup.match(/rounded-\[var\(--mobile-radius-pill\)\]/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="Chart club"');
    expect(markup).not.toContain("first:rounded");
    expect(markup).not.toContain("last:rounded");
  });

  it("uses selectable dots for up to five carousel items and a count beyond five", () => {
    const dots = renderToStaticMarkup(
      <MobileCarouselPagination
        labels={["Driver", "7 iron", "Wedge"]}
        selectedIndex={1}
        onSelect={() => undefined}
        ariaLabel="Choose bag club"
      />,
    );
    const count = renderToStaticMarkup(
      <MobileCarouselPagination
        labels={["1", "2", "3", "4", "5", "6"]}
        selectedIndex={1}
        onSelect={() => undefined}
        ariaLabel="Choose practice block"
      />,
    );

    expect(dots).toContain('aria-label="Choose bag club"');
    expect(dots).toContain('aria-label="Show 7 iron"');
    expect(dots).toContain('aria-current="step"');
    expect(dots.match(/size-11/g)).toHaveLength(3);
    expect(count).toContain("2 of 6");
    expect(count).not.toContain("<button");
  });

  it("supports local tabs without URL mutation and navigable tabs with browser history", () => {
    expect(source).toContain('mode = "navigable"');
    expect(source).toContain('mode === "navigable" && tab.href');
    expect(source).toContain("window.history.pushState");
    expect(source).toContain('window.addEventListener("popstate"');
    expect(source).toContain('window.removeEventListener("popstate"');
    expect(source).not.toContain("window.history.replaceState");
    expect(source).not.toContain('from "next/link"');
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.push");
    expect(source).not.toContain("router.replace");
  });

  it("derives the selected tab from exact, hash-only and query URLs", () => {
    const tabs = [
      {
        value: "yardages",
        label: "Yardages",
        href: "/bag?view=yardages#bag-yardages",
        content: null,
      },
      { value: "target", label: "Target", href: "/bag?view=target#bag-quick", content: null },
    ];

    expect(resolveMobilePageTabValue(tabs, "https://example.test/bag?view=target#bag-quick")).toBe(
      "target",
    );
    expect(resolveMobilePageTabValue(tabs, "https://example.test/bag#bag-quick")).toBe("target");
    expect(resolveMobilePageTabValue(tabs, "https://example.test/bag?view=yardages&peers=1")).toBe(
      "yardages",
    );
    expect(resolveMobilePageTabValue(tabs, "https://example.test/bag?unrelated=1")).toBeNull();
  });
});
