import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemePreferenceSelect } from "@/components/theme-preference-select";

describe("ThemePreferenceSelect", () => {
  it("renders the four persisted appearance choices and checks Clubhouse Manager", () => {
    const markup = renderToStaticMarkup(<ThemePreferenceSelect defaultValue="clubhouse" />);

    expect(markup).toContain("Use device setting");
    expect(markup).toContain("Light");
    expect(markup).toContain("Dark");
    expect(markup).toContain("Clubhouse Manager");
    expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="clubhouse"/);
  });
});
