import { describe, expect, it } from "vitest";
import { appSurfaceHref } from "./app-surface-navigation";

describe("surface navigation preserves task context", () => {
  it.each(["companion", "workbench"] as const)(
    "retains entity, repeated filters and fragment for %s",
    (surface) => {
      const location =
        "/progress?compareClub=club-7&compareMeasure=carry&source=range&source=sim#comparison";
      const href = new URL(appSurfaceHref(surface, location), "https://example.test");
      expect(href.pathname).toBe(`/surface/${surface}`);
      expect(href.searchParams.get("next")).toBe(location);
    },
  );

  it("encodes a saved draft reference without changing its value", () => {
    const location = "/practice?planId=saved-plan&name=Iron%20%26%20wedge";
    const href = new URL(appSurfaceHref("workbench", location), "https://example.test");
    expect(href.searchParams.get("next")).toBe(location);
  });

  it.each(["https://elsewhere.test", "//elsewhere.test", "/\\elsewhere.test", ""])(
    "falls back for non-local destinations: %s",
    (location) => {
      expect(appSurfaceHref("companion", location)).toBe("/surface/companion?next=%2Ftoday");
    },
  );
});
