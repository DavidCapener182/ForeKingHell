import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemePreferenceSelect } from "@/components/theme-preference-select";

const source = readFileSync(
  join(process.cwd(), "src/components/theme-preference-select.tsx"),
  "utf8",
);

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

    expect(markup).toContain("Clubhouse Manager");
    expect(markup).not.toContain('data-slot="card"');
    expect(markup).toContain('data-slot="select-trigger"');
    expect(markup).toContain('name="theme"');
    expect(markup).toContain('data-theme-swatch="clubhouse"');

    expect(source).toContain("themeOptions.map");
    expect(source).toContain("<SelectItem");
    expect(source).toContain("previewThemePreference(value as ThemePreference)");
    expect(source).not.toContain("@/components/ui/card");
    expect(source).not.toContain("<Card");
    expect(source).not.toContain('type="radio"');

    for (const theme of [
      "system",
      "light",
      "dark",
      "clubhouse",
      "outdoor",
      "range-night",
      "tour-broadcast",
      "high-contrast",
    ]) {
      expect(source).toContain(theme);
    }
  });
});
