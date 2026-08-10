import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QuickRangeSession } from "@/app/practice/quick-range/quick-range-session";

describe("QuickRangeSession mobile task flow", () => {
  it("puts the real focus, current block and start action before supporting controls", () => {
    const html = renderToStaticMarkup(<QuickRangeSession focus="Driver start-line control" />);

    expect(html).toContain("data-quick-range-mobile");
    expect(html).toContain("Driver start-line control");
    expect(html).toContain("Block 1 of 3");
    expect(html).toContain("Start guided session");
    expect(html.indexOf("Start guided session")).toBeLessThan(html.indexOf("Session controls"));
  });

  it("keeps setup, plan and scoring methodology in accessible one-level disclosures", () => {
    const html = renderToStaticMarkup(<QuickRangeSession focus="Wedge distance control" />);

    expect(html).toContain('aria-label="Quick Range supporting controls"');
    expect(html).toContain("Club and display");
    expect(html).toContain("Three-block plan");
    expect(html).toContain("How results are scored");
    expect(html).toContain("Guidance and manual labels do not claim performance");
    expect(html).toContain("data-quick-range-desktop");
  });
});
