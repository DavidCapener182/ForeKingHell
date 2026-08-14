import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const welcome = readFileSync(join(root, "src/app/(app)/welcome/page.tsx"), "utf8");
const companion = readFileSync(
  join(root, "src/app/(app)/welcome/welcome-companion-page.tsx"),
  "utf8",
);
const workbench = readFileSync(
  join(root, "src/app/(app)/welcome/welcome-workbench-page.tsx"),
  "utf8",
);
const activation = readFileSync(join(root, "src/lib/activation-journey.ts"), "utf8");
const progressCard = readFileSync(
  join(root, "src/components/app/activation-progress-card.tsx"),
  "utf8",
);

describe("first-use journey", () => {
  it("uses real account state, supports resume, and never imports demo data", () => {
    expect(welcome).toContain("getActivationJourney(userId)");
    expect(welcome).toContain('resume !== "1"');
    expect(companion).toContain("dismissWelcomeAction");
    expect(workbench).toContain("dismissWelcomeAction");
    expect(progressCard).toContain('href="/welcome?resume=1"');
    expect(activation).toContain("providerAccounts");
    expect(activation).toContain("practicePlans");
    expect(activation).not.toContain("marketingDemo");
  });

  it("branches on the requested app surface before importing either UI graph", () => {
    expect(welcome).toContain("getRequestAppSurface()");
    expect(welcome).toContain('surface === "companion"');
    expect(welcome).toContain('await import("./welcome-companion-page")');
    expect(welcome).toContain('await import("./welcome-workbench-page")');
    expect(welcome.indexOf("getRequestAppSurface()")).toBeLessThan(
      welcome.indexOf('await import("./welcome-companion-page")'),
    );
    expect(welcome.indexOf('surface === "companion"')).toBeLessThan(
      welcome.indexOf('await import("./welcome-companion-page")'),
    );
    expect(welcome).not.toMatch(/^import .*MobileWelcomeJourney/m);
    expect(welcome).not.toMatch(/^import .*PageShell/m);
    expect(welcome).not.toMatch(/^import .*welcome-(?:companion|workbench)-page/m);
    expect(welcome).not.toContain("<MobileAppShell>");
    expect(welcome).not.toContain("data-welcome-workbench");
    expect(welcome).not.toMatch(/className=["'][^"']*\bhidden\b/);
  });

  it("keeps the native companion checklist out of the workbench module graph", () => {
    expect(companion).toContain("<MobileAppShell>");
    expect(companion).toContain("IOSGroupedList");
    expect(companion).toContain("IOSInlineStatus");
    expect(companion).toContain('next?.href ?? "/today"');
    expect(companion).toContain("var(--status-success-foreground)");
    expect(companion).not.toContain("welcome-workbench-page");
    expect(companion).not.toContain("data-welcome-workbench");
    expect(companion).not.toContain("Get to the first insight you can trust.");
    expect(companion).not.toContain("text-emerald-");

    expect(workbench).toContain("data-welcome-workbench");
    expect(workbench).toContain("Get to the first insight you can trust.");
    expect(workbench).not.toContain("welcome-companion-page");
    expect(workbench).not.toContain("MobileAppShell");
    expect(workbench).not.toContain("MobileWelcomeJourney");
    expect(workbench).not.toContain("IOSGroupedList");
  });

  it("does not use viewport-hidden composition gates for either requested surface", () => {
    for (const source of [companion, workbench]) {
      expect(source).not.toMatch(/className=["'][^"']*\bhidden\b/);
      expect(source).not.toMatch(/\blg:(?:block|flex|grid|hidden)\b/);
    }
    expect(workbench).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(workbench).toContain("sm:flex-row");
  });
});
