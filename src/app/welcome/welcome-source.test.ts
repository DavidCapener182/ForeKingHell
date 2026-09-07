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

const journeySource = readFileSync(join(root, "src/app/welcome/welcome-journey.tsx"), "utf8");
const skipSource = readFileSync(join(root, "src/app/welcome/welcome-skip.tsx"), "utf8");
describe("first-use journey", () => {
  it("uses real account state, supports resume, and never imports demo data", () => {
    expect(welcome).toContain("getActivationJourney(userId)");
    expect(welcome).toContain('resume !== "1"');
    expect(journeySource).toContain("<WelcomeSkip");
    expect(skipSource).toContain("dismissWelcomeStateAction");
    expect(skipSource).toContain('role="alert"');
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

  it("shares an evidence-backed checklist across both selected entry points", () => {
    for (const entry of [companion, workbench]) {
      expect(entry).toContain("<WelcomeJourney journey={journey} />");
    }
    expect(journeySource).toContain('aria-label="Setup checklist"');
    expect(journeySource).toContain('aria-current={step.id === next?.id ? "step" : undefined}');
    expect(journeySource).toContain('next?.href ?? "/today"');
    expect(journeySource).toContain("No completed steps are inferred.");
    expect(journeySource).toContain("Opening a step does not mark it complete.");
    expect(journeySource).toContain("journey.steps.filter((step) => step.complete).length");
    expect(journeySource).toContain("Skipping does not delete data or disable golf features.");
  });

  it("renders a single responsive checklist without viewport-hidden duplicate trees", () => {
    for (const source of [companion, workbench, journeySource]) {
      expect(source).not.toMatch(/className=["'][^"']*\bhidden\b/);
      expect(source).not.toMatch(/\blg:(?:block|flex|grid|hidden)\b/);
    }
    expect(journeySource).toContain("md:grid-cols-[minmax(0,1fr)_auto]");
    expect(journeySource).toContain("<progress");
    expect(journeySource).toContain('aria-label="Setup evidence progress"');
  });
});
