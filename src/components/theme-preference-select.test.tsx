import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemePreferenceSelect } from "@/components/theme-preference-select";

describe("ThemePreferenceSelect", () => {
  it("labels product themes as a saved desktop preference while mobile follows the system", () => {
    const markup = renderToStaticMarkup(<ThemePreferenceSelect defaultValue="clubhouse" />);

    expect(markup).toContain("Mobile appearance");
    expect(markup).toContain("system Light or Dark mode");
    expect(markup).toContain("Desktop appearance");
    expect(markup).toContain("does not change the mobile appearance above");
    expect(markup).toContain("Mobile remains automatic");
    expect(markup).toContain("data-mobile-appearance-note");
    expect(markup).toContain('data-mobile-surface="secondary"');
    expect(markup).toContain("lg:hidden");
    expect(markup).toContain("hidden text-xs");
    expect(markup).toContain("lg:inline");

    expect(markup).toContain("Use device setting");
    expect(markup).toContain("Light");
    expect(markup).toContain("Dark");
    expect(markup).toContain("Clubhouse Manager");
    expect(markup).toContain("Outdoor Mode");
    expect(markup).toContain("Range Night");
    expect(markup).toContain("Tour Broadcast");
    expect(markup).toContain("High Contrast");
    expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="clubhouse"/);
    expect(markup).toMatch(/<input[^>]*name="theme"[^>]*value="tour-broadcast"/);
  });
});
