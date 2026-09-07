import { describe, expect, it } from "vitest";
import { companionDestination, hasDirectCompanionRoute } from "./companion-destination";
describe("legacy companion destination recovery", () => {
  it("retains repeated filters and fragments on the actual normalized local path", () => {
    expect(
      companionDestination(
        "/progress/?compareClub=7i&compareMeasure=carry&session=a&session=b#comparison",
      ),
    ).toBe("/progress?compareClub=7i&compareMeasure=carry&session=a&session=b#comparison");
    expect(companionDestination("/courses/../progress?x=1")).toBe("/progress?x=1");
  });
  it("rejects external and internal loop destinations", () => {
    for (const value of [
      "//evil.invalid",
      "/\\evil.invalid",
      "/companion/handoff?from=/today",
      "/companion/summary",
      "/companion-runtime/rounds",
      "/surface/companion",
      "/%2e%2e/companion/summary",
      "/admin\n",
    ]) {
      expect(companionDestination(value)).toBe("/today");
    }
  });
  it("promotes only known destinations permitted by both actual proxy capability checks", () => {
    expect(hasDirectCompanionRoute("/progress?compareClub=7i")).toBe(true);
    expect(hasDirectCompanionRoute("/admin")).toBe(true);
    expect(hasDirectCompanionRoute("/admin/unsupported")).toBe(false);
    expect(hasDirectCompanionRoute("/unknown")).toBe(false);
    expect(hasDirectCompanionRoute("/progress/unimplemented")).toBe(false);
    expect(hasDirectCompanionRoute("/coach/unimplemented")).toBe(false);
  });
});
