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
    expect(practiceWorkbenchSource).toContain(
      'className="grid gap-3 lg:grid-cols-12 lg:items-start"',
    );
    expect(practiceWorkbenchSource).toContain(
      'className="min-w-0 lg:sticky lg:top-4 lg:self-start"',
    );
    expect(practiceWorkbenchSource).not.toMatch(/MobileAppShell|MobileFilterSheet|IOS[A-Z]/);
    expect(practiceWorkbenchSource).not.toContain("PracticeMobile");
  });

  it("bounds the real companion practice carousel to the phone viewport", () => {
    expect(practiceCompanionSource).toContain("<OperationStepper");
    expect(practiceCompanionSource).toContain("<Carousel");
    expect(practiceCompanionSource).toContain("w-full min-w-0 max-w-full overflow-hidden");
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
