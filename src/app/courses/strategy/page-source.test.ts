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

describe("course strategy mode-aware mobile hierarchy", () => {
  it("loads the companion before the dashboard-backed workbench", () => {
    expect(routeSource).toContain('surface === "companion"');
    expect(routeSource).toContain('await import("./course-strategy-companion-page")');
    expect(routeSource).toContain('await import("./course-strategy-workbench-page")');
    expect(companionSource).toContain("data-course-strategy-companion");
    expect(companionSource).toContain("<MobileHoleStrategy");
    expect(companionSource).toContain("courseTwinAvailable={courseTwinAvailable}");
    expect(companionSource).toContain("listAvailableCourseTwins(userId)");
    expect(companionSource).toContain("PlaySetupDrawer");
    expect(companionSource).not.toContain("getDashboardData");
  });

  it("uses carousel semantics, compact progress and explicit hole controls", () => {
    expect(mobileHoleSource).toContain('aria-roledescription="carousel"');
    expect(mobileHoleSource).toContain('aria-roledescription="slide"');
    expect(mobileHoleSource).toContain("<Progress");
    expect(mobileHoleSource).toContain("Hole {strategy.holeNumber} of {strategies.length}");
    expect(mobileHoleSource).toContain('aria-label="Previous hole"');
    expect(mobileHoleSource).toContain('aria-label="Next hole"');
  });

  it("renders every pre-round planning surface only in pre mode", () => {
    expect(source).toContain(
      "<MobilePreRoundStrategy data={data} strategyData={strategyData} accountId={userId} />",
    );
    expect(source).toContain('{mode === "pre" ? (\n        <section');
    expect(source).toContain('className="hidden gap-4 rounded-2xl border bg-card p-4 lg:grid"');
    expect(source.match(/<MobilePreRoundStrategy/g)).toHaveLength(1);
    expect(source).toContain("data-mobile-pre-round-strategy");
    expect(source).toContain('mode === "post" ? "post" : "pre"');
  });

  it("puts the answer, warning and Prepare round action before hole disclosure", () => {
    const mobile = source.slice(
      source.indexOf("function MobilePreRoundStrategy"),
      source.indexOf("function MobilePostRoundStrategy"),
    );

    expect(mobile.indexOf('title="Overall strategy"')).toBeLessThan(
      mobile.indexOf('title="A plan is not a live caddie"'),
    );
    expect(mobile.indexOf("Prepare round")).toBeLessThan(
      mobile.indexOf('title="Hole-by-hole plan"'),
    );
    expect(mobile).toContain("<MobileHoleStrategy");
    expect(mobile).toContain("strategies={strategies}");
    expect(mobile).toContain("accountId={accountId}");
  });

  it("keeps secondary course selection and evidence one level deep", () => {
    const mobile = source.slice(
      source.indexOf("function MobilePreRoundStrategy"),
      source.indexOf("function MobilePostRoundStrategy"),
    );

    expect(mobile).toContain('label="Course selection"');
    expect(mobile).toContain('label="Supporting course evidence"');
    expect(mobile).toContain('<Select name="courseId"');
    expect(mobile).toContain('<SelectTrigger className="min-h-11 w-full">');
    expect(mobile).toContain('className="min-h-11 w-full rounded-xl"');
  });

  it("puts the post-round answer and practice action before review controls on phones", () => {
    const mobile = source.slice(
      source.indexOf("function MobilePostRoundStrategy"),
      source.indexOf("function mobileReviewConfidenceTone"),
    );

    expect(source).toContain(
      '<MobilePostRoundStrategy postRoundData={postRoundData} saved={params?.saved === "1"} />',
    );
    expect(source).toContain('className="hidden gap-4 lg:grid"');
    expect(mobile.indexOf('title="What the round changed"')).toBeLessThan(
      mobile.indexOf('title="Practise this next"'),
    );
    expect(mobile.indexOf('title="Practise this next"')).toBeLessThan(
      mobile.indexOf('title: "Add review context"'),
    );
    expect(mobile).toContain('label="Post-round review controls and evidence"');
    expect(mobile).toContain('className="min-h-11 w-full min-w-0');
    expect(mobile).not.toContain("<details");
  });
});
