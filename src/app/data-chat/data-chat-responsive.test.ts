import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/data-chat/page.tsx"), "utf8");
const panelSource = readFileSync(
  join(process.cwd(), "src/app/data-chat/data-chat-panel.tsx"),
  "utf8",
);
const capabilitySource = readFileSync(
  join(process.cwd(), "src/lib/app-route-capabilities.ts"),
  "utf8",
);

describe("Data Chat workbench bundle boundary", () => {
  it("keeps the route desktop-only with a companion handoff fallback", () => {
    expect(capabilitySource).toContain(
      '"data-chat": desktopOnly(\n    "Build recommended practice"',
    );
    expect(capabilitySource).toContain('"/practice"');
    expect(source).toContain('<DesktopWorkbenchLayout scope="data-chat">');
    expect(source).toContain('data-data-chat-panel="desktop"');
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("MobileTopBar");
    expect(source).not.toContain("MobileRouteTabs");
    expect(source).not.toContain('data-data-chat-panel="mobile"');
    expect(source).not.toContain("hidden lg:");
    expect(source).not.toContain("lg:hidden");
  });

  it("keeps one desktop conversation and composer architecture", () => {
    expect(panelSource).toContain("data-data-chat-composer");
    expect(panelSource).toContain('className="h-[32rem] min-h-[22rem] rounded-lg border bg-card"');
    expect(panelSource).toContain('aria-label="Suggested Data Chat questions"');
    expect(panelSource).toContain("<Command");
    expect(panelSource).toContain("<ScrollArea");
    expect(panelSource).toContain("<InputGroup");
    expect(panelSource).not.toContain("bottom-[calc(");
    expect(panelSource).not.toContain("max-h-[46dvh]");
    expect(panelSource).not.toContain("savedAnswerWorkbench");
  });

  it("uses shadcn disclosures and semantic citation items without iOS bundle imports", () => {
    expect(panelSource).toContain("<Collapsible");
    expect(panelSource).toContain("<CollapsibleTrigger");
    expect(panelSource).toContain("<CollapsibleContent");
    expect(panelSource).toContain("<ResponsiveDetailPanel");
    expect(panelSource).toContain("<CitationItem");
    expect(panelSource).toContain('<Item variant="muted"');
    expect(panelSource).not.toContain("IOSDisclosureGroup");
    expect(panelSource).not.toContain("IOSGroupedList");
    expect(panelSource).not.toContain("@/components/app/ios-mobile");
    expect(panelSource).not.toContain("lg:hidden");
    expect(panelSource).not.toContain("hidden lg:");
  });

  it("keeps ordinary workbench surfaces on theme-aware semantic tokens", () => {
    for (const workbenchSource of [source, panelSource]) {
      expect(workbenchSource).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(workbenchSource).not.toMatch(/(?:bg|text|border)-(?:white|slate|zinc|gray)-/);
      expect(workbenchSource).not.toMatch(/(?:bg|text|border)-(?:green|emerald|amber|rose|red)-/);
    }

    expect(panelSource).toContain("bg-card");
    expect(panelSource).toContain("bg-muted");
    expect(panelSource).toContain("text-primary");
  });
});
