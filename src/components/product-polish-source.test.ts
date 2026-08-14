import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/product-polish.tsx"), "utf8");

describe("product polish desktop flow panels", () => {
  it("keeps workflow and proof cards readable before large-monitor layouts", () => {
    expect(source).toContain("sm:grid-cols-2 min-[1800px]:grid-cols-3 min-[2400px]:grid-cols-5");
    expect(source).not.toContain("md:grid-cols-5");
    expect(source).not.toContain("sm:grid-cols-2 xl:grid-cols-5");
    expect(source).not.toContain("sm:grid-cols-2 xl:grid-cols-3");
  });

  it("uses one flat shadcn card per public panel and item-based content", () => {
    expect(source.match(/<Card(?:\s|>)/g)).toHaveLength(3);
    expect(source.match(/data-product-polish-panel=/g)).toHaveLength(3);
    expect(source).toContain('data-product-polish-panel="proof"');
    expect(source).toContain('data-product-polish-panel="flow"');
    expect(source).toContain('data-product-polish-panel="share"');
    expect(source.match(/<Item(?:\s|>)/g)).toHaveLength(3);
    expect(source).toContain("<CardHeader");
    expect(source).toContain("<CardAction>");
    expect(source).toContain("<CardContent");
    expect(source).not.toContain("DataPanel");
    expect(source).not.toContain("SectionHeader");
    expect(source).not.toContain("StatusPill");
  });

  it("uses semantic status and surface tokens instead of a fixed light palette", () => {
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-success-border)");
    expect(source).toContain("var(--status-success-foreground)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-warning-border)");
    expect(source).toContain("var(--status-warning-foreground)");
    expect(source).toContain('variant="outline"');
    expect(source).not.toMatch(
      /(?:bg-white|border-slate-|bg-slate-|text-slate-|text-sky-|text-emerald-|bg-\[#|border-\[#|text-\[#)/,
    );
    expect(source).not.toContain("h-full rounded-lg border");
  });

  it("preserves public defaults, links, calculations and responsive share hooks", () => {
    expect(source).toContain('title = "Proof checklist"');
    expect(source).toContain('actionLabel = "Review proof"');
    expect(source).toContain('actionHref = "/settings"');
    expect(source).toContain('actionLabel = "Privacy settings"');
    expect(source).toContain('items.filter((item) => (item.status ?? "ready") === "ready").length');
    expect(source).toContain('step.status ?? (index === 0 ? "ready" : "optional")');
    expect(source).toContain("item.href ? (");
    expect(source).toContain("step.href ? (");
    expect(source).toContain("prefetch={false}");
    expect(source).toContain("ios-share-audiences grid gap-3 md:grid-cols-3");
    expect(source).toContain("ios-share-audience h-full items-start");
  });
});
