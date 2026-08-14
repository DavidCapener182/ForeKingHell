import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const mobile = readFileSync(join(root, "src/app/mobile-apple.css"), "utf8");
const premium = readFileSync(join(root, "src/components/premium.tsx"), "utf8");

describe("functional appearance modes", () => {
  it("keeps Outdoor, Range Night and Tour Broadcast as desktop-only product themes", () => {
    for (const theme of ["outdoor", "range-night", "tour-broadcast"]) {
      expect(globals).toContain(`html[data-theme="${theme}"]`);
      expect(mobile).not.toContain(`data-theme="${theme}"`);
      expect(globals).toContain(`[data-theme-swatch="${theme}"]`);
    }

    expect(mobile).not.toContain("data-theme");
    expect(mobile).not.toContain("clubhouse");
    expect(mobile).toContain("--ios-tint: #007aff");
    expect(mobile).toContain("--ios-tint: #0a84ff");

    expect(globals).toContain("--background: #fffdf4");
    expect(globals).toContain("--ring: #ff5a1f");
    expect(globals).toContain("--background: #050c08");
    expect(globals).toContain("--primary: #7ee0a3");
    expect(globals).toContain("--background: #f6f3ea");
    expect(globals).toContain("--chart-2: #2c93d4");
  });

  it("treats High Contrast as an accessibility mode", () => {
    expect(globals).toContain('html[data-theme="high-contrast"]');
    expect(mobile).not.toContain('data-theme="high-contrast"');
    expect(globals).toContain("outline: 3px solid #ffff00 !important");
    expect(globals).toContain("text-decoration: underline");
    expect(globals).toContain("min-height: 44px");
    expect(globals).toContain("stroke-dasharray: 9 5");
    expect(globals).toContain("opacity: 1");
    const highContrastBody =
      globals.match(/html\[data-theme="high-contrast"\] body \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(highContrastBody).toContain("background: var(--background)");
    expect(highContrastBody).toContain("background-image: none");
    expect(highContrastBody).not.toContain("gradient");
  });

  it("keeps shared shadcn tables readable through semantic theme tokens", () => {
    const tableRulesStart = globals.lastIndexOf("  .data-table-scroll th {");
    const tableRules = globals.slice(
      tableRulesStart,
      globals.indexOf("  .chart-frame {", tableRulesStart),
    );

    expect(tableRules).toContain("background: var(--muted)");
    expect(tableRules).toContain("color: var(--muted-foreground)");
    expect(tableRules).toContain("color: var(--foreground)");
    expect(tableRules).toContain("color-mix(in srgb, var(--muted) 58%, var(--card))");
    for (const literal of ["#f5f8ef", "#596a5f", "#111827", "#f6f8f2"]) {
      expect(tableRules).not.toContain(literal);
    }
  });

  it("keeps shared status badges and readout dots semantic across every theme", () => {
    const tones = premium.slice(
      premium.indexOf("const toneClasses"),
      premium.indexOf("export type CompactReadoutItem"),
    );

    expect(tones).toContain("var(--status-success-surface)");
    expect(tones).toContain("var(--status-information-surface)");
    expect(tones).toContain("var(--status-warning-surface)");
    expect(tones).toContain("bg-muted text-muted-foreground ring-border");
    expect(tones).not.toMatch(/(?:bg|text|ring)-(?:emerald|sky|pink|amber|slate)-/);
  });
});
