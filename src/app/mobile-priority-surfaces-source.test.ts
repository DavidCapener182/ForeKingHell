import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clubAnalyticsSource = readFileSync(
  join(process.cwd(), "src/app/(app)/bag/[clubId]/analytics/page.tsx"),
  "utf8",
);
const clubProfileSource = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-analysis-tabs.tsx"),
  "utf8",
);
const practiceWorkbenchSource = readFileSync(
  join(process.cwd(), "src/app/practice/practice-planner-client.tsx"),
  "utf8",
);
const practiceCompanionSource = readFileSync(
  join(process.cwd(), "src/app/practice/practice-companion-client.tsx"),
  "utf8",
);
const speedSource = readFileSync(join(process.cwd(), "src/app/(app)/speed/page.tsx"), "utf8");

describe("priority authenticated responsive surfaces", () => {
  it("keeps desktop-only analytics and speed workbenches free of obsolete mobile trees", () => {
    for (const source of [clubAnalyticsSource, speedSource]) {
      expect(source).toContain("DesktopWorkbenchLayout");
      expect(source).not.toMatch(/MobileAppShell|MobileRouteHeader|IOS[A-Z]/);
      expect(source).not.toMatch(/lg:hidden|hidden lg:/);
    }

    expect(clubAnalyticsSource).toContain("bg-primary text-primary-foreground");
    expect(clubAnalyticsSource).toContain("text-[var(--status-success-foreground)]");
  });

  it("keeps the desktop practice workflow single-column and separated from companion UI", () => {
    expect(practiceWorkbenchSource).toContain("data-practice-training-workspace");
    expect(practiceWorkbenchSource).toContain(
      "xl:grid-cols-[minmax(15rem,0.72fr)_minmax(34rem,1.8fr)_minmax(17rem,0.78fr)]",
    );
    expect(practiceWorkbenchSource).toContain('className="min-w-0 xl:sticky xl:top-4"');
    expect(practiceWorkbenchSource).toContain(
      'className="min-w-0 xl:sticky xl:top-4 xl:self-start"',
    );
    expect(practiceWorkbenchSource).not.toMatch(/MobileAppShell|MobileFilterSheet|IOS[A-Z]/);
    expect(practiceWorkbenchSource).not.toContain("PracticeMobile");
  });

  it("bounds the real companion practice carousel to the phone viewport", () => {
    expect(practiceCompanionSource).toContain("<OperationStepper");
    expect(practiceCompanionSource).toContain("<Carousel");
    expect(practiceCompanionSource).toContain('className="w-full min-w-0 max-w-full"');
    expect(practiceCompanionSource).toContain("basis-[calc(100%-2rem)]");
    expect(practiceCompanionSource).toContain("<Textarea");
    expect(practiceCompanionSource).not.toContain("<textarea");
    expect(practiceCompanionSource).not.toContain("w-fit min-w-[504px]");
  });

  it("retains dark backgrounds only for genuine data visualisations", () => {
    expect(clubAnalyticsSource).toContain("bg-[#0b1411]");
    expect(clubProfileSource).toContain("bg-[#172f1d]");
    expect(speedSource).toContain("bg-[#111611]");
  });
});
