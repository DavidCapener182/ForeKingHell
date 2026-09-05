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
const digitalBookSource = readFileSync(
  join(process.cwd(), "src/app/courses/strategy/digital-caddie-book.tsx"),
  "utf8",
);
const visualSource = readFileSync(
  join(process.cwd(), "src/app/courses/strategy/hole-strategy-visual.tsx"),
  "utf8",
);

describe("course strategy surface split", () => {
  it("loads the companion before the dashboard-backed workbench", () => {
    expect(routeSource).toContain('surface === "companion"');
    expect(routeSource).toContain('await import("./course-strategy-companion-page")');
    expect(routeSource).toContain('await import("./course-strategy-workbench-page")');
    expect(companionSource).toContain("data-course-strategy-companion");
    expect(companionSource).toContain("<MobileHoleStrategy");
    expect(companionSource).toContain("courseTwinAvailable={Boolean(courseTwinManifest)}");
    expect(companionSource).toContain("getCourseTwinManifest");
    expect(companionSource).toContain("courseStrategyMapFromManifest");
    expect(companionSource).toContain("PlaySetupDrawer");
    expect(mobileHoleSource).toContain("<h1>Hole {strategy.holeNumber}</h1>");
    expect(companionSource).not.toContain("IOSGroupedList");
    expect(companionSource).not.toContain("getDashboardData");
  });

  it("renders one mobile hole with a prominent visual and fixed navigation", () => {
    expect(mobileHoleSource).toContain("data-mobile-one-hole-strategy");
    expect(mobileHoleSource).toContain("<HoleStrategyVisual");
    expect(mobileHoleSource).toContain("Recommended play");
    expect(mobileHoleSource).toContain("Club evidence and course detail");
    expect(mobileHoleSource).toContain("evidence.sampleSize");
    expect(mobileHoleSource).toContain("evidence.carryYd");
    expect(mobileHoleSource).toContain("window.history.replaceState");
    expect(mobileHoleSource).toContain("mobileFixedControls");
    expect(mobileHoleSource).toContain('aria-label="Previous hole"');
    expect(mobileHoleSource).toContain('aria-label="Next hole"');
    expect(mobileHoleSource).not.toContain("strategies.map((holeStrategy)");
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
    expect(source).toContain("<DigitalCaddieBook");
    expect(source).toContain("Guided post-round review");
  });

  it("uses the shadcn Textarea for post-round review context", () => {
    const reviewQuestion =
      source.match(/function ReviewQuestion[\s\S]*?function RoundResultCard/)?.[0] ?? "";
    expect(reviewQuestion).toContain("<Textarea");
    expect(reviewQuestion).not.toContain("<textarea");
  });

  it("uses three desktop zones and labels modelled overlay evidence", () => {
    expect(digitalBookSource).toContain('aria-label="Hole navigator"');
    expect(digitalBookSource).toContain("className={styles.mapZone}");
    expect(digitalBookSource).toContain('aria-label="Strategy panel"');
    expect(digitalBookSource).toContain("Safe target");
    expect(digitalBookSource).toContain("Ideal leave");
    expect(digitalBookSource).toContain("Open Course Twin");
    expect(digitalBookSource).toContain("courseMap={courseMap}");
    expect(visualSource).toContain("Recommended landing");
    expect(visualSource).toContain("Measured dispersion");
    expect(visualSource).toContain("Mapped aerial plan");
    expect(visualSource).toContain("Course Twin geometry · personal shot overlay");
    expect(visualSource).toContain("className={styles.visualCanvas}");
    expect(visualSource).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(visualSource).toContain("pointAlongPolyline");
    expect(visualSource).toContain("courseMap.imageUrl");
  });

  it("uses one visible shadcn composition for each workbench mode", () => {
    expect(source).toContain("data-course-strategy-plan");
    expect(source).toContain("data-course-strategy-post-round");
    expect(source).toContain('from "@/components/ui/item"');
    expect(source).toContain("<AlertTitle>No completed round yet</AlertTitle>");
    expect(source).toContain("<AlertTitle>Review context saved</AlertTitle>");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden gap-4 lg:grid"');
    expect(source).not.toMatch(/<article\b/);
    expect(source).not.toContain("rounded-xl border border-dashed p-5");
  });
});
