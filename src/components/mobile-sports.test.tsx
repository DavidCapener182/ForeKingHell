import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MobileRouteHeader, MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";

describe("mobile page headers", () => {
  it("renders a single semantic, wrapping title in a top bar", () => {
    const markup = renderToStaticMarkup(<MobileTopBar title="A very long course record title" />);

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("data-mobile-route-label");
    expect(markup).toContain("break-words");
    expect(markup).not.toContain("truncate");
  });

  it("keeps route tabs outside the semantic page title", () => {
    const markup = renderToStaticMarkup(
      <MobileRouteHeader title="Performance Lab" group="analyse" activeKey="simulator-lab" />,
    );

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("Performance Lab");
    expect(markup).toContain("<nav");
  });
});

describe("MobileStatusAction", () => {
  it("wraps important real values instead of silently truncating them", () => {
    const markup = renderToStaticMarkup(
      <MobileStatusAction
        label="Current leader"
        value="A golfer with an unusually long profile name"
        detail="Verified course record"
      />,
    );

    expect(markup).toContain("break-words");
    expect(markup).toContain("overflow-wrap:anywhere");
    expect(markup).not.toContain("truncate");
  });
});
