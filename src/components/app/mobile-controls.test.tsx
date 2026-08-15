import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MobileFilterChipGroup, MobileSegmentedControl } from "@/components/app/mobile-controls";

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

  it("synchronises page-section URLs without Next router or document navigation", () => {
    expect(source).toContain("window.history.replaceState");
    expect(source).not.toContain('from "next/link"');
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.push");
    expect(source).not.toContain("router.replace");
    expect(source).not.toContain("window.location");
  });
});
