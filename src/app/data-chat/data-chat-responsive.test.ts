import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/data-chat/page.tsx"), "utf8");
const panelSource = readFileSync(
  join(process.cwd(), "src/app/data-chat/data-chat-panel.tsx"),
  "utf8",
);

describe("Data Chat responsive shell", () => {
  it("uses lg as the only paired-interface cutover and names the page accurately on mobile", () => {
    expect(source).toContain('<MobileTopBar title="Data Chat" />');
    expect(source).toContain('className="hidden lg:grid"');
    expect(source).not.toContain('className="hidden sm:grid"');
    expect(source).toContain('data-data-chat-panel="mobile"');
    expect(source).toContain('data-data-chat-panel="desktop"');
  });

  it("keeps the mobile composer reachable and bounds the conversation", () => {
    expect(source).toContain('label="Data Chat access and scope"');
    expect(source).toContain('label="Credits remaining"');
    expect(panelSource).toContain("data-data-chat-composer");
    expect(panelSource).toContain("max-h-[46dvh]");
    expect(panelSource).toContain("overscroll-contain");
    expect(panelSource).toContain("bottom-[calc(4.75rem+env(safe-area-inset-bottom))]");
    expect(panelSource).toContain('aria-label="Suggested Data Chat questions"');
    expect(panelSource).toContain("min-w-[13rem]");
  });

  it("progressively discloses answer evidence and saved answers on mobile", () => {
    expect(panelSource).toContain("function AssistantEvidenceDisclosures");
    expect(panelSource).toContain('title: "Tips and drills"');
    expect(panelSource).toContain('title: "Cited data"');
    expect(panelSource).toContain('label="Supporting Data Chat evidence"');
    expect(panelSource).toContain('title: "Saved answers"');
    expect(panelSource).toContain("<IOSDisclosureGroup");
    expect(panelSource).toContain("min-h-11");
  });
});
