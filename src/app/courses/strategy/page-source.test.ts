import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/strategy/course-strategy-workbench-page.tsx"),
  "utf8",
);
const companionSource = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/strategy/course-strategy-companion-page.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/strategy/page.tsx"),
  "utf8",
);
const mobileHoleSource = readFileSync(
  join(process.cwd(), "src/app/courses/strategy/mobile-hole-strategy.tsx"),
  "utf8",
);

describe("course strategy surface split", () => {
  it("loads the companion before the dashboard-backed workbench", () => {
    expect(routeSource).toContain('surface === "companion"');
    expect(routeSource).toContain('await import("./course-strategy-companion-page")');
    expect(routeSource).toContain('await import("./course-strategy-workbench-page")');
    expect(companionSource).toContain("data-course-strategy-companion");
    expect(companionSource).toContain("<MobileHoleStrategy");
    expect(companionSource).toContain("courseTwinAvailable={courseTwinAvailable}");
    expect(companionSource).toContain("listAvailableCourseTwins(userId)");
    expect(companionSource).toContain("PlaySetupDrawer");
    expect(companionSource).toContain("<StrategySummaryItem");
    expect(companionSource).toContain("<Item");
    expect(companionSource).not.toContain("IOSGroupedList");
    expect(companionSource).not.toContain("getDashboardData");
  });

  it("uses carousel semantics, compact progress and explicit hole controls", () => {
    expect(mobileHoleSource).toContain("<Carousel");
    expect(mobileHoleSource).toContain("<CarouselContent");
    expect(mobileHoleSource).toContain("<CarouselItem");
    expect(mobileHoleSource).toContain("<CarouselPrevious");
    expect(mobileHoleSource).toContain("<CarouselNext");
    expect(mobileHoleSource).toContain("valueAsBadge");
    expect(mobileHoleSource).toContain("<Progress");
    expect(mobileHoleSource).toContain("Hole {strategy.holeNumber} of {strategies.length}");
    expect(mobileHoleSource).toContain('aria-label="Previous hole"');
    expect(mobileHoleSource).toContain('aria-label="Next hole"');
  });

  it("keeps companion and iOS rendering out of the workbench bundle", () => {
    for (const legacyMobileSymbol of [
      "MobilePreRoundStrategy",
      "MobilePostRoundStrategy",
      "MobileHoleStrategy",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSSectionHeader",
      "data-mobile-pre-round-strategy",
      "data-mobile-post-round-strategy",
    ]) {
      expect(source).not.toContain(legacyMobileSymbol);
    }

    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain("@/app/courses/strategy/mobile-hole-strategy");
    expect(source).toContain("Hole-by-hole plan");
    expect(source).toContain("Guided post-round review");
  });

  it("uses the shadcn Textarea for post-round review context", () => {
    const reviewQuestion =
      source.match(/function ReviewQuestion[\s\S]*?function RoundResultCard/)?.[0] ?? "";
    expect(reviewQuestion).toContain("<Textarea");
    expect(reviewQuestion).not.toContain("<textarea");
  });

  it("renders the hole hazard as a semantic shadcn alert", () => {
    const hazard =
      source.match(
        /<Alert className="border-\[var\(--status-warning-border\)\][\s\S]*?<\/Alert>/,
      )?.[0] ?? "";

    expect(source).toContain("import { Alert, AlertDescription, AlertTitle }");
    expect(hazard).toContain("<AlertTitle>Hazard check</AlertTitle>");
    expect(hazard).toContain("var(--status-warning-surface)");
    expect(hazard).not.toContain("bg-amber-50");
  });

  it("uses one visible shadcn composition for each workbench mode", () => {
    expect(source).toContain("data-course-strategy-plan");
    expect(source).toContain("data-course-strategy-post-round");
    expect(source).toContain('from "@/components/ui/item"');
    expect(source).toContain("<Item key={strategy.holeNumber}");
    expect(source).toContain("<AlertTitle>No completed round yet</AlertTitle>");
    expect(source).toContain("<AlertTitle>Review context saved</AlertTitle>");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden gap-4 lg:grid"');
    expect(source).not.toMatch(/<article\b/);
    expect(source).not.toContain("rounded-xl border border-dashed p-5");
  });
});
