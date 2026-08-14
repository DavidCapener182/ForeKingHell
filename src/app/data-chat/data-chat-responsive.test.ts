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

describe("Data Chat responsive boundary", () => {
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

  it("keeps one desktop conversation and a sticky workbench composer", () => {
    expect(panelSource).toContain("data-data-chat-composer");
    expect(panelSource).toContain('<ResizablePanelGroup orientation="horizontal"');
    expect(panelSource).toContain("<ResizableHandle withHandle");
    expect(panelSource).toContain('<ResizablePanel defaultSize="67" minSize="65" maxSize="70">');
    expect(panelSource).toContain('<ResizablePanel defaultSize="33" minSize="30" maxSize="35">');
    expect(panelSource).toContain("<EvidenceContextPanel");
    expect(panelSource).toContain("h-full min-h-0 min-w-0 overflow-y-auto");
    expect(panelSource).toContain('aria-label="Suggested Data Chat questions"');
    expect(panelSource).toContain("<Command");
    expect(panelSource).toContain("<ScrollArea");
    expect(panelSource).toContain("<InputGroup");
    expect(panelSource).toContain("border-t bg-card/95");
    expect(panelSource).not.toContain("max-h-[46dvh]");
  });

  it("keeps saved answers in a history sheet rather than below the conversation", () => {
    expect(panelSource).toContain("function SavedAnswersHistory");
    expect(panelSource).toContain("<Sheet>");
    expect(panelSource).toContain("<SheetTrigger asChild>");
    expect(panelSource).toContain("<SheetContent");
    expect(panelSource).not.toContain("SavedAnswersWorkbench");
    expect(panelSource).not.toContain("data-workbench-export-table");
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
