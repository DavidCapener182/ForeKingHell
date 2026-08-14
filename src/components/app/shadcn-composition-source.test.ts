import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("shared shadcn application compositions", () => {
  it("builds the generic result hero from the required card primitives", () => {
    const resultHero = source("src/components/app/result-hero.tsx");

    for (const primitive of [
      "CardHeader",
      "CardContent",
      "CardFooter",
      "Badge",
      "Separator",
      "ButtonGroup",
    ]) {
      expect(resultHero).toContain(primitive);
    }
    expect(resultHero).toContain("bg-card");
    expect(resultHero).not.toContain("<section");
    expect(resultHero).not.toContain("<dl");
  });

  it("uses connected Card and Separator primitives for metric rows", () => {
    const metricBar = source("src/components/app/connected-metric-bar.tsx");

    expect(metricBar).toContain("@/components/ui/card");
    expect(metricBar).toContain("@/components/ui/separator");
    expect(metricBar).toContain("<Card");
    expect(metricBar).toContain("<Separator");
  });

  it("uses theme-aware shadcn chart and badge primitives for trend metrics", () => {
    const trendCard = source("src/components/app/metric-trend-card.tsx");

    expect(trendCard).toContain("@/components/ui/badge");
    expect(trendCard).toContain("ChartContainer");
    expect(trendCard).toContain("ChartTooltip");
    expect(trendCard).toContain("ChartTooltipContent");
    expect(trendCard).not.toContain("<svg");
  });

  it("composes timelines and steppers from the checklist primitives", () => {
    const timeline = source("src/components/app/status-timeline.tsx");
    const stepper = source("src/components/app/operation-stepper.tsx");
    const operationStatus = source("src/components/app/operation-status.tsx");

    expect(timeline).toContain("<ScrollArea");
    expect(timeline).toContain("<Separator");
    expect(timeline).toContain("<Badge");
    expect(stepper).toContain("<Progress");
    expect(stepper).toContain("<Separator");
    expect(stepper).toContain("<Badge");
    expect(operationStatus).toContain("<Alert");
    expect(operationStatus).toContain("<Progress");
    expect(operationStatus).toContain("<Spinner");
  });

  it("uses Card, Separator and ButtonGroup for dirty form actions", () => {
    const dirtyFormBar = source("src/components/app/dirty-form-bar.tsx");

    expect(dirtyFormBar).toContain("<Card");
    expect(dirtyFormBar).toContain("<Separator");
    expect(dirtyFormBar).toContain("<ButtonGroup");
    expect(dirtyFormBar).not.toContain("<aside");
  });

  it("keeps command UI theme-safe and includes all required command primitives", () => {
    const appCommand = source("src/components/app/app-command-menu.tsx");
    const desktopCommand = source("src/components/app/desktop-command-palette.tsx");

    expect(appCommand).toContain("CommandSeparator");
    expect(appCommand).toContain("CommandShortcut");
    expect(desktopCommand).toContain("CommandSeparator");
    expect(desktopCommand).toContain("CommandShortcut");
    for (const hardCodedSurface of ["bg-white", "text-emerald", "border-emerald"]) {
      expect(desktopCommand).not.toContain(hardCodedSurface);
    }
  });

  it("keeps shared metric, status and workbench shadcn wrappers theme-safe", () => {
    const metric = source("src/components/app/metric-card.tsx");
    const workbench = source("src/components/app/desktop-workbench-chrome.tsx");
    const saveInsight = source("src/components/app/desktop-save-insight-button.tsx");
    const evidence = source("src/components/app/evidence-status.tsx");

    for (const candidate of [metric, workbench, saveInsight, evidence]) {
      expect(candidate).not.toMatch(/(?:bg|text|border|ring)-(?:emerald|sky|pink|amber|slate)-/);
    }
    expect(metric).toContain("var(--status-success-surface)");
    expect(workbench).not.toContain("bg-white");
    expect(workbench).not.toContain("bg-[#FFFDF8]");
    expect(saveInsight).toContain("<Button");
    expect(evidence).toContain("var(--status-warning-surface)");
  });

  it("keeps shared filters, notifications, workspace switching and feature panels semantic", () => {
    const dateFilter = source("src/components/app/date-filter-popover.tsx");
    const notifications = source("src/components/app/workbench/notification-centre.tsx");
    const workspaceSwitcher = source("src/components/app/workbench/workspace-switcher.tsx");
    const featurePanels = source("src/components/features/feature-panels.tsx");
    const fixedPaletteClass =
      /(?:bg|text|border|ring|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|\/|\b)|(?:bg|text|border|ring)-\[#|#[0-9a-f]{3,8}\b|rgba?\(/i;

    for (const candidate of [dateFilter, notifications, workspaceSwitcher, featurePanels]) {
      expect(candidate).not.toMatch(fixedPaletteClass);
    }
    expect(dateFilter).toContain("bg-card");
    expect(notifications).toContain("bg-card");
    expect(notifications).toContain("bg-primary");
    expect(notifications).toContain("text-primary-foreground");
    expect(notifications).toContain("var(--confidence-high)");
    expect(workspaceSwitcher).toContain("bg-secondary text-secondary-foreground");
    expect(featurePanels).toContain("border-border bg-card");
    expect(featurePanels).toContain("var(--status-success-surface)");
  });

  it("keeps the high-contrast body on the active semantic background without artwork", () => {
    const globals = source("src/app/globals.css");
    const highContrastBody =
      globals.match(/html\[data-theme="high-contrast"\] body \{[\s\S]*?\n  \}/)?.[0] ?? "";

    expect(highContrastBody).toContain("background: var(--background)");
    expect(highContrastBody).toContain("background-image: none");
    expect(highContrastBody).toContain("background-attachment: scroll");
    expect(highContrastBody).not.toMatch(/gradient\(|#[0-9a-f]{3,8}|rgba?\(/i);
  });

  it("uses Collapsible for the shared progressive-disclosure utility", () => {
    const premium = source("src/components/premium.tsx");

    expect(premium).toContain("<Collapsible");
    expect(premium).toContain("<CollapsibleTrigger");
    expect(premium).toContain("<CollapsibleContent");
    expect(premium).not.toContain("<details");
  });
});
