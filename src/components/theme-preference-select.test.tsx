import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemePreferenceSelect } from "@/components/theme-preference-select";

describe("ThemePreferenceSelect", () => {
  it("renders every persisted appearance choice and checks Clubhouse Manager", () => {
    const markup = renderToStaticMarkup(<ThemePreferenceSelect defaultValue="clubhouse" />);

    expect(markup).toContain("Use device setting");
    expect(markup).toContain("Light");
    expect(markup).toContain("Dark");
    expect(markup).toContain("Clubhouse Manager");
    expect(markup).toContain("Outdoor Mode");
    expect(markup).toContain("Range Night");
    expect(markup).toContain("Tour Broadcast");
    expect(markup).toContain("High Contrast");
    expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="clubhouse"/);
  });
});
