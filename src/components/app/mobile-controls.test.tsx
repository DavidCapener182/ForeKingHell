import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MobileCarouselPagination,
  MobileFilterChipGroup,
  MobileSegmentedControl,
  resolveMobilePageTabValue,
} from "@/components/app/mobile-controls";

const source = readFileSync(join(process.cwd(), "src/components/app/mobile-controls.tsx"), "utf8");

describe("mobile companion controls", () => {
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
