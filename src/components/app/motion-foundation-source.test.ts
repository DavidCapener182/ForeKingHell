import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("shared motion foundation", () => {
  const motion = source("src/app/motion.css");

  it("loads one global motion layer with the complete product hook vocabulary", () => {
    expect(source("src/app/layout.tsx")).toContain('import "./motion.css"');

    for (const hook of [
      ".t-dropdown",
      ".t-modal",
      ".t-panel-slide",
      ".t-route-step",
      ".t-text-state",
      ".t-icon-swap",
      ".t-success-check",
      ".t-badge",
      ".t-skel",
      ".t-shimmer",
      ".t-tooltip",
      ".t-tabs-pill",
      ".t-acc-content",
      ".t-toast",
      ".t-input.is-shaking",
      ".t-check",
      ".t-toggle",
      ".t-like",
      ".t-learn",
      ".t-stagger",
      ".t-number-pop",
    ]) {
      expect(motion).toContain(hook);
    }
  });

  it("keeps professional UI motion bounded and accessible", () => {
    for (const token of [
      "--duration-micro: 80ms",
      "--duration-quick: 120ms",
      "--duration-fast: 180ms",
      "--duration-medium: 220ms",
      "--duration-slow: 250ms",
    ]) {
      expect(motion).toContain(token);
    }

    expect(motion).not.toMatch(/transition:\s*all/);
    expect(motion).not.toMatch(/transform:\s*scale\(0(?:\)|[, ])/);
    expect(motion).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motion).toContain('.t-success-check[data-draw="true"] svg path');
    expect(motion).toContain('.t-success-check[data-state="in"][data-draw="true"] svg path');
    expect(motion).toContain('.t-modal:has([data-slot="command"])');
  });

  it("wires shared Radix surfaces without stacking their old animation utilities", () => {
    const contracts = [
      ["src/components/ui/dropdown-menu.tsx", "t-dropdown"],
      ["src/components/ui/select.tsx", "t-dropdown"],
      ["src/components/ui/popover.tsx", "t-dropdown"],
      ["src/components/ui/dialog.tsx", "t-modal"],
      ["src/components/ui/alert-dialog.tsx", "t-modal"],
      ["src/components/ui/sheet.tsx", "t-sheet"],
      ["src/components/ui/accordion.tsx", "t-acc-content"],
      ["src/components/ui/collapsible.tsx", "t-acc-content"],
      ["src/components/ui/checkbox.tsx", "t-check"],
      ["src/components/ui/switch.tsx", "t-toggle"],
      ["src/components/ui/skeleton.tsx", "t-skel-skeleton"],
      ["src/components/ui/tabs.tsx", "t-tabs-trigger"],
      ["src/components/ui/tooltip.tsx", "t-tooltip"],
    ] as const;

    for (const [path, hook] of contracts) {
      const component = source(path);
      expect(component).toContain(hook);
      expect(component).not.toContain("data-open:animate-in");
      expect(component).not.toContain("data-closed:animate-out");
    }
  });

  it("keeps collapsible spacing inside the animated height boundary", () => {
    const collapsible = source("src/components/ui/collapsible.tsx");
    const premium = source("src/components/premium.tsx");

    expect(collapsible).toContain('className={cn("t-acc-content", outerClassName)}');
    expect(collapsible).toContain('className={cn("t-acc-panel-inner", className)}');
    expect(premium).toContain(
      '<CollapsibleContent className="contents" outerClassName="contents">',
    );
  });

  it("pulses shared skeletons once, then leaves their fallback visible", () => {
    const skeleton = source("src/components/ui/skeleton.tsx");

    expect(skeleton).toContain("t-skel-skeleton is-pulsing");
    expect(skeleton).not.toContain("animate-pulse");
    expect(motion).toContain("--pulse-dur: 900ms");
    expect(motion).toContain("--pulse-count: 1");
    expect(motion).toMatch(/@keyframes t-skeleton-pulse[\s\S]*?0%,\s*100%\s*{\s*opacity:\s*1;/);
  });

  it("arms keyed text motion only after a state change", () => {
    const copyButton = source("src/components/social/copy-share-image-button.tsx");

    expect(motion).toContain('.t-text-state[data-motion-ready="true"]');
    expect(motion).not.toMatch(/\/\* React callers key[\s\S]*?\n\.t-text-state\s*\{/);
    expect(copyButton).toContain('copyStatus !== "idle" ? "true" : "false"');
  });

  it("preserves indeterminate checkboxes and arms switch travel after interaction", () => {
    const checkbox = source("src/components/ui/checkbox.tsx");
    const toggle = source("src/components/ui/switch.tsx");

    expect(checkbox).toContain("forceMount");
    expect(motion).toContain('.t-check[data-state="indeterminate"] .t-check-indicator');
    expect(motion).toContain('.t-check[aria-checked="mixed"] .t-check-indicator');
    expect(toggle).toContain('data-motion-ready={motionReady ? "true" : "false"}');
    expect(toggle).toContain("onPointerDown?.(event)");
    expect(toggle).toContain("onKeyDown?.(event)");
    expect(toggle).toContain("keyboardActivationRef.current = true");
    expect(toggle).toContain("setMotionReady(false)");
    expect(toggle).toContain("keyboardResetTimerRef.current = window.setTimeout");
    expect(toggle).toContain("window.clearTimeout(keyboardResetTimerRef.current)");
    expect(toggle).not.toContain("queueMicrotask");
    expect(toggle).toContain("onClick?.(event)");
    expect(toggle).toContain("!keyboardActivation");
    expect(motion).toContain('.t-toggle[data-motion-ready="true"]');
    expect(motion).toContain('.t-toggle[data-motion-ready="true"] .t-toggle-thumb');
  });

  it("keeps restrained like feedback available on touch screens", () => {
    const likePress = motion.indexOf(".t-like:active .t-like-icon");
    const hoverGate = motion.indexOf("@media (hover: hover) and (pointer: fine)");

    expect(likePress).toBeGreaterThan(-1);
    expect(hoverGate).toBeGreaterThan(likePress);
  });

  it("moves the equal-width segmented pill with transform only", () => {
    const segmented = source("src/components/app/segmented-control.tsx");
    const mobileSegmented = source("src/components/app/mobile-controls.tsx");

    expect(segmented).toContain("t-tabs-pill");
    expect(segmented).toContain("transform: `translateX(${activeIndex * 100}%)`");
    expect(mobileSegmented).toContain("t-tabs-pill");
    expect(mobileSegmented).toContain(
      "transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 0.25}rem))`",
    );
    expect(motion).toContain("transition: transform var(--tabs-dur) var(--tabs-ease)");
    expect(motion).not.toMatch(/\.t-tabs-pill[\s\S]{0,240}transition:[^;}]*width/);
  });

  it("keeps tooltips delayed once, then immediate, and shares disclosure motion on iOS", () => {
    const tooltip = source("src/components/ui/tooltip.tsx");
    const ios = source("src/components/app/mobile-primitives.tsx");

    expect(tooltip).toContain("delayDuration = 300");
    expect(tooltip).toContain("skipDelayDuration = 400");
    expect(motion).toContain('.t-tooltip[data-state="instant-open"]');
    expect(ios).toContain("t-ios-disclosure");
  });
});
